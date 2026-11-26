/**
 * Internal names for AI-generated sales microsites.
 *
 * The page title is how reps find a page in LP Studio. Generated pages used to
 * get whatever the model returned, or just the account name when it returned
 * nothing, so an account could end up with several pages all called e.g.
 * "ATX", and the wrong ones got deleted. This builds a name that says whose
 * page it is, what it's about, who it's for and when it was made:
 *
 *   "ATX — Clinical quality partnership · for Jane Doe · Nov 26"
 *
 * Only the internal title changes; the page's on-page copy and meta title are
 * untouched. Pure.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const humanize = (s: string): string => {
  const t = s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

export function buildGeneratedPageTitle(opts: {
  company: string;
  aiTitle?: unknown;
  contactName?: string | null;
  objective?: string | null;
  date?: Date;
}): string {
  const company = (opts.company ?? "").trim() || "Untitled account";
  const ai = typeof opts.aiTitle === "string" ? opts.aiTitle.replace(/\s+/g, " ").trim() : "";
  const sameAsCompany = ai.toLowerCase() === company.toLowerCase();
  let head: string;
  if (ai && !sameAsCompany && ai.length <= 90) {
    head = ai.toLowerCase().includes(company.toLowerCase()) ? ai : `${company} — ${ai}`;
  } else {
    const what = opts.objective && opts.objective !== "from-scratch" ? humanize(opts.objective) : "Microsite";
    head = `${company} — ${what}`;
  }
  const d = opts.date ?? new Date();
  const parts = [head];
  const who = (opts.contactName ?? "").trim();
  if (who && !head.toLowerCase().includes(who.toLowerCase())) parts.push(`for ${who}`);
  parts.push(`${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`);
  return parts.join(" · ").slice(0, 200);
}
