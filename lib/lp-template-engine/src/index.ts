/**
 * Custom-block template engine — Handlebars-style subset (task #227).
 *
 * Single source of truth for both api-server (validator + dry-render)
 * and lp-studio (renderer + preview). The artifact-side files
 *   - artifacts/lp-studio/src/lib/schema-template-engine.ts
 *   - artifacts/api-server/src/routes/lp/schema-template-engine.ts
 * are thin `export *` shims pointing at this module. Pure TS, no
 * DOM/React deps.
 *
 * Supported syntax:
 *   {{field}}                              — scalar field, HTML-escaped
 *   {{this.subfield}}                      — inside #each, current row subfield
 *   {{#each list}}…{{/each}}               — iterate a top-level "list" field
 *   {{#each this.subList}}…{{/each}}       — iterate a nested list subfield
 *                                            (only valid one level deep, e.g.
 *                                            nav_columns → links)
 *   {{#if field}}…{{else}}…{{/if}}         — boolean branch on a scalar
 *   {{#if this.subfield}}…{{/if}}          — same, inside #each
 *
 * Nesting depth is capped at 2 levels of #each (depth 1 = top-level list,
 * depth 2 = a nested list inside that). Forbidden: any other helper,
 * partial (>), comment (!), 3+ levels of #each, dotted paths other than
 * `this.<id>`. Existing flat {{field}} templates continue to work unchanged.
 */

export * from "./block-tags";
export * from "./robots";

export type Scalar = string | number | boolean;
/**
 * A row inside a list field. Each cell is either a scalar or — when the
 * list's itemSchema declares a nested "list" subfield — another array of
 * rows. Nesting is capped at one level inside any given list (engine
 * enforces a max #each depth of 2).
 */
export type ListItem = { [k: string]: Scalar | ListItem[] };
export type FieldValue = Scalar | ListItem[];
export type ValuesMap = Record<string, FieldValue>;
/** Max nesting depth of `#each` — see file header. */
export const MAX_EACH_DEPTH = 2;

/**
 * Minimal field-def shape the engine needs. Both api-server's
 * `SchemaFieldDef` and lp-studio's `SchemaFieldDef` are structural
 * supersets, so they can be passed directly.
 */
export interface EngineFieldDef {
  id: string;
  type: string;
  itemSchema?: EngineFieldDef[];
  defaultValue?: unknown;
}

export type TemplateNode =
  | { kind: "text"; text: string }
  | { kind: "var"; name: string; isThis: boolean }
  /** When `isThis`, the iterated list is `currentItem[list]`; else `values[list]`. */
  | { kind: "each"; list: string; isThis: boolean; body: TemplateNode[] }
  | { kind: "if"; field: string; isThis: boolean; then: TemplateNode[]; els: TemplateNode[] };

export interface EngineIssue {
  code: string;
  message: string;
  /** Optional dotted path matching the validator's ValidationIssue.path shape. */
  path?: string;
}

const PLACEHOLDER_RE = /\{\{([^{}]*?)\}\}/g;
const VAR_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const THIS_VAR_RE = /^this\.([a-zA-Z0-9_-]+)$/;

type RawToken =
  | { type: "text"; text: string }
  | { type: "tag"; raw: string; inner: string };

