/**
 * Content Hub — attach downloaded files to a hub page's resources.
 *
 * Highspot's public viewer refuses automated browsers, so the files are
 * downloaded by hand (Highspot → Download on each item) into a folder, named
 * by the resource's analytics key (see `--list`). This script then uploads
 * each file into LP Studio's object storage, registers it in the tenant's
 * media library, and sets `fileUrl` (PDF) / `videoUrl` (video) on the
 * matching resource of the page — so the card opens it in the in-page viewer
 * and grows a download button. The Highspot link stays on the resource as
 * the fallback.
 *
 * Run from artifacts/api-server (needs DATABASE_URL + object storage env,
 * i.e. the Replit shell):
 *
 *   npx tsx src/scripts/hub-attach-assets.ts --tenant 68450 --page dentists --list
 *   npx tsx src/scripts/hub-attach-assets.ts --tenant 68450 --page dentists --dir ../../hub-assets/dentists --dry-run
 *   npx tsx src/scripts/hub-attach-assets.ts --tenant 68450 --page dentists --dir ../../hub-assets/dentists
 *
 * Matching: a file named `<key>.pdf` / `<key>.mp4` (any case, `_` and spaces
 * treated as `-`) attaches to the resource with that key; a file named after
 * the resource's title works too. Unmatched files and resources are listed,
 * never guessed. Already-hosted resources are skipped unless `--replace`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { db, pool, lpPagesTable, lpMediaTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";

type Asset = { key?: string; kind: "pdf" | "video" | "link" | "image" | "text"; title: string; fileUrl?: string; videoUrl?: string; externalUrl?: string; body?: string };
type Section = { title?: string; items?: Asset[] };
type Block = { id: string; type: string; props: Record<string, unknown> & { sections?: Section[]; asset?: Asset } };

const MIME: Record<string, string> = { ".pdf": "application/pdf", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4v": "video/x-m4v", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const kindOfMime = (mime: string): "pdf" | "video" | "image" => (mime === "application/pdf" ? "pdf" : mime.startsWith("image/") ? "image" : "video");
const MAX_PDF = 50 * 1024 * 1024;
const MAX_VIDEO = 500 * 1024 * 1024;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
const keyOf = (a: Asset) => (a.key ?? "").trim() || slugify(a.title) || a.kind;
const hosted = (a: Asset) => (a.kind === "pdf" || a.kind === "image" ? (a.fileUrl ?? "").trim() : a.kind === "video" ? (a.videoUrl ?? "").trim() : "x");

/** Every pdf / video resource on the page with where it lives in `blocks`. */
function collect(blocks: Block[]): Array<{ asset: Asset; set: (url: string) => void; where: string }> {
  const out: Array<{ asset: Asset; set: (url: string) => void; where: string }> = [];
  for (const b of blocks) {
    const isFile = (a: Asset) => a.kind === "pdf" || a.kind === "video" || a.kind === "image";
    if (b.type === "hub-featured" && b.props.asset && isFile(b.props.asset)) {
      const a = b.props.asset;
      out.push({ asset: a, where: `${b.type}`, set: (url) => { if (a.kind === "video") a.videoUrl = url; else a.fileUrl = url; } });
    }
    if (b.type === "hub-library") {
      for (const s of b.props.sections ?? []) {
        for (const a of s.items ?? []) {
          if (!isFile(a)) continue;
          out.push({ asset: a, where: `${b.type} › ${s.title ?? "section"}`, set: (url) => { if (a.kind === "video") a.videoUrl = url; else a.fileUrl = url; } });
        }
      }
    }
  }
  return out;
}

