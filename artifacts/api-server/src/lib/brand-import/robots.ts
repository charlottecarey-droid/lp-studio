import { USER_AGENT } from "./types";
import type { RobotsVerdict } from "./types";

// Minimal robots.txt parser: we only need allow/disallow for two user-agents
// (`*` and our own UA prefix) on a small set of candidate paths. We don't
// implement crawl-delay or sitemap.
function parseRobots(body: string, ourUaPrefix: string): {
  starRules: { allow: string[]; disallow: string[] };
  ourRules: { allow: string[]; disallow: string[] };
} {
  const starRules = { allow: [] as string[], disallow: [] as string[] };
  const ourRules = { allow: [] as string[], disallow: [] as string[] };
  let current: "star" | "ours" | "other" | null = null;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.+)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (value === "*") current = "star";
      else if (value.toLowerCase().startsWith(ourUaPrefix.toLowerCase())) current = "ours";
      else current = "other";
      continue;
    }
    if (!current || current === "other") continue;
    const bucket = current === "star" ? starRules : ourRules;
    if (field === "disallow") bucket.disallow.push(value);
    else if (field === "allow") bucket.allow.push(value);
  }
  return { starRules, ourRules };
}

function pathMatches(path: string, pattern: string): boolean {
  if (!pattern) return false;
  // Robots wildcard: `*` matches any sequence; `$` matches end of URL.
  // Conservative: empty disallow = no match (RFC says disallow nothing).
  let regex = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") regex += ".*";
    else if (c === "$" && i === pattern.length - 1) regex += "$";
    else regex += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(regex).test(path);
}

function isAllowed(
  path: string,
  rules: { allow: string[]; disallow: string[] },
): boolean {
  // Most-specific (longest) matching rule wins. If tied, allow wins (RFC).
  let bestAllowLen = -1;
  let bestDisallowLen = -1;
  for (const pat of rules.allow) {
    if (pathMatches(path, pat) && pat.length > bestAllowLen) bestAllowLen = pat.length;
  }
  for (const pat of rules.disallow) {
    if (pat === "") continue;
    if (pathMatches(path, pat) && pat.length > bestDisallowLen) bestDisallowLen = pat.length;
  }
  if (bestDisallowLen < 0) return true;
  if (bestAllowLen >= bestDisallowLen) return true;
  return false;
}

export async function fetchRobotsVerdict(
  homeUrl: string,
  candidatePaths: string[],
  timeoutMs = 4000,
): Promise<RobotsVerdict> {
  const verdict: RobotsVerdict = {
    allowed: Object.fromEntries(candidatePaths.map((p) => [p, true])),
    source: null,
    userAgent: USER_AGENT,
  };
  let robotsUrl: string;
  try {
    const u = new URL(homeUrl);
    robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
  } catch {
    return verdict;
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  let body = "";
  try {
    const res = await fetch(robotsUrl, {
      signal: ctl.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/plain,*/*" },
    });
    if (!res.ok) {
      verdict.source = `${robotsUrl} (status ${res.status})`;
      return verdict;
    }
    body = (await res.text()).slice(0, 200_000);
    verdict.source = robotsUrl;
  } catch {
    return verdict;
  } finally {
    clearTimeout(t);
  }
  const { starRules, ourRules } = parseRobots(body, "LPStudio-BrandImport");
  for (const p of candidatePaths) {
    let path = p;
    try {
      path = new URL(p, homeUrl).pathname;
    } catch {
      /* keep raw */
    }
    const allowedByOurs = ourRules.allow.length || ourRules.disallow.length
      ? isAllowed(path, ourRules)
      : isAllowed(path, starRules);
    verdict.allowed[p] = allowedByOurs;
  }
  return verdict;
}
