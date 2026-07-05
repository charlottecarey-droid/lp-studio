import { eq, and } from "drizzle-orm";
import { db, salesBriefingsTable, salesAccountsTable, lpBrandSettingsTable } from "@workspace/db";
import { callAIChat, AIChatError, fetchWithTimeout } from "./ai-utils";
import { getSalesBrandContext, type SalesBrandContext } from "./salesBrandContext";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY ?? "";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? "";

/** Thrown when the requested account does not exist for the tenant. Callers map
 *  this to a 404; the inline microsite path treats it (like any throw) as a
 *  fail-open "continue without a briefing". */
export class AccountNotFoundError extends Error {
  constructor(accountId: number) {
    super(`Account not found for this tenant: ${accountId}`);
    this.name = "AccountNotFoundError";
  }
}

// ─── Perplexity Research ────────────────────────────────────

interface AccountContext {
  name: string;
  domain?: string | null;
  industry?: string | null;
  segment?: string | null;
  city?: string | null;
  state?: string | null;
  privateEquityFirm?: string | null;
  numLocations?: number | null;
  dsoSize?: string | null;
  brandCompanyDescription?: string | null;
  brandTargetAudience?: string | null;
  brandName?: string | null;
}

async function perplexityResearch(account: AccountContext): Promise<{ text: string; sources: string[] }> {
  if (!PERPLEXITY_API_KEY) return { text: "", sources: [] };

  const contextParts: string[] = [];
  if (account.domain) contextParts.push(`website: ${account.domain}`);
  if (account.city && account.state) contextParts.push(`headquartered in ${account.city}, ${account.state}`);
  else if (account.state) contextParts.push(`based in ${account.state}`);
  if (account.segment) contextParts.push(`segment: ${account.segment}`);
  if (account.dsoSize) contextParts.push(`DSO size: ${account.dsoSize}`);
  if (account.numLocations) contextParts.push(`${account.numLocations} locations`);
  if (account.privateEquityFirm) contextParts.push(`PE-backed by ${account.privateEquityFirm}`);

  const industryCtx = account.industry
    ?? (account.brandTargetAudience ? `company serving ${account.brandTargetAudience}` : null)
    ?? (account.brandCompanyDescription ? "company" : null)
    ?? "B2B company";

  const industryHint = account.industry
    ?? account.brandTargetAudience
    ?? (account.brandCompanyDescription ? account.brandCompanyDescription : null)
    ?? "a B2B company";

  const contextStr = contextParts.length > 0 ? ` (${contextParts.join(", ")})` : "";

  const query = [
    `Research the ${industryCtx} named "${account.name}"${contextStr}.`,
    `This company operates in the following space: ${industryHint} — do not confuse it with companies in unrelated industries with similar names.`,
    account.domain ? `Their website is ${account.domain} — use this to confirm you have the right company.` : "",
    "Provide: executive leadership (name + title), number of locations/offices,",
    "states/regions they operate in, PE backer or ownership structure, recent news,",
    "any technology stack or vendor partnerships, estimated revenue or size indicators.",
    "Focus on factual, verifiable information specific to this company.",
  ].filter(Boolean).join(" ");

  try {
    const resp = await fetchWithTimeout(
      "https://api.perplexity.ai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [{ role: "user", content: query }],
        }),
      },
      // 30s budget. sonar-pro routinely takes 15-20s when the account row is
      // sparse (no domain/industry/state) because the model has to disambiguate
      // the company name from public search results before it can answer. The
      // old 12s timeout silently dropped most of those calls and left the
      // synthesis LLM with nothing to chew on, producing the "skeleton" briefing
      // bug (every array empty, every field null) we saw on imported accounts.
      30000,
    );
    if (!resp.ok) {
      console.warn("[briefings] Perplexity returned", resp.status);
      return { text: "", sources: [] };
    }
    const data = await resp.json() as { choices?: { message?: { content?: string } }[]; citations?: string[] };
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      sources: data.citations ?? [],
    };
  } catch (err) {
    console.warn("[briefings] Perplexity research failed (continuing without it):", err instanceof Error ? err.message : err);
    return { text: "", sources: [] };
  }
}

// ─── Firecrawl Website Scrape ───────────────────────────────

