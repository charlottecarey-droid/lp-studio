/**
 * AI audience-role tagging for an imported session catalog.
 *
 * Most conference pages never state who a session is for, so a URL import
 * lands mostly untagged and role matching has nothing to work with. This
 * infers the audience from what the page DOES say — title, description,
 * track, session type — and writes it into the same `tags.roles` the matcher
 * reads.
 *
 * VOCABULARY CONTRACT: the model is given the roles already in use (the
 * catalog's own tags first, then the tenant's brand personas) and told to
 * reuse them wherever they fit. Letting it free-associate would invent a third
 * vocabulary — the exact mismatch that made matching fail in the first place.
 * A new role is allowed only when nothing existing fits.
 *
 * Prompt builder and parser are pure and unit-tested; only
 * suggestSessionRoleTags touches the LLM.
 */

import { callAIChat } from "../ai-utils";

export interface TaggableSession {
  id: number;
  title: string;
  description?: string | null;
  sessionType?: string | null;
  track?: string | null;
}

/** Roles are short titles, not sentences — guards against a chatty model. */
const MAX_ROLE_LEN = 40;
const MAX_ROLES_PER_SESSION = 4;

export function buildRoleTaggingPrompt(
  sessions: TaggableSession[],
  vocabulary: string[],
): { systemPrompt: string; userPrompt: string } {
  const vocabLine = vocabulary.length > 0
    ? `EXISTING ROLE VOCABULARY (reuse these exact strings wherever one fits):\n${vocabulary.map((r) => `- ${r}`).join("\n")}`
    : "No roles exist yet — establish a small, consistent set and reuse it across sessions.";

  const systemPrompt = [
    "You label conference sessions with the attendee ROLES each one is for.",
    'Return ONLY JSON: {"tags": [{"sessionId": number, "roles": [string]}]}.',
    "Rules:",
    `- Reuse a role from the existing vocabulary whenever it fits — exact same spelling. Invent a new role only when nothing fits, and keep it a short job-title-like label (max ${MAX_ROLE_LEN} chars).`,
    `- 1–${MAX_ROLES_PER_SESSION} roles per session. Prefer fewer, more accurate roles over a long list.`,
    "- Infer ONLY from the session's own title, description, track and type. Never guess from the event name or from other sessions.",
    "- A session that is genuinely for everyone (keynote, opening, closing, welcome, social, meals) gets an EMPTY roles array — the matcher already treats those as open to all, and tagging them narrows them wrongly.",
    "- If a session is too vague to place, return an empty roles array rather than a guess.",
    "- Do not restate the title as a role. Roles describe PEOPLE, not topics.",
  ].join("\n");

  const sessionLines = sessions.map((s) => [
    `sessionId ${s.id}: ${s.title}`,
    s.sessionType ? `  type: ${s.sessionType}` : null,
    s.track ? `  track: ${s.track}` : null,
    s.description ? `  description: ${s.description.slice(0, 400)}` : null,
  ].filter(Boolean).join("\n")).join("\n\n");

  return {
    systemPrompt,
    userPrompt: [vocabLine, "", "SESSIONS:", sessionLines].join("\n"),
  };
}

/**
 * Validate the payload into a sessionId → roles map. Only requested ids are
 * kept; roles are trimmed, de-duplicated case-insensitively, length-capped,
 * and snapped back to the existing vocabulary's spelling when they differ only
 * by case — so "operations" never becomes a second chip beside "Operations".
 */
export function parseRoleTagPayload(
  raw: unknown,
  requestedIds: number[],
  vocabulary: string[] = [],
): Map<number, string[]> {
  const allowed = new Set(requestedIds);
  const canonical = new Map(vocabulary.map((v) => [v.trim().toLowerCase(), v.trim()]));
  const out = new Map<number, string[]>();
  const tags = (raw as { tags?: unknown[] })?.tags;
  if (!Array.isArray(tags)) return out;

  for (const item of tags) {
    const obj = (item ?? {}) as Record<string, unknown>;
    const id = typeof obj.sessionId === "number" ? obj.sessionId : NaN;
    if (!allowed.has(id)) continue;
    if (!Array.isArray(obj.roles)) continue;

    const seen = new Set<string>();
    const roles: string[] = [];
    for (const rawRole of obj.roles) {
      if (typeof rawRole !== "string") continue;
      const trimmed = rawRole.trim().slice(0, MAX_ROLE_LEN).trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      roles.push(canonical.get(key) ?? trimmed);
      if (roles.length >= MAX_ROLES_PER_SESSION) break;
    }
    // An empty array is a MEANINGFUL answer ("open to everyone") — keep it so
    // the caller can tell "considered and left open" from "not returned".
    out.set(id, roles);
  }
  return out;
}

/** Batch size per LLM call — keeps prompts well inside context on big agendas. */
export const TAGGING_BATCH_SIZE = 25;

export async function suggestSessionRoleTags(
  sessions: TaggableSession[],
  vocabulary: string[],
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  for (let i = 0; i < sessions.length; i += TAGGING_BATCH_SIZE) {
    const batch = sessions.slice(i, i + TAGGING_BATCH_SIZE);
    const { systemPrompt, userPrompt } = buildRoleTaggingPrompt(batch, vocabulary);
    const raw = await callAIChat({
      model: "gpt-4o",
      temperature: 0.2,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      timeoutMs: 90_000,
    });
    const parsed = parseRoleTagPayload(JSON.parse(raw), batch.map((s) => s.id), vocabulary);
    for (const [id, roles] of parsed) result.set(id, roles);
  }
  return result;
}
