/**
 * Rep directory for bulk-generated pages (Programmatic Pages).
 *
 * A spreadsheet row only needs the rep's work email (`rep_email`); the rest
 * of the rep's details come from the Sales Reps library (Content Library
 * `team_member` records) so reps never retype their name, role, headshot or
 * booking link. Pure functions — the query lives in `rep-directory.ts`.
 *
 * Library quirks handled here:
 *   - duplicate records per rep (one with the link, another with the photo)
 *     are merged by email, first non-empty value of each field wins;
 *   - booking links live in `chilipiperUrl` or, on older records,
 *     `calendlyUrl`;
 *   - stray whitespace / casing in stored emails.
 */
export interface RepProfile {
  name: string;
  firstName: string;
  title: string;
  email: string;
  phone: string;
  photo: string;
  calendar: string;
}

export type RepDirectory = Map<string, RepProfile>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function buildRepDirectory(contents: Array<Record<string, unknown>>): RepDirectory {
  const dir: RepDirectory = new Map();
  for (const c of contents) {
    const email = str(c.email).toLowerCase();
    if (!email) continue;
    const next: RepProfile = {
      name: str(c.name),
      firstName: str(c.name).split(/\s+/)[0] ?? "",
      title: str(c.role),
      email,
      phone: str(c.phone),
      photo: str(c.photo),
      calendar: str(c.chilipiperUrl) || str(c.calendlyUrl),
    };
    const prev = dir.get(email);
    if (!prev) { dir.set(email, next); continue; }
    const merged = { ...prev };
    for (const k of Object.keys(next) as Array<keyof RepProfile>) {
      if (!merged[k] && next[k]) merged[k] = next[k];
    }
    dir.set(email, merged);
  }
  return dir;
}

/** Variable names the gift templates read. */
export const REP_VARIABLES = ["rep_name", "rep_first_name", "rep_title", "rep_photo", "rep_calendar", "rep_phone"] as const;

/**
 * Fill a row's rep_* variables from its `rep_email`. Values the row already
 * has win (a sheet can override e.g. rep_title). Returns whether the email
 * matched a library record.
 */
export function fillRepVariables(variables: Record<string, string>, dir: RepDirectory): { vars: Record<string, string>; matched: boolean | null } {
  const email = str(variables.rep_email).toLowerCase();
  if (!email) return { vars: variables, matched: null };
  const rep = dir.get(email);
  if (!rep) return { vars: variables, matched: false };
  const fromLibrary: Record<string, string> = {
    rep_name: rep.name,
    rep_first_name: rep.firstName,
    rep_title: rep.title,
    rep_photo: rep.photo,
    rep_calendar: rep.calendar,
    rep_phone: rep.phone,
  };
  const vars = { ...variables };
  for (const [k, v] of Object.entries(fromLibrary)) {
    if (!str(vars[k]) && v) vars[k] = v;
  }
  return { vars, matched: true };
}

/**
 * The rep a submission names, if any: a field labelled "Rep email" (any
 * casing/spacing; "Sales rep email" and "rep_email" count too). Pages
 * created from a gift template carry the rep's email in such a field so
 * the rep can be notified about their own prospect's submission.
 */
export function findRepEmailField(fields: Record<string, unknown>): string {
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== "string" || !v.includes("@")) continue;
    const key = k.toLowerCase().replace(/[^a-z]/g, "");
    if (key === "repemail" || key === "salesrepemail" || key === "accountowneremail" || key === "owneremail") return v.trim().toLowerCase();
  }
  return "";
}

/**
 * The address to notify for a submission's rep: the "Rep email" field, but
 * only when it names someone in the tenant's Sales Reps library. A public
 * form post can carry any field, so without this allowlist a stranger could
 * make the server mail lead notifications to arbitrary addresses.
 */
export function resolveRepRecipient(fields: Record<string, unknown>, dir: RepDirectory): string | null {
  const email = findRepEmailField(fields);
  if (!email) return null;
  return dir.has(email) ? email : null;
}

/**
 * Re-point the gift blocks at the row's rep. The builder's rep picker bakes
 * one rep's name, role, headshot and booking link into the template's
 * gift-note (and name/email into gift-form), so cloning the template alone
 * would put the template author's rep on every page. When a row's rep_email
 * matched the library, `vars` carries that rep's details (row overrides
 * included); write them over those literal values. A rep without a booking
 * link clears the field rather than leaving another rep's link behind. The
 * headshot becomes the note's big picture (imageUrl).
 */
export function applyRepToBlocks(blocks: unknown[], vars: Record<string, string>): unknown[] {
  return blocks.map((b) => {
    if (!b || typeof b !== "object") return b;
    const block = b as { type?: unknown; props?: Record<string, unknown> };
    if (!block.props || typeof block.props !== "object") return b;
    if (block.type === "gift-note") {
      return {
        ...block,
        props: {
          ...block.props,
          signature: str(vars.rep_name) || block.props.signature,
          repTitle: str(vars.rep_title),
          // The rep's headshot goes in the card's big picture, not as a tiny
          // thumbnail beside their name; no headshot keeps the template's image.
          repPhotoUrl: "",
          imageUrl: str(vars.rep_photo) || block.props.imageUrl,
          imageAlt: str(vars.rep_photo) ? str(vars.rep_name) : block.props.imageAlt,
          calendarUrl: str(vars.rep_calendar),
        },
      };
    }
    if (block.type === "gift-form") {
      return {
        ...block,
        props: {
          ...block.props,
          sentBy: str(vars.rep_name) || block.props.sentBy,
          repEmail: str(vars.rep_email).toLowerCase(),
        },
      };
    }
    return b;
  });
}

export const GIFT_BLOCK_TYPES = ["gift-hero", "gift-picker", "gift-form", "gift-note"] as const;
export type GiftProps = Partial<Record<(typeof GIFT_BLOCK_TYPES)[number], Record<string, unknown>>>;

/**
 * Validate the gifting wizard's per-block props: only the four gift block
 * types, each a plain object, bounded in size. Anything else is dropped, so
 * this can restyle a gift template but never inject other block types.
 */
export function sanitizeGiftProps(raw: unknown): GiftProps | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: GiftProps = {};
  for (const t of GIFT_BLOCK_TYPES) {
    const v = (raw as Record<string, unknown>)[t];
    if (v && typeof v === "object" && !Array.isArray(v) && JSON.stringify(v).length <= 60_000) out[t] = v as Record<string, unknown>;
  }
  return Object.keys(out).length ? out : null;
}

/** Replace the props of the template's gift blocks with the wizard's. */
export function applyGiftProps(blocks: unknown[], giftProps: GiftProps): unknown[] {
  return blocks.map((b) => {
    if (!b || typeof b !== "object") return b;
    const block = b as { type?: string; props?: unknown };
    const next = (GIFT_BLOCK_TYPES as readonly string[]).includes(block.type ?? "") ? giftProps[block.type as keyof GiftProps] : undefined;
    return next ? { ...block, props: next } : b;
  });
}
