/**
 * Holiday gifting wizard (Sales Console). It builds from three designed pages
 * (holiday-gifts-premium / -mid / -swag, served by GET
 * /lp/programmatic/gift-sources) and restyles their gift blocks for the
 * chosen audience, layout and envelope, so editing a source page in the
 * builder changes what the wizard produces. Pure helpers only; the wizard's
 * answers + an optional uploaded list become rows for bulk-generate.
 */
import { parseBulkCsv, slugify, toCsv } from "@/lib/csv";

export type GiftTierId = "premium" | "mid" | "swag";
export type GiftAudience = "prospect" | "customer";
export type GiftLayoutChoice = "classic" | "atelier";

export interface GiftTier { id: GiftTierId; label: string; blurb: string }

export const GIFT_TIERS: GiftTier[] = [
  { id: "premium", label: "Premium", blurb: "AirPods kit or Meta Ray-Bans. For C-suite and regional leaders." },
  { id: "mid", label: "Mid-tier", blurb: "Candy, Yeti mug and wireless charger sets." },
  { id: "swag", label: "Dandy swag", blurb: "Everyday Dandy gear, with a size picker." },
];

export const tierById = (id: GiftTierId): GiftTier => GIFT_TIERS.find((t) => t.id === id) ?? GIFT_TIERS[0];

export type GiftBlockProps = Record<string, unknown>;
/** The source page's gift blocks, keyed by block type (from gift-sources). */
export type GiftSourceBlocks = Record<string, GiftBlockProps>;

export interface GiftChoices { tier: GiftTierId | "custom"; audience: GiftAudience; layout: GiftLayoutChoice; envelope: boolean }

const PROSPECT_COPY: Record<string, GiftBlockProps> = {
  "gift-hero": {
    kicker: "A holiday thank-you from Dandy",
    headline: "A small thank-you,\nno strings attached.",
    subheadline: "For your commitment to the industry. Choose your gift, tell us where to send it, and we'll take care of the rest.",
    navCtaText: "Accept my gift",
  },
  "gift-form": {
    kicker: "Accept your gift",
    subheadline: "Three quick steps. No follow-up required.",
    submitText: "Accept my gift",
    consentText: "We'll only use these details to ship your gift.",
    successMessage: "Thank you, and happy holidays. Your gift ships before the holidays.",
  },
  "gift-note": {
    kicker: "A note from your Dandy rep",
    headline: "Wishing you a\nwonderful new year.",
    body: "I'm sending this as a small thank-you for your commitment to the industry and a reflection of how Dandy thinks about supporting DSOs: consistency across locations, quality at every touchpoint, and long-term value over quick wins.\n\nNo follow-up required. Just wishing you the best as we wrap up 2026 and head into the new year.",
    signoff: "Happy holidays to you and yours,",
    calendarText: "If you ever want to compare notes, here's my calendar",
  },
};

const ATELIER_COPY: Record<string, GiftBlockProps> = {
  "gift-hero": {
    layout: "atelier",
    logoUrlLight: "/dandy-logo.svg",
    heroArt: "auto", // the source page's product photo when it has one, else the gift boxes
    announcement: "Complimentary delivery · Ships before the holidays",
    kicker: "The 2026 holiday collection",
  },
  "gift-picker": { layout: "atelier" },
  "gift-form": { layout: "atelier" },
  "gift-note": { layout: "atelier" },
};

/** Lead source label, e.g. holiday-gift-prospect / holiday-gift-mid-customer / holiday-swag-prospect. */
export function giftSourceLabel(tier: GiftTierId | "custom", audience: GiftAudience): string {
  if (tier === "custom") return `holiday-gift-custom-${audience}`;
  return `${tier === "swag" ? "holiday-swag" : tier === "mid" ? "holiday-gift-mid" : "holiday-gift"}-${audience}`;
}

/**
 * Per-block props for bulk-generate's `gifts`: the source page's props, then
 * the audience copy, the layout, the envelope switch, and the personalisation
 * tokens every recipient page needs (rep, recipient name, personal note).
 */
