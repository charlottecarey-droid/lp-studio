/**
 * Import a conference agenda straight from RainFocus.
 *
 * Most large events (Procore Groundbreak, Dreamforce, Cisco Live…) run their
 * catalog on RainFocus and embed it as a widget:
 *
 *   window.widget = new Rainfocus.Widget({
 *     apiToken: '…', widgetId: '…', env: 'prod'
 *   })
 *
 * That embed is public by design — the token ships in client-side HTML so the
 * browser can call the catalog API. Given the pair we can query the catalog
 * DIRECTLY, which is strictly better than the Firecrawl + LLM path in
 * `agenda-import.ts`:
 *
 *   • The scrape route only ever saw rendered HTML, so session type, track and
 *     audience had to be inferred by a model. RainFocus returns them as typed
 *     `attributevalues` (Role, Audience, Topic, SessionType, BreakoutTrack) —
 *     no inference, no hallucinated tags, no per-chunk token spend.
 *   • `times[]` carries a real ISO date plus 24h start/end, so calendar (.ics)
 *     data comes for free instead of being parsed out of "9:00 AM – 10:00 AM".
 *   • Pagination is explicit, so a 168-session catalog arrives complete rather
 *     than truncated at a character cap.
 *
 * The Firecrawl importer stays for events that AREN'T on RainFocus.
 *
 * IMPORTANT API QUIRK: this API answers HTTP 200 even when it refuses you —
 * failures come back as `{responseCode: "124", responseMessage: "Access to API
 * endpoint session denied."}`. Anything that only checks `res.ok` will happily
 * treat a refusal as an empty catalog, so `responseCode === "0"` is the real
 * success test.
 */
import type { ImportedSessionRow } from "./agenda-import";

/** Hosts we will talk to, keyed by the embed's `env`. An allowlist rather than
 *  string interpolation: `env` comes from user-pasted text and must never be
 *  able to point this at an arbitrary origin. */
const ENV_HOSTS: Record<string, string> = {
  prod: "https://events.rainfocus.com",
  stg: "https://events-stg.rainfocus.com",
  staging: "https://events-stg.rainfocus.com",
  dev: "https://events-dev.rainfocus.com",
};

export interface RainfocusCredentials {
  apiToken: string;
  widgetId: string;
  /** Defaults to "prod" — what every public embed uses. */
  env: string;
}

/** RainFocus ids are opaque alphanumeric strings; reject anything else rather
 *  than forwarding punctuation into a header value. */
const ID_RE = /^[A-Za-z0-9_@.-]{8,128}$/;

/**
 * Pull credentials out of a pasted embed snippet.
 *
 * Deliberately tolerant about the surrounding markup — people paste the whole
 * `<html>` document, just the `<script>` block, or sometimes only the two
 * values. All we need is the three fields, in either quote style.
 */
export function parseRainfocusEmbed(snippet: string): RainfocusCredentials | { error: string } {
  const field = (name: string): string => {
    // Allow a closing quote before the colon: the key is sometimes pasted
    // JSON-style (`"apiToken": "…"`) rather than as a bare JS property.
    const m = new RegExp(`${name}['"\`]?\\s*:\\s*['"\`]([^'"\`]+)['"\`]`, "i").exec(snippet);
    return (m?.[1] ?? "").trim();
  };
  const apiToken = field("apiToken");
  const widgetId = field("widgetId");
  const env = (field("env") || "prod").toLowerCase();

  if (!apiToken || !widgetId) {
    return { error: "Couldn't find apiToken and widgetId in that snippet. Paste the whole RainFocus embed script." };
  }
  if (!ID_RE.test(apiToken) || !ID_RE.test(widgetId)) {
    return { error: "That apiToken or widgetId doesn't look like a RainFocus id." };
  }
  if (!ENV_HOSTS[env]) {
    return { error: `Unknown RainFocus env "${env}". Expected prod, stg or dev.` };
  }
  return { apiToken, widgetId, env };
}

export function rainfocusHost(env: string): string | null {
  return ENV_HOSTS[env.toLowerCase()] ?? null;
}

/* ── catalog fetch ─────────────────────────────────────────────────────── */

