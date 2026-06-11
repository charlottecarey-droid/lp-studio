/**
 * Tenant page outline (task #6) — the optional, ordered "recipe" a tenant can
 * define for how their landing pages and microsites are structured.
 *
 * Pure TS, no DOM/React/DB deps, so BOTH api-server generators (landing page +
 * microsite) and the lp-studio settings UI import the exact same model and
 * resolution logic and can never drift.
 *
 * An outline is a list of ordered STEPS. Each step is either:
 *   • a CATEGORY step  — a structural role (BlockRoleTag, e.g. "hero",
 *     "social-proof"). On generation it is filled with a brand-matched block of
 *     that role drawn from the segment's APPROVED POOL.
 *   • a BLOCK step     — a specific registered block type, forced into place.
 *
 * Steps may be freely mixed and reordered. The outline is OPTIONAL: when none is
 * configured the generator behaves as it does today (free AI choice). The
 * outline supersedes the older per-segment `micrositeBlockList`; legacy lists are
 * adapted into block-step outlines via {@link pageOutlineFromBlockList} so there
 * is one structure concept end to end.
 *
 * Graceful fallback: a CATEGORY step with no approved block for the segment is
 * skipped (or, when `required` and a structural `roleDefaults[role]` is given,
 * filled with that default) rather than breaking the page.
 */

import { type BlockRoleTag, isBlockRoleTag, resolveBlockTags } from "./block-tags";

export type PageOutlineStepKind = "category" | "block";

/**
 * One step in a page outline. `kind` discriminates:
 *   • "category" → `role` (a valid BlockRoleTag) is required; `type` ignored.
 *   • "block"    → `type` (a registered block type) is required; `role` ignored.
 * `schemaHint` is an optional prop-shape hint passed to the AI for a forced
 * block (parity with the legacy block-list entry). `required` defaults to true;
 * an unsatisfiable required category still falls back gracefully (it is never
 * allowed to break the page).
 */
export interface PageOutlineStep {
  kind: PageOutlineStepKind;
  role?: string;
  type?: string;
  schemaHint?: string;
  required?: boolean;
}

export interface PageOutline {
  steps: PageOutlineStep[];
}

/**
 * Sanitize arbitrary stored/user input into a clean {@link PageOutline}, or
 * `null` when there is nothing usable. Invalid steps are dropped (fail-closed):
 * a category step needs a valid role tag; a block step needs a non-empty type.
 * `required` is normalized to an explicit boolean (default true).
 */
export function normalizePageOutline(raw: unknown): PageOutline | null {
  if (!raw || typeof raw !== "object") return null;
  const stepsRaw = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(stepsRaw)) return null;
  const steps: PageOutlineStep[] = [];
  for (const s of stepsRaw) {
    if (!s || typeof s !== "object") continue;
    const kind = (s as { kind?: unknown }).kind;
    const required = (s as { required?: unknown }).required === false ? false : true;
    const schemaHintRaw = (s as { schemaHint?: unknown }).schemaHint;
    const schemaHint =
      typeof schemaHintRaw === "string" && schemaHintRaw.trim()
        ? schemaHintRaw.trim()
        : undefined;
    if (kind === "category") {
      const role = (s as { role?: unknown }).role;
      if (typeof role !== "string" || !isBlockRoleTag(role.trim())) continue;
      steps.push({ kind: "category", role: role.trim(), required, ...(schemaHint ? { schemaHint } : {}) });
    } else if (kind === "block") {
      const type = (s as { type?: unknown }).type;
      if (typeof type !== "string" || !type.trim()) continue;
      steps.push({ kind: "block", type: type.trim(), required, ...(schemaHint ? { schemaHint } : {}) });
    }
  }
  return steps.length ? { steps } : null;
}

/** True when the outline has at least one step. */
export function outlineHasSteps(outline: PageOutline | null | undefined): boolean {
  return !!outline?.steps?.length;
}

/**
 * Adapt a legacy block-list (the older per-segment / brand-default
 * `micrositeBlockList`) into an equivalent outline of forced BLOCK steps. Blank
 * types are dropped. Returns `null` when nothing usable remains.
 */
