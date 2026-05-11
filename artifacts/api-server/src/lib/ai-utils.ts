/**
 * Shared AI utilities used across sales routes (draft-email, person-brief, etc.)
 */

/** Returns the configured AI (OpenAI-compatible) client info, or null. */
export function getAIClient(): { baseURL: string; apiKey: string } | null {
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (integrationBase && integrationKey) {
    return { baseURL: integrationBase, apiKey: integrationKey };
  }
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) return { baseURL: "https://api.openai.com/v1", apiKey: directKey };
  return null;
}

/** Fetch with an AbortController-based timeout. */
export async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Error class thrown by callAIChat. Carries a stable `code` so route handlers
 * can map upstream failures to specific HTTP responses instead of a blanket
 * "Failed to generate…" 500.
 */
export class AIChatError extends Error {
  code: "ai_not_configured" | "ai_timeout" | "ai_upstream" | "ai_empty" | "ai_parse";
  status: number;
  upstreamStatus?: number;
  upstreamBody?: string;
  constructor(
    code: AIChatError["code"],
    message: string,
    status = 502,
    upstreamStatus?: number,
    upstreamBody?: string,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.upstreamStatus = upstreamStatus;
    this.upstreamBody = upstreamBody;
  }
}

export interface AIChatOptions {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  responseFormat?: { type: "json_object" };
  timeoutMs?: number;
  /** Optional Gemini fallback model if the OpenAI call fails. */
  geminiFallbackModel?: string;
}

/**
 * Calls the configured OpenAI-compatible chat-completions endpoint. Throws
 * AIChatError with a specific code on failure so the caller can return a
 * meaningful message to the client instead of a generic 500.
 */
export async function callAIChat(opts: AIChatOptions): Promise<string> {
  const ai = getAIClient();
  if (!ai) {
    throw new AIChatError(
      "ai_not_configured",
      "AI is not configured for this environment. Set the OpenAI integration or OPENAI_API_KEY.",
      503,
    );
  }
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.responseFormat) body.response_format = opts.responseFormat;

  const timeoutMs = opts.timeoutMs ?? 45000;
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${ai.baseURL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    throw new AIChatError(
      isAbort ? "ai_timeout" : "ai_upstream",
      isAbort
        ? `AI request timed out after ${Math.round(timeoutMs / 1000)}s.`
        : `AI request failed: ${err instanceof Error ? err.message : String(err)}`,
      isAbort ? 504 : 502,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    // Try Gemini fallback if configured
    if (opts.geminiFallbackModel) {
      const geminiBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (geminiBase && geminiKey) {
        try {
          const geminiRes = await fetchWithTimeout(
            `${geminiBase}/chat/completions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${geminiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...body, model: opts.geminiFallbackModel }),
            },
            Math.min(timeoutMs, 30000),
          );
          if (geminiRes.ok) {
            const data = await geminiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
            const content = data.choices?.[0]?.message?.content ?? "";
            if (content) return content;
          } else {
            const gtext = await geminiRes.text().catch(() => "");
            console.error("[ai] Gemini fallback failed:", geminiRes.status, gtext.slice(0, 500));
          }
        } catch (err) {
          console.error("[ai] Gemini fallback threw:", err);
        }
      }
    }
    throw new AIChatError(
      "ai_upstream",
      `AI provider returned ${response.status}.`,
      502,
      response.status,
      text.slice(0, 500),
    );
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = await response.json() as typeof data;
  } catch (err) {
    throw new AIChatError(
      "ai_parse",
      `AI response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new AIChatError("ai_empty", "AI returned an empty response.", 502);
  }
  return content;
}

/** Maps an AIChatError to a user-facing message suitable for an `error` JSON field. */
export function aiErrorMessage(err: unknown, fallback: string): { status: number; message: string } {
  if (err instanceof AIChatError) {
    switch (err.code) {
      case "ai_not_configured":
        return { status: 503, message: err.message };
      case "ai_timeout":
        return { status: 504, message: err.message };
      case "ai_empty":
        return { status: 502, message: "AI returned an empty response. Please try again." };
      case "ai_parse":
        return { status: 502, message: "AI returned a malformed response. Please try again." };
      case "ai_upstream":
      default:
        return {
          status: err.status,
          message: err.upstreamStatus
            ? `AI provider error (${err.upstreamStatus}). Please try again in a moment.`
            : err.message,
        };
    }
  }
  if (err instanceof Error) {
    return { status: 500, message: `${fallback}: ${err.message}` };
  }
  return { status: 500, message: fallback };
}

/** Account briefing data shape (superset used by draft-email & person-brief). */
export type BriefingData = {
  overview?: string;
  tier?: string;
  organizationalModel?: string;
  leadership?: Array<{ name: string; title: string }>;
  sizeAndLocations?: {
    locationCount?: string;
    regions?: string[];
    headquarters?: string;
    ownership?: string;
  };
  recentNews?: Array<{ headline: string; summary: string; date?: string }>;
  buyingCommittee?: Array<{
    role: string;
    painPoints: string;
    recommendedMessage: string;
  }>;
  fitAnalysis?: {
    primaryValueProp?: string;
    keyPainPoints?: string[];
    proofPoints?: string[];
    potentialObjections?: string[];
    recommendedApproach?: string;
  };
  talkingPoints?: string[];
  pageRecommendations?: {
    heroHeadline?: string;
    contentFocus?: string;
    ctaStrategy?: string;
  };
};
