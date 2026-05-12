// Task #210/#227 — Shared validator for AI-generated and user-edited schema blocks.
//
// Used by both the generate endpoint and the custom-blocks save endpoint so
// that any block_type === "schema" payload that lands in the database has
// passed the same checks (allowed field types, no unsafe HTML, strict
// {{token}} ↔ schema field id parity, dry render).
//
// Task #227 widened the template engine to support a tiny Handlebars subset:
//   {{field}}, {{this.subfield}}, {{#each list}}, {{#if field}}…{{else}}…{{/if}}
// and added a new "list" field type (array of objects with a scalar
// itemSchema). The validator now parses the template via
// `schema-template-engine.parseAndValidate` and carries those issues through
// the existing ValidationIssue shape so the dialog/UI can keep displaying
// them inline.

import {
  parseAndValidate,
  defaultsFromSchema as engineDefaults,
  renderAst,
  parseTemplate,
  type EngineFieldDef,
  type FieldValue as EngineFieldValue,
  type ListItem,
  type Scalar,
  type ValuesMap,
} from "./schema-template-engine";

export const SCHEMA_FIELD_TYPES = [
  "text", "longText", "number", "color", "image", "url", "boolean", "select", "list",
] as const;
export type SchemaFieldType = (typeof SCHEMA_FIELD_TYPES)[number];
const FIELD_TYPE_SET = new Set<string>(SCHEMA_FIELD_TYPES);
const SCALAR_TYPE_SET = new Set<string>(SCHEMA_FIELD_TYPES.filter(t => t !== "list"));

export interface SchemaFieldDef {
  id: string;
  label: string;
  type: SchemaFieldType;
  defaultValue?: Scalar | ListItem[];
  options?: string[];
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  /** Only valid when `type === "list"`. Sub-fields must be scalar (no nested list). */
  itemSchema?: SchemaFieldDef[];
}

export type SchemaFieldValue = EngineFieldValue;

export interface SchemaBlockPayload {
  name?: string;
  description?: string;
  schema: SchemaFieldDef[];
  template: string;
  sample: Record<string, SchemaFieldValue>;
}

export interface ValidationIssue {
  level: "error" | "warning";
  /**
   * Dotted path identifying *what* failed:
   *   - "template"                          — template-wide error (safety, length, parse)
   *   - "template.token.<id>"               — token referenced but no field
   *   - "template.token.<list>.<sub>"       — list subfield ref problems
   *   - "schema"                            — schema-wide error (not array, etc.)
   *   - "schema.field.<id>"                 — per-field error or unused-field error
   *   - "schema.field.<id>.item.<sub>"      — per-list-subfield error
   *   - "sample.<id>"                       — sample value problem
   *   - "name"                              — name field
   */
  path: string;
  code: string;
  message: string;
}

