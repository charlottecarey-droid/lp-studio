/**
 * Tenant custom blocks in the AI page generator's vocabulary (July 2026).
 *
 * A tenant's block-maker creations (lp_custom_blocks, block_type='schema')
 * become placeable by the GENERAL freeform generator as
 *   { type: "custom-schema", props: { customBlockId, values } }
 * blocks. This module owns both ends:
 *
 *  - PROMPT: buildCustomBlocksPromptSection() advertises up to
 *    {@link CUSTOM_BLOCK_VOCAB_CAP} blocks with a compact field signature so
 *    the model can write `values` that fit each block's schema.
 *  - NORMALIZE: normalizeCustomSchemaBlocks() hardens whatever the model
 *    emitted — the customBlockId must resolve to one of THIS tenant's schema
 *    blocks (else the block is dropped with a warn degradation), `values` are
 *    coerced to the field schema, the master's sample backfills fields the
 *    model skipped (so a half-filled block still looks finished), and the
 *    master's schema/template are SNAPSHOTTED onto the instance so the page
 *    keeps rendering even if the master block is later deleted (the live
 *    source still wins at render time — see BlockCustomSchema / the public
 *    hydration in hydrate-custom-schema.ts).
 *
 * Deliberately scoped to the GENERAL freeform path: the template path locks
 * structure (copy-only rewrite) and the DSO paths use curated vocabularies.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";
import {
  coerceSchema,
  coerceSample,
  type SchemaFieldDef,
  type SchemaFieldValue,
  type ValidationIssue,
} from "./custom-blocks-validator";

/** Structural twin of generate-page's GenerationDegradation (type-only —
 *  importing the 11k-line module here would be a needless coupling). */
interface DegradationEntry {
  code: string;
  severity: "warn" | "info";
  detail: string;
}

export interface CustomBlockVocabEntry {
  id: number;
  name: string;
  description: string;
  schema: SchemaFieldDef[];
  template: string;
  sample: Record<string, SchemaFieldValue>;
}

/** Advertising every block a prolific tenant ever made would bloat the prompt
 *  and dilute the built-in library — the palette shows them all, the model
 *  gets the first N by the tenant's own sort order. */
export const CUSTOM_BLOCK_VOCAB_CAP = 12;

export async function fetchCustomBlockVocab(tenantId: number): Promise<CustomBlockVocabEntry[]> {
  try {
    const result = await db.execute(
      sql`SELECT id, name, props FROM lp_custom_blocks
          WHERE tenant_id = ${tenantId} AND block_type = 'schema'
          ORDER BY sort_order ASC, id ASC
          LIMIT ${CUSTOM_BLOCK_VOCAB_CAP}`,
    );
    const rows = (result.rows ?? []) as Array<{ id: number; name: string; props: unknown }>;
    return rows.map((r) => rowToVocabEntry(r)).filter((e): e is CustomBlockVocabEntry => e !== null);
  } catch (err) {
    // Fail-open: generation proceeds with the built-in library only.
    logger.warn({ err: String(err), tenantId }, "[custom-blocks-vocab] fetch failed");
    return [];
  }
}

function rowToVocabEntry(row: { id: number; name: string; props: unknown }): CustomBlockVocabEntry | null {
  const props = (row.props && typeof row.props === "object" ? row.props : {}) as Record<string, unknown>;
  const issues: ValidationIssue[] = [];
  const schema = coerceSchema(props.schema, issues);
  const template = typeof props.template === "string" ? props.template : "";
  if (schema.length === 0 || !template.trim()) return null; // unusable master
  return {
    id: Number(row.id),
    name: String(row.name ?? "").trim() || `Custom block ${row.id}`,
    description: typeof props.description === "string" ? props.description : "",
    schema,
    template,
    sample: coerceSample(props.sample, schema),
  };
}

/** Compact one-line field signature the model can write `values` against:
 *  `headline (text), quotes (list of { text, author })`. */
export function fieldSignature(schema: SchemaFieldDef[]): string {
  return schema
    .map((f) => {
      if (f.type === "list") {
        const subs = (f.itemSchema ?? []).map((s) => s.id).join(", ");
        return `${f.id} (list of { ${subs} }, 4-6 rows)`;
      }
      return `${f.id} (${f.type})`;
    })
    .join(", ");
}

/**
 * The user-prompt section advertising the tenant's custom blocks. "" when the
 * tenant has none. Pure — exported for its tests.
 */
