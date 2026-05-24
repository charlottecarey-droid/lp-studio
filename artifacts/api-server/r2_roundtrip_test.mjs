// Real R2 round-trip: PUT, GET, DELETE.
// Uses the same SDK + endpoint pattern as artifacts/api-server/src/lib/r2Storage.ts.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

console.log("Config check:");
console.log("  R2_ACCOUNT_ID:", accountId ? `${accountId.slice(0,4)}…${accountId.slice(-4)} (${accountId.length} chars)` : "MISSING");
console.log("  R2_ACCESS_KEY_ID:", accessKeyId ? `${accessKeyId.slice(0,4)}…${accessKeyId.slice(-4)} (${accessKeyId.length} chars)` : "MISSING");
console.log("  R2_SECRET_ACCESS_KEY:", secretAccessKey ? `[set, ${secretAccessKey.length} chars]` : "MISSING");
console.log("  R2_BUCKET:", bucket || "MISSING");

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("FAIL: missing credentials");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

const key = `test/round-trip-${Date.now()}.txt`;
const body = "hello";

async function run() {
  console.log(`\n[1/4] PUT s3://${bucket}/${key}`);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(body, "utf8"),
    ContentType: "text/plain",
  }));
  console.log("  ✓ PUT ok");

  console.log(`[2/4] HEAD ${key}`);
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`  ✓ HEAD ok — size=${head.ContentLength}, etag=${head.ETag}, lastModified=${head.LastModified?.toISOString()}`);

  console.log(`[3/4] GET ${key}`);
  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const fetched = await got.Body.transformToString("utf-8");
  if (fetched !== body) {
    console.error(`  ✗ GET body mismatch: expected "${body}", got "${fetched}"`);
    process.exit(2);
  }
  console.log(`  ✓ GET ok — body matches ("${fetched}")`);

  console.log(`[4/4] DELETE ${key}`);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log("  ✓ DELETE ok");

  // Verify the delete actually deleted
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.error("  ✗ HEAD after DELETE returned a body — delete didn't take");
    process.exit(3);
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      console.log("  ✓ HEAD after DELETE correctly 404s");
    } else {
      console.error("  ✗ unexpected error after DELETE:", err.name, err.message);
      process.exit(4);
    }
  }

  console.log("\n✓ R2 round-trip PASSED — credentials, bucket, and SDK all work end-to-end.");
}

run().catch((err) => {
  console.error("\n✗ R2 round-trip FAILED");
  console.error("  Error:", err.name, "—", err.message);
  if (err.$metadata) console.error("  HTTP status:", err.$metadata.httpStatusCode);
  if (err.Code) console.error("  R2 code:", err.Code);
  console.error("  Stack:", err.stack?.split("\n").slice(0, 5).join("\n"));
  process.exit(10);
});