const UNSAFE_TEMPLATE_PATTERNS: Array<{ re: RegExp; code: string; msg: string }> = [
  { re: /<\s*script\b/i, code: "unsafe.script", msg: "<script> tags are not allowed" },
  { re: /<\s*iframe\b/i, code: "unsafe.iframe", msg: "<iframe> tags are not allowed" },
  { re: /<\s*object\b/i, code: "unsafe.object", msg: "<object> tags are not allowed" },
  { re: /<\s*embed\b/i, code: "unsafe.embed", msg: "<embed> tags are not allowed" },
  { re: /\son[a-z]+\s*=/i, code: "unsafe.inline_handler", msg: "inline event handlers (on*) are not allowed" },
  { re: /javascript\s*:/i, code: "unsafe.javascript_url", msg: "javascript: URLs are not allowed" },
  { re: /<\s*link\b[^>]*\bhref\s*=\s*["']?https?:/i, code: "unsafe.external_link", msg: "external <link> stylesheets are not allowed" },
  { re: /<\s*script\b[^>]*\bsrc\s*=/i, code: "unsafe.external_script", msg: "external <script src> is not allowed" },
];

export function sanitizeFieldId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return cleaned.length > 0 ? cleaned : null;
}

function coerceScalar(v: unknown): Scalar | undefined {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return undefined;
}

/**
 * Coerce a single field def. `parentPath` is used for nested issue paths
 * (item subfields). When `allowList` is false (i.e. inside an itemSchema)
 * the "list" type is rejected so we never recurse.
 */
function coerceField(
  raw: unknown,
  idx: number,
  issues: ValidationIssue[],
  parentPath: string,
  allowList: boolean,
): SchemaFieldDef | null {
  if (!raw || typeof raw !== "object") {
    issues.push({ level: "error", path: `${parentPath}.${idx}`, code: "field.invalid", message: `${parentPath}[${idx}] is not an object` });
    return null;
  }
  const fobj = raw as Record<string, unknown>;
  const id = sanitizeFieldId(fobj.id);
  if (!id) {
    issues.push({ level: "error", path: `${parentPath}.${idx}`, code: "field.invalid_id", message: `${parentPath}[${idx}] has invalid id ${JSON.stringify(fobj.id)}` });
    return null;
  }
  const type = typeof fobj.type === "string" ? fobj.type.trim() : "";
  if (!FIELD_TYPE_SET.has(type)) {
    issues.push({
      level: "error",
      path: `${parentPath}.${id}`,
      code: "field.unknown_type",
      message: `field "${id}" has unknown type "${type}" (allowed: ${SCHEMA_FIELD_TYPES.join(", ")})`,
    });
    return null;
  }
  if (type === "list" && !allowList) {
    issues.push({
      level: "error",
      path: `${parentPath}.${id}`,
      code: "field.nested_list",
      message: `field "${id}" cannot be type "list" inside another list — nested lists are not supported`,
    });
    return null;
  }
  const def: SchemaFieldDef = {
    id,
    label: typeof fobj.label === "string" && fobj.label.trim() ? fobj.label.trim().slice(0, 120) : id,
    type: type as SchemaFieldType,
  };
  if (typeof fobj.placeholder === "string") def.placeholder = fobj.placeholder.slice(0, 200);
  if (typeof fobj.helpText === "string") def.helpText = fobj.helpText.slice(0, 200);
  if (fobj.required === true) def.required = true;
  if (def.type === "select" && Array.isArray(fobj.options)) {
    def.options = fobj.options.filter((o): o is string => typeof o === "string").map(o => o.slice(0, 80)).slice(0, 32);
  }
  if (def.type === "list") {
    const subRaw = Array.isArray(fobj.itemSchema) ? fobj.itemSchema : [];
    const subOut: SchemaFieldDef[] = [];
    const subSeen = new Set<string>();
    subRaw.forEach((s, sIdx) => {
      const sub = coerceField(s, sIdx, issues, `schema.field.${id}.item`, false);
      if (!sub) return;
      if (subSeen.has(sub.id)) {
        issues.push({ level: "error", path: `schema.field.${id}.item.${sub.id}`, code: "subfield.duplicate", message: `duplicate subfield id "${sub.id}" in list "${id}"` });
        return;
      }
      subSeen.add(sub.id);
      subOut.push(sub);
    });
    if (subOut.length === 0) {
      issues.push({
        level: "error",
        path: `schema.field.${id}`,
        code: "list.empty_item_schema",
        message: `list field "${id}" must declare at least one subfield in itemSchema`,
      });
    }
    def.itemSchema = subOut;
  }
  if (fobj.defaultValue !== undefined) {
    if (def.type === "list") {
      if (Array.isArray(fobj.defaultValue)) {
        const items = coerceListValue(fobj.defaultValue, def.itemSchema ?? []);
        def.defaultValue = items;
      }
    } else {
      const sv = coerceScalar(fobj.defaultValue);
      if (sv !== undefined) def.defaultValue = sv;
    }
  }
  return def;
}

/**
 * Normalize a raw schema (e.g. from JSON) into a typed SchemaFieldDef[],
 * collecting structural issues (unknown types, dup ids, etc.).
 */
export function coerceSchema(raw: unknown, issues: ValidationIssue[]): SchemaFieldDef[] {
  if (!Array.isArray(raw)) {
    issues.push({ level: "error", path: "schema", code: "schema.not_array", message: "schema must be an array" });
    return [];
  }
  const out: SchemaFieldDef[] = [];
  const seen = new Set<string>();
  raw.forEach((f, idx) => {
    const def = coerceField(f, idx, issues, "schema.field", true);
    if (!def) return;
    if (seen.has(def.id)) {
      issues.push({ level: "error", path: `schema.field.${def.id}`, code: "field.duplicate", message: `duplicate field id "${def.id}"` });
      return;
    }
    seen.add(def.id);
    out.push(def);
  });
  return out;
}

function coerceListValue(raw: unknown, itemSchema: SchemaFieldDef[]): ListItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ListItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const item: ListItem = {};
    for (const sub of itemSchema) {
      const sv = coerceScalar(r[sub.id]);
      if (sv !== undefined) item[sub.id] = sv;
    }
    out.push(item);
  }
  return out;
}

