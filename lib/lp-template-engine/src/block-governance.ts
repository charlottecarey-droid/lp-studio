/**
 * Tenant block governance — the SINGLE documented precedence model that ties
 * together the four block-visibility / AI-vocabulary systems (task #4).
 *
 * Pure TS, no DOM/React/DB deps, so BOTH the api-server generator and the
 * lp-studio builder import the exact same resolution logic and can never drift.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE PRECEDENCE ORDER (who wins on conflict)
 * ─────────────────────────────────────────────────────────────────────────
 * Inputs to a resolution: (tenant, industry, blockType, segmentId?, audience?).
 * The four layers, highest-priority first:
 *
 *   1. Superadmin industry catalog kill-switch — `block_catalog.is_enabled`.
 *      An explicit `false` makes the block UNAVAILABLE for that industry. This
 *      is absolute: no tenant setting can resurrect a superadmin-killed block.
 *
 *   2. Tenant governance `enabled` (NEW, this table). An explicit `false`
 *      makes the block unavailable for that tenant. `null`/absent = inherit
 *      (available). Tenants can only REMOVE blocks the superadmin allows, they
 *      cannot add ones the superadmin killed (layer 1 already excluded them).
 *
 *   3. Tenant library prefs `hiddenBlockTypes` — the existing cosmetic
 *      "hide from my picker" list. Membership hides the block.
 *
 *   4. Otherwise AVAILABLE.
 *
 * Fail-open: a missing catalog row, a missing governance row, and an empty
 * prefs object all resolve to AVAILABLE — so a tenant with zero governance
 * rows behaves exactly as it does today.
 *
 * Orthogonal filters (applied AFTER availability, never override it):
 *   • Audience gating (leadership vs practice) — display filter for which
 *     blocks show on a given audience page. Unchanged by this module.
 *
 * Derived facets:
 *   • Segment membership — a block belongs to a brand segment iff the tenant
 *     governance row lists that segmentId in `segments`. Drives the segment
 *     tab, the segment library, and the insert-blocks modal.
 *   • AI eligibility — available (layers 1–2) AND superadmin `ai_enabled`
 *     is not `false` AND governance `enabled` is not `false`.
 *   • AI block vocabulary — base curated set ∪ superadmin `approved_segments`
 *     ∪ tenant governance segment approvals (EXPAND), minus governance-disabled
 *     types (CONSTRAIN). Expansion matches the established additive contract;
 *     constraint lets a tenant pull a block out of generation by disabling it.
 *   • AI mode — `noai` (human-only: the block stays AVAILABLE in the builder so
 *     a human can drag it in, but the AI must NEVER choose or generate it — it
 *     is excluded from the AI block vocabulary and any AI-emitted instance is
 *     dropped), `locked` (place only: reset to default props, no copy/image
 *     changes), `copy` (rewrite text but keep default/approved images), or
 *     `open` (today's full behaviour). Absent governance row ⇒ `open`.
 */

export type AiMode = "noai" | "locked" | "copy" | "open";

export const AI_MODES: readonly AiMode[] = ["noai", "locked", "copy", "open"] as const;

/** Fail-open default: an un-governed block behaves exactly as it does today. */
export const DEFAULT_AI_MODE: AiMode = "open";

/**
 * One tenant governance entry, one per (tenant, blockType). `enabled === null`
 * / `undefined` means "inherit" (available); only an explicit `false` hides.
 */
export interface TenantBlockGovernanceEntry {
  blockType: string;
  /** null/undefined = inherit (available); false = tenant-disabled. */
  enabled: boolean | null;
  aiMode: AiMode;
  /** Brand-segment ids this block is approved for (may be empty). */
  segments: string[];
}

export type GovernanceMap = Map<string, TenantBlockGovernanceEntry>;

/** Coerce any input into a valid AiMode, defaulting to `open` (fail-open). */
export function sanitizeAiMode(v: unknown): AiMode {
  return v === "noai" || v === "locked" || v === "copy" || v === "open" ? v : DEFAULT_AI_MODE;
}

/**
 * True when the block is human-only: available in the builder, but the AI must
 * never choose or generate it. Drives BOTH halves of enforcement — exclusion
 * from the AI vocabulary at prompt-build time and removal of any AI-emitted
 * instance after generation. Independent of `enabled` (a `noai` block stays
 * builder-available unless separately disabled).
 */
export function isAiNoGenerate(governance?: TenantBlockGovernanceEntry): boolean {
  return governance?.aiMode === "noai";
}

/**
 * Normalize one raw governance entry (DB row or client payload) into a clean
 * `TenantBlockGovernanceEntry`. Returns null when the blockType is missing so
 * callers can skip junk rows.
 */
