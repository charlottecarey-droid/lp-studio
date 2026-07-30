/**
 * URL agenda import for the conference agenda builder (phase 2).
 *
 * Public conference agendas (RainFocus/Cvent/Swapcard widgets and bespoke
 * pages) are almost always client-rendered — a plain fetch returns an empty
 * shell (verified against procore.com/groundbreak/agenda: zero sessions in
 * the static HTML, 166 in the rendered DOM). So the pipeline is:
 *
 *   1. Firecrawl scrape with a JS-render wait → markdown of the RENDERED page
 *   2. Chunk the markdown on paragraph boundaries (agendas run 100k+ chars)
 *   3. LLM extraction per chunk → session rows (JSON mode, low temperature)
 *   4. Normalize (ISO dates, 24h times) — the route upserts by source_key so
 *      re-imports update instead of duplicating
 *
 * Prompt builders and normalizers are pure and exported for unit tests; only
 * scrapeAgendaMarkdown / extractSessionsFromMarkdown touch the network.
 *
 * SSRF: callers MUST validate the user-pasted URL with isSafePublicHost
 * before handing it here (the firecrawl-lockdown contract for URL-ingest
 * paths). This module assumes the URL is already vetted.
 */

import { callAIChat } from "../ai-utils";
import { fetchWithTimeout } from "../ai-utils";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? "";

/** One session as extracted from the page, pre-upsert. */
export interface ImportedSessionRow {
  title: string;
  day?: string;        // "2026-10-20"
  startTime?: string;  // "09:00"
  endTime?: string;
  room?: string;
  sessionType?: string;
  track?: string;
  description?: string;
  speakers?: { name: string; title?: string }[];
  /** `segments` is the audience PARTITION axis — the only one the matcher
   *  excludes on. See lib/sales/agenda-matching.ts. */
  tags?: { roles?: string[]; industries?: string[]; segments?: string[]; topics?: string[] };
}

export interface AgendaEventContext {
  name: string;
  startDate: string | null; // "2026-10-20" — lets the model resolve "Tuesday, Oct 20"
  endDate: string | null;
}

/** Hard cap on markdown fed to extraction (chars). Beyond this we truncate
 *  and report it — silent truncation would read as "imported everything". */
export const AGENDA_MARKDOWN_CAP = 120_000;
/** Per-LLM-call chunk size (chars). */
export const AGENDA_CHUNK_SIZE = 20_000;

// ─── Scrape ──────────────────────────────────────────────────────────────────

/**
 * Firecrawl scrape with a JS-render wait. Returns { markdown, truncated } —
 * empty markdown means the page was unreadable (caller maps to a 422).
 */