export function coerceSample(raw: unknown, schema: SchemaFieldDef[]): Record<string, SchemaFieldValue> {
  const out: Record<string, SchemaFieldValue> = {};
  if (!raw || typeof raw !== "object") return out;
  const rec = raw as Record<string, unknown>;
  for (const f of schema) {
    const v = rec[f.id];
    if (v === undefined || v === null) continue;
    if (f.type === "list") {
      out[f.id] = coerceListValue(v, f.itemSchema ?? []);
    } else {
      const sv = coerceScalar(v);
      if (sv !== undefined) out[f.id] = sv;
    }
  }
  return out;
}

function dryRender(template: string, schema: SchemaFieldDef[], sample: Record<string, SchemaFieldValue>, issues: ValidationIssue[]): void {
  try {
    const merged: ValuesMap = { ...engineDefaults(schema as EngineFieldDef[]), ...sample };
    const { ast } = parseTemplate(template);
    renderAst(ast, merged);
  } catch (e) {
    issues.push({
      level: "error",
      path: "template",
      code: "template.dry_render_failed",
      message: `dry render failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

/**
 * Validate an already-coerced SchemaBlockPayload. Coerces the schema/sample
 * first if you pass raw values (use `validateRaw` for that).
 */
export function validateSchemaBlock(payload: SchemaBlockPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tpl = payload.template;
  if (typeof tpl !== "string" || !tpl.trim()) {
    issues.push({ level: "error", path: "template", code: "template.empty", message: "template is empty" });
    return issues;
  }
  if (tpl.length > 12000) {
    issues.push({ level: "error", path: "template", code: "template.too_long", message: "template exceeds 12000 chars" });
  }
  for (const { re, code, msg } of UNSAFE_TEMPLATE_PATTERNS) {
    if (re.test(tpl)) issues.push({ level: "error", path: "template", code, message: `template: ${msg}` });
  }
  // Defensive per-field check: scalar fields must not declare itemSchema;
  // list fields must declare it (already enforced in coerceField, but guard
  // here in case a payload was constructed in code).
  for (const f of payload.schema) {
    if (f.type === "list") {
      if (!f.itemSchema || f.itemSchema.length === 0) {
        issues.push({
          level: "error",
          path: `schema.field.${f.id}`,
          code: "list.empty_item_schema",
          message: `list field "${f.id}" must declare at least one subfield in itemSchema`,
        });
      } else {
        for (const sub of f.itemSchema) {
          if (!SCALAR_TYPE_SET.has(sub.type)) {
            issues.push({
              level: "error",
              path: `schema.field.${f.id}.item.${sub.id}`,
              code: "subfield.non_scalar",
              message: `subfield "${f.id}.${sub.id}" must be a scalar type, got "${sub.type}"`,
            });
          }
        }
      }
    }
  }
  // Engine-driven parse + schema-aware validation. Replaces the old
  // flat-{{token}} regex check.
  const { issues: engineIssues } = parseAndValidate(tpl, payload.schema as EngineFieldDef[]);
  for (const e of engineIssues) {
    issues.push({
      level: "error",
      path: e.path ?? "template",
      code: e.code,
      message: e.message,
    });
  }
  dryRender(tpl, payload.schema, payload.sample, issues);
  return issues;
}

/**
 * Coerce a raw payload (untyped JSON) and validate it. Returns both the
 * normalized payload and the structured issue list.
 */
export function validateRawSchemaBlock(raw: unknown): {
  payload: SchemaBlockPayload;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const schema = coerceSchema(r.schema, issues);
  const template = typeof r.template === "string" ? r.template : "";
  const sample = coerceSample(r.sample, schema);
  const payload: SchemaBlockPayload = {
    name: typeof r.name === "string" ? r.name.trim().slice(0, 120) : undefined,
    description: typeof r.description === "string" ? r.description.trim().slice(0, 400) : undefined,
    schema,
    template,
    sample,
  };
  issues.push(...validateSchemaBlock(payload));
  return { payload, issues };
}

export function splitIssues(issues: ValidationIssue[]): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  return {
    errors: issues.filter(i => i.level === "error"),
    warnings: issues.filter(i => i.level === "warning"),
  };
}
