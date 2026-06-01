import { db, lpPagesTable } from "@workspace/db";
import { like, eq, and } from "drizzle-orm";

async function main() {
  const pages = await db
    .select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, slug: lpPagesTable.slug, status: lpPagesTable.status, blocks: lpPagesTable.blocks })
    .from(lpPagesTable)
    .where(like(lpPagesTable.slug, "%crown%"));

  console.log(`Found ${pages.length} page(s) matching slug %crown%`);
  for (const p of pages) {
    const blocks = (p.blocks as Array<{ id?: string; type?: string; props?: Record<string, unknown> }>) ?? [];
    console.log(`\n=== page id=${p.id} tenant=${p.tenantId} slug=${p.slug} status=${p.status} blocks=${blocks.length} ===`);
    blocks.forEach((b, i) => {
      const html = b?.props?.html;
      const hasHtml = typeof html === "string";
      const hasDandyPrice = hasHtml && (html as string).includes("DANDY_PRICE");
      console.log(`  [${i}] type=${b?.type} id=${b?.id} htmlLen=${hasHtml ? (html as string).length : "-"} hasDANDY_PRICE=${hasDandyPrice}`);
    });
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