function tokenize(template: string): RawToken[] {
  const out: RawToken[] = [];
  let last = 0;
  PLACEHOLDER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(template)) !== null) {
    if (m.index > last) out.push({ type: "text", text: template.slice(last, m.index) });
    out.push({ type: "tag", raw: m[0], inner: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push({ type: "text", text: template.slice(last) });
  return out;
}

/**
 * Parse a template into an AST, collecting structural issues (unmatched
 * tags, comments/partials, unknown helpers, etc). Schema-aware checks are
 * done separately by `validateAst`.
 */
export function parseTemplate(template: string): { ast: TemplateNode[]; issues: EngineIssue[] } {
  const issues: EngineIssue[] = [];
  const tokens = tokenize(template);
  let i = 0;
  let eachDepth = 0;

  function parseBody(stop: "/each" | "/if" | null): TemplateNode[] {
    const out: TemplateNode[] = [];
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.type === "text") {
        out.push({ kind: "text", text: t.text });
        i++;
        continue;
      }
      const inner = t.inner;

      // Closing/else — stop without consuming so parent can match.
      if (stop && (inner === stop || (stop === "/if" && inner === "else"))) return out;

      if (inner.startsWith("!")) {
        issues.push({ code: "template.comment_disallowed", message: `comments are not allowed: ${t.raw}`, path: "template" });
        i++; continue;
      }
      if (inner.startsWith(">")) {
        issues.push({ code: "template.partial_disallowed", message: `partials are not allowed: ${t.raw}`, path: "template" });
        i++; continue;
      }

      if (inner.startsWith("#each")) {
        const expr = inner.slice(5).trim();
        let isThis = false;
        let list = expr;
        const tm = THIS_VAR_RE.exec(expr);
        if (tm) { isThis = true; list = tm[1]; }
        if (!VAR_NAME_RE.test(list)) {
          issues.push({ code: "template.invalid_each", message: `invalid #each list name: ${t.raw}`, path: "template" });
        }
        if (eachDepth >= MAX_EACH_DEPTH) {
          issues.push({
            code: "template.each_nesting",
            message: `#each can be nested at most ${MAX_EACH_DEPTH - 1} level deep — too deep at ${t.raw}`,
            path: "template",
          });
        }
        if (isThis && eachDepth === 0) {
          issues.push({ code: "template.this_outside_each", message: `${t.raw} only allowed inside an outer #each`, path: "template" });
        }
        i++;
        eachDepth++;
        const body = parseBody("/each");
        eachDepth--;
        if (i < tokens.length && tokens[i].type === "tag" && (tokens[i] as { inner: string }).inner === "/each") {
          i++;
        } else {
          issues.push({ code: "template.unclosed_each", message: `missing {{/each}} for {{#each ${expr}}}`, path: "template" });
        }
        out.push({ kind: "each", list, isThis, body });
        continue;
      }

      if (inner.startsWith("#if")) {
        const expr = inner.slice(3).trim();
        let isThis = false;
        let field = expr;
        const tm = THIS_VAR_RE.exec(expr);
        if (tm) { isThis = true; field = tm[1]; }
        if (!VAR_NAME_RE.test(field)) {
          issues.push({ code: "template.invalid_if", message: `invalid #if expression: ${t.raw}`, path: "template" });
        }
        if (isThis && eachDepth === 0) {
          issues.push({ code: "template.this_outside_each", message: `${t.raw} only allowed inside #each`, path: "template" });
        }
        i++;
        const thenB = parseBody("/if");
        let elseB: TemplateNode[] = [];
        if (i < tokens.length && tokens[i].type === "tag" && (tokens[i] as { inner: string }).inner === "else") {
          i++;
          elseB = parseBody("/if");
        }
        if (i < tokens.length && tokens[i].type === "tag" && (tokens[i] as { inner: string }).inner === "/if") {
          i++;
        } else {
          issues.push({ code: "template.unclosed_if", message: `missing {{/if}} for ${t.raw}`, path: "template" });
        }
        out.push({ kind: "if", field, isThis, then: thenB, els: elseB });
        continue;
      }

      if (inner === "/each" || inner === "/if" || inner === "else") {
        issues.push({ code: "template.unexpected_close", message: `unexpected ${t.raw}`, path: "template" });
        i++;
        continue;
      }

      if (inner.startsWith("#") || inner.startsWith("/")) {
        issues.push({ code: "template.unknown_helper", message: `unknown helper: ${t.raw}`, path: "template" });
        i++;
        continue;
      }

      const tv = THIS_VAR_RE.exec(inner);
      if (tv) {
        if (eachDepth === 0) {
          issues.push({ code: "template.this_outside_each", message: `${t.raw} only allowed inside #each`, path: "template" });
        }
        out.push({ kind: "var", name: tv[1], isThis: true });
        i++;
        continue;
      }

      if (VAR_NAME_RE.test(inner)) {
        out.push({ kind: "var", name: inner, isThis: false });
        i++;
        continue;
      }

      issues.push({
        code: "template.invalid_placeholder",
        message: `unsupported placeholder ${t.raw} — only {{field}}, {{this.subfield}}, {{#each list}}, {{#if field}} are allowed`,
        path: "template",
      });
      i++;
    }
    return out;
  }

  const ast = parseBody(null);
  return { ast, issues };
}

/**
 * Validate an AST against the schema. Catches unknown fields/subfields,
 * `#each` over non-list, `#if` over non-scalar, list field used as a bare
 * `{{x}}` instead of `#each`, and unused fields/subfields.
 */
