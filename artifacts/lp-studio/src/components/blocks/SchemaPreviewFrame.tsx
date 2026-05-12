import { useEffect, useMemo, useRef } from "react";
import type { SchemaFieldDef, SchemaFieldValue } from "@/lib/block-types";

/**
 * Standalone iframe preview for schema-driven custom blocks (task #202).
 *
 * Renders the given template/schema/values combination inside a sandboxed
 * iframe so authored CSS/scripts can't escape into the host page. Used by
 * the schema-block editor to show a live "before/after" preview of the
 * change before saving and again inside the affected-pages confirm dialog
 * as a thumbnail diff.
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
  /** Display height — when "auto" the iframe expands to fit content. */
  mode?: "auto" | "thumbnail";
  className?: string;
}

export function SchemaPreviewFrame({ schema, template, values, mode = "auto", className }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(() => {
    const merged = { ...defaultsFromSchema(schema), ...values };
    const body = template.trim() ? interpolate(template, merged) : "";
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; padding: 12px; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
</style>
</head>
<body>${body}</body>
</html>`;
  }, [schema, template, values]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    if (mode !== "auto") return;
    const resize = () => {
      try {
        const h = doc.documentElement?.scrollHeight ?? 200;
        iframe.style.height = `${h}px`;
      } catch { /* ignore */ }
    };
    resize();
    const t = setTimeout(resize, 60);
    return () => clearTimeout(t);
  }, [html, mode]);

  if (!template.trim()) {
    return (
      <div className={`p-4 border border-dashed border-amber-300 bg-amber-50 rounded text-xs text-amber-800 ${className ?? ""}`}>
        No template — add one to see a preview.
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title="Schema block preview"
      sandbox="allow-same-origin"
      className={`w-full block border-0 ${className ?? ""}`}
      style={mode === "thumbnail" ? { height: 180 } : { minHeight: 80 }}
    />
  );
}
