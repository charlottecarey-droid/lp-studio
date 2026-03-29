import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesAccountsTable, salesBriefingsTable, lpPagesTable } from "@workspace/db";
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

/**
 * POST /sales/accounts/:accountId/generate-microsite
 *
 * Creates a personalized landing page for a sales account, using the
 * AI briefing data (if available) to pre-populate copy, value props,
 * and messaging tailored to that account's segment, pain points, and
 * buying committee.
 */
router.post("/accounts/:accountId/generate-microsite", async (req, res): Promise<void> => {
  const accountId = Number(req.params.accountId);
  const { prompt: userPrompt } = req.body as { prompt?: string };

  try {
    // Load account
    const [account] = await db.select().from(salesAccountsTable)
      .where(eq(salesAccountsTable.id, accountId));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    // Load briefing if available
    const [briefing] = await db.select().from(salesBriefingsTable)
      .where(eq(salesBriefingsTable.accountId, accountId))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);

    const openai = getOpenAIClient();
    if (!openai) { res.status(503).json({ error: "AI not configured" }); return; }

    // Build context-rich prompt
    const briefingData = briefing?.briefingData as Record<string, unknown> | undefined;

    const systemPrompt = [
      "You are an expert B2B landing page copywriter for Dandy, a dental technology company.",
      "You create personalized microsites for specific dental accounts (DSOs, independent practices, etc.).",
      "Return ONLY valid JSON with this structure: { title, slug, blocks }",
      "where blocks is an array of landing page block objects.",
      "",
      "Each block must have a `type` field. Common types:",
      '- "hero": { type, heading, subheading, ctaText, ctaUrl, backgroundStyle, imageUrl }',
      '- "features": { type, heading, features: [{ title, description, icon }] }',
      '- "stats": { type, stats: [{ value, label }] }',
      '- "testimonials": { type, heading, testimonials: [{ quote, author, role, company }] }',
      '- "cta": { type, heading, subheading, ctaText, ctaUrl, backgroundStyle }',
      "",
      "Make the copy feel personalized to the specific company — reference their segment, size, challenges.",
      "Use Dandy's value props: digital workflows, chairside efficiency, lab-quality results, easy onboarding.",
      "Keep language warm, professional, and specific. Avoid generic marketing fluff.",
    ].join("\n");

    const contextParts: string[] = [];
    contextParts.push(`ACCOUNT: ${account.name}`);
    if (account.domain) contextParts.push(`Domain: ${account.domain}`);
    if (account.segment) contextParts.push(`Segment: ${account.segment}`);
    if (account.industry) contextParts.push(`Industry: ${account.industry}`);

    if (briefingData) {
      if (briefingData.overview) contextParts.push(`\nACCOUNT OVERVIEW:\n${briefingData.overview}`);
      if (briefingData.tier) contextParts.push(`Tier: ${briefingData.tier}`);

      const sizeAndLocations = briefingData.sizeAndLocations as Record<string, unknown> | undefined;
      if (sizeAndLocations) {
        if (sizeAndLocations.locationCount) contextParts.push(`Locations: ${sizeAndLocations.locationCount}`);
        if (sizeAndLocations.headquarters) contextParts.push(`HQ: ${sizeAndLocations.headquarters}`);
        if (sizeAndLocations.ownership) contextParts.push(`Ownership: ${sizeAndLocations.ownership}`);
      }

      const fitAnalysis = briefingData.fitAnalysis as Record<string, unknown> | undefined;
      if (fitAnalysis) {
        if (fitAnalysis.primaryValueProp) contextParts.push(`\nPRIMARY VALUE PROP:\n${fitAnalysis.primaryValueProp}`);
        if (Array.isArray(fitAnalysis.keyPainPoints) && fitAnalysis.keyPainPoints.length > 0) {
          contextParts.push(`KEY PAIN POINTS:\n${(fitAnalysis.keyPainPoints as string[]).map(p => `- ${p}`).join("\n")}`);
        }
        if (Array.isArray(fitAnalysis.proofPoints) && fitAnalysis.proofPoints.length > 0) {
          contextParts.push(`PROOF POINTS:\n${(fitAnalysis.proofPoints as string[]).map(p => `- ${p}`).join("\n")}`);
        }
        if (fitAnalysis.recommendedApproach) contextParts.push(`RECOMMENDED APPROACH:\n${fitAnalysis.recommendedApproach}`);
      }

      const buyingCommittee = briefingData.buyingCommittee as Array<{ role: string; painPoints: string }> | undefined;
      if (buyingCommittee && buyingCommittee.length > 0) {
        contextParts.push("\nBUYING COMMITTEE:");
        buyingCommittee.forEach(p => contextParts.push(`- ${p.role}: ${p.painPoints}`));
      }

      const pageRec = briefingData.pageRecommendations as Record<string, string> | undefined;
      if (pageRec) {
        if (pageRec.heroHeadline) contextParts.push(`\nSUGGESTED HERO HEADLINE: "${pageRec.heroHeadline}"`);
        if (pageRec.contentFocus) contextParts.push(`CONTENT FOCUS: ${pageRec.contentFocus}`);
        if (pageRec.ctaStrategy) contextParts.push(`CTA STRATEGY: ${pageRec.ctaStrategy}`);
      }
    }

    if (userPrompt) contextParts.push(`\nADDITIONAL INSTRUCTIONS:\n${userPrompt}`);
    contextParts.push(`\nGenerate a personalized microsite for ${account.name}. Make it specific to their business.`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextParts.join("\n") },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; slug?: string; blocks?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!parsed.title || !parsed.slug || !Array.isArray(parsed.blocks)) {
      res.status(500).json({ error: "AI response missing required fields" });
      return;
    }

    // Sanitize slug
    parsed.slug = parsed.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Save as a new page linked to the account
    const [page] = await db.insert(lpPagesTable).values({
      title: parsed.title,
      slug: parsed.slug,
      blocks: parsed.blocks,
      status: "draft",
      mode: "sales",
      accountId,
    }).returning();

    res.json({ page, blocks: parsed.blocks });
  } catch (err) {
    console.error("Generate microsite error:", err);
    res.status(500).json({ error: "Failed to generate microsite" });
  }
});

export default router;
