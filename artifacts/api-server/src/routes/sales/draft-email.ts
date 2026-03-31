import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable, salesHotlinksTable, salesBriefingsTable } from "@workspace/db";

const router = Router();

function getAIClient() {
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (integrationBase && integrationKey) {
    return { baseURL: integrationBase, apiKey: integrationKey };
  }
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) return { baseURL: "https://api.openai.com/v1", apiKey: directKey };
  return null;
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function perplexitySearch(
  apiKey: string,
  query: string,
  domainFilter?: string[]
): Promise<{ content: string; citations: string[] }> {
  const body: Record<string, unknown> = {
    model: "sonar",
    messages: [{ role: "user", content: query }],
  };
  if (domainFilter?.length) {
    body.search_domain_filter = domainFilter;
  }
  try {
    const res = await fetchWithTimeout(
      "https://api.perplexity.ai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      12000
    );
    if (!res.ok) return { content: "", citations: [] };
    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: string[];
    };
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      citations: data.citations ?? [],
    };
  } catch {
    return { content: "", citations: [] };
  }
}

async function firecrawlScrape(apiKey: string, domain: string): Promise<string> {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          excludeTags: ["nav", "footer", "script", "style"],
        }),
      },
      15000
    );
    if (!res.ok) return "";
    const data = await res.json() as { success?: boolean; data?: { markdown?: string } };
    const md = data?.data?.markdown ?? "";
    return md.slice(0, 4000);
  } catch {
    return "";
  }
}