export function buildCustomBlocksPromptSection(vocab: CustomBlockVocabEntry[]): string {
  if (vocab.length === 0) return "";
  const bullets = vocab.map((cb) => {
    const desc = cb.description ? ` — ${cb.description}` : "";
    return `- customBlockId ${cb.id} "${cb.name}"${desc}. Fields: ${fieldSignature(cb.schema)}`;
  });
  return [
    `TENANT CUSTOM BLOCKS — this brand's team designed these reusable blocks in their block library. You MAY place one where it fits the page's narrative better than a built-in block (or when the USER REQUEST names it); never force one in. Emit EXACTLY this shape:`,
    `{ "type": "custom-schema", "props": { "customBlockId": <number>, "values": { <field id>: <value per the field list> } } }`,
    `Write values for every field, matching the field types (lists = arrays of row objects with the listed sub-fields, 4-6 rows). The same copy-density rules apply as everywhere else: concrete, on-topic, no stubs.`,
    bullets.join("\n"),
  ].join("\n");
}

/**
 * Pure normalization core — exported for its tests. `sources` maps a valid
 * customBlockId to its master entry; blocks referencing anything else are
 * dropped (warn degradation). Non-custom blocks pass through untouched.
 */
export function applyCustomSchemaSources(
  blocks: unknown[],
  sources: Map<number, CustomBlockVocabEntry>,
  degradations: DegradationEntry[],
): unknown[] {
  const out: unknown[] = [];
  for (const block of blocks) {
    const b = (block && typeof block === "object" ? block : null) as Record<string, unknown> | null;
    if (!b || b.type !== "custom-schema") {
      out.push(block);
      continue;
    }
    const props = (b.props && typeof b.props === "object" ? b.props : {}) as Record<string, unknown>;
    const rawId = props.customBlockId;
    const id = typeof rawId === "number" ? rawId : typeof rawId === "string" ? Number(rawId) : NaN;
    const src = Number.isInteger(id) ? sources.get(id) : undefined;
    if (!src) {
      degradations.push({
        code: "custom_block_unresolved",
        severity: "warn",
        detail: `The model placed custom block #${String(rawId ?? "?")}, which doesn't exist in this workspace — the section was removed.`,
      });
      continue;
    }
    // Coerce the model's values to the schema, then let the master's sample
    // backfill anything skipped/empty so the block renders finished.
    const modelValues = coerceSample(props.values, src.schema);
    const values: Record<string, SchemaFieldValue> = { ...src.sample };
    for (const [k, v] of Object.entries(modelValues)) {
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      values[k] = v;
    }
    out.push({
      ...b,
      props: {
        customBlockId: src.id,
        customBlockName: src.name,
        // Snapshot so the page survives a later master deletion; the live
        // master still wins at render when it exists.
        schema: src.schema,
        template: src.template,
        values,
      },
    });
  }
  return out;
}

/** DB-backed wrapper: resolve every referenced customBlockId against the
 *  tenant's schema blocks, then run the pure core. No-op fast path when the
 *  model placed no custom blocks. */
export async function normalizeCustomSchemaBlocks(
  blocks: unknown[],
  tenantId: number | null,
  degradations: DegradationEntry[],
): Promise<unknown[]> {
  const referenced = new Set<number>();
  for (const block of blocks) {
    const b = block as { type?: unknown; props?: { customBlockId?: unknown } } | null;
    if (b && b.type === "custom-schema") {
      const id = Number(b.props?.customBlockId);
      if (Number.isInteger(id) && id > 0) referenced.add(id);
    }
  }
  const hasCustom = blocks.some((b) => (b as { type?: unknown } | null)?.type === "custom-schema");
  if (!hasCustom) return blocks;
  const sources = new Map<number, CustomBlockVocabEntry>();
  if (tenantId !== null && referenced.size > 0) {
    try {
      const idParams = sql.join([...referenced].map((n) => sql`${n}`), sql`, `);
      const result = await db.execute(
        sql`SELECT id, name, props FROM lp_custom_blocks
            WHERE tenant_id = ${tenantId} AND block_type = 'schema' AND id IN (${idParams})`,
      );
      for (const row of (result.rows ?? []) as Array<{ id: number; name: string; props: unknown }>) {
        const entry = rowToVocabEntry(row);
        if (entry) sources.set(entry.id, entry);
      }
    } catch (err) {
      logger.warn({ err: String(err), tenantId }, "[custom-blocks-vocab] resolve failed");
      // Fall through with an empty map: unresolved custom blocks are dropped
      // (better an absent section than an unrenderable one).
    }
  }
  return applyCustomSchemaSources(blocks, sources, degradations);
}