export function buildGiftProps(source: GiftSourceBlocks, c: GiftChoices): Record<string, GiftBlockProps> {
  const out: Record<string, GiftBlockProps> = {};
  for (const type of ["gift-hero", "gift-picker", "gift-form", "gift-note"]) {
    if (!source[type]) continue;
    let p: GiftBlockProps = { ...source[type] };
    if (c.audience === "prospect") p = { ...p, ...PROSPECT_COPY[type] };
    if (c.layout === "atelier") {
      p = { ...p, ...ATELIER_COPY[type] };
      // Customer notes read "wonderful year" in Atelier; the prospect headline already fits.
      if (type === "gift-note" && c.audience === "customer") p.headline = "Thank you for\na wonderful year.";
    } else {
      p.layout = "classic";
    }
    if (type === "gift-hero") {
      p.envelopeIntro = c.envelope;
      p.tagTo = "To {{first_name|you}}";
      p.tagFrom = "From {{rep_first_name|Dandy}}";
      p.envelopeTo = "For {{first_name|you}}";
    }
    if (type === "gift-form") {
      Object.assign(p, {
        source: giftSourceLabel(c.tier, c.audience),
        prefillFirstName: "{{first_name}}", prefillLastName: "{{last_name}}", prefillEmail: "{{email}}", prefillCompany: "{{company}}",
        sentBy: "{{rep_name}}", repEmail: "{{rep_email}}",
        summaryLines: ["Delivery: Complimentary", "Arrives: Before the holidays", "From: {{rep_name|Your Dandy team}}"],
      });
    }
    if (type === "gift-note") {
      Object.assign(p, {
        greeting: "Hi {{first_name|there}},", personalNote: "{{personal_note}}",
        signature: "{{rep_name|Your Dandy rep}}", repTitle: "{{rep_title}}", calendarUrl: "{{rep_calendar}}",
        // No thumbnail by the name: bulk-generate puts the rep's headshot in the card's big picture
        // (imageUrl) per page, and keeps the source page's image when the rep has no headshot.
        repPhotoUrl: "",
        calendarText: p.calendarText || "Grab time on my calendar",
      });
    }
    out[type] = p;
  }
  return out;
}

export interface PickableGift { key: string; tier: GiftTierId; name: string; caption: string; imageUrl: string; option: Record<string, unknown> }

/** Every gift across the three source pages, for the pick-your-own step. */
export function allGifts(sources: Partial<Record<GiftTierId, { blocks: GiftSourceBlocks }>> | null): PickableGift[] {
  const out: PickableGift[] = [];
  for (const t of GIFT_TIERS) {
    const opts = sources?.[t.id]?.blocks?.["gift-picker"]?.options;
    if (!Array.isArray(opts)) continue;
    for (const o of opts as Array<Record<string, unknown>>) {
      const name = String(o.name ?? "");
      if (name) out.push({ key: `${t.id}::${name}`, tier: t.id, name, caption: String(o.caption ?? ""), imageUrl: String(o.imageUrl ?? ""), option: o });
    }
  }
  return out;
}

export const MAX_PICKED_GIFTS = 4;
const COUNT_WORD = ["", "one", "two", "three", "four"];

/** Swap "one of three" / "three gifts" style copy for the real number of gifts. */
export function fixCountCopy(text: unknown, n: number): unknown {
  if (typeof text !== "string" || n === 3) return text;
  if (n === 1) return text.replace(/\b(choose|pick) one of (three|two|four)\b/gi, "$1 your gift").replace(/\b(three|two|four) gifts\b/gi, "your gift");
  const w = COUNT_WORD[n] ?? String(n);
  return text.replace(/\bone of three\b/gi, `one of ${w}`).replace(/\bthree gifts\b/gi, `${w} gifts`).replace(/\bthree to choose from\b/gi, `${w} to choose from`);
}

/**
 * The source blocks for a hand-picked set of gifts: the base page's blocks
 * (its look, hero photo and copy), with the picker showing exactly the
 * picked gifts and the size select present only if a swag gift is among them.
 */
export function composeSource(
  sources: Partial<Record<GiftTierId, { blocks: GiftSourceBlocks }>>,
  picked: PickableGift[],
  baseTier: GiftTierId,
): GiftSourceBlocks {
  const base = sources[baseTier]?.blocks ?? {};
  const n = picked.length;
  const out: GiftSourceBlocks = {};
  for (const [type, props] of Object.entries(base)) out[type] = { ...props };
  if (out["gift-picker"]) {
    out["gift-picker"] = { ...out["gift-picker"], options: picked.map((g) => g.option), headline: fixCountCopy(out["gift-picker"].headline, n) };
  }
  if (out["gift-hero"]) {
    for (const k of ["ctaText", "subheadline"]) out["gift-hero"][k] = fixCountCopy(out["gift-hero"][k], n);
    if (Array.isArray(out["gift-hero"].facts)) {
      out["gift-hero"].facts = (out["gift-hero"].facts as Array<{ label?: unknown }>).map((f) => ({ ...f, label: fixCountCopy(f.label, n) }));
    }
  }
  if (out["gift-form"]) {
    const swagForm = sources.swag?.blocks?.["gift-form"];
    const hasSwag = picked.some((g) => g.tier === "swag");
    out["gift-form"] = {
      ...out["gift-form"],
      subheadline: fixCountCopy(out["gift-form"].subheadline, n),
      sizeOptions: hasSwag ? ((swagForm?.sizeOptions as string[] | undefined) ?? ["XS", "S", "M", "L", "XL", "XXL"]) : [],
      sizeLabel: hasSwag ? String(swagForm?.sizeLabel || "Size (if it applies)") : "",
    };
  }
  return out;
}

/** Tier with the most picked gifts (ties go to the earlier tier), as the page's base look. */
export function majorityTier(picked: PickableGift[]): GiftTierId {
  const counts = new Map<GiftTierId, number>();
  for (const g of picked) counts.set(g.tier, (counts.get(g.tier) ?? 0) + 1);
  let best: GiftTierId = "premium", n = -1;
  for (const t of GIFT_TIERS) if ((counts.get(t.id) ?? 0) > n) { best = t.id; n = counts.get(t.id) ?? 0; }
  return best;
}

