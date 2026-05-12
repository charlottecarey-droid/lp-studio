import { useMemo } from "react";
import type { SchemaFieldDef, SchemaFieldValue } from "@/lib/block-types";
import {
  parseTemplate,
  renderAst,
  defaultsFromSchema,
  type EngineFieldDef,
  type ValuesMap,
} from "@/lib/schema-template-engine";

/**
 * Inline preview for schema-driven custom blocks (task #202, refactored to
 * drop the iframe wrapper; task #227 widened to the new template engine).
 *
 * Renders the given template/schema/values combination via the same
 * engine the runtime renderer uses, so the preview matches what editors
 * will see on rendered pages. Safety is enforced server-side by the
 * validator (task #210) on both generate and save paths.
 */

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
    const merged: ValuesMap = { ...defaultsFromSchema(schema as EngineFieldDef[]), ...values };
    const { ast } = parseTemplate(template);
    return renderAst(ast, merged);
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
