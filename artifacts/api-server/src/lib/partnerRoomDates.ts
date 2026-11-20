/**
 * Dates as people and Salesforce reports write them ("11/4/2026", "Nov 4",
 * "2026-11-04", "November 4, 2026") → YYYY-MM-DD. Pure.
 *
 * A date with no year is read as the one nearest to today (within six months
 * back, otherwise ahead): "Jan 12" written in November means next January.
 */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const iso = (y: number, m: number, d: number): string | null => {
  if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // 2/30 rolls over to March: not a real date.
  if (date.getUTCMonth() !== m - 1) return null;
  return date.toISOString().slice(0, 10);
};

function nearestYear(m: number, d: number, now: Date): number {
  const y = now.getUTCFullYear();
  const thisYear = Date.UTC(y, m - 1, d);
  const sixMonths = 183 * 86_400_000;
  if (thisYear < now.getTime() - sixMonths) return y + 1;
  if (thisYear > now.getTime() + sixMonths) return y - 1;
  return y;
}

const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

// Each pattern finds a date anywhere in a text; the earliest match in the text wins.
const PATTERNS: { re: RegExp; read: (m: RegExpExecArray, now: Date) => string | null }[] = [
  { re: /(\d{4})-(\d{1,2})-(\d{1,2})/g, read: (m) => iso(+m[1], +m[2], +m[3]) },
  { re: /(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/g, read: (m) => iso(fullYear(m[3]), +m[1], +m[2]) },
  { re: /(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g, read: (m, now) => iso(nearestYear(+m[1], +m[2], now), +m[1], +m[2]) },
  {
    re: /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/gi,
    read: (m, now) => {
      const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
      return iso(m[3] ? +m[3] : nearestYear(month, +m[2], now), month, +m[2]);
    },
  },
];

/** The first date written in a text ("11/4/2026; 11/18/2026" → 2026-11-04), or null when it has none. */
export function firstDateIn(text: unknown, now: Date = new Date()): string | null {
  const s = typeof text === "string" ? text : "";
  let best: { at: number; date: string } | null = null;
  for (const { re, read } of PATTERNS) {
    re.lastIndex = 0;
    for (let m = re.exec(s); m; m = re.exec(s)) {
      const date = read(m, now);
      if (date && (!best || m.index < best.at)) best = { at: m.index, date };
      if (date) break;
    }
  }
  return best?.date ?? null;
}
