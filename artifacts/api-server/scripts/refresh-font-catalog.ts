// Refresh the bundled Google Fonts catalog. Run via:
//   pnpm --filter @workspace/api-server refresh-font-catalog
// Requires GOOGLE_FONTS_API_KEY. The output is committed so production never
// needs to call the Google API at runtime.

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

interface ApiFont {
  family: string;
  variants: string[];
  files: Record<string, string>;
}

async function main(): Promise<void> {
  const key = process.env.GOOGLE_FONTS_API_KEY;
  if (!key) {
    console.error("GOOGLE_FONTS_API_KEY not set");
    process.exit(1);
  }
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(key)}&sort=popularity`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Google Fonts API ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = (await res.json()) as { items?: ApiFont[] };
  const items = data.items ?? [];
  const fonts = items.slice(0, 800).map((f) => {
    const weights = [...new Set(f.variants
      .map((v) => v === "regular" ? 400 : v === "italic" ? 400 : parseInt(v, 10))
      .filter((n) => Number.isFinite(n)))]
      .sort((a, b) => a - b);
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, "+")}:wght@${weights.length ? weights.join(";") : "400"}&display=swap`;
    return { family: f.family, variants: f.variants, cssUrl: url };
  });
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = join(here, "../src/lib/brand-import/google-fonts.json");
  writeFileSync(outPath, JSON.stringify({ fonts }, null, 0));
  console.log(`Wrote ${fonts.length} fonts to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
