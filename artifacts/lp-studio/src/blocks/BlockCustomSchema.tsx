import { useMemo } from "react";
import type { CustomSchemaBlockProps, SchemaFieldDef, SchemaFieldValue } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { useCustomBlock } from "@/lib/custom-blocks-context";
import {
  parseTemplate,
  renderAst,
  defaultsFromSchema,
  type EngineFieldDef,
  type ValuesMap,
} from "@/lib/schema-template-engine";

/**
 * Schema-driven custom block renderer (task #120, extended in #227).
 *
 * The author defines an HTML/CSS template with placeholders + a JSON schema
 * describing the editable fields. Tenant editors fill values via the
 * auto-generated property panel. Templates support:
 *   - {{field}}                           scalar interpolation
 *   - {{this.subfield}}                   inside #each, current item subfield
 *   - {{#each list}}…{{/each}}            iterate a list field
 *   - {{#if field}}…{{else}}…{{/if}}      conditional branch
 * See `lib/schema-template-engine.ts` for the full grammar.
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
    const merged: ValuesMap = {
      ...defaultsFromSchema(schema as EngineFieldDef[]),
      ...sharedValues,
      ...(props.values || {}),
    };
    const { ast } = parseTemplate(template);
    return renderAst(ast, merged);
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
