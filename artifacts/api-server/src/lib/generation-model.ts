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

/** `{ temperature }` for models that take one, `{}` for models that don't.
 *  Spread into the chat-completion request instead of writing `temperature:`. */
export function samplingParams(
  model: string,
  temperature: number,
): { temperature: number } | Record<string, never> {
  return modelLocksTemperature(model) ? {} : { temperature };
}

/** Every path's resolved model — for the generation receipt / startup log. */
export function describeGenerationModels(env: Env = process.env): Record<GenerationModelPath, string> {
  const out = {} as Record<GenerationModelPath, string>;
  for (const p of GENERATION_MODEL_PATHS) out[p] = resolveGenerationModel(p, env);
  return out;
}