export async function scrapeWebsite(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY || !url) return "";

  try {
    const resp = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      },
      // 15s — same reasoning as the Perplexity bump above. 8s is too tight for
      // slow corporate marketing sites (heavy JS, CDN warmups), and a timeout
      // here means the synthesis LLM loses the most reliable source of truth.
      15000,
    );
    if (!resp.ok) {
      console.warn("[briefings] Firecrawl returned", resp.status);
      return "";
    }
    const data = await resp.json() as { data?: { markdown?: string } };
    const md = data.data?.markdown ?? "";
    return md.slice(0, 8000);
  } catch (err) {
    console.warn("[briefings] Firecrawl scrape failed (continuing without it):", err instanceof Error ? err.message : err);
    return "";
  }
}

// ─── AI Synthesis ───────────────────────────────────────────

export interface AccountBriefingPromptArgs {
  account: AccountContext;
  /** Per-tenant Sales Console brand context — identifies THE SELLER. */
  brandCtx: SalesBrandContext;
  researchText: string;
  websiteContent: string;
  sources: string[];
}

/**
 * Pure prompt builder for the account briefing — extracted from
 * synthesizeBriefing so the seller→prospect framing can be unit-tested
 * without hitting the live LLM.
 *
 * DIRECTION CONTRACT: the tenant is always THE SELLER and the researched
 * account is always THE PROSPECT (buyer). Every generated value prop,
 * talking point, recommended message, objection, and page recommendation
 * must position the tenant's services being sold TO the account — never
 * the account selling to its own customers. The original prompt named the
 * seller only once and left the schema entirely prospect-shaped, so the
 * model would sometimes flip the perspective and brief "the account on how
 * to sell to itself". The explicit SELLER / PROSPECT blocks + direction
 * rules below lock the orientation in.
 */
