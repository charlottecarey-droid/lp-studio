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

type AiBlock = Record<string, unknown>;

/**
 * Normalize an AI-generated block into the { id, type, props } structure
 * that the block renderer expects. Handles both the new (correct) format and
 * the legacy flat format the AI sometimes produces.
 */
function normalizeBlock(raw: AiBlock, index: number): AiBlock {
  const type = (raw.type as string) ?? "hero";

  // If the block already has a proper `props` object, just ensure it has an id
  if (raw.props && typeof raw.props === "object") {
    return {
      id: raw.id ?? `${type}-${index}`,
      type,
      props: mergeWithDefaults(type, raw.props as AiBlock),
    };
  }

  // Legacy flat format — lift all non-type/id keys into props, fill defaults
  const { type: _t, id: _id, ...rest } = raw;
  return {
    id: `${type}-${index}`,
    type,
    props: mergeWithDefaults(type, rest),
  };
}

function mergeWithDefaults(type: string, aiProps: AiBlock): AiBlock {
  switch (type) {
    case "hero":
      return {
        headline: aiProps.headline ?? aiProps.heading ?? "See What Dandy Can Do For You",
        subheadline: aiProps.subheadline ?? aiProps.subheading ?? aiProps.subtitle ?? "Digital-first lab workflows that save time, reduce remakes, and delight your patients.",
        ctaText: aiProps.ctaText ?? "Book a Demo",
        ctaUrl: aiProps.ctaUrl ?? "#",
        ctaColor: aiProps.ctaColor ?? "#C7E738",
        ctaTextColor: aiProps.ctaTextColor ?? "#001a14",
        heroType: aiProps.heroType ?? "static-image",
        layout: aiProps.layout ?? "centered",
        backgroundStyle: aiProps.backgroundStyle ?? "dark",
        showSocialProof: aiProps.showSocialProof ?? true,
        socialProofText: aiProps.socialProofText ?? "Trusted by 12,000+ dental practices across the US",
        imageUrl: aiProps.imageUrl ?? "",
        mediaUrl: aiProps.mediaUrl ?? "",
      };

    case "benefits-grid":
    case "features": {
      const rawItems = (aiProps.items ?? aiProps.features ?? aiProps.benefits ?? []) as AiBlock[];
      return {
        headline: aiProps.headline ?? aiProps.heading ?? "Why practices choose Dandy",
        columns: aiProps.columns ?? 3,
        items: rawItems.length > 0
          ? rawItems.map((f) => ({
              icon: f.icon ?? "Zap",
              title: f.title ?? f.name ?? "",
              description: f.description ?? f.body ?? "",
            }))
          : [
              { icon: "Zap", title: "Faster Turnaround", description: "5-day crown delivery with real-time case tracking." },
              { icon: "RefreshCcw", title: "Free Remakes", description: "If a case doesn't fit, we remake it at no charge." },
              { icon: "HeadphonesIcon", title: "Dedicated Support", description: "A real person answers your calls and knows your preferences." },
            ],
      };
    }

    case "trust-bar":
    case "stats": {
      const rawStats = (aiProps.items ?? aiProps.stats ?? []) as AiBlock[];
      return {
        items: rawStats.length > 0
          ? rawStats.map((s) => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [
              { value: "12,000+", label: "Dental Practices" },
              { value: "48 hrs", label: "Avg. Turnaround" },
              { value: "99.2%", label: "Perfect Fit Rate" },
            ],
      };
    }

    case "stat-callout":
      return {
        stat: aiProps.stat ?? aiProps.value ?? "89%",
        description: aiProps.description ?? aiProps.label ?? "Average reduction in remakes when partnering with Dandy",
        footnote: aiProps.footnote ?? "",
      };

    case "testimonial":
    case "testimonials": {
      const rawList = (aiProps.testimonials ?? []) as AiBlock[];
      if (rawList.length > 0) {
        const t = rawList[0];
        return {
          quote: t.quote ?? t.body ?? "",
          author: t.author ?? t.name ?? "Dental Practice Owner",
          role: t.role ?? t.title ?? "Dentist",
          practiceName: t.practiceName ?? t.company ?? "",
        };
      }
      return {
        quote: aiProps.quote ?? "",
        author: aiProps.author ?? "Dental Practice Owner",
        role: aiProps.role ?? "Dentist",
        practiceName: aiProps.practiceName ?? aiProps.company ?? "",
      };
    }

    case "bottom-cta":
    case "cta":
      return {
        headline: aiProps.headline ?? aiProps.heading ?? "Ready to upgrade your lab — with zero risk?",
        subheadline: aiProps.subheadline ?? aiProps.subheading ?? "No contracts. No setup fees. Free shipping both ways.",
        ctaText: aiProps.ctaText ?? "Book a Demo",
        ctaUrl: aiProps.ctaUrl ?? "#",
        backgroundStyle: aiProps.backgroundStyle ?? "dark",
      };

    case "how-it-works": {
      const rawSteps = (aiProps.steps ?? []) as AiBlock[];
      return {
        headline: aiProps.headline ?? aiProps.heading ?? "Simple to start.",
        steps: rawSteps.length > 0
          ? rawSteps.map((s, i) => ({
              number: s.number ?? `0${i + 1}`,
              title: s.title ?? s.name ?? "",
              description: s.description ?? s.body ?? "",
            }))
          : [
              { number: "01", title: "Scan & Send", description: "Take an intraoral scan and send it to Dandy in seconds." },
              { number: "02", title: "We Manufacture", description: "Your case enters Dandy's digital lab immediately." },
              { number: "03", title: "Delivered to Your Door", description: "Your restoration arrives in 5 business days." },
            ],
      };
    }

    case "comparison":
      return {
        headline: aiProps.headline ?? aiProps.heading ?? "A paradigm shift for your practice.",
        ctaText: aiProps.ctaText ?? "Get Started Free",
        ctaUrl: aiProps.ctaUrl ?? "#",
        oldWayLabel: aiProps.oldWayLabel ?? "Traditional Lab",
        oldWayBullets: aiProps.oldWayBullets ?? ["Long wait times", "Inconsistent fits", "Opaque pricing"],
        newWayLabel: aiProps.newWayLabel ?? "Dandy",
        newWayBullets: aiProps.newWayBullets ?? ["5-day crowns", "Free remakes", "Transparent pricing"],
      };

    case "pas-section":
      return {
        headline: aiProps.headline ?? aiProps.heading ?? "Your lab is costing you more than money.",
        body: aiProps.body ?? aiProps.description ?? "",
        bullets: Array.isArray(aiProps.bullets) ? aiProps.bullets : [],
      };

    case "rich-text":
      return {
        content: aiProps.content ?? aiProps.body ?? aiProps.html ?? "",
        maxWidth: aiProps.maxWidth ?? "prose",
      };

    default:
      return { ...aiProps };
  }
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
    const [account] = await db.select().from(salesAccountsTable)
      .where(eq(salesAccountsTable.id, accountId));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const [briefing] = await db.select().from(salesBriefingsTable)
      .where(eq(salesBriefingsTable.accountId, accountId))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);

    const openai = getOpenAIClient();
    if (!openai) { res.status(503).json({ error: "AI not configured" }); return; }

    const briefingData = briefing?.briefingData as Record<string, unknown> | undefined;

    const systemPrompt = [
      "You are an expert B2B landing page copywriter for Dandy, a dental technology company.",
      "You create personalized microsites for specific dental accounts (DSOs, independent practices, etc.).",
      "",
      "Return ONLY valid JSON with this exact structure:",
      "{ \"title\": string, \"slug\": string, \"blocks\": Block[] }",
      "",
      "Each Block MUST follow this exact format: { \"type\": string, \"props\": { ...props } }",
      "The props object contains all the block's content. Never put content fields at the top level of a block.",
      "",
      "Available block types and their required props:",
      "",
      "\"hero\": { headline, subheadline, ctaText, ctaUrl, backgroundStyle (\"dark\"|\"white\"|\"light-gray\") }",
      "\"benefits-grid\": { headline, columns (2 or 3), items: [{ icon (lucide name), title, description }] }",
      "\"trust-bar\": { items: [{ value, label }] }",
      "\"testimonial\": { quote, author, role, practiceName }",
      "\"how-it-works\": { headline, steps: [{ number (\"01\"), title, description }] }",
      "\"comparison\": { headline, oldWayLabel, oldWayBullets: string[], newWayLabel, newWayBullets: string[] }",
      "\"bottom-cta\": { headline, subheadline, ctaText, ctaUrl, backgroundStyle }",
      "\"pas-section\": { headline, body, bullets: string[] }",
      "",
      "Build a page with 4-6 blocks. Always start with a hero block.",
      "Use clear, bold, specific Dandy value props — never filler or generic marketing language.",
      "Reference the account's name, size, and pain points throughout the copy.",
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

    // Normalize blocks to the { id, type, props } structure the renderer expects
    const normalizedBlocks = (parsed.blocks as AiBlock[]).map((b, i) => normalizeBlock(b, i));

    // Save as a new page linked to the account
    const [page] = await db.insert(lpPagesTable).values({
      title: parsed.title,
      slug: parsed.slug,
      blocks: normalizedBlocks,
      status: "draft",
      mode: "sales",
      accountId,
    }).returning();

    res.json({ page, blocks: normalizedBlocks });
  } catch (err) {
    console.error("Generate microsite error:", err);
    res.status(500).json({ error: "Failed to generate microsite" });
  }
});

export default router;
