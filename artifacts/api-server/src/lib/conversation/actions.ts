/**
 * Conversation engine — structured action contract (June 2026 chatbot spec).
 *
 * A conversation MODE may let the bot PROPOSE structured actions (an
 * `insert_block`, a `rewrite_copy`, …). The bot never applies them — it streams
 * an `action` SSE event and the client renders an action card with an "Apply"
 * button. This module is the single source of truth for the action shape +
 * parsing/serialization, kept PURE (no OpenAI / Express imports) so it is unit-
 * testable in isolation.
 *
 * The engine prefers OpenAI tool/function-calling to emit actions (robust,
 * schema-validated by the model). Each allowed action is surfaced to the model
 * as one tool whose name is the action `type` and whose parameters are the
 * action `args`. When a tool call arrives we coerce it into a `CopilotAction`
 * here; a fenced-JSON fallback parser is also provided for models/proxies that
 * don't honor tool-calling.
 */

/** One structured edit the bot proposes. `type` selects which builder mutation
 *  the client will run on Apply; `args` are that mutation's parameters. */
export interface CopilotAction {
  /** Action discriminator — must be one of the mode's allowedActions names. */
  type: string;
  /** Short human label for the action card button row (e.g. "Add a
   *  testimonial wall"). */
  label: string;
  /** The mutation's parameters (block id, field, instruction, …). */
  args: Record<string, unknown>;
  /** Why the bot is proposing this — shown on the action card. */
  rationale: string;
}

/** Declarative description of an action the mode permits. Drives BOTH the
 *  OpenAI tool schema (so the model can call it) and server-side validation of
 *  whatever the model returns. */
export interface AllowedActionDef {
  /** Action type / tool name (e.g. "insert_block"). */
  type: string;
  /** One-line description fed to the model as the tool description. */
  description: string;
  /** JSON-schema `properties` for the action args (OpenAI function params). */
  properties: Record<string, unknown>;
  /** Required arg keys. */
  required: string[];
}

/** OpenAI tool definition derived from an AllowedActionDef. Typed loosely to
 *  avoid a hard dependency on the openai package's evolving tool types. */
export interface OpenAIToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties: false;
    };
  };
}

/** Build the OpenAI tools array for a mode's allowed actions. Every action
 *  schema also carries a shared `label` + `rationale` string so the model
 *  supplies the action-card copy in the same call. */
export function buildToolDefs(allowed: AllowedActionDef[]): OpenAIToolDef[] {
  return allowed.map((a) => ({
    type: "function",
    function: {
      name: a.type,
      description: a.description,
      parameters: {
        type: "object",
        properties: {
          ...a.properties,
          label: {
            type: "string",
            description: "A short button label for this proposed action (e.g. 'Add a testimonial wall').",
          },
          rationale: {
            type: "string",
            description: "One or two sentences explaining why you're proposing this edit, shown to the user.",
          },
        },
        required: [...a.required, "label", "rationale"],
        additionalProperties: false,
      },
    },
  }));
}

/** Coerce a raw OpenAI tool call (`name` + JSON-string `arguments`) into a
 *  validated CopilotAction, or null if the name isn't allowed / args don't
 *  parse / required keys are missing. PURE + total (never throws). */
export function actionFromToolCall(
  name: string,
  argumentsJson: string,
  allowed: AllowedActionDef[],
): CopilotAction | null {
  const def = allowed.find((a) => a.type === name);
  if (!def) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson || "{}");
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;

  const label = typeof obj.label === "string" && obj.label.trim() ? obj.label.trim() : prettifyType(name);
  const rationale = typeof obj.rationale === "string" ? obj.rationale.trim() : "";

  // args = everything except the shared label/rationale envelope fields.
  const args: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "label" || k === "rationale") continue;
    args[k] = v;
  }

  // Required-arg gate: every required key (minus the envelope) must be present
  // and non-empty.
  for (const key of def.required) {
    if (key === "label" || key === "rationale") continue;
    const v = args[key];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      return null;
    }
  }

  return { type: name, label, args, rationale };
}

/** Fallback parser for models/proxies that ignore tool-calling and instead
 *  emit actions as a fenced ```action JSON block in their text. Extracts every
 *  such block and validates each against the allowed set. Tolerant: malformed
 *  blocks are skipped, never thrown. */
export function parseFencedActions(text: string, allowed: AllowedActionDef[]): CopilotAction[] {
  const out: CopilotAction[] = [];
  // Match ```action ... ``` (case-insensitive label, optional whitespace).
  const re = /```(?:action|json)\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = m[1];
    if (!body) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of candidates) {
      if (c === null || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      const type = typeof obj.type === "string" ? obj.type : "";
      if (!type) continue;
      const rawArgs = obj.args && typeof obj.args === "object" && !Array.isArray(obj.args)
        ? (obj.args as Record<string, unknown>)
        : {};
      const merged = JSON.stringify({
        ...rawArgs,
        label: obj.label,
        rationale: obj.rationale,
      });
      const action = actionFromToolCall(type, merged, allowed);
      if (action) out.push(action);
    }
  }
  return out;
}

/** Strip fenced ```action / ```json blocks out of assistant text so the chat
 *  bubble shows prose only (the actions render as cards instead). */
export function stripFencedActions(text: string): string {
  return text.replace(/```(?:action|json)\s*\n[\s\S]*?```/gi, "").trim();
}

function prettifyType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