/**
 * Requested page size. RainFocus reports a `paginationMax` of 10 000 but
 * SERVES AT MOST 50 PER PAGE regardless of what you ask for — verified live
 * against a 168-session catalog. So pagination must advance by the number of
 * items actually returned, never by the number requested; assuming otherwise
 * silently truncated the import to the first 50.
 */
const PAGE_SIZE = 50;
/** Hard ceiling on requests, so a lying `totalSearchItems` can't loop forever. */
const MAX_PAGES = 60;

export type RainfocusType = "session" | "speaker" | "exhibitor";

export interface RainfocusFetchResult {
  items: Record<string, unknown>[];
  total: number;
  /** True when the catalog held more than MAX_PAGES × PAGE_SIZE. Reported. */
  truncated: boolean;
}

type Fetcher = typeof fetch;

/**
 * Fetch every item of one catalog type, following pagination.
 *
 * `fetchImpl` is injectable so the mapping tests don't need the network.
 */
export async function fetchRainfocusCatalog(
  creds: RainfocusCredentials,
  type: RainfocusType,
  fetchImpl: Fetcher = fetch,
): Promise<RainfocusFetchResult | { error: string }> {
  const host = rainfocusHost(creds.env);
  if (!host) return { error: `Unknown RainFocus env "${creds.env}".` };

  const items: Record<string, unknown>[] = [];
  let total = 0;
  let requests = 0;

  while (requests < MAX_PAGES) {
    let payload: Record<string, unknown>;
    try {
      const res = await fetchImpl(`${host}/api/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          rfWidgetId: creds.widgetId,
          rfApiProfileId: creds.apiToken,
        },
        body: new URLSearchParams({
          type,
          size: String(PAGE_SIZE),
          // Offset by what we HAVE, not by page × requested size — the server
          // may return fewer than requested (it caps at 50).
          from: String(items.length),
        }).toString(),
      });
      payload = (await res.json()) as Record<string, unknown>;
    } catch {
      return { error: "Couldn't reach RainFocus." };
    }

    // HTTP 200 + a non-zero responseCode is still a failure (see file header).
    const code = String(payload.responseCode ?? "");
    if (code !== "0") {
      const msg = String(payload.responseMessage ?? "RainFocus refused the request.");
      return { error: `RainFocus: ${msg}` };
    }

    // THE RESPONSE SHAPE CHANGES BETWEEN PAGES. Verified live: the first page
    // (`from=0`) comes back sectioned as `{sectionList:[{items:[…]}]}`, while
    // every subsequent page is FLAT — `{items:[…], total, numItems, from}` with
    // no sectionList at all. Reading only one shape made page 2 look empty and
    // silently truncated a 168-session catalog to 50. Accept both.
    const pageItems: Record<string, unknown>[] = [];
    const sections = Array.isArray(payload.sectionList) ? payload.sectionList : [];
    for (const s of sections) {
      const sec = (s ?? {}) as Record<string, unknown>;
      if (Array.isArray(sec.items)) pageItems.push(...(sec.items as Record<string, unknown>[]));
    }
    if (Array.isArray(payload.items)) {
      pageItems.push(...(payload.items as Record<string, unknown>[]));
    }
    // Likewise the total is `totalSearchItems` on the sectioned page and plain
    // `total` on the flat ones.
    total = Number(payload.totalSearchItems ?? payload.total ?? total) || total;
    items.push(...pageItems);
    requests += 1;
    // Stop on an empty page (nothing left) or once we hold the reported total.
    // NOT on "fewer than requested" — that's normal here and stopping on it is
    // what truncated the import.
    if (pageItems.length === 0) break;
    if (total > 0 && items.length >= total) break;
  }

  return {
    items,
    total: total || items.length,
    truncated: requests >= MAX_PAGES && total > 0 && items.length < total,
  };
}

/* ── mapping ───────────────────────────────────────────────────────────── */

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** RainFocus abstracts are HTML fragments (`<br/>`, entities, occasional tags). */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

/**
 * Split a Procore-style abstract into its labelled sections.
 *
 * These abstracts are written as "WHO IT'S FOR: … OVERVIEW: …". The overview is
 * the description a reader wants; the who-it's-for line is audience metadata
 * that would read as noise on the page (and is already captured as Role tags),
 * so it's returned separately rather than printed. An abstract with no labels
 * is used verbatim.
 */
export function splitAbstract(raw: string): { description: string; audienceLine: string } {
  const text = htmlToText(raw);
  if (!text) return { description: "", audienceLine: "" };

  const overview = /^[\s\S]*?\bOVERVIEW\s*:\s*([\s\S]*)$/i.exec(text);
  const who = /\bWHO\s+IT'?S\s+FOR\s*:\s*([^\n]*)/i.exec(text);
  const audienceLine = who ? who[1].trim() : "";

  if (overview) {
    // Drop any trailing labelled block after the overview (e.g. "SPEAKERS:").
    const body = overview[1].split(/\n\s*[A-Z][A-Z '&/-]{3,}\s*:\s*\n?/)[0];
    return { description: body.trim(), audienceLine };
  }
  if (who) {
    return { description: text.replace(who[0], "").trim(), audienceLine };
  }
  return { description: text, audienceLine };
}

/** Collect the values of one `attributevalues` attribute, in display order. */
function attrValues(item: Record<string, unknown>, attribute: string): string[] {
  const raw = Array.isArray(item.attributevalues) ? item.attributevalues : [];
  const out: { value: string; order: number }[] = [];
  for (const a of raw) {
    const av = (a ?? {}) as Record<string, unknown>;
    const id = str(av.attribute_id) || str(av.attribute);
    if (id.toLowerCase() !== attribute.toLowerCase()) continue;
    const value = str(av.value) || str(av.displayName) || str(av.name);
    if (value) out.push({ value, order: Number(av.displayorder ?? 0) });
  }
  out.sort((a, b) => a.order - b.order);
  return [...new Set(out.map((o) => o.value))];
}

/**
 * Strip a catalog's "repeat offering" bookkeeping off a session title.
 *
 * Procore's catalog runs the same workshop in several slots and appends
 * "OFFERING 2" / "OFFERING 3" to distinguish the rows. That's internal
 * scheduling detail — on a customer-facing agenda it reads like a typo.
 *
 * Only a TRAILING marker is removed, so a title that genuinely contains the
 * word ("What Your Offering Says About You") is untouched. A title that is
 * nothing BUT the marker is left alone rather than emptied.
 */
// "offering" only. `session` was tempting and wrong: "Breakout Session 2" is a
// real title, and stripping it would rename someone's session. `offering` in
// trailing position is unambiguous scheduling bookkeeping.
const OFFERING_SUFFIX_RE =
  /[\s\u2013\u2014\-:,(\[]*\boffering\s*#?\s*\d+\s*[)\]]*\s*$/i;

export function cleanSessionTitle(raw: string): string {
  const title = raw.trim();
  const stripped = title.replace(OFFERING_SUFFIX_RE, "").replace(/\s{2,}/g, " ").trim();
  // Don't hand back an empty title, and don't strip everything meaningful.
  return stripped.length >= 3 ? stripped : title;
}

/** Earliest scheduled time — a session can recur, and the agenda wants the
 *  slot it actually sits in. */
function firstTime(item: Record<string, unknown>): Record<string, unknown> | null {
  const times = Array.isArray(item.times) ? (item.times as Record<string, unknown>[]) : [];
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => str(a.daySort).localeCompare(str(b.daySort)) || str(a.startTime).localeCompare(str(b.startTime)));
  return sorted[0] ?? null;
}

/**
 * Map one RainFocus session onto the row shape the CSV and URL importers
 * already produce, so it flows through the SAME `upsertSessionRows` path —
 * which means source-key matching and `tagsEditedInApp` protection come along
 * for free.
 */
export function mapRainfocusSession(item: Record<string, unknown>): ImportedSessionRow | null {
  const rawTitle = str(item.title);
  if (!rawTitle) return null;
  const title = cleanSessionTitle(rawTitle);

  const t = firstTime(item);
  const { description } = splitAbstract(str(item.abstract));

  const speakers = (Array.isArray(item.participants) ? item.participants : [])
    .map((p) => {
      const sp = (p ?? {}) as Record<string, unknown>;
      const name = str(sp.fullName) || [str(sp.firstName), str(sp.lastName)].filter(Boolean).join(" ");
      if (!name) return null;
      const jobTitle = str(sp.jobTitle) || str(sp.globalJobtitle);
      const company = str(sp.companyName) || str(sp.globalCompany);
      // One field on our side, so fold company in where both exist.
      const titleParts = [jobTitle, company].filter(Boolean);
      return { name, ...(titleParts.length ? { title: titleParts.join(", ") } : {}) };
    })
    .filter((s): s is { name: string; title?: string } => s !== null);

  const roles = attrValues(item, "Role");
  const industries = attrValues(item, "Audience");
  const topics = attrValues(item, "Topic");

  const sessionType = str(item.type) || attrValues(item, "SessionType")[0] || "";
  const track = attrValues(item, "BreakoutTrack")[0] || "";

  const row: ImportedSessionRow = { title };
  if (description) row.description = description;
  if (sessionType) row.sessionType = sessionType;
  if (track) row.track = track;
  if (speakers.length) row.speakers = speakers;
  if (t) {
    const date = str(t.date);
    const start = str(t.startTime);
    const end = str(t.endTime);
    const room = str(t.room);
    if (date) row.day = date;
    if (start) row.startTime = start;
    if (end) row.endTime = end;
    if (room) row.room = room;
  }
  if (roles.length || industries.length || topics.length) {
    row.tags = {
      ...(roles.length ? { roles } : {}),
      ...(industries.length ? { industries } : {}),
      ...(topics.length ? { topics } : {}),
    };
  }
  return row;
}

export interface RainfocusMapResult {
  rows: ImportedSessionRow[];
  /** Items we couldn't use (no title) — reported, not silently dropped. */
  skipped: number;
}

export function mapRainfocusSessions(items: Record<string, unknown>[]): RainfocusMapResult {
  const rows: ImportedSessionRow[] = [];
  const originals: string[] = [];
  let skipped = 0;
  for (const item of items) {
    const row = mapRainfocusSession(item);
    if (row) {
      rows.push(row);
      originals.push(str(item.title));
    } else skipped += 1;
  }

  /**
   * Put the offering marker BACK on any row whose cleaned title would collide.
   *
   * The stored source key is (title, day, startTime), so two offerings that
   * happen to share a slot would become one row once the suffix is gone —
   * silently losing a session. Two offerings normally run at DIFFERENT times,
   * which is the whole point of them, so this is a rare guard rather than the
   * common path; it just must not lose data when it fires.
   */
  const keyOf = (r: ImportedSessionRow) => `${r.title.toLowerCase()}|${r.day ?? ""}|${r.startTime ?? ""}`;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(keyOf(r), (counts.get(keyOf(r)) ?? 0) + 1);
  for (let i = 0; i < rows.length; i += 1) {
    if ((counts.get(keyOf(rows[i])) ?? 0) > 1 && originals[i]) {
      rows[i] = { ...rows[i], title: originals[i].trim() };
    }
  }

  return { rows, skipped };
}

/** Distinct tag vocabulary the import brought in, for the UI to show. */
export function rainfocusVocabulary(rows: ImportedSessionRow[]): {
  roles: string[]; industries: string[]; topics: string[];
} {
  const pick = (key: "roles" | "industries" | "topics"): string[] =>
    [...new Set(rows.flatMap((r) => r.tags?.[key] ?? []))].sort();
  return { roles: pick("roles"), industries: pick("industries"), topics: pick("topics") };
}


/* ── speakers + exhibitors ─────────────────────────────────────────────────
 * An agenda page is more than its schedule: the block has a keynote-speakers
 * section and a sponsors wall, and RainFocus already holds both. Mapping them
 * here means one paste fills the whole template instead of the schedule only.
 */

/** Matches the block's EvaPerson (speakers section). */
export interface RainfocusSpeaker {
  name: string;
  title?: string;
  bio?: string;
  imageUrl?: string;
}

/** Matches the block's EvaSponsor. */
export interface RainfocusSponsor {
  name: string;
  tier?: string;
  logoUrl?: string;
  url?: string;
}

/**
 * Map a speaker-catalog item.
 *
 * `photoURL` is only used when the mark is actually published — RainFocus
 * serves a grey "no headshot" placeholder otherwise, and a wall of identical
 * placeholders looks worse than initials, which the block already renders.
 */
export function mapRainfocusSpeaker(item: Record<string, unknown>): RainfocusSpeaker | null {
  const name = str(item.fullName) || [str(item.firstName), str(item.lastName)].filter(Boolean).join(" ");
  if (!name) return null;
  const jobTitle = str(item.jobTitle) || str(item.globalJobtitle);
  const company = str(item.companyName) || str(item.globalCompany);
  const titleParts = [jobTitle, company].filter(Boolean);
  const photo = str(item.photoURL);
  const published = str(item["Speaker-Photo-Published"]).toLowerCase() === "published";
  const usablePhoto = published && photo && !/no[-%20\s]*headshot/i.test(photo) ? photo : "";

  const out: RainfocusSpeaker = { name };
  if (titleParts.length) out.title = titleParts.join(", ");
  const bio = htmlToText(str(item.bio));
  if (bio) out.bio = bio;
  if (usablePhoto) out.imageUrl = usablePhoto;
  return out;
}

/**
 * Which speakers are worth featuring.
 *
 * A 137-person catalog is not a keynote section. Ranked by how prominent the
 * speaker is (a real headshot and a bio are the signals RainFocus gives us)
 * and capped, because the point of the section is billing, not a directory.
 */
export function pickFeaturedSpeakers(items: Record<string, unknown>[], limit = 8): RainfocusSpeaker[] {
  const mapped = items.map(mapRainfocusSpeaker).filter((s): s is RainfocusSpeaker => s !== null);
  const score = (s: RainfocusSpeaker): number => (s.imageUrl ? 2 : 0) + (s.bio ? 1 : 0);
  return [...mapped]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => score(b.s) - score(a.s) || a.i - b.i) // stable within a score
    .slice(0, limit)
    .map((x) => x.s);
}

export function mapRainfocusSponsor(item: Record<string, unknown>): RainfocusSponsor | null {
  const name = str(item.name);
  if (!name) return null;
  const out: RainfocusSponsor = { name };
  // Exhibitor "type" is the closest thing RainFocus has to a sponsorship tier.
  const tier = attrValues(item, "ExhibitorType")[0] || attrValues(item, "SponsorLevel")[0] || "";
  if (tier) out.tier = tier;
  const url = str(item.externalLink) || str(item.url);
  if (url) out.url = url;
  const logo = str(item.logoURL) || str(item.logo);
  if (logo) out.logoUrl = logo;
  return out;
}

export function mapRainfocusSponsors(items: Record<string, unknown>[]): RainfocusSponsor[] {
  return items.map(mapRainfocusSponsor).filter((s): s is RainfocusSponsor => s !== null);
}

/**
 * Event-level details inferred from the session catalog.
 *
 * RainFocus has no "event" endpoint on a widget token, but every session
 * carries the event name and a date, so the span and title can be derived —
 * which is enough to fill the hero without the rep retyping it.
 */
export interface RainfocusEventDetails {
  eventName: string;
  startDate: string;
  endDate: string;
  /** Distinct room/venue names, most frequent first — a hint for "location". */
  venues: string[];
}

export function deriveEventDetails(items: Record<string, unknown>[]): RainfocusEventDetails {
  const dates = new Set<string>();
  const names = new Map<string, number>();
  const venues = new Map<string, number>();
  for (const item of items) {
    const n = str(item.eventName);
    if (n) names.set(n, (names.get(n) ?? 0) + 1);
    const times = Array.isArray(item.times) ? (item.times as Record<string, unknown>[]) : [];
    for (const t of times) {
      const d = str(t.date);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dates.add(d);
      const room = str(t.room);
      if (room) venues.set(room, (venues.get(room) ?? 0) + 1);
    }
  }
  const sorted = [...dates].sort();
  const topName = [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return {
    eventName: topName,
    startDate: sorted[0] ?? "",
    endDate: sorted[sorted.length - 1] ?? "",
    venues: [...venues.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v).slice(0, 5),
  };
}