export function buildAccountBriefingPrompt(args: AccountBriefingPromptArgs): {
  systemPrompt: string;
  userPrompt: string;
} {
  const { account, brandCtx, researchText, websiteContent, sources } = args;

  // ─── THE SELLER (the tenant doing the selling) ───
  // Robust identity: prefer the Sales Console brand name, then the brand
  // config name, then a neutral fallback — never the prospect's name.
  const sellerName =
    brandCtx.brandName.trim()
    || (account.brandName ?? "").trim()
    || "our company";
  const sellerDescriptor =
    (account.brandCompanyDescription ?? "").trim()
    || brandCtx.briefBlurb.replace(/^\(|\)$/g, "").trim()
    || (account.brandTargetAudience ? `a company that sells to ${account.brandTargetAudience}` : "");
  const sellerLine = sellerDescriptor ? `${sellerName} — ${sellerDescriptor}` : sellerName;

  const valuePropPairs = Array.isArray(brandCtx.valuePropPairs) ? brandCtx.valuePropPairs : [];
  const sellerOfferLines = [
    brandCtx.salesIntroLine.trim() && `Positioning / voice: ${brandCtx.salesIntroLine.trim()}`,
    ...valuePropPairs.map(p => {
      const roles = (p.roles ?? []).filter(Boolean).join(" / ");
      const header = roles ? `For ${roles} → ${p.theme}` : p.theme;
      return [header, p.pain && `  Pain: ${p.pain}`, p.proof && `  Proof: ${p.proof}`].filter(Boolean).join("\n");
    }),
  ].filter(Boolean).join("\n");

  // ─── THE PROSPECT (the researched account being sold to) ───
  const prospectIndustry = account.industry
    ?? (account.brandTargetAudience ? `companies in this space: ${account.brandTargetAudience}` : null)
    ?? "B2B companies";

  const systemPrompt = [
    `You are a B2B sales-intelligence analyst working for THE SELLER defined below. Your job is to brief THE SELLER's sales team on how to win THE PROSPECT as a customer — i.e. how THE SELLER should sell ITS OWN products and services TO THE PROSPECT.`,
    "",
    "=== THE SELLER (your employer — the company doing the selling) ===",
    sellerLine,
    sellerOfferLines ? `\nWhat ${sellerName} offers:\n${sellerOfferLines}` : "",
    "",
    "=== THE PROSPECT (the company being researched — the buyer) ===",
    `${account.name}${prospectIndustry ? ` — ${prospectIndustry}` : ""}`,
    "",
    "CRITICAL DIRECTION RULES — follow these without exception:",
    `- Write the entire briefing from ${sellerName}'s point of view as the SELLER. ${account.name} is the BUYER/prospect, not the seller.`,
    `- NEVER describe how ${account.name} should sell to ITS OWN customers, and never position ${account.name}'s own products. Every recommendation is about ${sellerName} selling TO ${account.name}.`,
    `- "fitAnalysis.primaryValueProp" = why ${account.name} should buy from ${sellerName} (lead with ${sellerName}'s value).`,
    `- "fitAnalysis.proofPoints" = ${sellerName}'s proof points, not ${account.name}'s.`,
    `- "buyingCommittee[].recommendedMessage" = what a ${sellerName} sales rep should say to that person at ${account.name}.`,
    `- "talkingPoints" = points a ${sellerName} rep raises in a conversation with ${account.name}.`,
    `- "pageRecommendations" = guidance for a personalized landing page ${sellerName} will show ${account.name} to win the deal.`,
    "",
    "Return ONLY valid JSON matching this exact schema:",
    JSON.stringify({
      companyName: "string (the PROSPECT company name)",
      overview: "2-3 sentence overview of the PROSPECT",
      tier: "Enterprise / Mid-Market / SMB / Unknown",
      organizationalModel: "Centralized / Decentralized / Hybrid / Unknown",
      leadership: [{ name: "string", title: "string" }],
      sizeAndLocations: {
        locationCount: "string or null",
        regions: ["string"],
        headquarters: "string or null",
        estimatedRevenue: "string or null",
        ownership: "string or null",
      },
      recentNews: [{ headline: "string", summary: "string", date: "string or null" }],
      buyingCommittee: [{ role: "string", painPoints: "string", recommendedMessage: "string" }],
      fitAnalysis: {
        primaryValueProp: "string (150 chars max)",
        keyPainPoints: ["string"],
        proofPoints: ["string"],
        potentialObjections: ["string"],
        recommendedApproach: "string",
      },
      talkingPoints: ["string"],
      pageRecommendations: {
        heroHeadline: "string",
        contentFocus: "string",
        ctaStrategy: "string",
      },
    }, null, 2),
    "If data is insufficient for a field, use null or empty arrays. Never fabricate data.",
  ].filter(line => line !== "").join("\n");

  const accountMeta = [
    account.domain ? `Website: ${account.domain}` : null,
    account.industry ? `Industry: ${account.industry}` : (account.brandTargetAudience ? `Target market: ${account.brandTargetAudience}` : null),
    account.segment ? `Segment: ${account.segment}` : null,
    account.city && account.state ? `Location: ${account.city}, ${account.state}` : account.state ? `State: ${account.state}` : null,
    account.numLocations ? `Locations: ${account.numLocations}` : null,
    account.dsoSize ? `DSO Size: ${account.dsoSize}` : null,
    account.privateEquityFirm ? `PE Firm: ${account.privateEquityFirm}` : null,
  ].filter(Boolean).join("\n");

  const userPrompt = [
    `PROSPECT company to brief ${sellerName}'s sales team on: ${account.name}`,
    accountMeta ? `\n--- Prospect Account Info ---\n${accountMeta}` : "",
    researchText ? `\n--- Research Data (about the prospect ${account.name}) ---\n${researchText}` : "",
    websiteContent ? `\n--- Prospect Website Content ---\n${websiteContent.slice(0, 4000)}` : "",
    sources.length > 0 ? `\n--- Sources ---\n${sources.join("\n")}` : "",
  ].filter(Boolean).join("\n");

  return { systemPrompt, userPrompt };
}

