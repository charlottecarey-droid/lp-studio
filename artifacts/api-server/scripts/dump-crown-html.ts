import { db, lpPagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { writeFileSync } from "fs";

async function main() {
  const [p] = await db
    .select({ blocks: lpPagesTable.blocks })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.id, 252));
  if (!p) throw new Error("page 252 not found");
  const blocks = p.blocks as Array<{ id?: string; type?: string; props?: { html?: string } }>;
  const html = blocks[0]?.props?.html ?? "";
  writeFileSync("/tmp/crown-current.html", html, "utf8");
  console.log(`Wrote ${html.length} chars to /tmp/crown-current.html`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
