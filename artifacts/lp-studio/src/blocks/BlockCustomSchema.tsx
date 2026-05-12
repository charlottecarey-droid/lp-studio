import { useMemo } from "react";
import type { CustomSchemaBlockProps, SchemaFieldDef, SchemaFieldValue } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { useCustomBlock } from "@/lib/custom-blocks-context";

/**
 * Schema-driven custom block renderer (task #120).
 *
 * The author defines an HTML/CSS template with `{{field_id}}` placeholders
 * plus a JSON schema describing the editable fields. Tenant editors fill in
 * the field values via the auto-generated property panel, and this renderer
 * substitutes the values into the template at render time.
 *
 * Schema + template are looked up live from the source custom block via
 * CustomBlocksContext (keyed by `props.customBlockId`). This is what lets
 * existing instances pick up template/schema edits without a page-data
 * migration. If the source block is unavailable (e.g. the renderer is
 * mounted outside the context, or the source block was deleted), we fall
 * back to whatever schema/template is stored on the instance.
 *
 * Templates render inline via dangerouslySetInnerHTML — no iframe — so the
 * block flows naturally with the surrounding page (no scroll-height hacks,
 * no awkward reflow). Safety is enforced server-side by the schema-block
 * validator (task #210), which rejects <script>, <iframe>, on*= handlers,
 * javascript: URLs, and external <link>/<script src> before the template
 * can ever land in the database. Field values are HTML-escaped before
 * substitution to defend against placeholder-based XSS.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function valueToString(v: SchemaFieldValue | undefined): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function interpolate(template: string, values: Record<string, SchemaFieldValue>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, id: string) => {
    const raw = valueToString(values[id]);
    return escapeHtml(raw);
  });
}

interface Props {
  props: CustomSchemaBlockProps;
  brand: BrandConfig;
}

export function BlockCustomSchema({ props }: Props) {
  const source = useCustomBlock(props.customBlockId);

  // Live schema/template come from the source custom block when available;
  // fall back to anything snapshotted on the instance for resilience.
  const schema: SchemaFieldDef[] = source?.schema ?? props.schema ?? [];
  const template: string = source?.template ?? props.template ?? "";
  // Task #198: master "shared" values flow into every linked instance.
  // Per-instance values win per-field, so editors can override one field
  // without losing the master defaults for the rest.
  const sharedValues: Record<string, SchemaFieldValue> =
    source?.sharedValues ?? (props.sharedValues as Record<string, SchemaFieldValue> | undefined) ?? {};

  const html = useMemo(() => {
    const merged = {
      ...defaultsFromSchema(schema),
      ...sharedValues,
      ...(props.values || {}),
    };
    return interpolate(template, merged);
  }, [schema, template, props.values, sharedValues]);

  if (!template.trim()) {
    return (
      <div className="p-6 border-2 border-dashed border-amber-300 bg-amber-50 rounded text-sm text-amber-800">
        This schema custom block has no template yet. Edit the source custom block to add a template.
      </div>
    );
  }

  return (
    <div
      className="lp-custom-schema-block w-full"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function defaultsFromSchema(schema: SchemaFieldDef[]): Record<string, SchemaFieldValue> {
  const out: Record<string, SchemaFieldValue> = {};
  for (const f of schema || []) {
    if (f.defaultValue !== undefined) out[f.id] = f.defaultValue;
    else if (f.type === "boolean") out[f.id] = false;
    else if (f.type === "number") out[f.id] = 0;
    else out[f.id] = "";
  }
  return out;
}
