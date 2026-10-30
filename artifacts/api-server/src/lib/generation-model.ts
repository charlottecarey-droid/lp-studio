/**
 * Generation model selection (Oct 2026, generation-quality step 2).
 *
 * Both page generators and the critique pass used to hardcode "gpt-4o". The
 * model is now resolved per PROMPT PATH from the environment so each path can
 * move to a current model independently and be reverted with one env change:
 *
 *   GENERATION_MODEL_<PATH>   e.g. GENERATION_MODEL_GENERAL=gpt-5
 *   GENERATION_MODEL          fallback for every path
 *   (default)                 "gpt-4o" — the model every path shipped on
 *
 * Paths: GENERAL | DSO_ENTERPRISE | DSO_PRACTICES | TEMPLATE | PLANNER
 * (the two-pass lineup planner) | MICROSITE | CRITIQUE (the copy-polish pass).
 *
 * Whatever is configured MUST be a model the AI proxy serves
 * (AI_INTEGRATIONS_OPENAI_BASE_URL) — an unknown model string fails every
 * generation and blanks the preview. gpt-5 is already served there
 * (routes/sales/draft-email.ts calls it).
 *
 * Sampling guard: the gpt-5 and o-series reasoning models reject any
 * `temperature` other than the default (the request 400s), so
 * `samplingParams` omits the parameter for them and keeps the tuned value
 * for every other model. This is why no call site may spell `temperature:`
 * directly — spread `samplingParams(model, t)` instead.
 */

export type GenerationModelPath =
  | "GENERAL"
  | "DSO_ENTERPRISE"
  | "DSO_PRACTICES"
  | "TEMPLATE"
  | "PLANNER"
  | "MICROSITE"
  | "CRITIQUE";

export const GENERATION_MODEL_PATHS: readonly GenerationModelPath[] = [
  "GENERAL",
  "DSO_ENTERPRISE",
  "DSO_PRACTICES",
  "TEMPLATE",
  "PLANNER",
  "MICROSITE",
  "CRITIQUE",
];

/** The model every generation path shipped on before per-path selection. */
export const DEFAULT_GENERATION_MODEL = "gpt-4o";

type Env = Record<string, string | undefined>;

function clean(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

/** The model a prompt path should call right now. */
export function resolveGenerationModel(
  path: GenerationModelPath,
  env: Env = process.env,
): string {
  return (
    clean(env[`GENERATION_MODEL_${path}`]) ??
    clean(env["GENERATION_MODEL"]) ??
    DEFAULT_GENERATION_MODEL
  );
}

/** True for models that only accept the default temperature (gpt-5 family,
 *  o1 / o3 / o4 reasoning models and their -mini / -pro variants). */
export function modelLocksTemperature(model: string): boolean {
  return /^(gpt-5|o[1-9])(\b|[-._])/i.test(model.trim());
}

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";
const REASONING_EFFORTS = new Set<string>(["minimal", "low", "medium", "high"]);

/** Reasoning effort for gpt-5 / o-series models, from GENERATION_REASONING_EFFORT.
 *  Unset → the parameter is omitted (the provider default, "medium" for gpt-5,
 *  which made page generations take 100–230 s in the first gpt-5 eval run).
 *  "low" or "minimal" is the recommended setting for page copy. */
export function resolveReasoningEffort(env: Env = process.env): ReasoningEffort | null {
  const v = clean(env["GENERATION_REASONING_EFFORT"])?.toLowerCase() ?? null;
  return v && REASONING_EFFORTS.has(v) ? (v as ReasoningEffort) : null;
}

/** The model-specific sampling parameters to spread into a chat-completion
 *  request instead of writing `temperature:` at the call site:
 *    • gpt-4o-class models → `{ temperature }`;
 *    • gpt-5 / o-series → no temperature (they reject non-default values),
 *      plus `reasoning_effort` when GENERATION_REASONING_EFFORT is set. */
export function samplingParams(
  model: string,
  temperature: number,
  env: Env = process.env,
): { temperature: number } | { reasoning_effort: ReasoningEffort } | Record<string, never> {
  if (!modelLocksTemperature(model)) return { temperature };
  const effort = resolveReasoningEffort(env);
  return effort ? { reasoning_effort: effort } : {};
}

/** Every path's resolved model — for the generation receipt / startup log. */
export function describeGenerationModels(env: Env = process.env): Record<GenerationModelPath, string> {
  const out = {} as Record<GenerationModelPath, string>;
  for (const p of GENERATION_MODEL_PATHS) out[p] = resolveGenerationModel(p, env);
  return out;
}
