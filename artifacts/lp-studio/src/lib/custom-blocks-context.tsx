import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SchemaFieldDef, SchemaFieldValue } from "./block-types";

/**
 * Live lookup of tenant custom blocks, indexed by id (task #120).
 *
 * `custom-schema` PageBlocks store only `customBlockId` + per-instance
 * `values`. The schema and template they render against are pulled from
 * the source custom block at render time via this context, so when an
 * author edits the source template every existing instance picks up the
 * change without a page-data migration.
 *
 * Provided by:
 *   - BuilderEditor (live custom blocks state)
 *   - landing-page-viewer (fetched at mount)
 * Consumers:
 *   - BlockCustomSchema (renderer)
 *   - CustomSchemaPanel (property panel)
 *
 * The context is intentionally tiny — only the bits the renderer needs.
 */

export interface CustomBlockSource {
  id: number;
  name: string;
  schema: SchemaFieldDef[];
  template: string;
  sample?: Record<string, SchemaFieldValue>;
}

const CustomBlocksContext = createContext<Map<number, CustomBlockSource>>(new Map());

export function CustomBlocksProvider({
  blocks,
  children,
}: {
  blocks: CustomBlockSource[] | null | undefined;
  children: ReactNode;
}) {
  const map = useMemo(() => {
    const m = new Map<number, CustomBlockSource>();
    for (const b of blocks ?? []) m.set(b.id, b);
    return m;
  }, [blocks]);
  return <CustomBlocksContext.Provider value={map}>{children}</CustomBlocksContext.Provider>;
}

export function useCustomBlock(id: number | undefined): CustomBlockSource | undefined {
  const map = useContext(CustomBlocksContext);
  if (id === undefined) return undefined;
  return map.get(id);
}

/**
 * Coerce a raw API custom-block row into a CustomBlockSource. Rows whose
 * `block_type !== "schema"` are skipped (returns null).
 */
export function customBlockRowToSource(row: {
  id: number;
  name: string;
  block_type?: string;
  props?: Record<string, unknown> | null;
}): CustomBlockSource | null {
  if (row.block_type !== "schema") return null;
  const props = (row.props ?? {}) as { schema?: unknown; template?: unknown; sample?: unknown };
  return {
    id: row.id,
    name: row.name,
    schema: Array.isArray(props.schema) ? (props.schema as SchemaFieldDef[]) : [],
    template: typeof props.template === "string" ? props.template : "",
    sample: (props.sample && typeof props.sample === "object")
      ? (props.sample as Record<string, SchemaFieldValue>)
      : undefined,
  };
}