export function validateAst(ast: TemplateNode[], schema: EngineFieldDef[]): EngineIssue[] {
  const issues: EngineIssue[] = [];
  const byId = new Map<string, EngineFieldDef>();
  for (const f of schema) byId.set(f.id, f);

  /**
   * Each list-field node's "used subfield ids" are tracked under a dotted
   * path so nested lists don't collide. Keys look like:
   *   "nav_columns"                  (top-level list)
   *   "nav_columns.links"            (nested list inside nav_columns)
   */
  const usedFields = new Set<string>();
  const usedSubs = new Map<string, Set<string>>();
  const ensure = (k: string): Set<string> => {
    let s = usedSubs.get(k);
    if (!s) { s = new Set<string>(); usedSubs.set(k, s); }
    return s;
  };

  function walk(nodes: TemplateNode[], currentList: EngineFieldDef | null, currentPath: string | null): void {
    for (const n of nodes) {
      if (n.kind === "text") continue;
      if (n.kind === "var") {
        if (n.isThis) {
          if (!currentList || !currentPath) {
            issues.push({ code: "template.this_outside_each", message: `{{this.${n.name}}} used outside an #each block`, path: "template" });
            continue;
          }
          const sub = (currentList.itemSchema ?? []).find(f => f.id === n.name);
          if (!sub) {
            issues.push({
              code: "template.unknown_subfield",
              message: `{{this.${n.name}}} but list "${currentPath}" has no subfield with that id`,
              path: `template.token.${currentPath}.${n.name}`,
            });
            continue;
          }
          if (sub.type === "list") {
            issues.push({
              code: "template.subfield_is_list",
              message: `{{this.${n.name}}} references a nested list — wrap it in {{#each this.${n.name}}}…{{/each}}`,
              path: `template.token.${currentPath}.${n.name}`,
            });
            continue;
          }
          ensure(currentPath).add(n.name);
        } else {
          const f = byId.get(n.name);
          if (!f) {
            issues.push({
              code: "token.unknown_field",
              message: `template uses {{${n.name}}} but no field with that id exists`,
              path: `template.token.${n.name}`,
            });
            continue;
          }
          if (f.type === "list") {
            issues.push({
              code: "template.list_as_var",
              message: `{{${n.name}}} references a list field — wrap it in {{#each ${n.name}}}…{{/each}}`,
              path: `template.token.${n.name}`,
            });
            continue;
          }
          usedFields.add(n.name);
        }
        continue;
      }
      if (n.kind === "each") {
        if (n.isThis) {
          if (!currentList || !currentPath) {
            issues.push({ code: "template.this_outside_each", message: `{{#each this.${n.list}}} used outside an outer #each`, path: "template" });
            continue;
          }
          const sub = (currentList.itemSchema ?? []).find(f => f.id === n.list);
          if (!sub) {
            issues.push({
              code: "template.unknown_subfield",
              message: `{{#each this.${n.list}}} but list "${currentPath}" has no subfield with that id`,
              path: `template.token.${currentPath}.${n.list}`,
            });
            continue;
          }
          if (sub.type !== "list") {
            issues.push({
              code: "template.each_non_list",
              message: `{{#each this.${n.list}}} requires a "list" subfield, but "${currentPath}.${n.list}" is type "${sub.type}"`,
              path: `template.token.${currentPath}.${n.list}`,
            });
            continue;
          }
          ensure(currentPath).add(n.list);
          const nestedPath = `${currentPath}.${n.list}`;
          ensure(nestedPath);
          walk(n.body, sub, nestedPath);
        } else {
          const f = byId.get(n.list);
          if (!f) {
            issues.push({
              code: "token.unknown_field",
              message: `{{#each ${n.list}}} but no field with that id exists`,
              path: `template.token.${n.list}`,
            });
            continue;
          }
          if (f.type !== "list") {
            issues.push({
              code: "template.each_non_list",
              message: `{{#each ${n.list}}} requires a "list" field, but "${n.list}" is type "${f.type}"`,
              path: `template.token.${n.list}`,
            });
            continue;
          }
          usedFields.add(n.list);
          ensure(n.list);
          walk(n.body, f, n.list);
        }
        continue;
      }
      if (n.kind === "if") {
        if (n.isThis) {
          if (!currentList || !currentPath) {
            issues.push({ code: "template.this_outside_each", message: `{{#if this.${n.field}}} used outside #each`, path: "template" });
          } else {
            const sub = (currentList.itemSchema ?? []).find(f => f.id === n.field);
            if (!sub) {
              issues.push({
                code: "template.unknown_subfield",
                message: `{{#if this.${n.field}}} but list "${currentPath}" has no subfield with that id`,
                path: `template.token.${currentPath}.${n.field}`,
              });
            } else if (sub.type === "list") {
              issues.push({ code: "template.if_non_scalar", message: `{{#if this.${n.field}}} requires a scalar subfield`, path: "template" });
            } else {
              ensure(currentPath).add(n.field);
            }
          }
        } else {
          const f = byId.get(n.field);
          if (!f) {
            issues.push({
              code: "token.unknown_field",
              message: `{{#if ${n.field}}} but no field with that id exists`,
              path: `template.token.${n.field}`,
            });
          } else if (f.type === "list") {
            issues.push({
              code: "template.if_non_scalar",
              message: `{{#if ${n.field}}} requires a scalar field, not a list`,
              path: `template.token.${n.field}`,
            });
          } else {
            usedFields.add(n.field);
          }
        }
        walk(n.then, currentList, currentPath);
        walk(n.els, currentList, currentPath);
        continue;
      }
    }
  }

  walk(ast, null, null);

  // Recursive parity check for unused fields/subfields at every level.
  function checkUnused(fields: EngineFieldDef[], path: string | null): void {
    for (const f of fields) {
      const isTop = path === null;
      const fullPath = isTop ? f.id : `${path}.${f.id}`;
      if (isTop) {
        if (!usedFields.has(f.id)) {
          issues.push({
            code: "field.unused",
            message: `field "${f.id}" is defined but never used in the template`,
            path: `schema.field.${f.id}`,
          });
          continue;
        }
      } else {
        const used = usedSubs.get(path!) ?? new Set<string>();
        if (!used.has(f.id)) {
          issues.push({
            code: "subfield.unused",
            message: `subfield "${fullPath}" is defined but never used in the template`,
            path: `schema.field.${path!.split(".")[0]}.item.${f.id}`,
          });
          continue;
        }
      }
      if (f.type === "list") {
        checkUnused(f.itemSchema ?? [], fullPath);
      }
    }
  }
  checkUnused(schema, null);

  return issues;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function valueToString(v: Scalar | undefined | null): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function isTruthy(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Render an AST with the given values map. Output is HTML-safe (every
 * scalar interpolation is `escapeHtml`'d, exactly like the legacy plain
 * `{{x}}` engine — so existing flat templates render byte-identically).
 */
export function renderAst(
  ast: TemplateNode[],
  values: ValuesMap,
  options?: { currentItem?: ListItem | null },
): string {
  const currentItem = options?.currentItem ?? null;
  let out = "";
  for (const n of ast) {
    if (n.kind === "text") { out += n.text; continue; }
    if (n.kind === "var") {
      const raw = n.isThis
        ? (currentItem ? currentItem[n.name] : undefined)
        : (values[n.name] as Scalar | undefined);
      if (Array.isArray(raw)) continue; // defended by validator
      out += escapeHtml(valueToString(raw));
      continue;
    }
    if (n.kind === "each") {
      const raw = n.isThis
        ? (currentItem ? currentItem[n.list] : undefined)
        : values[n.list];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          out += renderAst(n.body, values, { currentItem: item });
        }
      }
      continue;
    }
    if (n.kind === "if") {
      const v = n.isThis
        ? (currentItem ? currentItem[n.field] : undefined)
        : values[n.field];
      out += renderAst(isTruthy(v) ? n.then : n.els, values, { currentItem });
      continue;
    }
  }
  return out;
}

/** parse + validate in one call. */
export function parseAndValidate(
  template: string,
  schema: EngineFieldDef[],
): { ast: TemplateNode[]; issues: EngineIssue[] } {
  const { ast, issues } = parseTemplate(template);
  issues.push(...validateAst(ast, schema));
  return { ast, issues };
}

export function defaultForField(f: EngineFieldDef): FieldValue {
  if (f.defaultValue !== undefined) return f.defaultValue as FieldValue;
  switch (f.type) {
    case "boolean": return false;
    case "number": return 0;
    case "list": return [];
    default: return "";
  }
}

export function defaultsFromSchema(schema: EngineFieldDef[]): ValuesMap {
  const out: ValuesMap = {};
  for (const f of schema) out[f.id] = defaultForField(f);
  return out;
}

/** Convenience: parse + render. Returns "" on parse errors. */
export function renderTemplate(template: string, schema: EngineFieldDef[], values: ValuesMap): string {
  const { ast } = parseTemplate(template);
  const merged = { ...defaultsFromSchema(schema), ...values };
  return renderAst(ast, merged);
}
