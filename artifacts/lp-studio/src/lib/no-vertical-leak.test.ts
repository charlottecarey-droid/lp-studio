/**
 * Placeholder / helper-text leak guard.
 *
 * The existing no-dandy-leak specs scan RENDERED pages for Dandy URLs, asset
 * paths and brand COLOURS. That misses the class of leak this pins: the words
 * themselves, sitting in placeholders, hints and sample values that every
 * tenant sees — "Acme Dental" in the new-workspace modal, "e.g. Dandy Hub,
 * Dandy Insights" under a Brand Settings field, "Acme DSO" on the one-pager
 * templates page. Colour-driven scans can't catch those because the copy is
 * static and the colours were already brand-correct.
 *
 * SCOPE: only the chrome a non-dental tenant is shown — settings, modals,
 * builder panels, the sales console. Deliberately NOT scanned:
 *   - Dandy-gated content (isDandy branches, BlockDandy / BlockDso components,
 *     the dental block catalog) — that's Dandy's own tenant content, correct
 *     as-is.
 *   - SuperAdmin screens — Dandy staff only, where "dental" is a real
 *     industry category they administer.
 *   - Tests and fixtures.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..");

/** Files a non-dental tenant's admin/rep actually sees. */
const SCANNED_DIRS = [
  "pages/settings",
  "pages/sales",
  "components/layout",
  "pages/builder/property-panels",
];
const SCANNED_FILES = [
  "pages/brand-settings.tsx",
  "components/AudienceBuilderModal.tsx",
  "components/QuickCampaignWizard.tsx",
  "components/PersonalizedLinksPanel.tsx",
  "components/ImagePicker.tsx",
  "components/builder/AdCopyDialog.tsx",
  "pages/builder/BuilderEditor.tsx",
];

/** Vertical-specific words that must not appear in shared chrome copy. */
const LEAKS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "Dandy product names", re: /\bDandy (?:Hub|Insights|Portal|Reviews)\b/i },
  { label: "dental sample company", re: /\b(?:Acme|Apex|Pacific|Bright)\s+Dental\b/i },
  { label: "DSO jargon", re: /\bDSOs?\b/ },
  { label: "dental practice jargon", re: /\b(?:chairside|operatory|dentures?|orthodontic|dentists?)\b/i },
];

/** Lines that are legitimately allowed to mention these — see SCOPE above. */
const ALLOWED_LINE = new RegExp([
  "isDandy", "BlockDandy", "BlockDso", "dandy-", "meetdandy",
  "dsoName", "dso-practices", "dso_name", "\\{dso\\}",
  "^\\s*(?://|\\*|/\\*)",              // comments
  "^\\s*[{\\w\"']+[\\s\\w\"']*:",           // object-literal data (Dandy-gated default content)
  "Categories|n\\.includes",           // block-category taxonomy + its inference
  "^\\s*\"",                            // bare string entries in a data array
  "//",                                // trailing/inline comments
  "console\\.",                        // log messages, not UI copy
  "knownNonCore|preferredOrder",       // block-CATEGORY taxonomy: the names come
                                       // from the block_catalog rows, so renaming
                                       // them is a data change, not a code one.
                                       // Flagged separately.
].join("|"));

/**
 * The ROI calculator is a dental tool end to end — it models remakes, chair
 * time and denture production, and its non-Dandy branch still says "across
 * your practices". Neutralising the WORDS would be worse than leaving them:
 * the page would read generic while computing dental economics. It needs an
 * industry gate (hide the nav entry for non-dental tenants), which is a
 * product decision, so it's excluded here rather than silently reworded.
 */
const KNOWN_VERTICAL_TOOLS = [
  "sales-roi-calculator.tsx",
  // Property panels for the dental-specific blocks themselves (BlockDso*,
  // BlockDandy*). A panel that edits a "DSO practice nav" block is correctly
  // dental — it only appears when that block is on the canvas. PropertyPanel
  // is excluded for the same reason: it's one very large file mixing generic
  // panels with the dental blocks' own, and a line-level scan can't separate
  // them honestly.
  "DsoPracticeNavPanel.tsx",
  // The in-app sales guide DOCUMENTS the vertical tools above (it explains the
  // denture/ROI models), so it inherits their exclusion.
  "sales-guide.tsx",
  "PropertyPanel.tsx",
];

/** Blank out comments so prose ABOUT the dental blocks isn't mistaken for UI
 *  copy, while keeping line numbers intact for the failure message. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) { walk(full, out); continue; }
    if (!/\.tsx?$/.test(e) || /\.test\.tsx?$/.test(e)) continue;
    if (KNOWN_VERTICAL_TOOLS.some((k) => full.endsWith(k))) continue;
    out.push(full);
  }
  return out;
}

const files = [
  ...SCANNED_DIRS.flatMap((d) => walk(join(SRC, d))),
  ...SCANNED_FILES.map((f) => join(SRC, f)),
];

describe("shared chrome carries no vertical-specific copy", () => {
  it("scans a non-trivial number of files (guards against a broken glob)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const { label, re } of LEAKS) {
    it(`no ${label} in placeholders, hints or sample values`, () => {
      const hits: string[] = [];
      for (const file of files) {
        const lines = stripComments(readFileSync(file, "utf8")).split("\n");
        lines.forEach((line, i) => {
          if (ALLOWED_LINE.test(line)) return;
          if (re.test(line)) hits.push(`${relative(SRC, file)}:${i + 1}  ${line.trim().slice(0, 110)}`);
        });
      }
      expect(hits).toEqual([]);
    });
  }
});
