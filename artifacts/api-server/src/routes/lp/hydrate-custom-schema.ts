import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Server-side hydration of `custom-schema` blocks (task #120).
 *
 * Schema-driven custom blocks are stored on pages with only a
 * `customBlockId` reference + per-instance `values`. The schema/template
 * live on the source `lp_custom_blocks` row so that template/schema edits
 * propagate to every existing instance without a page-data migration.
 *
 * For public, unauthenticated viewers, the client cannot fetch the
 * tenant's custom blocks (`/api/lp/custom-blocks` requires auth). To keep
 * published pages renderable, this helper walks the block tree and copies
 * the live `schema`/`template` onto each `custom-schema` block before
 * sending the page response. This is purely a render-time hydration —
 * the stored block JSON is left untouched.
 */

interface PossibleBlock {
  type?: string;
  props?: Record<string, unknown>;
  children?: unknown[];
  [k: string]: unknown;
}

function collectIds(blocks: unknown, out: Set<number>): void {
  if (!Array.isArray(blocks)) return;
  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as PossibleBlock;
    if (b.type === "custom-schema") {
      const id = (b.props as { customBlockId?: unknown } | undefined)?.customBlockId;
      if (typeof id === "number" && Number.isFinite(id)) out.add(id);
    }
    if (Array.isArray(b.children)) collectIds(b.children, out);
  }
}

function applyHydration(blocks: unknown, sources: Map<number, { schema: unknown; template: unknown; name: string }>): unknown {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map(raw => {
    if (!raw || typeof raw !== "object") return raw;
    const b = raw as PossibleBlock;
    let next: PossibleBlock = b;
    if (b.type === "custom-schema") {
      const props = (b.props ?? {}) as { customBlockId?: number; [k: string]: unknown };
      const src = typeof props.customBlockId === "number" ? sources.get(props.customBlockId) : undefined;
      if (src) {
        next = {
          ...b,
          props: {
            ...props,
            schema: src.schema,
            template: src.template,
            customBlockName: src.name,
          },
        };
      }
    }
    if (Array.isArray(next.children)) {
      next = { ...next, children: applyHydration(next.children, sources) as unknown[] };
    }
    return next;
  });
}

export async function hydrateCustomSchemaBlocks(blocks: unknown, tenantId: number): Promise<unknown> {
  if (!Array.isArray(blocks) || blocks.length === 0) return blocks;
  const ids = new Set<number>();
  collectIds(blocks, ids);
  if (ids.size === 0) return blocks;
  const idList = Array.from(ids);
  const rows = await db.execute(
    sql`SELECT id, name, props
        FROM lp_custom_blocks
        WHERE tenant_id = ${tenantId}
          AND block_type = 'schema'
          AND id = ANY(${idList}::int[])`,
  );
  const sources = new Map<number, { schema: unknown; template: unknown; name: string }>();
  for (const row of rows.rows as Array<{ id: number; name: string; props: Record<string, unknown> | null }>) {
    const props = row.props ?? {};
    sources.set(row.id, {
      name: row.name,
      schema: Array.isArray(props.schema) ? props.schema : [],
      template: typeof props.template === "string" ? props.template : "",
    });
  }
  return applyHydration(blocks, sources);
}
