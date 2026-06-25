/**
 * Shared primitives for the live "watch your page build" experience (June 2026).
 *
 * Extracted from GenerationLiveView so the sales microsite generator can reuse
 * the exact same stage model, block reconciliation, and scaled BlockRenderer
 * preview. Purely presentational/utility — no streaming or save logic lives
 * here (see generationStream.ts for the SSE client and the two callers,
 * GenerationLiveView + MicrositeGenerationLive, for orchestration).
 */
import { memo } from "react";
import { motion } from "framer-motion";
import type { PageBlock } from "@/lib/block-types";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import type { BrandConfig } from "@/lib/brand-config";
import type {
  GenerationStageId,
  GenerationReferenceFailure,
} from "@/lib/generationStream";

/** Design width the page surface renders at before being scaled down. */
export const PAGE_DESIGN_WIDTH = 1200;

// ── Stage rail model ─────────────────────────────────────────────────────────

export type StageStatus = "pending" | "active" | "done";

export interface GenerationStageDef {
  id: GenerationStageId;
  label: string;
}

/** Full marketing pipeline (with the copy critique/polish pass). The sales
 *  microsite path omits `polish` — it passes its own subset to the rail. */
export const DEFAULT_STAGE_DEFS: GenerationStageDef[] = [
  { id: "context", label: "Loading brand & content context" },
  { id: "references", label: "Studying reference pages" },
  { id: "model", label: "Designing your page with AI" },
  { id: "images", label: "Resolving page imagery" },
  { id: "polish", label: "Critiquing & polishing copy" },
  { id: "finalize", label: "Finalizing the page" },
];

/** A total status map keyed by every stage id — kept total (all 7 keys) even
 *  when a caller's rail only shows a subset (e.g. the marketing rail omits
 *  `research`), so an out-of-order event never indexes a missing key. */
export function initialStageState(): Record<GenerationStageId, StageStatus> {
  return {
    research: "pending",
    context: "pending",
    references: "pending",
    model: "pending",
    images: "pending",
    polish: "pending",
    finalize: "pending",
  };
}

export interface RefsMeta {
  scraped: string[];
  failed: GenerationReferenceFailure[];
  fromInspiration: string[];
}

// ── Block reconciliation ─────────────────────────────────────────────────────

/** Deterministic JSON stringify (sorted object keys) so an unchanged block
 *  always hashes identically across snapshots and never re-renders. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export interface LiveEntry {
  /** Stable mount key: index + block type. A snapshot that keeps the same
   *  type at the same position re-renders in place; a structural change
   *  (different type) remounts just that slot. */
  key: string;
  /** Stable-stringify hash — memo gate for the rendered block. */
  hash: string;
  block: PageBlock;
}

export function toEntry(block: unknown, index: number): LiveEntry | null {
  if (!block || typeof block !== "object") return null;
  const type = typeof (block as { type?: unknown }).type === "string"
    ? (block as { type: string }).type
    : "unknown";
  return { key: `${index}:${type}`, hash: stableStringify(block), block: block as PageBlock };
}

export function toEntries(blocks: unknown[]): LiveEntry[] {
  const out: LiveEntry[] = [];
  blocks.forEach((b, i) => {
    const e = toEntry(b, i);
    if (e) out.push(e);
  });
  return out;
}

// ── URL helper (shared by rail + receipt) ────────────────────────────────────

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ── One rendered block ───────────────────────────────────────────────────────

/** Memoized on the JSON hash so a `blocks` snapshot replacement re-renders
 *  ONLY blocks whose content actually changed — unchanged blocks keep their
 *  DOM untouched (no flicker, images keep loading). The entrance animation
 *  runs at mount only. */
export const LiveBlock = memo(
  function LiveBlock({
    block,
    brand,
    reduced,
  }: {
    block: PageBlock;
    hash: string;
    brand: BrandConfig;
    reduced: boolean;
  }) {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Live (viewer) mode: no isBuilder / onBlockChange. BlockRenderer
            wraps each block in its own error boundary, so one malformed
            streamed block can't blank the preview. Scroll-reveal animations
            are disabled — inside a scaled overflow container their viewport
            math is wrong and blocks would stay invisible. */}
        <BlockRenderer block={block} brand={brand} animationsEnabled={false} />
      </motion.div>
    );
  },
  (prev, next) =>
    prev.hash === next.hash && prev.brand === next.brand && prev.reduced === next.reduced,
);
