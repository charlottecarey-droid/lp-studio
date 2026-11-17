/**
 * Partner rooms: the practice microsite.
 *
 * Every new partnership needs a page its practices sign up on ("MB2 Practices
 * Microsite"). The launch kit links to it, and the one-pager and media kit
 * print its address. This finds the account's page when one already exists,
 * and otherwise makes a draft from the workspace's own practice-microsite
 * template with the account's name filled in.
 *
 * Nothing here publishes: a new microsite is a draft for a person to review.
 */
import { and, desc, eq } from "drizzle-orm";
import { db, lpPagesTable } from "@workspace/db";
import { logger } from "./logger";
import { accountKey } from "./partnerRoomNames";

/* ── Pure helpers ────────────────────────────────────────────────────────── */

/** Block types only a practice sign-up page carries. */
const PRACTICE_SITE_BLOCKS = new Set(["dso-practice-hero", "dso-heartland-hero"]);
/** Words too common in account names to identify one ("Heartland Dental" is known by "heartland"). */
const GENERIC = new Set(["dental", "dentistry", "partners", "partner", "group", "management", "dso", "care", "associates", "holdings", "usa", "the", "of", "and", "family", "health", "services", "company", "co", "llc", "inc"]);

const norm = (v: string) => v.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * The forms of an account's name to look for in a page's title or address:
 * the whole name, and the name without its generic words ("mb2-dental" and
 * "mb2"). A form shorter than three characters is not used.
 */
export function accountNameForms(name: string): string[] {
  const full = accountKey(name);
  const core = full.split("-").filter((w) => w && !GENERIC.has(w)).join("-");
  return [...new Set([full, core])].filter((f) => f.length >= 3);
}

export function isPracticeSite(blocks: unknown): boolean {
  return Array.isArray(blocks) && blocks.some((b) => !!b && typeof b === "object" && PRACTICE_SITE_BLOCKS.has(String((b as { type?: unknown }).type)));
}

const sameSfdcId = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.length >= 15 && b.length >= 15 && a.slice(0, 15) === b.slice(0, 15);

/**
 * Does this page belong to the account? By Salesforce id when the page has
 * one; otherwise when its title or address carries the account's name as
 * whole words ("mb2-practices" is MB2's; "smile-partners-usa" is not Smile
 * Brands'). 0 = no, 2 = by name, 3 = by id.
 */
export function practiceSiteMatch(page: { title: string; slug: string; sfdcAccountId?: string | null }, account: { name: string; sfdcId?: string | null }): number {
  if (sameSfdcId(page.sfdcAccountId, account.sfdcId)) return 3;
  const forms = accountNameForms(account.name);
  const hay = [`-${norm(page.slug)}-`, `-${norm(page.title)}-`];
  return forms.some((f) => hay.some((h) => h.includes(`-${f}-`))) ? 2 : 0;
}

const NAME_TOKEN = /\[\s*(?:dso|partner|customer|account)(?: name)?\s*\]|\{\{\s*(?:dso|dso_name|account|account_name|partner|company|company_name)\s*\}\}/gi;

/** A template's blocks with the account's name written wherever it leaves a blank for one ("[dso name]", "{{account}}"). */
export function fillTemplateName<T>(value: T, name: string): T {
  if (typeof value === "string") return value.replace(NAME_TOKEN, name) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => fillTemplateName(v, name)) as unknown as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, fillTemplateName(v, name)])) as T;
  return value;
}

export const PRACTICE_SITE_LINK_KEY = "practice-site";

/**
 * Put the practice microsite at the top of the room's launch-kit links (so
 * the one-pager and media kit pick up its address). An existing entry for it
 * is replaced; a link someone typed by hand to the same page is left alone.
 * Returns the new blocks, or null when the page has no workspace block.
 */