export function sanitizeGovernanceEntry(raw: unknown): TenantBlockGovernanceEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const blockType = typeof o.blockType === "string" ? o.blockType.trim() : "";
  if (!blockType || blockType.length > 200) return null;
  let enabled: boolean | null = null;
  if (o.enabled === true || o.enabled === false) enabled = o.enabled;
  const segments = Array.isArray(o.segments)
    ? Array.from(
        new Set(
          o.segments
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0 && s.length <= 200)
            .map(s => s.trim()),
        ),
      )
    : [];
  return { blockType, enabled, aiMode: sanitizeAiMode(o.aiMode), segments };
}

/** Build a blockType → entry map from raw rows/entries, skipping junk. */
export function governanceMapFromRows(rows: readonly unknown[] | null | undefined): GovernanceMap {
  const map: GovernanceMap = new Map();
  for (const r of rows ?? []) {
    const e = sanitizeGovernanceEntry(r);
    if (e) map.set(e.blockType, e);
  }
  return map;
}

/** Inputs needed to resolve a block's builder availability (layers 1–3). */
export interface AvailabilityInput {
  /** Superadmin `block_catalog.is_enabled`. undefined = no catalog row. */
  catalogEnabled?: boolean;
  /** Tenant governance entry for this block, if any. */
  governance?: TenantBlockGovernanceEntry;
  /** Tenant library prefs `hiddenBlockTypes`. */
  hiddenBlockTypes?: ReadonlySet<string> | readonly string[];
  blockType: string;
}

function hiddenHas(
  hidden: AvailabilityInput["hiddenBlockTypes"],
  type: string,
): boolean {
  if (!hidden) return false;
  return hidden instanceof Set ? hidden.has(type) : (hidden as readonly string[]).includes(type);
}

/**
 * Layer 1–3 of the precedence model. Returns true when the block is available
 * in the builder for this tenant. Fail-open on every missing input.
 */
export function resolveBlockAvailable(input: AvailabilityInput): boolean {
  // 1. Superadmin kill-switch is absolute.
  if (input.catalogEnabled === false) return false;
  // 2. Tenant governance opt-out.
  if (input.governance?.enabled === false) return false;
  // 3. Cosmetic hide list.
  if (hiddenHas(input.hiddenBlockTypes, input.blockType)) return false;
  return true;
}

/** Resolve a block's AI mode (governance, default `open`). */
export function resolveAiMode(governance?: TenantBlockGovernanceEntry): AiMode {
  return governance ? governance.aiMode : DEFAULT_AI_MODE;
}

/** Brand-segment ids a block is approved for (governance, empty when absent). */
export function resolveBlockSegments(governance?: TenantBlockGovernanceEntry): string[] {
  return governance?.segments ?? [];
}

/** True when the block is approved for the given brand segment. */
export function isBlockApprovedForSegment(
  governance: TenantBlockGovernanceEntry | undefined,
  segmentId: string,
): boolean {
  if (!segmentId) return false;
  return !!governance?.segments?.includes(segmentId);
}

/**
 * The segment-approval POOL from tenant governance: every block type the tenant
 * has approved for `segmentId` that is not tenant-disabled (`enabled !== false`).
 * This is the EXPAND half of the AI vocabulary — superadmin `approved_segments`
 * is unioned on top by the caller. Map keys are stored canonical, so the
 * returned types are canonical too; callers may canonicalize defensively.
 *
 * Returns [] for a blank segmentId or an empty map (fail-open: no approvals ⇒
 * generation falls back to its base vocabulary / curated list).
 */
export function blocksApprovedForSegment(
  map: GovernanceMap,
  segmentId: string,
): string[] {
  const id = (segmentId ?? "").trim();
  if (!id) return [];
  const out: string[] = [];
  for (const [type, entry] of map) {
    // A human-only (`noai`) block is never offered to the AI, even when the
    // tenant has approved it for this segment — it stays a builder-only block.
    if (entry.aiMode === "noai") continue;
    if (entry.enabled !== false && entry.segments.includes(id)) out.push(type);
  }
  return out;
}

/**
 * AI eligibility (layer applied to generation): a block may be generated only
 * when it is available AND not AI-disabled by the superadmin AND not disabled
 * by tenant governance. `catalogAiEnabled === false` excludes; undefined =
 * fail-open (eligible).
 */
export function resolveAiEligible(input: {
  catalogEnabled?: boolean;
  catalogAiEnabled?: boolean;
  governance?: TenantBlockGovernanceEntry;
  hiddenBlockTypes?: ReadonlySet<string> | readonly string[];
  blockType: string;
}): boolean {
  if (!resolveBlockAvailable(input)) return false;
  if (input.catalogAiEnabled === false) return false;
  // Human-only governance: available in the builder, but never AI-eligible.
  if (input.governance?.aiMode === "noai") return false;
  return true;
}