// POST /sales/draft-email — rich cold email using all account/contact fields + Perplexity research + Firecrawl site crawl
router.post("/draft-email", async (req, res): Promise<void> => {
  const { contactId, accountId } = req.body;

  const ai = getAIClient();
  if (!ai) {
    res.status(503).json({ error: "AI not configured. Set AI integration or OPENAI_API_KEY." });
    return;
  }

  try {
    // ─── 1. Load contact ────────────────────────────────────────
    let firstName = "";
    let lastName = "";
    let title = "";
    let titleLevel = "";
    let contactRole = "";
    let department = "";
    let linkedinUrl = "";
    let contactEmail = "";
    let buyerPersona = "";
    let contactTier = "";

    if (contactId) {
      const [c] = await db.select().from(salesContactsTable)
        .where(eq(salesContactsTable.id, Number(contactId)));
      if (c) {
        firstName    = c.firstName ?? "";
        lastName     = c.lastName ?? "";
        title        = c.title ?? "";
        titleLevel   = c.titleLevel ?? "";
        contactRole  = c.contactRole ?? "";
        department   = c.department ?? "";
        linkedinUrl  = c.linkedinUrl ?? "";
        contactEmail = c.email ?? "";
        buyerPersona = c.role ?? "";
        contactTier  = c.tier ?? "";
      }
    }

    // ─── 2. Load account ────────────────────────────────────────
    let accountName = "";
    let domain = "";
    let industry = "";
    let segment = "";
    let dsoSize = "";
    let privateEquityFirm = "";
    let numLocations: number | null = null;
    let abmTier = "";
    let abmStage = "";
    let practiceSegment = "";
    let msaSigned = "";
    let enterprisePilot = "";
    let city = "";
    let state = "";
    let accountNotes = "";

    if (accountId) {
      const [a] = await db.select().from(salesAccountsTable)
        .where(eq(salesAccountsTable.id, Number(accountId)));
      if (a) {
        accountName       = a.name ?? "";
        domain            = a.domain ?? "";
        industry          = a.industry ?? "";
        segment           = a.segment ?? "";
        dsoSize           = a.dsoSize ?? "";
        privateEquityFirm = a.privateEquityFirm ?? "";
        numLocations      = a.numLocations ?? null;
        abmTier           = a.abmTier ?? "";
        abmStage          = a.abmStage ?? "";
        practiceSegment   = a.practiceSegment ?? "";
        msaSigned         = a.msaSigned ?? "";
        enterprisePilot   = a.enterprisePilot ?? "";
        city              = a.city ?? "";
        state             = a.state ?? "";
        accountNotes      = a.notes ?? "";
      }
    }

    // ─── 3. Load account briefing ───────────────────────────────
    type BriefingData = {
      overview?: string;
      tier?: string;
      organizationalModel?: string;
      leadership?: Array<{ name: string; title: string }>;
      sizeAndLocations?: { locationCount?: string; regions?: string[]; headquarters?: string; ownership?: string };
      recentNews?: Array<{ headline: string; summary: string; date?: string }>;
      buyingCommittee?: Array<{ role: string; painPoints: string; recommendedMessage: string }>;
      fitAnalysis?: { primaryValueProp?: string; keyPainPoints?: string[]; proofPoints?: string[]; potentialObjections?: string[]; recommendedApproach?: string };
      talkingPoints?: string[];
      pageRecommendations?: { heroHeadline?: string; contentFocus?: string; ctaStrategy?: string };
    };

    let briefing: BriefingData | null = null;
    if (accountId) {
      const [br] = await db.select().from(salesBriefingsTable)
        .where(eq(salesBriefingsTable.accountId, Number(accountId)))
        .orderBy(desc(salesBriefingsTable.updatedAt))
        .limit(1);
      if (br?.briefingData && (br.briefingData as Record<string, unknown>).overview) {
        briefing = br.briefingData as BriefingData;
      }
    }

    // ─── 4. Hotlink check ────────────────────────────────────────
    let hasMicrosite = false;
    if (contactId) {
      const hotlinks = await db.select({ id: salesHotlinksTable.id })
        .from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.contactId, Number(contactId)))
        .limit(1);
      hasMicrosite = hotlinks.length > 0;
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "the contact";
    const micrositeNote = hasMicrosite
      ? `A personalized microsite for ${accountName} is already live. Include a reference to it using the exact placeholder [MICROSITE_URL] where the link belongs naturally in the email. Example: "I put together a quick look at how Dandy would work for ${accountName} — [MICROSITE_URL]"`
      : "No microsite exists for this company yet. Do not mention a microsite or link.";

    // ─── 5. Research: Perplexity (news + LinkedIn) + Firecrawl (site) — all parallel ────
    const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
    const FIRECRAWL_KEY  = process.env.FIRECRAWL_API_KEY;

    let personResearch   = "";
    let companyResearch  = "";
    let linkedinResearch = "";
    let siteResearch     = "";
    const allCitations: string[] = [];

    const researchTasks: Promise<void>[] = [];

    if (PERPLEXITY_KEY && accountName) {
      // ── Person-specific search: talks, quotes, interviews, articles ──
      const personQuery = `Find public professional information about this specific person for a B2B sales outreach:

Name: ${fullName}
Title: ${title || "unknown"}
Company: ${accountName}

Search broadly across the web for:
- "${fullName}" conference talk, keynote, panel, or presentation (dental industry, DSO, healthcare ops)
- "${fullName}" quoted or interviewed in: Dental Economics, DSO News, Group Dentistry Now, Dentistry Today, podcasts, industry blogs
- "${fullName}" authored article, LinkedIn post, or published content
- "${fullName}" award, recognition, or leadership mention
- Any professional achievement, career move, or public statement from the last 6 months

Be specific. Include exact quotes, dates, and sources when found. If nothing found, say "No person-level information found."`;

      // ── Company news search: expansion, acquisition, growth signals ──
      const companyQuery = `Find recent company news about ${accountName} for a B2B sales team:

Company: ${accountName}${segment ? ` (${segment})` : ""}${numLocations ? `, ${numLocations} locations` : ""}${privateEquityFirm ? `, PE-backed by ${privateEquityFirm}` : ""}

Search for:
- "${accountName}" expansion, new locations, acquisition, merger — 2025 or 2026
- "${accountName}" press release, funding, leadership hire, partnership
- "${accountName}" DSO news, dental group news, job postings signaling growth

Return ONLY recent news (last 6 months). If nothing found, say "No recent company news found." Be brief.`;

      // ── LinkedIn: broad web search for this person's profile + activity ──
      const linkedinQuery = linkedinUrl
        ? `Look up ${fullName}'s LinkedIn profile at ${linkedinUrl} and also search the web for any of their recent LinkedIn posts, comments, or professional activity.

Also search: "${fullName}" site:linkedin.com OR "${fullName}" "${accountName}" LinkedIn

Extract:
- How long they've been in their current role and what they did before
- Any recent posts, shared articles, or comments (last 6 months) — what topics do they engage with?
- Career trajectory and stated professional priorities
- Any shared content about DSO growth, operations, technology, or dental industry trends

Be specific. If LinkedIn content is behind a paywall, report what's visible from search snippets.`
        : `Search for "${fullName}" "${accountName}" on LinkedIn and across the web.
Find their career background, current role details, any public posts or professional activity, and stated interests.
Only report what you can confirm from public sources.`;

      researchTasks.push(
        perplexitySearch(PERPLEXITY_KEY, personQuery).then(r => { personResearch = r.content; allCitations.push(...r.citations); }),
        perplexitySearch(PERPLEXITY_KEY, companyQuery).then(r => { companyResearch = r.content; allCitations.push(...r.citations); }),
        perplexitySearch(PERPLEXITY_KEY, linkedinQuery).then(r => { linkedinResearch = r.content; allCitations.push(...r.citations); }),
      );
    }

    if (FIRECRAWL_KEY && domain) {
      researchTasks.push(
        firecrawlScrape(FIRECRAWL_KEY, domain).then(r => { siteResearch = r; }),
      );
    } else if (PERPLEXITY_KEY && domain && accountName) {
      // Fallback: use Perplexity for site if no Firecrawl key
      const siteQuery = `Summarize the key facts about ${accountName} from their website at ${domain}. Focus on:
- What type of dental organization they are (DSO, group practice, independent)
- Number of locations or practices
- Geographic footprint (states, regions)
- Any stated growth strategy, M&A activity, or expansion plans
- Key leadership or brand positioning
Be factual and specific. Only include what's on the site.`;
      researchTasks.push(
        perplexitySearch(PERPLEXITY_KEY, siteQuery, [domain]).then(r => { siteResearch = r.content; allCitations.push(...r.citations); }),
      );
    }

    await Promise.all(researchTasks);

    const noPersonInfo = !personResearch || personResearch.includes("No person-level information found");
    const noCompanyNews = !companyResearch || companyResearch.includes("No recent company news found");

    const researchBlock = [
      `=== PERSON RESEARCH: ${fullName} ===`,
      noPersonInfo
        ? `No public information found for ${fullName}. Do NOT invent person-level hooks.`
        : personResearch,
      "",
      `=== LINKEDIN / PROFESSIONAL PRESENCE: ${fullName} ===`,
      linkedinResearch
        ? linkedinResearch
        : `No LinkedIn activity found for ${fullName}.`,
      "",
      `=== COMPANY NEWS: ${accountName} ===`,
      noCompanyNews
        ? `No recent company news found for ${accountName} (last 6 months). Use a pain point hook instead.`
        : companyResearch,
      "",
      siteResearch
        ? `=== COMPANY WEBSITE (${domain}) ===\n${siteResearch}`
        : domain
          ? `=== COMPANY WEBSITE ===\nCould not retrieve content from ${domain}.`
          : "",
    ].filter(Boolean).join("\n");

    // ─── 6. Build contact/account context ────────────────────────
    const locationStr = [city, state].filter(Boolean).join(", ");
    const accountContext = [
      `Company: ${accountName}`,
      industry          && `Industry: ${industry}`,
      segment           && `Segment: ${segment}`,
      practiceSegment   && `Practice Profile: ${practiceSegment}`,
      dsoSize           && `DSO Size: ${dsoSize}`,
      numLocations      && `Locations: ${numLocations}`,
      privateEquityFirm && `PE-backed by: ${privateEquityFirm}`,
      locationStr       && `HQ: ${locationStr}`,
      abmTier           && `ABM Tier: ${abmTier}`,
      abmStage          && `ABM Stage: ${abmStage}`,
      (msaSigned === "1" || /closed.?won/i.test(abmStage)) && `MSA Status: Enterprise MSA already signed`,
      enterprisePilot === "1" && `Pilot Status: Enterprise pilot already underway`,
      domain            && `Website: ${domain}`,
      accountNotes      && `Notes: ${accountNotes}`,
    ].filter(Boolean).join("\n");

    const contactContext = [
      `Name: ${fullName}`,
      title             && `Title: ${title}`,
      titleLevel        && `Seniority: ${titleLevel}`,
      contactRole       && `Functional Role: ${contactRole}`,
      department        && `Department: ${department}`,
      buyerPersona      && `Buyer Persona: ${buyerPersona}`,
      contactTier       && `ABM Contact Tier: ${contactTier}`,
      linkedinUrl       && `LinkedIn: ${linkedinUrl}`,
    ].filter(Boolean).join("\n");

    // ─── 7. Build briefing block ──────────────────────────────────
    const briefingBlock = (() => {
      if (!briefing) return null;
      const parts: string[] = [];
      if (briefing.overview) parts.push(`Overview: ${briefing.overview}`);
      const sl = briefing.sizeAndLocations;
      if (sl) {
        if (sl.locationCount) parts.push(`Locations: ${sl.locationCount}`);
        if (sl.headquarters)  parts.push(`HQ: ${sl.headquarters}`);
        if (sl.regions?.length) parts.push(`Regions: ${sl.regions.join(", ")}`);
        if (sl.ownership)     parts.push(`Ownership structure: ${sl.ownership}`);
      }
      if (briefing.organizationalModel) parts.push(`Org model: ${briefing.organizationalModel}`);
      if (briefing.leadership?.length) {
        parts.push(`Leadership: ${briefing.leadership.map(l => `${l.name} (${l.title})`).join(", ")}`);
      }
      if (briefing.recentNews?.length) {
        parts.push("\nRECENT NEWS (only use if < 6 months old):");
        briefing.recentNews.slice(0, 3).forEach(n => {
          parts.push(`- ${n.headline}${n.date ? ` (${n.date})` : ""}: ${n.summary}`);
        });
      }
      const fit = briefing.fitAnalysis;
      if (fit) {
        if (fit.primaryValueProp)   parts.push(`\nPrimary value prop for this account: ${fit.primaryValueProp}`);
        if (fit.keyPainPoints?.length) parts.push(`Key pain points: ${fit.keyPainPoints.join(" | ")}`);
        if (fit.proofPoints?.length)   parts.push(`Proof points: ${fit.proofPoints.join(" | ")}`);
        if (fit.recommendedApproach)   parts.push(`Recommended approach: ${fit.recommendedApproach}`);
      }
      if (briefing.talkingPoints?.length) {
        parts.push(`\nTalking points:\n${briefing.talkingPoints.map(t => `- ${t}`).join("\n")}`);
      }
      if (briefing.buyingCommittee?.length) {
        const persona = [titleLevel, contactRole, title].filter(Boolean).join(" ").toLowerCase();
        let matched = briefing.buyingCommittee[0];
        for (const m of briefing.buyingCommittee) {
          if (persona && m.role.toLowerCase().split(/[\s,/]+/).some(w => persona.includes(w))) {
            matched = m;
            break;
          }
        }
        parts.push(`\nFor this persona (${matched.role}):`);
        parts.push(`  Pain points: ${matched.painPoints}`);
        parts.push(`  Recommended message: ${matched.recommendedMessage}`);
      }
      return parts.join("\n");
    })();

    // ─── 8. Build the prompt ──────────────────────────────────────
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setMonth(cutoff.getMonth() - 6);
    const todayStr  = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const cutoffStr = cutoff.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const prompt = `You write short, human cold emails for Dandy — a vertically integrated dental lab and clinical performance platform for DSOs.

⚠️ RECENCY RULE — READ THIS BEFORE LOOKING AT THE RESEARCH:
Today's date is ${todayStr}. The 6-month cutoff is ${cutoffStr}.
ANY news, event, quote, hire, or announcement that occurred BEFORE ${cutoffStr} must be completely ignored as a hook.
If you are not certain something happened after ${cutoffStr}, do NOT use it as a hook.
When in doubt, lead with a pain point tailored to their role instead.
This rule is absolute — do not use old information even if it seems relevant.

The research below was gathered before writing. Only use items that clearly fall after ${cutoffStr}.

HOOK PRIORITY ORDER (always follow this):
1. BEST: A specific, recent (post-${cutoffStr}) fact about ${firstName} personally — a talk they gave, a quote, a post, a career move, a published article
2. GOOD: A specific, recent (post-${cutoffStr}) company event — acquisition, expansion, new market, leadership hire
3. FALLBACK: A pain point directly relevant to their role — use this if research yields nothing recent and verifiable

Do NOT mix these levels. If you found a person-level hook, use that. Do not also mention company news.

=== RESEARCH FINDINGS ===
${researchBlock}
${briefingBlock ? `\n=== ACCOUNT INTELLIGENCE (pre-generated briefing) ===\n${briefingBlock}` : ""}

=== CONTACT ===
${contactContext}
${micrositeNote}

=== ACCOUNT ===
${accountContext}

=== DANDY POSITIONING ===
Core message: "The world's fastest growing DSOs unlock more EBITDA with Dandy."

Dandy is an end-to-end lab partner built for DSOs at the growth stage where acquisitions are slowing and same-store performance is the primary lever. By embedding standardized workflows, AI-driven quality control, and centralized visibility into the clinical process, Dandy turns the lab from a fragmented cost center into a scalable revenue engine.

The four DSO pain points:
1. Pressure on same-store growth
2. Fragmented, non-actionable data
3. Standardization vs. clinical autonomy
4. Capital constraints ($40–75K per operatory)

The five messaging pillars (pick the most relevant to this contact's role):
- "Same-store growth is the new growth engine"
- "Growth breaks without a standard that scales"
- "Waste is the hidden tax on every DSO"
- "Visibility isn't reporting, it's control"
- "Enterprise growth shouldn't require enterprise risk"

=== PROOF POINTS BY PERSONA ===

IMPORTANT — customer name rules:
- "Apex Dental Partners" or "Apex" — NEVER "APEX DSOs" (Apex is one DSO, not multiple)
- "Dental Care Alliance" or "DCA" — when referring to their practices, say "DCA practices"
- Never pluralize a single DSO name with "DSOs"

CFO / Finance: remake math ($780 lost value per crown), Apex Dental Partners saw a 29% remake reduction, zero scanner CAPEX, month-to-month terms
COO / Operations: DCA consolidated 400+ lab relationships, Dandy Hub dashboard, preferred program without forcing doctors
CDO / Clinical: Apex Dental Partners reached near-zero remakes within a year, DCA practices hit ~1% remake rate, AI margin detection
CEO / President: Apex Dental Partners saw a 12.5% revenue increase, low-risk entry with free scanners
Growth / M&A: eliminates $40–75K capital barrier, scales from 10 to 200+ locations

=== EMAIL FORMAT ===
Subject: [subject line]

Hi ${firstName || "[First Name]"},

[1-sentence hook — research-based if recent and specific, otherwise a pain point tailored to their role]

[1-sentence Dandy proof point with a real number or quote, matched to their persona]

[1-sentence soft CTA]

Best,

=== EMAIL RULES ===
- 3 sentences max in the body. One sentence per line. Blank line between each.
- Sound like a real person, not a sales rep
- RECENCY RULE: Only use something as a hook if it clearly happened after ${cutoffStr}. Anything older or undated — ignore it completely and lead with a pain point instead.
- Never open with: "I hope", "My name is", "I'm reaching out", "I came across your profile"
- No buzzwords: leverage, synergy, streamline, revolutionize, game-changer, innovative solution, transform, empower, robust, cutting-edge
- Don't over-explain Dandy
- If a microsite exists, use the placeholder [MICROSITE_URL] exactly once where the link belongs naturally
- CTA should be low-commitment ("Worth a quick call?" / "Happy to share the math?" / "Open to a 15-min chat?")
- End with "Best,"

Output only the email. Nothing else.`;

    // ─── 9. Call AI ───────────────────────────────────────────────
    const response = await fetchWithTimeout(
      `${ai.baseURL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0.85,
          messages: [
            { role: "system", content: "You are a sales email copywriter. Output only the email as requested. Nothing else." },
            { role: "user", content: prompt },
          ],
        }),
      },
      30000
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("AI error:", err);
      res.status(500).json({ error: "AI request failed" });
      return;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "";

    const subjectMatch = raw.match(/^Subject:\s*(.+)/m);
    const subject = subjectMatch?.[1]?.trim() ?? "";
    let body = raw;
    if (subjectMatch) {
      const idx = raw.indexOf(subjectMatch[0]);
      body = raw.slice(idx + subjectMatch[0].length).replace(/^\s*\n/, "").trim();
    }

    // Deduplicate and filter citations; add Firecrawl domain as a source if used
    const sources: string[] = [];
    if (FIRECRAWL_KEY && domain && siteResearch) {
      sources.push(domain.startsWith("http") ? domain : `https://${domain}`);
    }
    for (const url of allCitations) {
      if (url && !sources.includes(url)) sources.push(url);
    }

    res.json({
      subject,
      body,
      hasMicrosite,
      contactEmail,
      researchUsed:   !noPersonInfo || !noCompanyNews || !!linkedinResearch,
      siteResearched: !!siteResearch,
      siteSource:     siteResearch ? (FIRECRAWL_KEY && domain ? "firecrawl" : "perplexity") : null,
      sources,
      researchText: {
        person:   personResearch   || "",
        linkedin: linkedinResearch || "",
        company:  companyResearch  || "",
        site:     siteResearch     || "",
      },
    });
  } catch (err) {
    console.error("POST /sales/draft-email error:", err);
    res.status(500).json({ error: "Failed to generate email draft" });
  }
});

export default router;