async function synthesizeBriefing(
  account: AccountContext,
  brandCtx: SalesBrandContext,
  researchText: string,
  websiteContent: string,
  sources: string[],
): Promise<Record<string, unknown>> {
  const { systemPrompt, userPrompt } = buildAccountBriefingPrompt({
    account,
    brandCtx,
    researchText,
    websiteContent,
    sources,
  });

  const raw = await callAIChat({
    model: "gpt-4o",
    temperature: 0.3,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    timeoutMs: 60000,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new AIChatError(
      "ai_parse",
      `AI returned non-JSON for briefing: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }
  parsed.sources = sources;
  return parsed;
}

// ─── Orchestration ──────────────────────────────────────────

/**
 * Research + synthesize + persist an account briefing, returning the persisted
 * row alongside the account it was generated for. Shared by the briefings route
 * (POST /accounts/:id/briefing) and the microsite generator, which calls this
 * inline when an account has no briefing yet so the page has real account facts
 * to anchor on.
 *
 * Failure modes: external research (Perplexity/Firecrawl) fails open to empty.
 * AI synthesis throws (AIChatError) — the route maps it to a precise status; the
 * microsite path catches it and continues without a briefing. Unknown account →
 * AccountNotFoundError. Slack notification is intentionally NOT fired here so the
 * inline microsite path never double-notifies; the route fires it after calling.
 */
/**
 * Coalesce concurrent briefing generations per (tenant, account): the research
 * + synthesis step costs 30–90s and real money, and it can now be triggered
 * from three places at once (the prewarm fired when the microsite modal opens,
 * the explicit "Generate briefing" button, and the inline fallback inside
 * generate-microsite). Joiners share the leader's promise instead of running
 * duplicate research. The map only ever holds in-flight work — entries clear
 * in finally, success or failure.
 */
const inFlightBriefings = new Map<string, ReturnType<typeof generateAndPersistAccountBriefing>>();

export function generateAndPersistAccountBriefingCoalesced(args: {
  tenantId: number;
  accountId: number;
}): ReturnType<typeof generateAndPersistAccountBriefing> {
  const key = `${args.tenantId}:${args.accountId}`;
  const existing = inFlightBriefings.get(key);
  if (existing) return existing;
  const run = generateAndPersistAccountBriefing(args).finally(() => {
    inFlightBriefings.delete(key);
  });
  inFlightBriefings.set(key, run);
  return run;
}

export async function generateAndPersistAccountBriefing(args: {
  tenantId: number;
  accountId: number;
}): Promise<{
  briefing: typeof salesBriefingsTable.$inferSelect;
  account: typeof salesAccountsTable.$inferSelect;
}> {
  const { tenantId, accountId } = args;

  const [account] = await db.select().from(salesAccountsTable)
    .where(and(eq(salesAccountsTable.id, accountId), eq(salesAccountsTable.tenantId, tenantId)));
  if (!account) throw new AccountNotFoundError(accountId);

  const [brandRow] = await db.select().from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, account.tenantId))
    .limit(1);
  const brandConfig = (brandRow?.config as Record<string, unknown> | undefined) ?? {};

  const accountCtx: AccountContext = {
    ...account,
    brandCompanyDescription: (brandConfig.companyDescription as string | undefined) || null,
    brandTargetAudience: (brandConfig.targetAudience as string | undefined) || null,
    brandName: (brandConfig.brandName as string | undefined) || null,
  };

  const scrapeUrl = account.domain
    ? (account.domain.startsWith("http") ? account.domain : `https://${account.domain}`)
    : null;

  // Best-effort enrichment: failures here must not kill the request.
  // perplexityResearch and scrapeWebsite already swallow their own errors,
  // but Promise.all would reject if either ever escapes — so guard it.
  const [research, website] = await Promise.all([
    perplexityResearch(accountCtx).catch((err) => {
      console.warn("[briefings] perplexity wrapper threw:", err);
      return { text: "", sources: [] as string[] };
    }),
    scrapeUrl
      ? scrapeWebsite(scrapeUrl).catch((err) => {
          console.warn("[briefings] scrape wrapper threw:", err);
          return "";
        })
      : Promise.resolve(""),
  ]);

  // Seller identity (the tenant) for the briefing's direction framing.
  const brandCtx = await getSalesBrandContext(tenantId);

  const briefingData = await synthesizeBriefing(
    accountCtx,
    brandCtx,
    research.text,
    website,
    research.sources,
  );

  const existing = await db.select({ id: salesBriefingsTable.id })
    .from(salesBriefingsTable)
    .where(and(
      eq(salesBriefingsTable.tenantId, tenantId),
      eq(salesBriefingsTable.accountId, accountId),
    ))
    .limit(1);

  let briefing: typeof salesBriefingsTable.$inferSelect;
  if (existing.length > 0) {
    [briefing] = await db.update(salesBriefingsTable)
      .set({ briefingData, status: "complete" })
      .where(and(
        eq(salesBriefingsTable.tenantId, tenantId),
        eq(salesBriefingsTable.id, existing[0].id),
      ))
      .returning();
  } else {
    [briefing] = await db.insert(salesBriefingsTable).values({
      tenantId,
      accountId,
      briefingData,
      status: "complete",
    }).returning();
  }

  return { briefing, account };
}
