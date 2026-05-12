import { useMemo } from "react";
import type { SchemaFieldDef, SchemaFieldValue } from "@/lib/block-types";

/**
 * Inline preview for schema-driven custom blocks (task #202, refactored to
 * drop the iframe wrapper).
 *
 * Renders the given template/schema/values combination directly via
 * dangerouslySetInnerHTML so the preview matches the runtime exactly (which
 * also no longer iframes). Safety is enforced server-side by the validator
 * (task #210) that runs on both the generate and the save paths — no
 * <script>/<iframe>/on*=/javascript:/external <link>/<script src> can reach
 * here. CSS scoping is the template's responsibility (the AI prompt
 * instructs a unique root class on every selector).
 *
 * Mirrors the substitution + escaping rules used by BlockCustomSchema so
 * the preview matches what editors will actually see on rendered pages.
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
    return escapeHtml(valueToString(values[id]));
  });
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

interface Props {
  schema: SchemaFieldDef[];
  template: string;
  values: Record<string, SchemaFieldValue>;
  /**
   * "auto" lets the rendered block size to its natural height.
   * "thumbnail" caps height + clips overflow for compact previews
   * (e.g. the affected-pages confirm dialog).
   */
  mode?: "auto" | "thumbnail";
  className?: string;
}

export function SchemaPreviewFrame({ schema, template, values, mode = "auto", className }: Props) {
  const html = useMemo(() => {
    if (!template.trim()) return "";
    const merged = { ...defaultsFromSchema(schema), ...values };
    return interpolate(template, merged);
  }, [schema, template, values]);

  if (!template.trim()) {
    return (
      <div className={`p-4 border border-dashed border-amber-300 bg-amber-50 rounded text-xs text-amber-800 ${className ?? ""}`}>
        No template — add one to see a preview.
      </div>
    );
  }

  const style: React.CSSProperties =
    mode === "thumbnail"
      ? { height: 180, overflow: "hidden" }
      : {};

  return (
    <div
      className={`lp-schema-preview w-full ${className ?? ""}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
