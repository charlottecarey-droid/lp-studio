import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { buildEvidence } from "../src/lib/brand-import/evidence";

const SITES: { slug: string; url: string }[] = [
  { slug: "stripe", url: "https://stripe.com" },
  { slug: "airbnb", url: "https://www.airbnb.com" },
  { slug: "royaldesign", url: "https://www.royaldesign.com" },
  { slug: "hackernews", url: "https://news.ycombinator.com" },
  { slug: "basecamp", url: "https://basecamp.com" },
  { slug: "linear", url: "https://linear.app" },
  { slug: "notion", url: "https://www.notion.so" },
  { slug: "craigslist", url: "https://www.craigslist.org" },
];

async function main(): Promise<void> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not set");
  const outDir = join(process.cwd(), "scripts", ".captured");
  mkdirSync(outDir, { recursive: true });

  for (const { slug, url } of SITES) {
    const started = Date.now();
    try {
      const ev = await buildEvidence(url, key);
      const fixture = {
        slug,
        homeUrl: ev.homeUrl,
        sampledPalette: ev.sampledPalette,
        cssVarPaletteHints: ev.cssVarPaletteHints,
        errors: ev.errors,
        hasScreenshot: !!ev.screenshotDataUrl,
      };
      writeFileSync(join(outDir, `${slug}.json`), JSON.stringify(fixture, null, 2));
      console.log(
        `[ok] ${slug} (${Date.now() - started}ms) palette=${ev.sampledPalette.length} cssVars=${ev.cssVarPaletteHints.length} shot=${!!ev.screenshotDataUrl}`,
      );
      console.log(`     palette: ${ev.sampledPalette.join(", ")}`);
      console.log(
        `     cssVars: ${ev.cssVarPaletteHints.slice(0, 12).map((v) => `${v.name}=${v.value}`).join(", ")}`,
      );
    } catch (e) {
      console.log(`[fail] ${slug}: ${String(e)}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