export function setRoomPracticeLink(blocks: unknown, link: { url: string; short: string }): unknown[] | null {
  if (!Array.isArray(blocks)) return null;
  let done = false;
  const next = blocks.map((b) => {
    if (done || !b || typeof b !== "object" || (b as { type?: unknown }).type !== "room-workspace") return b;
    const props = (b as { props?: Record<string, unknown> }).props ?? {};
    const links = Array.isArray(props.links) ? (props.links as Record<string, unknown>[]) : [];
    done = true;
    if (links.some((l) => l && l.key !== PRACTICE_SITE_LINK_KEY && typeof l.url === "string" && l.url.trim() === link.url)) return b;
    const entry = { key: PRACTICE_SITE_LINK_KEY, title: `${link.short} practice sign-up page`, description: link.url.replace(/^https?:\/\//, ""), url: link.url };
    return { ...(b as object), props: { ...props, links: [entry, ...links.filter((l) => l?.key !== PRACTICE_SITE_LINK_KEY)] } };
  });
  return done ? next : null;
}

export const isTestPracticeSite = (slug: string) => /-practices-test(-\d+)?$/.test(slug);

export const practiceSiteSlug = (name: string) => `${accountKey(name).slice(0, 56).replace(/-+$/, "") || "partner"}-practices`;

/* ── Finding and making ──────────────────────────────────────────────────── */

export interface PracticeSite {
  pageId: number;
  slug: string;
  title: string;
  status: string;
  /** True when the page was already there; false when this run made it. */
  existing: boolean;
}

/** The account's practice microsite, when the workspace already has one. The surest match wins, then a published page, then the newest. */
export async function findPracticeSite(tenantId: number, account: { name: string; sfdcId?: string | null }, opts: { includeTests?: boolean } = {}): Promise<PracticeSite | null> {
  const pages = await db
    .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, status: lpPagesTable.status, sfdcAccountId: lpPagesTable.sfdcAccountId, blocks: lpPagesTable.blocks })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isTemplate, false)))
    .orderBy(desc(lpPagesTable.id))
    .limit(3000);
  const hits = pages
    // A microsite drafted by a test run belongs to test hubs only: a real hub never links to it.
    .filter((p) => isPracticeSite(p.blocks) && (opts.includeTests || !isTestPracticeSite(p.slug)))
    .map((p) => ({ p, score: practiceSiteMatch(p, account) * 10 + (p.status === "published" ? 1 : 0) }))
    .filter((x) => x.score >= 20)
    .sort((a, b) => b.score - a.score || b.p.id - a.p.id);
  const best = hits[0]?.p;
  return best ? { pageId: best.id, slug: best.slug, title: best.title, status: best.status, existing: true } : null;
}

/** The workspace's own practice-microsite template: a template page that is a practice sign-up page, the newest first. */
async function practiceSiteTemplate(tenantId: number) {
  const templates = await db.select().from(lpPagesTable).where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isTemplate, true))).orderBy(desc(lpPagesTable.id)).limit(500);
  const sites = templates.filter((t) => isPracticeSite(t.blocks));
  // A template named for the job ("…Practice Microsite Template") beats one that merely has the right blocks.
  return sites.find((t) => /practice/i.test(`${t.templateLabel ?? ""} ${t.title}`)) ?? sites[0] ?? null;
}

async function freeSlug(tenantId: number, base: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await db.select({ id: lpPagesTable.id }).from(lpPagesTable).where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, slug))).limit(1);
    if (!hit) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * The account's practice microsite: the one that exists, else a new draft
 * made from the workspace's template. Null when there is neither a page nor
 * a template to make one from.
 */
export async function ensurePracticeSite(tenantId: number, account: { name: string; sfdcId?: string | null }, opts: { accountId?: number | null; test?: boolean } = {}): Promise<PracticeSite | null> {
  const found = await findPracticeSite(tenantId, account, { includeTests: !!opts.test });
  if (found) return found;
  const template = await practiceSiteTemplate(tenantId);
  if (!template) return null;
  const slug = await freeSlug(tenantId, opts.test ? practiceSiteSlug(account.name).replace(/-practices$/, "-practices-test") : practiceSiteSlug(account.name));
  const title = `${account.name} Practices Microsite${opts.test ? " (test)" : ""}`;
  // Carry over the template's look and settings. A setting the template leaves empty is left out, so the page gets the column's default.
  const carried = Object.fromEntries(
    Object.entries({
      customCss: template.customCss,
      metaTitle: template.metaTitle ? fillTemplateName(template.metaTitle, account.name) : null,
      metaDescription: template.metaDescription ? fillTemplateName(template.metaDescription, account.name) : null,
      ogImage: template.ogImage,
      animationsEnabled: template.animationsEnabled,
      pageVariables: template.pageVariables,
      mode: template.mode,
      audienceType: template.audienceType,
    }).filter(([, v]) => v !== null && v !== undefined),
  );
  const [page] = await db
    .insert(lpPagesTable)
    .values({
      ...carried,
      tenantId,
      title,
      slug,
      status: "draft",
      blocks: fillTemplateName(template.blocks, account.name) as never,
      sfdcAccountId: account.sfdcId ?? null,
      accountId: opts.accountId ?? null,
      createdBy: "automatic rooms",
    } as typeof lpPagesTable.$inferInsert)
    .returning({ id: lpPagesTable.id });
  logger.info({ tenantId, pageId: page.id, templateId: template.id }, "practice microsite drafted from the template");
  return { pageId: page.id, slug, title, status: "draft", existing: false };
}