/** Gift names on the source page, for the tier cards. */
export function giftNames(source: GiftSourceBlocks | undefined): string[] {
  const opts = source?.["gift-picker"]?.options;
  return Array.isArray(opts) ? opts.map((o) => String((o as { name?: unknown }).name ?? "")).filter(Boolean) : [];
}

/** Columns of the upload (a rep_email / personal_note left blank uses the wizard's answers). */
export const WIZARD_COLUMNS = [
  { key: "first_name", required: true, hint: "Recipient's first name (greets them on the page)" },
  { key: "last_name", required: false, hint: "Recipient's last name" },
  { key: "company", required: true, hint: "Their DSO or practice" },
  { key: "email", required: false, hint: "Pre-fills the claim form" },
  { key: "personal_note", required: false, hint: "Overrides the wizard's note for this person" },
  { key: "rep_email", required: false, hint: "Overrides the wizard's rep for this person (must be in Sales Reps)" },
] as const;

export interface WizardRow { slug: string; variables: Record<string, string> }

export function wizardCsvTemplate(): string {
  const headers = WIZARD_COLUMNS.map((c) => c.key);
  const sample = ["Jordan", "Lee", "Acme Dental Group", "jordan@example.com", "", ""];
  return toCsv([headers, sample]);
}

/** Parse an upload; rows missing a required field come back as problems, not rows. */
export function parseWizardCsv(text: string): { rows: WizardRow[]; problems: string[] } {
  const parsed = parseBulkCsv(text);
  const problems: string[] = [];
  const rows: WizardRow[] = [];
  parsed.forEach((r, i) => {
    const v = r.variables;
    const missing = WIZARD_COLUMNS.filter((c) => c.required && !(v[c.key] ?? "").trim()).map((c) => c.key);
    if (missing.length) { problems.push(`Row ${i + 2}: missing ${missing.join(", ")}`); return; }
    rows.push({ slug: r.slug, variables: v });
  });
  return { rows, problems };
}

/** Fill each row's rep and note from the wizard when the row leaves them blank. */
export function applyWizardDefaults(rows: WizardRow[], repEmail: string, note: string): WizardRow[] {
  return rows.map((r) => {
    const variables = { ...r.variables };
    if (!(variables.rep_email ?? "").trim() && repEmail) variables.rep_email = repEmail;
    if (!(variables.personal_note ?? "").trim() && note.trim()) variables.personal_note = note.trim();
    return { ...r, variables };
  });
}

/** One recipient typed into the wizard (no upload). Null until the required fields are filled. */
export function manualRow(v: Record<string, string>): WizardRow | null {
  const variables: Record<string, string> = {};
  for (const c of WIZARD_COLUMNS) variables[c.key] = (v[c.key] ?? "").trim();
  if (WIZARD_COLUMNS.some((c) => c.required && !variables[c.key])) return null;
  const slug = slugify([variables.first_name, variables.last_name, variables.company].filter(Boolean).join(" "));
  return slug ? { slug, variables } : null;
}

export interface RepForm { name: string; role: string; email: string; phone: string; calendar: string; photo: string }
export interface RawLibraryRow { id: number; name?: string; content?: Record<string, unknown> }

/**
 * Save a rep's own details to the Sales Reps library. If records already exist
 * for the email (the library can hold duplicates per rep), every one of them is
 * updated with the NON-EMPTY form values, so a blank field never erases what's
 * on file and the headshot lands on whichever record the directory reads first.
 * Otherwise one new record is created (name required). Null when there is
 * nothing to save.
 */
export function planRepSave(rows: RawLibraryRow[], f: RepForm):
  | { error: string }
  | { create: { name: string; content: Record<string, unknown> } }
  | { updates: Array<{ id: number; name: string; content: Record<string, unknown> }> } {
  const email = f.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Enter your work email." };
  const edits: Record<string, string> = {};
  if (f.name.trim()) edits.name = f.name.trim();
  if (f.role.trim()) edits.role = f.role.trim();
  if (f.phone.trim()) edits.phone = f.phone.trim();
  if (f.calendar.trim()) edits.chilipiperUrl = f.calendar.trim();
  if (f.photo.trim()) edits.photo = f.photo.trim();
  const matches = rows.filter((r) => String(r.content?.email ?? "").trim().toLowerCase() === email);
  if (matches.length === 0) {
    if (!edits.name) return { error: "Enter your name." };
    return { create: { name: edits.name, content: { ...edits, email } } };
  }
  if (Object.keys(edits).length === 0) return { error: "Add a headshot or some details to save." };
  return {
    updates: matches.map((r) => ({
      id: r.id,
      name: edits.name ?? r.name ?? String(r.content?.name ?? ""),
      content: { ...(r.content ?? {}), ...edits, email: String(r.content?.email ?? email) },
    })),
  };
}
