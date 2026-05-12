// Task #210 — Shared validator for AI-generated and user-edited schema blocks.
//
// Used by both the generate endpoint and the custom-blocks save endpoint so
// that any block_type === "schema" payload that lands in the database has
// passed the same checks (allowed field types, no unsafe HTML, strict
// {{token}} ↔ schema field id parity, dry render).
//
// All issues are returned in a structured shape so the UI can attach errors
// to a specific field/token instead of a generic banner.

export const SCHEMA_FIELD_TYPES = [
  "text", "longText", "number", "color", "image", "url", "boolean", "select",
] as const;
export type SchemaFieldType = (typeof SCHEMA_FIELD_TYPES)[number];
const FIELD_TYPE_SET = new Set<string>(SCHEMA_FIELD_TYPES);

export interface SchemaFieldDef {
  id: string;
  label: string;
  type: SchemaFieldType;
  defaultValue?: string | number | boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  required?: boolean;
}
export type SchemaFieldValue = string | number | boolean;

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
   *   - "template"                   — template-wide error (safety, length)
   *   - "template.token.<id>"        — token referenced but no field
   *   - "schema"                     — schema-wide error (not array, etc.)
   *   - "schema.field.<id>"          — per-field error or unused-field error
   *   - "sample.<id>"                — sample value problem
   *   - "name"                       — name field
   */
  path: string;
  code: string;
  message: string;
}

const TEMPLATE_TOKEN_RE = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

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
    if (!f || typeof f !== "object") {
      issues.push({ level: "error", path: `schema.field.${idx}`, code: "field.invalid", message: `schema[${idx}] is not an object` });
      return;
    }
    const fobj = f as Record<string, unknown>;
    const id = sanitizeFieldId(fobj.id);
    if (!id) {
      issues.push({ level: "error", path: `schema.field.${idx}`, code: "field.invalid_id", message: `schema[${idx}] has invalid id ${JSON.stringify(fobj.id)}` });
      return;
    }
    if (seen.has(id)) {
      issues.push({ level: "error", path: `schema.field.${id}`, code: "field.duplicate", message: `duplicate field id "${id}"` });
      return;
    }
    const type = typeof fobj.type === "string" ? fobj.type.trim() : "";
    if (!FIELD_TYPE_SET.has(type)) {
      issues.push({
        level: "error",
        path: `schema.field.${id}`,
        code: "field.unknown_type",
        message: `field "${id}" has unknown type "${type}" (allowed: ${SCHEMA_FIELD_TYPES.join(", ")})`,
      });
      return;
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
    if (fobj.defaultValue !== undefined) {
      const dv = fobj.defaultValue;
      if (typeof dv === "string" || typeof dv === "number" || typeof dv === "boolean") def.defaultValue = dv;
    }
    seen.add(id);
    out.push(def);
  });
  return out;
}

export function coerceSample(raw: unknown, schema: SchemaFieldDef[]): Record<string, SchemaFieldValue> {
  const out: Record<string, SchemaFieldValue> = {};
  if (!raw || typeof raw !== "object") return out;
  const rec = raw as Record<string, unknown>;
  for (const f of schema) {
    const v = rec[f.id];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[f.id] = v;
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function dryRender(template: string, schema: SchemaFieldDef[], sample: Record<string, SchemaFieldValue>, issues: ValidationIssue[]): void {
  try {
    const merged: Record<string, SchemaFieldValue> = {};
    for (const f of schema) {
      if (f.defaultValue !== undefined) merged[f.id] = f.defaultValue;
      else if (f.type === "boolean") merged[f.id] = false;
      else if (f.type === "number") merged[f.id] = 0;
      else merged[f.id] = "";
    }
    Object.assign(merged, sample);
    template.replace(TEMPLATE_TOKEN_RE, (_, id: string) => {
      const v = merged[id];
      if (v === undefined || v === null) return "";
      if (typeof v === "boolean") return v ? "true" : "false";
      return escapeHtml(String(v));
    });
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
 * Strict {{token}} ↔ schema field id parity:
 *   - tokens not backed by a field         → error  (template.token.<id>)
 *   - schema fields not used in template   → error  (schema.field.<id>)
 * (Both directions are errors per task #210 acceptance criteria.)
 */
function validateTokenMapping(template: string, schema: SchemaFieldDef[], issues: ValidationIssue[]): void {
  const ids = new Set(schema.map(f => f.id));
  const found = new Set<string>();
  for (const m of template.matchAll(TEMPLATE_TOKEN_RE)) found.add(m[1]);
  for (const tok of found) {
    if (!ids.has(tok)) {
      issues.push({
        level: "error",
        path: `template.token.${tok}`,
        code: "token.unknown_field",
        message: `template uses {{${tok}}} but no field with that id exists`,
      });
    }
  }
  for (const id of ids) {
    if (!found.has(id)) {
      issues.push({
        level: "error",
        path: `schema.field.${id}`,
        code: "field.unused",
        message: `field "${id}" is defined but never used in the template`,
      });
    }
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
  validateTokenMapping(tpl, payload.schema, issues);
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
