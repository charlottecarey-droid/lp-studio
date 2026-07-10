/**
 * Inline-editing coverage ratchet (July 2026 consistency pass).
 *
 * Every text-bearing block must support click-to-edit on the builder canvas —
 * either by rendering InlineText directly or by composing the shared
 * section-kit (whose header/item primitives render InlineText). A block that
 * genuinely has no editable copy (containers, forms, raw-content and
 * media-only blocks) is listed in EXEMPT with the reason.
 *
 * If this test fails on a NEW block: wire InlineText for its visible text
 * (see BlockDsoSplitFeature.tsx for the idiom — field helper + array-item
 * updaters, never inside <a>/<button>, exact tag/className/style preserved)
 * and pass onFieldChange through its BlockRenderer case. Only add an EXEMPT
 * entry when the block truly has no user-editable copy.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BLOCKS_DIR = dirname(fileURLToPath(import.meta.url));

/** Files allowed to lack inline editing, with the reason they're exempt. */
const EXEMPT: Record<string, string> = {
  "BlockRenderer.tsx": "dispatcher, not a block",
  "BlockErrorBoundary.tsx": "error wrapper, renders no copy of its own",
  "BlockGrid.tsx": "layout container (childrenSlot only)",
  "BlockStack.tsx": "layout container (childrenSlot only)",
  "BlockColumns.tsx": "layout container (childrenSlot only)",
  "BlockGridPieces.tsx": "container child pieces — nested-children editing plumbing is separate",
  "BlockForm.tsx": "form fields are panel/global-form managed",
  "BlockIdForm.tsx": "form block, panel-managed",
  "BlockChatCapture.tsx": "live chat widget; builder shows a static preview card",
  "BlockPopup.tsx": "overlay shown behind a trigger, not editable in place",
  "BlockRoiCalculator.tsx": "calculator inputs/formulas are panel-managed",
  "BlockCustomHtml.tsx": "raw HTML block",
  "BlockCustomSchema.tsx": "raw JSON-LD block",
  "BlockRichText.tsx": "uses the inline Tiptap editor instead",
  "BlockSpatialTour.tsx": "scene/hotspot media experience, panel-managed",
  "BlockPhotoStrip.tsx": "images only, no copy",
  "BlockStickyHeader.tsx": "nav links only — links are clickable, never inline-edited",
};

function blockFiles(): string[] {
  return readdirSync(BLOCKS_DIR).filter(
    (f) => /^Block[A-Za-z0-9]+\.tsx$/.test(f) && !f.includes(".test."),
  );
}

function supportsInlineEditing(source: string): boolean {
  return (
    source.includes('from "@/components/InlineText"') ||
    /from "(\.\/|@\/blocks\/)shared\/section-kit"/.test(source)
  );
}

describe("inline-editing coverage", () => {
  it("every non-exempt block renders InlineText (directly or via section-kit)", () => {
    const missing = blockFiles().filter((f) => {
      if (EXEMPT[f]) return false;
      const src = readFileSync(join(BLOCKS_DIR, f), "utf8");
      return !supportsInlineEditing(src);
    });
    expect(missing, `Blocks without inline editing (wire InlineText or add an EXEMPT entry with a reason): ${missing.join(", ")}`).toEqual([]);
  });

  it("the exempt list stays honest — prune entries that now support editing", () => {
    const stale = Object.keys(EXEMPT).filter((f) => {
      let src: string;
      try {
        src = readFileSync(join(BLOCKS_DIR, f), "utf8");
      } catch {
        return true; // file deleted/renamed — prune the entry
      }
      return f !== "BlockRenderer.tsx" && supportsInlineEditing(src);
    });
    expect(stale, `EXEMPT entries no longer needed: ${stale.join(", ")}`).toEqual([]);
  });
});
