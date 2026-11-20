/**
 * Recommended plays for a Partner Hub's account team.
 *
 * Each play is a rule over numbers the team can see for themselves (where the
 * practices are, which are live, who looks after them, what has been sent,
 * how long since the customer looked in), so its "why" is always checkable.
 * Nothing here is a guess by a model. Pure: the hub's data is gathered in
 * partnerRoomPlaysService.
 *
 * The play names and the dates programs are due come from the Expansion
 * Playbook (Sales Team Edition): section 6 for the dated programs, section 9
 * for the expansion plays, section 10 for what to run when things stall.
 */

export interface PlayPractice {
  id: number;
  name: string;
  /** not_started | scheduling | training_booked | trained | live */
  stage: string;
  city: string | null;
  state: string | null;
  region: string | null;
  regionalManager: string | null;
  officeType: string | null;
  /** A full mailing address is on file (street, city, state, ZIP). */
  mailable: boolean;
  /** The practice's training day (YYYY-MM-DD), when the list gives one that reads as a date. */
  trainingDay: string | null;
  kitSent: boolean;
  wave: string | null;
  lat: number | null;
  lng: number | null;
}

export interface PlayInput {
  customer: string;
  practices: PlayPractice[];
  /** Day of the rollout (1 = kickoff day); null before kickoff or with no kickoff date. */
  day: number | null;
  /** Internal stage. */
  stage: "rollout" | "expansion";
  /** The account doesn't allow direct outreach to its practices (mail, kits, calls). */
  noDirectOutreach: boolean;
  /** Live practices on each day the list was refreshed, oldest first. */
  trend: { day: string; live: number }[];
  /** The hub is published (the customer can reach it). */
  published: boolean;
  /** The last time someone from the customer opened the hub; null = never. */
  lastCustomerVisit: Date | null;
  /** The last post on the hub's Feed. */
  lastWin: Date | null;
  /** Customer steps not yet done. */
  openCustomerSteps: number;
  /** The hub's waves, in order, with live / total. */
  waves: { name: string; total: number; live: number; target: string }[];
}

export type PlayAction =
  /** Add these practices to the welcome kit list. */
  | { kind: "kit"; practiceIds: number[] }
  /** Ask marketing (an intake task). */
  | { kind: "request" }
  /** Something the rep does themselves; nothing to send. */
  | { kind: "none" };

export interface Play {
  /** Stable per hub and subject, so a play that was acted on or dismissed stays quiet. */
  key: string;
  title: string;
  /** The numbers behind it, as one or two plain sentences. */
  why: string;
  /** Where the play comes from in the playbook, when it does. */
  source: string | null;
  /** Higher = shown first. */
  score: number;
  action: PlayAction;
  /** Practices the play is about (named in the request, capped for display). */
  practices: string[];
}

const LIVE = new Set(["live", "trained"]);
const isLive = (p: PlayPractice) => LIVE.has(p.stage);
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86_400_000);

/** Miles between two points. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface PracticeCluster {
  /** The city most of them are in. */
  city: string;
  practices: PlayPractice[];
}

/**
 * Groups of practices close enough for one evening event: everyone within
 * `radius` miles of the group's busiest practice (so any two are under about
 * an hour apart). Largest group first; a practice belongs to one group.
 */