async function main() {
  const tenantId = Number(arg("tenant"));
  const slug = arg("page");
  const dir = arg("dir");
  if (!tenantId || !slug) {
    console.error("usage: --tenant <id> --page <slug> (--list | --dir <folder> [--dry-run] [--replace])");
    process.exit(1);
  }
  const [page] = await db
    .select({ id: lpPagesTable.id, title: lpPagesTable.title, blocks: lpPagesTable.blocks })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, slug)))
    .limit(1);
  if (!page) {
    console.error(`No page "${slug}" in tenant ${tenantId}`);
    process.exit(1);
  }
  const blocks = JSON.parse(JSON.stringify(page.blocks)) as Block[];
  const resources = collect(blocks);

  if (flag("list") || !dir) {
    console.log(`\n${page.title} (page ${page.id}) — ${resources.length} pdf/video resources\n`);
    console.log("Save each download as the file name below, then run with --dir.\n");
    for (const r of resources) {
      const k = keyOf(r.asset);
      const ext = r.asset.kind === "pdf" ? ".pdf" : r.asset.kind === "image" ? ".png" : ".mp4";
      const status = hosted(r.asset) ? "hosted ✓" : "MISSING";
      console.log(`${status.padEnd(9)} ${(k + ext).padEnd(34)} ${r.asset.title}\n          ${r.asset.externalUrl ?? "(no Highspot link)"}`);
    }
    return;
  }

  const folder = resolve(dir);
  const files = readdirSync(folder).filter((f) => MIME[extname(f).toLowerCase()]);
  const byName = new Map<string, string>();
  for (const f of files) byName.set(slugify(basename(f, extname(f))), join(folder, f));

  const storage = new ObjectStorageService();
  const dryRun = flag("dry-run");
  const replace = flag("replace");
  let attached = 0;
  const unmatchedFiles = new Set(files);

  for (const r of resources) {
    const k = keyOf(r.asset);
    const candidates = [k, slugify(r.asset.title)];
    const path = candidates.map((c) => byName.get(c)).find(Boolean);
    if (!path) {
      console.log(`– no file for      ${k.padEnd(30)} ${r.asset.title}${hosted(r.asset) ? "  (already hosted)" : ""}`);
      continue;
    }
    unmatchedFiles.delete(basename(path));
    if (hosted(r.asset) && !replace) {
      console.log(`· already hosted   ${k.padEnd(30)} (pass --replace to overwrite)`);
      continue;
    }
    const ext = extname(path).toLowerCase();
    const mime = MIME[ext];
    const isPdf = mime === "application/pdf";
    if (kindOfMime(mime) !== r.asset.kind) {
      console.log(`! kind mismatch    ${k.padEnd(30)} file is ${ext} but resource is ${r.asset.kind}`);
      continue;
    }
    const size = statSync(path).size;
    if (size > (kindOfMime(mime) === "video" ? MAX_VIDEO : MAX_PDF)) {
      console.log(`! too large        ${k.padEnd(30)} ${(size / 1e6).toFixed(1)} MB`);
      continue;
    }
    const buffer = readFileSync(path);
    if (isPdf && buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      console.log(`! not a PDF        ${k.padEnd(30)} ${basename(path)}`);
      continue;
    }
    if (dryRun) {
      console.log(`✓ would attach     ${k.padEnd(30)} ${basename(path)} (${(size / 1e6).toFixed(1)} MB)`);
      attached++;
      continue;
    }
    const servePath = await storage.uploadObjectEntity(buffer, mime, { tenantId });
    const url = `/api/storage${servePath}`;
    await db.insert(lpMediaTable).values({
      tenantId,
      title: r.asset.title,
      url,
      mediaType: kindOfMime(mime),
      mimeType: mime,
      sizeBytes: size,
      tags: ["content-hub", slug],
    });
    r.set(url);
    attached++;
    console.log(`✓ attached         ${k.padEnd(30)} ${basename(path)} → ${url}`);
  }

  for (const f of unmatchedFiles) console.log(`? unmatched file   ${f} — name it <key>.pdf / <key>.mp4 (see --list)`);

  if (!dryRun && attached > 0) {
    await db.update(lpPagesTable).set({ blocks, updatedAt: new Date() }).where(eq(lpPagesTable.id, page.id));
    console.log(`\nSaved ${attached} resource${attached === 1 ? "" : "s"} on "${page.title}". The live page serves them on its next load.`);
  } else {
    console.log(`\n${dryRun ? "Dry run" : "Nothing to save"} — ${attached} match${attached === 1 ? "" : "es"}.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void pool.end());
