import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ACL_METADATA_KEY,
  getObjectAclPolicy,
  tenantOwnerKey,
  type ObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR env var is not set");
  return dir;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  if (parts.length < 3) throw new Error("Invalid object path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

export interface UploadObjectOptions {
  /**
   * When set, the upload is tagged with an ACL policy whose owner is the
   * given tenant id. The serve route refuses cross-tenant reads for any
   * object that carries a tenant-owner ACL.
   */
  tenantId?: number;
}

export class ObjectStorageService {
  async uploadObjectEntity(
    buffer: Buffer,
    contentType: string,
    opts: UploadObjectOptions = {},
  ): Promise<string> {
    const objectId = randomUUID();
    let dir = getPrivateObjectDir();
    if (!dir.endsWith("/")) dir = `${dir}/`;
    const { bucketName, objectName } = parseObjectPath(`${dir}uploads/${objectId}`);
    const file = storageClient.bucket(bucketName).file(objectName);

    const customMetadata: Record<string, string> = {};
    if (opts.tenantId != null) {
      const policy: ObjectAclPolicy = {
        owner: tenantOwnerKey(opts.tenantId),
        visibility: "private",
      };
      customMetadata[ACL_METADATA_KEY] = JSON.stringify(policy);
    }

    const saveOpts: Parameters<typeof file.save>[1] = {
      contentType,
      resumable: false,
    };
    if (Object.keys(customMetadata).length > 0) {
      saveOpts.metadata = { metadata: customMetadata };
    }

    await file.save(buffer, saveOpts);
    return `/objects/uploads/${objectId}`;
  }

  /**
   * Delete a stored object given its serve path (e.g. "/objects/uploads/<id>").
   * Best-effort: silently ignores a path that doesn't point at a stored object
   * and treats an already-missing file as success, so callers can reclaim
   * storage on row delete without worrying about double-deletes or external URLs.
   */
  async deleteObjectEntity(objectPath: string): Promise<void> {
    if (!objectPath.startsWith("/objects/")) return;
    const entityId = objectPath.slice("/objects/".length);
    let dir = getPrivateObjectDir();
    if (!dir.endsWith("/")) dir = `${dir}/`;
    const { bucketName, objectName } = parseObjectPath(`${dir}${entityId}`);
    const file = storageClient.bucket(bucketName).file(objectName);
    await file.delete({ ignoreNotFound: true });
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const entityId = objectPath.slice("/objects/".length);
    let dir = getPrivateObjectDir();
    if (!dir.endsWith("/")) dir = `${dir}/`;
    const { bucketName, objectName } = parseObjectPath(`${dir}${entityId}`);
    const file = storageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  async getObjectAclPolicy(file: File): Promise<ObjectAclPolicy | null> {
    return getObjectAclPolicy(file);
  }

  async downloadObject(file: File, cacheTtlSec = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";
    const stream = Readable.toWeb(file.createReadStream()) as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    // Set Content-Length if size is known; otherwise use chunked transfer encoding
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    } else {
      headers["Transfer-Encoding"] = "chunked";
    }
    return new Response(stream, { headers });
  }
}