export function pageOutlineFromBlockList(
  list: ReadonlyArray<{ type?: string; schemaHint?: string }> | null | undefined,
): PageOutline | null {
  if (!Array.isArray(list)) return null;
  const steps: PageOutlineStep[] = [];
  for (const entry of list) {
    const type = (entry?.type ?? "").trim();
    if (!type) continue;
    const schemaHint =
      typeof entry?.schemaHint === "string" && entry.schemaHint.trim()
        ? entry.schemaHint.trim()
        : undefined;
    steps.push({ kind: "block", type, required: true, ...(schemaHint ? { schemaHint } : {}) });
  }
  return steps.length ? { steps } : null;
}

/**
 * The effective outline for one level: the new `pageOutline` when present, else
 * the legacy block-list adapted into block steps, else `null`. Lets callers
 * compute segment-level and brand-level effective outlines uniformly so the new
 * outline always supersedes the legacy list.
 */
export function effectiveOutline(input: {
  outline?: PageOutline | null;
  legacyBlockList?: ReadonlyArray<{ type?: string; schemaHint?: string }> | null;
}): PageOutline | null {
  const norm = normalizePageOutline(input.outline);
  if (norm) return norm;
  return pageOutlineFromBlockList(input.legacyBlockList ?? null);
}

export interface ResolvedOutlineBlock {
  /** Concrete (caller-canonicalized) block type to emit. */
  type: string;
  /** Optional prop-shape hint carried from a forced block step. */
  schemaHint?: string;
  /** For category-resolved blocks, the role they were matched for. */
  role?: string;
  /** True when this block came from a category step (drawn from the pool). */
  fromCategory: boolean;
}

export interface ResolvePageOutlineOptions {
  /** Approved block-type pool for the segment (category steps draw from this). */
  pool?: readonly string[];
  /** Resolve a block type's role tags. Defaults to {@link resolveBlockTags}. */
  rolesOf?: (type: string) => readonly string[];
  /** Normalize a type to its canonical form. Defaults to a trim. */
  canonicalize?: (type: string) => string;
  /** Structural defaults to satisfy a REQUIRED category with no pool match
   *  (e.g. { hero: "hero", cta: "bottom-cta", footer: "footer" }). */
  roleDefaults?: Partial<Record<string, string>>;
  /** Tiebreak ranking among multiple pool matches (lower = picked earlier). */
  rank?: (type: string) => number;
}

/**
 * Resolve an outline into an ordered list of concrete blocks, respecting order:
 *   • BLOCK step    → forced (its exact type).
 *   • CATEGORY step → a block of that role drawn from `pool` (best by `rank`,
 *     preferring a type not already used). When the pool has no match: a
 *     `roleDefaults[role]` fills a REQUIRED step, otherwise the step is skipped
 *     gracefully. Optional steps are always skipped when unmatched.
 * Returns [] for an empty/absent outline.
 */
export function resolvePageOutline(
  outline: PageOutline | null | undefined,
  opts: ResolvePageOutlineOptions = {},
): ResolvedOutlineBlock[] {
  if (!outline?.steps?.length) return [];
  const canon = opts.canonicalize ?? ((t: string) => t.trim());
  const rolesOf = opts.rolesOf ?? ((t: string) => resolveBlockTags(t));
  const roleDefaults = opts.roleDefaults ?? {};
  const pool: string[] = [];
  const poolSeen = new Set<string>();
  for (const raw of opts.pool ?? []) {
    const t = canon(raw);
    if (t && !poolSeen.has(t)) {
      poolSeen.add(t);
      pool.push(t);
    }
  }
  const out: ResolvedOutlineBlock[] = [];
  const used = new Set<string>();
  for (const step of outline.steps) {
    if (step.kind === "block") {
      const t = canon(step.type ?? "");
      if (!t) continue;
      out.push({ type: t, fromCategory: false, ...(step.schemaHint ? { schemaHint: step.schemaHint } : {}) });
      used.add(t);
      continue;
    }
    const role = (step.role ?? "").trim();
    if (!role) continue;
    const candidates = pool.filter((t) => (rolesOf(t) as readonly string[]).includes(role));
    let pick: string | undefined;
    if (candidates.length) {
      const ranked = opts.rank
        ? [...candidates].sort((a, b) => opts.rank!(a) - opts.rank!(b))
        : candidates;
      pick = ranked.find((t) => !used.has(t)) ?? ranked[0];
    }
    if (!pick && step.required !== false) {
      const fallback = roleDefaults[role];
      if (fallback) pick = canon(fallback);
    }
    if (!pick) continue;
    out.push({ type: pick, role, fromCategory: true });
    used.add(pick);
  }
  return out;
}