export function clusterPractices(practices: PlayPractice[], radius = 25, min = 5): PracticeCluster[] {
  const placed = practices.filter((p): p is PlayPractice & { lat: number; lng: number } => p.lat != null && p.lng != null);
  const left = new Set(placed.map((p) => p.id));
  const out: PracticeCluster[] = [];
  for (;;) {
    let best: (PlayPractice & { lat: number; lng: number })[] = [];
    for (const seed of placed) {
      if (!left.has(seed.id)) continue;
      const near = placed.filter((p) => left.has(p.id) && milesBetween(seed, p) <= radius);
      if (near.length > best.length) best = near;
    }
    if (best.length < min) break;
    for (const p of best) left.delete(p.id);
    const cities = new Map<string, number>();
    for (const p of best) {
      const c = [p.city, p.state].filter(Boolean).join(", ");
      if (c) cities.set(c, (cities.get(c) ?? 0) + 1);
    }
    const city = [...cities.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "one area";
    out.push({ city, practices: best });
  }
  return out;
}

/** Who a practice is grouped under: its regional manager, else its region. */
function groupsOf(practices: PlayPractice[]): { by: "manager" | "region"; groups: { name: string; total: number; live: number; practices: PlayPractice[] }[] } {
  const by = practices.some((p) => (p.regionalManager ?? "").trim()) ? "manager" : "region";
  const map = new Map<string, PlayPractice[]>();
  for (const p of practices) {
    const name = ((by === "manager" ? p.regionalManager : p.region) ?? "").trim();
    if (!name) continue;
    map.set(name, [...(map.get(name) ?? []), p]);
  }
  return { by, groups: [...map.entries()].map(([name, list]) => ({ name, total: list.length, live: list.filter(isLive).length, practices: list })) };
}

/** Every play that applies to the hub right now, best first. */
export function recommendPlays(input: PlayInput, now: Date = new Date()): Play[] {
  const { practices, day, noDirectOutreach } = input;
  const plays: Play[] = [];
  const add = (p: Omit<Play, "practices"> & { practices?: PlayPractice[] | string[] }) => {
    const list = (p.practices ?? []) as (PlayPractice | string)[];
    plays.push({ ...p, practices: list.map((x) => (typeof x === "string" ? x : x.name)).sort((a, b) => a.localeCompare(b)) });
  };
  const total = practices.length;
  const live = practices.filter(isLive);
  const notLive = practices.filter((p) => !isLive(p));
  const overall = pct(live.length, total);
  const started = day !== null || input.stage === "expansion";
  const d = day ?? 0;
  const past = input.stage === "expansion";

  /* ── Data the other plays depend on ─────────────────────────────────── */
  const unplaced = practices.filter((p) => p.lat == null);
  if (total >= 5 && unplaced.length / total >= 0.2) {
    add({ key: "data-addresses", title: "Add addresses for the practice list", why: `${plural(unplaced.length, "practice")} of ${total} have no ZIP code, so they can't be mapped, mailed or grouped for an event. Add address columns to the locations sheet or upload the customer's list.`, source: null, score: 58, action: { kind: "none" }, practices: unplaced });
  }
  if (total >= 5 && !practices.some((p) => (p.regionalManager ?? "").trim())) {
    add({ key: "data-managers", title: "Add regional managers to the practice list", why: `None of the ${total} practices has a regional manager. The plays that work through regionals (top-down taps, L&L at scale) need them: upload the customer's roster with a regional manager column.`, source: null, score: 40, action: { kind: "none" } });
  }

  /* ── Dated programs (playbook section 6) ────────────────────────────── */
  const kitless = practices.filter((p) => p.mailable && !p.kitSent);
  if (started && !noDirectOutreach && kitless.length > 0 && (past || d >= 3)) {
    const late = past || d > 15;
    add({ key: "program-welcome-kits", title: `Send welcome kits to ${plural(kitless.length, "practice")}`, why: `${plural(kitless.length, "practice")} with a mailing address ${kitless.length === 1 ? "has" : "have"} not had a welcome kit.${late ? " Kits are due by Day 15." : " Kits ship by Day 15."}`, source: "Playbook: Days 5–15, Launch", score: late ? 95 : 80, action: { kind: "kit", practiceIds: kitless.map((p) => p.id) }, practices: kitless });
  }
  if (!past && !noDirectOutreach && d >= 20 && d <= 45 && total > 0) {
    add({ key: "program-video-mailer", title: "Video mailer and lab-credit postcard", why: `Day ${d}: the video mailer and lab-credit postcard are due at practices by Day 30.`, source: "Playbook: Days 15–30, Align & Train", score: d > 30 ? 82 : 70, action: { kind: "request" } });
  }
  if (!past && !noDirectOutreach && d >= 45 && d <= 75 && total > 0) {
    add({ key: "program-magalog", title: "Magalog and 90-day promo postcard", why: `Day ${d}: the magalog and the 90-day promo postcard are due by Day 60.`, source: "Playbook: Days 30–60, Momentum", score: d > 60 ? 80 : 68, action: { kind: "request" } });
  }
  if (live.length > 0 && (past || d >= 30)) {
    add({ key: "program-product-training", title: `Book product-line training for ${plural(live.length, "live practice")}`, why: `${plural(live.length, "practice")} ${live.length === 1 ? "is" : "are"} live. Every live practice gets the follow-up training on implants, dentures and sleep in Days 30–60: activation training alone doesn't grow what a practice orders.`, source: "Playbook: Days 30–60, Momentum", score: 66, action: { kind: "request" }, practices: live });
  }
  if (live.length >= 3 && (past || d >= 55) && overall >= 25) {
    add({ key: "program-case-study", title: "Build the case study from the first practices", why: `${live.length} of ${total} practices are live (${overall}%). The playbook has a case study approved by the clinical champion in Days 60–90, for use across their network.`, source: "Playbook: Days 60–90, Prove & Expand", score: overall >= 60 ? 78 : 62, action: { kind: "request" }, practices: live });
  }

  /* ── Where the practices are (playbook section 9) ───────────────────── */
  const clusters = clusterPractices(practices);
  clusters.slice(0, 2).forEach((c, i) => {
    const open = c.practices.filter((p) => !isLive(p));
    if (open.length < 2) return;
    add({ key: `roadshow-${slug(c.city)}`, title: `Dandy After Hours roadshow in ${c.city}`, why: `${c.practices.length} practices sit within about 25 miles of ${c.city}, and ${open.length} of them aren't live yet. That is enough for an evening event with every practice under an hour away.`, source: "Playbook play: Roadshows", score: 74 - i * 6 + Math.min(10, open.length), action: { kind: "request" }, practices: c.practices });
  });
  const clustered = new Set(clusters.flatMap((c) => c.practices.map((p) => p.id)));
  const scattered = notLive.filter((p) => p.lat != null && !clustered.has(p.id));
  if (scattered.length >= 4) {
    if (noDirectOutreach) {
      add({ key: "ce-sponsorship", title: "Education / CE sponsorship", why: `${plural(scattered.length, "practice")} not yet live are too spread out for an event, and this account doesn't allow direct outreach. Sponsoring their CE calendar with the education lead is the sanctioned route to doctors.`, source: "Playbook play: Education / CE sponsorship", score: 64, action: { kind: "request" }, practices: scattered });
    } else {
      add({ key: "direct-mail", title: `Direct mail to ${plural(scattered.length, "spread-out practice")}`, why: `${plural(scattered.length, "practice")} not yet live ${scattered.length === 1 ? "is" : "are"} too far from the others for a regional event. Mail reaches them: video mailers and a case study with a quote from inside their own group.`, source: "Playbook play: Direct mail", score: 60, action: { kind: "request" }, practices: scattered });
    }
  }
  if (noDirectOutreach && scattered.length < 4 && notLive.length > 0) {
    add({ key: "ce-sponsorship", title: "Education / CE sponsorship", why: `This account doesn't allow direct outreach to its practices, and ${plural(notLive.length, "practice")} ${notLive.length === 1 ? "isn't" : "aren't"} live. Sponsoring their CE calendar with the education lead is the sanctioned route to doctors.`, source: "Playbook play: Education / CE sponsorship", score: 56, action: { kind: "request" } });
  }

  /* ── Who looks after them (playbook section 9) ──────────────────────── */
  const { by, groups } = groupsOf(practices);
  const sized = groups.filter((g) => g.total >= 4);
  const label = by === "manager" ? "regional manager" : "region";
  for (const g of sized) {
    const open = g.practices.filter((p) => !isLive(p));
    if (g.live === 0) {
      add({ key: `tap-${slug(g.name)}`, title: by === "manager" ? `Top-down tap: a 1:1 with ${g.name}` : `Top-down tap: the ${g.name} region`, why: `None of the ${g.total} practices ${by === "manager" ? `under ${g.name}` : `in ${g.name}`} is live. A ${label} who can convene practices or host a regional meeting opens all of them at once.`, source: "Playbook play: Top-down taps", score: 72 + Math.min(8, g.total), action: { kind: "none" }, practices: open });
    } else if (pct(g.live, g.total) <= overall - 20 && pct(g.live, g.total) < 50) {
      add({ key: `ll-${slug(g.name)}`, title: by === "manager" ? `L&L at scale with ${g.name}'s practices` : `L&L at scale in ${g.name}`, why: `${g.live} of ${g.total} practices ${by === "manager" ? `under ${g.name}` : `in ${g.name}`} are live (${pct(g.live, g.total)}%), against ${overall}% across the account. Get on the monthly regional call, pitch every office manager at once, and call each attendee within two days.`, source: "Playbook play: L&L at scale", score: 65 + Math.min(8, open.length), action: { kind: "request" }, practices: open });
    }
  }
  const lead = [...sized].sort((a, b) => pct(b.live, b.total) - pct(a.live, a.total))[0];
  if (lead && sized.length >= 2 && pct(lead.live, lead.total) >= 60 && pct(lead.live, lead.total) >= overall + 20 && lead.live < lead.total) {
    add({ key: `groundswell-${slug(lead.name)}`, title: `Region-by-region groundswell: finish ${by === "manager" ? `${lead.name}'s practices` : lead.name} first`, why: `${lead.live} of ${lead.total} practices ${by === "manager" ? `under ${lead.name}` : `in ${lead.name}`} are live (${pct(lead.live, lead.total)}%), well ahead of ${overall}% overall. Concentrate outreach and reference selling there until word of mouth carries it, then move to the next.`, source: "Playbook play: Region-by-region groundswell", score: 63, action: { kind: "none" }, practices: lead.practices.filter((p) => !isLive(p)) });
  }

  /* ── When things stall (playbook section 10) ────────────────────────── */
  const today = now.toISOString().slice(0, 10);
  const cutoff = new Date(now.getTime() - 21 * 86_400_000).toISOString().slice(0, 10);
  const stalled = practices.filter((p) => !isLive(p) && p.trainingDay && p.trainingDay <= cutoff);
  if (stalled.length > 0) {
    add({ key: "stalled-trainings", title: `Chase ${plural(stalled.length, "stalled training")}`, why: `${plural(stalled.length, "practice")} had a training date more than three weeks ago and ${stalled.length === 1 ? "is" : "are"} still not live. Check whether training happened and what is blocking the first case.`, source: "Playbook: no blocker open more than a week", score: 84 + Math.min(8, stalled.length), action: { kind: "none" }, practices: stalled });
  }
  const trend = input.trend.filter((t) => t.day <= today);
  if (trend.length >= 2 && total > 0 && overall < 70 && (past || d >= 30)) {
    const last = trend[trend.length - 1];
    const sinceChange = [...trend].reverse().find((t) => t.live !== last.live);
    const flatFrom = sinceChange ? trend[trend.indexOf(sinceChange) + 1].day : trend[0].day;
    const flatDays = daysBetween(new Date(`${flatFrom}T00:00:00Z`), new Date(`${today}T00:00:00Z`));
    if (flatDays >= 21) {
      add({ key: "flat-adoption", title: "Adoption has gone flat: run a savings reveal with regionals", why: `Live practices have stayed at ${last.live} for ${flatDays} days (${overall}% of ${total}). The playbook's answer is a savings reveal with regional leaders, L&L at scale on the next regional call, targeted direct mail, and a check on training completion.`, source: "Playbook: when adoption goes flat after launch", score: 86, action: { kind: "request" } });
    }
  }
  if (input.published && started) {
    const quiet = input.lastCustomerVisit ? daysBetween(input.lastCustomerVisit, now) : null;
    if (quiet === null ? d >= 14 || past : quiet >= 21) {
      add({ key: "quiet-customer", title: "Exec engagement has gone quiet: offer a lab tour or vendor day", why: `${quiet === null ? `Nobody at ${input.customer} has signed in to the hub yet` : `Nobody at ${input.customer} has signed in to the hub in ${quiet} days`}. The playbook's play for stalled exec engagement is structured facetime: a lab tour, a vendor day, or the Dandy exec buddy.`, source: "Playbook: when exec engagement stalls", score: 70, action: { kind: "request" } });
    }
  }

  /* ── Keeping the hub itself moving ──────────────────────────────────── */
  if (input.openCustomerSteps >= 5 && (past || d >= 15)) {
    add({ key: "open-steps", title: `Nudge ${input.customer} on ${input.openCustomerSteps} open steps`, why: `${input.openCustomerSteps} of their action-plan steps are still open${past ? "" : ` on Day ${d}`}. Walk the list on the next call rather than waiting for them to find it.`, source: null, score: 55, action: { kind: "none" } });
  }
  const current = input.waves.findIndex((w) => !(w.total > 0 && w.live >= w.total));
  if (current >= 0 && input.waves[current].total > 0 && pct(input.waves[current].live, input.waves[current].total) >= 80 && input.waves[current + 1] && !input.waves[current + 1].target) {
    const w = input.waves[current], next = input.waves[current + 1];
    add({ key: `next-wave-${slug(next.name)}`, title: `Plan ${next.name}`, why: `${w.name} is ${pct(w.live, w.total)}% live (${w.live} of ${w.total}) and ${next.name} has no target date yet. Agree its practices and dates with the customer before momentum drops.`, source: "Playbook: next wave committed at the Day 60 review", score: 76, action: { kind: "none" } });
  }
  if (trend.length >= 2 && input.published) {
    const twoWeeks = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
    const then = [...trend].reverse().find((t) => t.day <= twoWeeks) ?? trend[0];
    const gained = trend[trend.length - 1].live - then.live;
    if (gained > 0 && (!input.lastWin || daysBetween(input.lastWin, now) >= 14)) {
      add({ key: "share-win", title: `Post a win: ${plural(gained, "more practice")} live`, why: `${plural(gained, "practice")} went live since ${then.day} and nothing has been posted to the hub's Feed ${input.lastWin ? `in ${daysBetween(input.lastWin, now)} days` : "yet"}. A short post keeps their leadership seeing progress.`, source: null, score: 50, action: { kind: "none" } });
    }
  }
  const outOfScope = notLive.filter((p) => p.officeType && !/general/i.test(p.officeType));
  if (total >= 5 && outOfScope.length / total >= 0.15) {
    add({ key: "rescope", title: `Agree what to do with ${plural(outOfScope.length, "pediatric or specialty office")}`, why: `${plural(outOfScope.length, "office")} of ${total} ${outOfScope.length === 1 ? "is" : "are"} pediatric or specialty and not live, which holds the account at ${overall}% however well the general practices go. Agree with the customer whether they count toward the goal.`, source: null, score: 45, action: { kind: "none" }, practices: outOfScope });
  }

  return plays.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

/** What the team did with a play: asked marketing, sent it, or set it aside. It stays quiet until `until`. */
export interface PlayState {
  state: "requested" | "dismissed" | "done";
  /** YYYY-MM-DD. */
  until: string;
  by?: string;
}

/** Leave out the plays the team has already acted on or set aside (until their quiet period ends). */
export function activePlays(plays: Play[], states: Record<string, PlayState> | null | undefined, now: Date = new Date()): Play[] {
  const today = now.toISOString().slice(0, 10);
  return plays.filter((p) => !(states?.[p.key] && states[p.key].until >= today));
}

/** The intake task a play asks marketing for. */
export function playRequest(customer: string, play: Play, by: string, date: string, hubUrl: string): { subject: string; notes: string } {
  const shown = play.practices.slice(0, 100);
  return {
    subject: `${play.title} (requested ${date})`,
    notes: [
      `Play for ${customer}: ${play.title}`,
      `Why: ${play.why}`,
      ...(play.source ? [play.source] : []),
      `Requested: ${date}`,
      `Requested by: ${by}`,
      ...(shown.length ? ["", "Practices:", ...shown.map((n) => `- ${n}`), ...(play.practices.length > shown.length ? [`…and ${play.practices.length - shown.length} more`] : [])] : []),
      ...(hubUrl ? ["", `Hub: ${hubUrl}`] : []),
    ].join("\n"),
  };
}
