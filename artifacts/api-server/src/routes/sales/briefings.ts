import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesBriefingsTable, salesAccountsTable, lpBrandSettingsTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { callAIChat, AIChatError, aiErrorMessage, fetchWithTimeout } from "../../lib/ai-utils";

const router = Router();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY ?? "";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? "";

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

async function scrapeWebsite(url: string): Promise<string> {
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

async function synthesizeBriefing(
  account: AccountContext,
  researchText: string,
  websiteContent: string,
  sources: string[],
): Promise<Record<string, unknown>> {
  const sellerDesc = account.brandCompanyDescription
    ?? (account.brandName && account.brandTargetAudience
      ? `${account.brandName}, which sells to ${account.brandTargetAudience}`
      : (account.brandName ?? "a B2B company"));
  const prospectIndustry = account.industry
    ?? (account.brandTargetAudience ? `companies in this space: ${account.brandTargetAudience}` : null)
    ?? "B2B companies";

  const systemPrompt = [
    `You are a B2B sales intelligence analyst. Given research data about a prospect, synthesize a structured account briefing for the sales team at ${sellerDesc}. The prospect being researched is: ${prospectIndustry}.`,
    "Return ONLY valid JSON matching this exact schema:",
    JSON.stringify({
      companyName: "string",
      overview: "2-3 sentence company overview",
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
  ].join("\n");

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
    `Company: ${account.name}`,
    accountMeta ? `\n--- Account Info ---\n${accountMeta}` : "",
    researchText ? `\n--- Research Data ---\n${researchText}` : "",
    websiteContent ? `\n--- Website Content ---\n${websiteContent.slice(0, 4000)}` : "",
    sources.length > 0 ? `\n--- Sources ---\n${sources.join("\n")}` : "",
  ].filter(Boolean).join("\n");

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

// ─── Routes ─────────────────────────────────────────────────

// Get briefing for an account
router.get("/accounts/:accountId/briefing", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const [briefing] = await db.select().from(salesBriefingsTable)
      .where(and(
        eq(salesBriefingsTable.tenantId, tenantId),
        eq(salesBriefingsTable.accountId, Number(req.params.accountId)),
      ))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);
    if (!briefing) {
      res.json(null);
      return;
    }
    res.json(briefing);
  } catch (err) {
    console.error("GET briefing error:", err);
    res.status(500).json({ error: "Failed to load briefing" });
  }
});

// Generate or refresh briefing for an account
router.post("/accounts/:accountId/briefing", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const accountId = Number(req.params.accountId);
  if (isNaN(accountId) || accountId <= 0) {
    res.status(400).json({ error: "Invalid accountId" });
    return;
  }
  try {
    const [account] = await db.select().from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.id, accountId), eq(salesAccountsTable.tenantId, tenantId)));
    if (!account) {
      res.status(404).json({ error: "Account not found for this tenant" });
      return;
    }

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

    let briefingData: Record<string, unknown>;
    try {
      briefingData = await synthesizeBriefing(
        accountCtx,
        research.text,
        website,
        research.sources,
      );
    } catch (err) {
      // AI synthesis is the only step that *must* succeed — surface a precise
      // error to the client instead of a generic 500.
      const { status, message } = aiErrorMessage(err, "Failed to generate briefing");
      console.error("[briefings] synthesis failed:", err);
      res.status(status).json({ error: message });
      return;
    }

    const existing = await db.select({ id: salesBriefingsTable.id })
      .from(salesBriefingsTable)
      .where(and(
        eq(salesBriefingsTable.tenantId, tenantId),
        eq(salesBriefingsTable.accountId, accountId),
      ))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db.update(salesBriefingsTable)
        .set({ briefingData, status: "complete" })
        .where(and(
          eq(salesBriefingsTable.tenantId, tenantId),
          eq(salesBriefingsTable.id, existing[0].id),
        ))
        .returning();
    } else {
      [result] = await db.insert(salesBriefingsTable).values({
        tenantId,
        accountId,
        briefingData,
        status: "complete",
      }).returning();
    }

    res.json(result);
  } catch (err) {
    console.error("POST briefing error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate briefing";
    res.status(500).json({ error: `Failed to generate briefing: ${message}` });
  }
});

export default router;
