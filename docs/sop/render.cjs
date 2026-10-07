const path = require("path");
const p = require(process.argv[2]);
(async () => {
  const b = await p.chromium.launch();
  const pg = await b.newPage();
  await pg.goto("file://" + path.resolve(process.argv[3]), { waitUntil: "load" });
  await pg.pdf({ path: process.argv[4], format: "Letter", printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log("pdf written");
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
