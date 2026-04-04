import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesBriefingsTable, salesAccountsTable } from "@workspace/db";
import OpenAI from "openai";

const router = Router();

function getOpenAIClient(): OpenAI | null {
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (integrationBase && integrationKey) {
    return new OpenAI({ apiKey: integrationKey, baseURL: integrationBase });
  }
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) return new OpenAI({ apiKey: directKey });
  return null;
}

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY ?? "";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? "";

// ─── Perplexity Research ────────────────────────────────────

async function perplexityResearch(companyName: string, domain?: string | null): Promise<{ text: string; sources: string[] }> {
  if (!PERPLEXITY_API_KEY) return { text: "", sources: [] };

  const query = [
    `Research the company "${companyName}"${domain ? ` (${domain})` : ""}.`,
    "Provide: executive leadership (name + title), number of locations/offices,",
    "states/regions they operate in, PE backer or ownership structure, recent news,",
    "any technology stack or vendor partnerships, estimated revenue or size indicators.",
    "Focus on factual, verifiable information.",
  ].join(" ");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [{ role: "user", content: query }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!resp.ok) return { text: "", sources: [] };
    const data = await resp.json() as { choices?: { message?: { content?: string } }[]; citations?: string[] };
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      sources: data.citations ?? [],
    };
  } catch {
    return { text: "", sources: [] };
  }
}

// ─── Firecrawl Website Scrape ───────────────────────────────

async function scrapeWebsite(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY || !url) return "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!resp.ok) return "";
    const data = await resp.json() as { data?: { markdown?: string } };
    const md = data.data?.markdown ?? "";
    return md.slice(0, 8000);
  } catch {
    return "";
  }
}

// ─── AI Synthesis ───────────────────────────────────────────

async function synthesizeBriefing(
  companyName: string,
  researchText: string,
  websiteContent: string,
  sources: string[],
): Promise<Record<string, unknown>> {
  const openai = getOpenAIClient();
  if (!openai) return buildFallbackBriefing(companyName);

  const systemPrompt = [
    "You are a B2B sales intelligence analyst. Given research data about a company, synthesize a structured account briefing.",
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

  const userPrompt = [
    `Company: ${companyName}`,
    researchText ? `\n--- Research Data ---\n${researchText}` : "",
    websiteContent ? `\n--- Website Content ---\n${websiteContent.slice(0, 4000)}` : "",
    sources.length > 0 ? `\n--- Sources ---\n${sources.join("\n")}` : "",
  ].filter(Boolean).join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    parsed.sources = sources;
    return parsed;
  } catch (err) {
    console.error("Briefing synthesis error:", err);
    return buildFallbackBriefing(companyName);
  }
}

function buildFallbackBriefing(companyName: string): Record<string, unknown> {
  return {
    companyName,
    overview: `Research data for ${companyName} is not yet available. Generate a briefing to populate.`,
    tier: "Unknown",
    leadership: [],
    sizeAndLocations: { locationCount: null, regions: [], headquarters: null },
    recentNews: [],
    buyingCommittee: [],
    fitAnalysis: { primaryValueProp: "", keyPainPoints: [], proofPoints: [], potentialObjections: [] },
    talkingPoints: [],
    pageRecommendations: {},
    sources: [],
  };
}

// ─── Routes ─────────────────────────────────────────────────

// Get briefing for an account
router.get("/accounts/:accountId/briefing", async (req, res): Promise<void> => {
  try {
    const [briefing] = await db.select().from(salesBriefingsTable)
      .where(eq(salesBriefingsTable.accountId, Number(req.params.accountId)))
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
router.post("/accounts/:accountId/briefing", async (req, res): Promise<void> => {
  const accountId = Number(req.params.accountId);
  if (isNaN(accountId) || accountId <= 0) {
    res.status(400).json({ error: "Invalid accountId" });
    return;
  }
  try {
    // Load account
    const [account] = await db.select().from(salesAccountsTable)
      .where(eq(salesAccountsTable.id, accountId));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    // Run research pipeline
    const [research, website] = await Promise.all([
      perplexityResearch(account.name, account.domain),
      account.domain ? scrapeWebsite(`https://${account.domain}`) : Promise.resolve(""),
    ]);

    // Synthesize with AI
    const briefingData = await synthesizeBriefing(
      account.name,
      research.text,
      website,
      research.sources,
    );

    // Check if briefing exists
    const existing = await db.select({ id: salesBriefingsTable.id })
      .from(salesBriefingsTable)
      .where(eq(salesBriefingsTable.accountId, accountId))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db.update(salesBriefingsTable)
        .set({ briefingData, status: "complete" })
        .where(eq(salesBriefingsTable.id, existing[0].id))
        .returning();
    } else {
      [result] = await db.insert(salesBriefingsTable).values({
        accountId,
        briefingData,
        status: "complete",
      }).returning();
    }

    res.json(result);
  } catch (err) {
    console.error("POST briefing error:", err);
    res.status(500).json({ error: "Failed to generate briefing" });
  }
});

export default router;
