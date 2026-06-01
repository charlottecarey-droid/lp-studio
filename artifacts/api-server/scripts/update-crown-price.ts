import { db, lpPagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { readFileSync, writeFileSync } from "fs";
import { renderAndStoreNow } from "../src/lib/triggerPublishedRender";

const PAGE_ID = 252;

async function main() {
  const newHtml = readFileSync("/tmp/crown-current.html", "utf8");

  // Sanity-gate the edited markup before touching prod.
  if (newHtml.includes("DANDY_PRICE")) throw new Error("edited HTML still contains DANDY_PRICE constant");
  if (!newHtml.includes('id="aDandyPrice"')) throw new Error("edited HTML missing aDandyPrice input");
  if (!newHtml.includes("A.dandyPrice()")) throw new Error("edited HTML missing live dandyPrice read");
  if (newHtml.length < 50000) throw new Error(`edited HTML suspiciously short: ${newHtml.length}`);

  const [page] = await db
    .select({ id: lpPagesTable.id, slug: lpPagesTable.slug, tenantId: lpPagesTable.tenantId, status: lpPagesTable.status, blocks: lpPagesTable.blocks })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, PAGE_ID));
  if (!page) throw new Error(`page ${PAGE_ID} not found`);
  console.log(`Page ${page.id} slug=${page.slug} tenant=${page.tenantId} status=${page.status}`);

  const blocks = page.blocks as Array<{ id?: string; type?: string; props?: { html?: string } }>;
  if (!Array.isArray(blocks) || blocks.length === 0) throw new Error("no blocks");
  const block = blocks[0];
  if (block.type !== "custom-html" || !block.props || typeof block.props.html !== "string") {
    throw new Error(`unexpected block 0: type=${block.type}`);
  }

  // Backup current prod HTML for reversibility.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `/tmp/crown-backup-${stamp}.html`;
  writeFileSync(backupPath, block.props.html, "utf8");
  console.log(`Backed up current prod HTML (${block.props.html.length} chars) to ${backupPath}`);

  if (block.props.html === newHtml) {
    console.log("No change — DB HTML already matches edited HTML. Skipping update.");
  } else {
    block.props.html = newHtml;
    await db
      .update(lpPagesTable)
      .set({ blocks })
      .where(eq(lpPagesTable.id, PAGE_ID));
    console.log(`Updated page ${PAGE_ID} blocks[0].props.html -> ${newHtml.length} chars`);
  }

  console.log("Republishing (render + R2 upload)...");
  const outcome = await renderAndStoreNow({ pageId: PAGE_ID, requestHost: "partners.meetdandy.com" });
  console.log("Render outcome:", JSON.stringify(outcome, null, 2));
  if (!outcome.r2Ok) {
    console.error("R2 NOT updated — live page still at old version. skipped=", outcome.skipped, "error=", outcome.error);
    process.exit(1);
  }
  console.log("R2 updated — live page republished.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
