/**
 * AI "why this matters" blurbs for agenda sessions (phase 2).
 *
 * One short personalized line per selected session, shown on the published
 * event-agenda page under the "Why this matters for you" label. GROUNDING
 * CONTRACT: the model may use ONLY the synced account facts and the session's
 * own content passed in the prompt — no invented metrics, initiatives, or
 * claims about the account. The blurb explains relevance, it does not assert
 * facts we don't have. Reps can edit every line afterwards (blurbs land in
 * selections[].blurbOverride, the same field the editor writes).
 *
 * The prompt builder is pure and unit-tested; only generateWhyAttendBlurbs
 * hits the LLM.
 */

import { callAIChat } from "../ai-utils";

export interface BlurbAccountFacts {
  name: string;
  industry?: string | null;
  segment?: string | null;
  abmTier?: string | null;
  numLocations?: number | null;
  city?: string | null;
  state?: string | null;
}

export interface BlurbSessionInput {
  id: number;
  title: string;
  description?: string | null;
  sessionType?: string | null;
  track?: string | null;
  roles?: string[];
}

// ─── Prompt (pure — unit-tested) ─────────────────────────────────────────────

export function buildWhyAttendPrompt(
  account: BlurbAccountFacts,
  attendeeRoles: string[],
  sessions: BlurbSessionInput[],
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    "You write one short \"why this session matters\" line per conference session, personalized for a specific attending company.",
    "Return ONLY JSON: {\"blurbs\": [{\"sessionId\": number, \"blurb\": string}]} with exactly one entry per session you were given.",
    "Rules:",
    "- One sentence per blurb, 26 words maximum, addressed to the company as \"you\"/\"your\". No exclamation marks.",
    "- GROUNDING: use ONLY the account facts and session content provided below. Never invent metrics, initiatives, tools, deals, or history for the account. If you can't connect a session to a provided fact, write a role- or topic-level line (e.g. why it suits their COO) instead of inventing a company-specific one.",
    "- Do not restate the session title or open with \"This session\". Vary sentence openings across blurbs.",
    "- Do not mention tiers, segments, or internal labels verbatim (\"Tier 1\", \"ABM\") — translate them into plain relevance.",
    "- Plain confident tone; no marketing superlatives (\"amazing\", \"can't-miss\").",
  ].join("\n");

  const facts = [
    `Company: ${account.name}`,
    account.industry ? `Industry: ${account.industry}` : null,
    account.segment ? `Segment: ${account.segment}` : null,
    account.numLocations ? `Locations: ${account.numLocations}` : null,
    account.city || account.state ? `Based in: ${[account.city, account.state].filter(Boolean).join(", ")}` : null,
    account.abmTier ? `Account tier (internal, do not mention): ${account.abmTier}` : null,
    attendeeRoles.length > 0 ? `Attending from ${account.name}: ${attendeeRoles.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const sessionLines = sessions.map((s) =>
    [
      `sessionId ${s.id}: ${s.title}`,
      s.sessionType ? `  type: ${s.sessionType}` : null,
      s.track ? `  track: ${s.track}` : null,
      s.roles?.length ? `  intended audience: ${s.roles.join(", ")}` : null,
      s.description ? `  description: ${s.description.slice(0, 600)}` : null,
    ].filter(Boolean).join("\n"),
  ).join("\n\n");

  const userPrompt = [
    "ACCOUNT FACTS (the only account information that exists — do not go beyond it):",
    facts,
    "",
    "SESSIONS:",
    sessionLines,
  ].join("\n");

  return { systemPrompt, userPrompt };
}

// ─── Parse/validate (pure — unit-tested) ─────────────────────────────────────

/**
 * Validate the LLM payload: keep only blurbs for requested session ids,
 * clamp length, drop empties. Missing sessions simply get no blurb — the
 * editor shows an empty input rather than a fabricated fallback.
 */
export function parseBlurbPayload(raw: unknown, requestedIds: number[]): Map<number, string> {
  const allowed = new Set(requestedIds);
  const out = new Map<number, string>();
  const blurbs = (raw as { blurbs?: unknown[] })?.blurbs;
  if (!Array.isArray(blurbs)) return out;
  for (const item of blurbs) {
    const obj = (item ?? {}) as Record<string, unknown>;
    const id = typeof obj.sessionId === "number" ? obj.sessionId : NaN;
    const blurb = typeof obj.blurb === "string" ? obj.blurb.trim() : "";
    if (!allowed.has(id) || !blurb) continue;
    out.set(id, blurb.slice(0, 300));
  }
  return out;
}

// ─── LLM call ────────────────────────────────────────────────────────────────

export async function generateWhyAttendBlurbs(
  account: BlurbAccountFacts,
  attendeeRoles: string[],
  sessions: BlurbSessionInput[],
): Promise<Map<number, string>> {
  if (sessions.length === 0) return new Map();
  const { systemPrompt, userPrompt } = buildWhyAttendPrompt(account, attendeeRoles, sessions);
  const raw = await callAIChat({
    model: "gpt-4o",
    temperature: 0.5,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    timeoutMs: 60_000,
  });
  return parseBlurbPayload(JSON.parse(raw), sessions.map((s) => s.id));
}