export async function scrapeAgendaMarkdown(url: string): Promise<{ markdown: string; truncated: boolean }> {
  if (!FIRECRAWL_API_KEY) {
    throw new AgendaImportError("scrape_not_configured", "URL import isn't configured (missing Firecrawl key).");
  }
  let resp: Response;
  try {
    resp = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          // Agenda widgets (RainFocus etc.) hydrate after load; without a
          // render wait the markdown is the empty promotional shell.
          waitFor: 5000,
        }),
      },
      // Render wait + long session lists make these scrapes slower than the
      // brand-import ones; 45s keeps the worst public agenda pages inside it.
      45_000,
    );
  } catch (err) {
    throw new AgendaImportError(
      "scrape_failed",
      `Couldn't reach the page: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!resp.ok) {
    throw new AgendaImportError("scrape_failed", `The scraper returned ${resp.status} for that URL.`);
  }
  const data = (await resp.json()) as { data?: { markdown?: string } };
  const raw = data.data?.markdown ?? "";
  const truncated = raw.length > AGENDA_MARKDOWN_CAP;
  return { markdown: truncated ? raw.slice(0, AGENDA_MARKDOWN_CAP) : raw, truncated };
}

export class AgendaImportError extends Error {
  code: "scrape_not_configured" | "scrape_failed" | "page_empty" | "extract_failed";
  constructor(code: AgendaImportError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

// ─── Chunking ────────────────────────────────────────────────────────────────

/**
 * Split markdown into extraction-sized chunks on blank-line boundaries so a
 * session's fields never straddle two chunks. Falls back to a hard split for
 * pathological single-paragraph inputs.
 */
export function chunkAgendaMarkdown(markdown: string, chunkSize = AGENDA_CHUNK_SIZE): string[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];
  if (trimmed.length <= chunkSize) return [trimmed];

  const paragraphs = trimmed.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      // Pathological paragraph — flush and hard-split it.
      if (current) { chunks.push(current); current = ""; }
      for (let i = 0; i < para.length; i += chunkSize) {
        chunks.push(para.slice(i, i + chunkSize));
      }
      continue;
    }
    if (current.length + para.length + 2 > chunkSize) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ─── Extraction prompt (pure — unit-tested) ─────────────────────────────────

export function buildAgendaExtractionPrompt(
  chunk: string,
  event: AgendaEventContext,
  chunkIndex: number,
  chunkCount: number,
): { systemPrompt: string; userPrompt: string } {
  const dateContext = event.startDate
    ? `The event runs ${event.startDate}${event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ""}. Resolve weekday/day labels (e.g. "Tuesday, Oct 20") to ISO dates inside that range.`
    : "If the page shows dates, output them as ISO YYYY-MM-DD; otherwise omit `day`.";

  const systemPrompt = [
    "You extract conference sessions from the markdown of an event agenda page.",
    "Return ONLY JSON: {\"sessions\": [...]} — an array of session objects with these fields:",
    '  title (required, string)',
    '  day (optional, "YYYY-MM-DD")',
    '  startTime / endTime (optional, 24-hour "HH:MM")',
    '  room (optional), sessionType (optional, e.g. "Keynote"/"Workshop"/"Breakout"), track (optional)',
    "  description (optional — the session's own summary text, verbatim or lightly trimmed; do NOT write new copy)",
    '  speakers (optional array of {name, title} — title is the displayed role line, e.g. "CEO, theLinkai")',
    '  tags (optional {roles: [], industries: [], topics: []}) — roles ONLY when the page states an audience (e.g. a "WHO IT\'S FOR:" line); never invent them.',
    "Rules:",
    "- Extract EVERY session in the text, in order. Skip navigation, filters, sponsor lists, and testimonial copy.",
    "- Copy fields from the page; never fabricate times, rooms, or speakers that are not present.",
    "- Truncated descriptions (ending in \"Show more\"/ellipsis) are fine — keep what's there and drop the trailing marker.",
    `- ${dateContext}`,
    "- If the chunk contains no sessions, return {\"sessions\": []}.",
  ].join("\n");

  const userPrompt = [
    `Event: ${event.name}`,
    `Agenda page markdown (chunk ${chunkIndex + 1} of ${chunkCount}):`,
    "---",
    chunk,
    "---",
  ].join("\n");

  return { systemPrompt, userPrompt };
}

// ─── Normalization (pure — unit-tested) ──────────────────────────────────────

function normTime(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  // "09:00" / "9:00"
  let m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) {
    const h = parseInt(m[1], 10);
    if (h > 23) return undefined;
    return `${String(h).padStart(2, "0")}:${m[2]}`;
  }
  // "9:00 AM" / "12:30 pm" — belt-and-braces; the prompt asks for 24h.
  m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s);
  if (m) {
    let h = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return `${String(h).padStart(2, "0")}:${m[2]}`;
  }
  return undefined;
}

function normDay(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

function normString(v: unknown, max = 4000): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function normStringArray(v: unknown, maxItems = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().slice(0, 80))
    .slice(0, maxItems);
}

/** Validate + coerce one LLM extraction payload into upsertable rows. */
export function normalizeExtractedSessions(raw: unknown): ImportedSessionRow[] {
  const sessions = (raw as { sessions?: unknown[] })?.sessions;
  if (!Array.isArray(sessions)) return [];
  const rows: ImportedSessionRow[] = [];
  for (const item of sessions) {
    const obj = (item ?? {}) as Record<string, unknown>;
    const title = normString(obj.title, 300);
    if (!title) continue;
    const speakers = Array.isArray(obj.speakers)
      ? (obj.speakers as unknown[])
          .map((sp) => {
            const s = (sp ?? {}) as Record<string, unknown>;
            const name = normString(s.name, 120);
            if (!name) return null;
            return { name, title: normString(s.title, 160) };
          })
          .filter((s): s is { name: string; title: string | undefined } => s !== null)
          .slice(0, 10)
      : undefined;
    const rawTags = (obj.tags ?? {}) as Record<string, unknown>;
    rows.push({
      title,
      day: normDay(obj.day),
      startTime: normTime(obj.startTime),
      endTime: normTime(obj.endTime),
      room: normString(obj.room, 120),
      sessionType: normString(obj.sessionType, 60),
      track: normString(obj.track, 80),
      description: normString(obj.description),
      speakers,
      tags: {
        roles: normStringArray(rawTags.roles),
        industries: normStringArray(rawTags.industries),
        topics: normStringArray(rawTags.topics),
      },
    });
  }
  return rows;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

/**
 * Scrape + extract an agenda URL into normalized session rows. Chunks run
 * sequentially (each is one JSON-mode LLM call); a failed chunk fails the
 * whole import — a partial silent import would look complete to the rep.
 */
export async function importAgendaFromUrl(
  url: string,
  event: AgendaEventContext,
): Promise<{ rows: ImportedSessionRow[]; truncated: boolean; chunkCount: number }> {
  const { markdown, truncated } = await scrapeAgendaMarkdown(url);
  if (!markdown.trim()) {
    throw new AgendaImportError(
      "page_empty",
      "The page rendered empty — it may block scrapers or need a login. Try the CSV import instead.",
    );
  }
  const chunks = chunkAgendaMarkdown(markdown);
  const rows: ImportedSessionRow[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const { systemPrompt, userPrompt } = buildAgendaExtractionPrompt(chunks[i], event, i, chunks.length);
    let parsed: unknown;
    try {
      const raw = await callAIChat({
        model: "gpt-4o",
        temperature: 0.1,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        timeoutMs: 90_000,
      });
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new AgendaImportError(
        "extract_failed",
        `Session extraction failed on chunk ${i + 1}/${chunks.length}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    rows.push(...normalizeExtractedSessions(parsed));
  }
  return { rows, truncated, chunkCount: chunks.length };
}
