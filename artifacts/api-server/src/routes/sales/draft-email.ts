import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable, salesHotlinksTable, salesBriefingsTable } from "@workspace/db";
import { getAIClient, fetchWithTimeout, type BriefingData } from "../../lib/ai-utils";

const router = Router();

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
    const noLinkedIn = !linkedinResearch || linkedinResearch.includes("No LinkedIn") || linkedinResearch.includes("no public");
    const researchIsWeak = noPersonInfo && noCompanyNews && noLinkedIn;

    const researchBlock = [
      researchIsWeak
        ? `⚠️ RESEARCH WAS THIN — web searches returned very little about ${fullName} or ${accountName}. Rely on the ACCOUNT INTELLIGENCE briefing below and default to a role-specific pain point hook. Do NOT invent facts or cite unverified sources.`
        : "",
      `=== PERSON RESEARCH: ${fullName} ===`,
      noPersonInfo
        ? `No public information found for ${fullName}. Do NOT invent person-level hooks.`
        : personResearch,
      "",
      `=== LINKEDIN / PROFESSIONAL PRESENCE: ${fullName} ===`,
      noLinkedIn
        ? `No LinkedIn activity found for ${fullName}.`
        : linkedinResearch,
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

⚠️ LOCATION MILESTONE RULE:
Our database shows ${accountName} currently has ${numLocations ?? "an unknown number of"} locations.
If research mentions them "opening their Nth location" and N is less than or equal to ${numLocations ?? 0}, that milestone is CLEARLY OLD — they've grown past it. Do NOT use it as a hook under any circumstances. Treat it as outdated regardless of how it's dated.

⚠️ LINKEDIN PROFILE RULE:
LinkedIn profile pages are NOT news sources. Career history, "About" sections, job descriptions, and company milestones listed on a LinkedIn profile are biographical, not current events — they can be years old.
Do NOT use a LinkedIn profile page as evidence that something happened recently.
Only use LinkedIn as a source if the research contains a specific, dated post or article by the person published after ${cutoffStr}.

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

=== ACCOUNT ===
${accountContext}

=== HOW TO WRITE THIS EMAIL ===

You are writing a 3-sentence cold email. The #1 rule: EVERY SENTENCE MUST ADVANCE ONE SINGLE ARGUMENT. The email should read like one connected thought — not three unrelated ideas stitched together.

STEP 1 — PICK ONE THEME
Before writing anything, choose ONE theme that connects a pain point to a proof point. The theme is the throughline of the entire email. Every sentence must serve this theme.

Pick the theme based on this person's role:

THEME OPTIONS (pick exactly one):

For CFO / Finance roles → Theme: "Remakes are silently destroying margin"
  Pain: remakes cost ~$780 each and most DSOs can't even track them across locations
  Proof: Apex Dental Partners cut remakes by 29% after switching to Dandy

For CFO / Finance roles → Theme: "Scanner CAPEX is an unnecessary barrier"
  Pain: $40–75K per operatory in scanner hardware is hard to justify when margins are tight
  Proof: Dandy deploys scanners free — zero CAPEX

For COO / Operations roles → Theme: "Too many lab vendors means no control"
  Pain: when every location picks its own lab, you get inconsistent quality, no leverage on pricing, and no visibility
  Proof: DCA consolidated 400+ lab relationships down to one with Dandy

For COO / Operations roles → Theme: "Standardization shouldn't mean forcing doctors to switch"
  Pain: ops teams need consistency across locations, but mandating a single workflow alienates doctors
  Proof: Dandy's preferred program standardizes the lab without requiring doctors to change their process

For CDO / Clinical roles → Theme: "Remakes are a clinical quality problem hiding in plain sight"
  Pain: most DSOs don't have location-level remake data, so quality issues go undetected
  Proof: DCA practices hit ~1% remake rate with Dandy's standardized workflow

For CDO / Clinical roles → Theme: "Catching fit issues before they ship"
  Pain: bad margins and fit problems only surface after the patient is in the chair — costly for the practice and the patient
  Proof: Dandy's AI margin detection flags fit issues before the crown ships

For CEO / President roles → Theme: "Same-store growth is the next lever"
  Pain: acquisitions slow down eventually and same-store performance becomes the primary growth engine
  Proof: Apex Dental Partners saw a 12.5% revenue increase with Dandy

For CEO / President roles → Theme: "Scale without capital risk"
  Pain: growth requires scanners at every operatory, but $40–75K per site adds up fast
  Proof: Dandy deploys free scanners — no capital risk to start

For Growth / M&A roles → Theme: "Post-acquisition integration shouldn't break the lab"
  Pain: every acquisition brings a new lab vendor, new workflows, and new quality standards to normalize
  Proof: Dandy scales from 10 to 200+ locations on one platform

For IT / Technology / Systems roles → Theme: "One fewer vendor to procure and manage"
  Pain: IT has to spec, procure, and support scanner hardware at every location — it doesn't scale
  Proof: DCA deployed 100 free scanners through Dandy — no hardware procurement for IT

STEP 2 — WRITE THREE SENTENCES, ALL ON-THEME

Sentence 1 (THE PROBLEM): Name the specific pain from your chosen theme. If you have recent research about this person or company that relates to this theme, weave it in. Otherwise, state the pain plainly as it applies to their role at ${accountName}.

Sentence 2 (THE PROOF): State the ONE proof point from your chosen theme. This sentence should feel like the natural answer to sentence 1. It should make the reader think "oh, someone already solved this."

Sentence 3 (THE ASK): A low-pressure CTA that connects back to the theme. Reference ${accountName} by name. If a microsite exists, the CTA should include the [MICROSITE_URL] placeholder.

THE COHERENCE TEST — Read your three sentences back. If you removed the greeting and sign-off, would a stranger understand what single argument you're making? If any sentence feels like it belongs in a different email, rewrite it.

Customer name rules:
- "Apex Dental Partners" or "Apex" — NEVER "APEX DSOs"
- "Dental Care Alliance" or "DCA" — when referring to their practices, say "DCA practices"

=== ROLE RELEVANCE RULE ===
Before choosing a theme, ask: "Is this directly relevant to what THIS PERSON cares about in THEIR ROLE?"
- A same-store revenue stat is NOT relevant to an IT Manager
- An acquisition hook is NOT relevant to a CDO unless it creates a clinical challenge
- A financial metric is NOT relevant to a Clinical Director
- If research is company-level but not relevant to THIS person's function, lead with a role-specific pain point instead

=== EMAIL FORMAT ===
Subject: [short subject line that reflects your chosen theme — 6 words max]

Hi ${firstName || "[First Name]"},

[Sentence 1: the problem]

[Sentence 2: the proof]

[Sentence 3: the ask]

Best,

=== EMAIL RULES ===
- 3 sentences max in the body. One sentence per line. Blank line between each.
- Every sentence must serve the same theme. No tangents, no bonus stats, no "also."
- ONE proof point per email. Never stack multiple numbers or combine stats.
- Sound like a real person texting a colleague, not a sales rep reading a script
- Keep it under 60 words in the body (excluding greeting and sign-off)
- RECENCY RULE: Only use research as a hook if it clearly happened after ${cutoffStr}. Anything older or undated — use the pain point from your theme instead.
- Never open with: "I hope", "My name is", "I'm reaching out", "I came across your profile"
- No buzzwords: leverage, synergy, streamline, revolutionize, game-changer, innovative solution, transform, empower, robust, cutting-edge
- Don't over-explain Dandy — one clause about what they do is plenty
- If a microsite exists, use the placeholder [MICROSITE_URL] exactly once in sentence 3
- CTA should be low-commitment ("Worth a quick call?" / "Happy to share how?" / "Open to a 15-min chat?")
- End with "Best,"
- Do NOT say "I saw on LinkedIn", "according to LinkedIn", or attribute any source in the email body. State facts plainly.
- Do NOT attribute a fact to LinkedIn unless a linkedin.com URL is actually present in the research sources.

${micrositeNote}

After "Best," on a new line, write exactly:
HOOK_SOURCE: [paste the full URL of the specific page you used for the opening hook, or write "pain point" if you used a role-based pain point instead of research]
THEME: [write the theme you chose, e.g. "Remakes are silently destroying margin"]

Output only the email followed by the HOOK_SOURCE and THEME lines. Nothing else.`;

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
          model: "gpt-5",
          messages: [
            { role: "system", content: "You are a senior cold email copywriter. Your emails follow one rule above all: every sentence advances a single argument. Problem → Proof → Ask, all on the same theme. No tangents. Output only the email as requested." },
            { role: "user", content: prompt },
          ],
        }),
      },
      45000
    );

    let raw = "";
    if (!response.ok) {
      // Fallback to Gemini if OpenAI fails
      const geminiBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (geminiBase && geminiKey) {
        console.warn("OpenAI failed, falling back to Gemini for draft email");
        const geminiRes = await fetchWithTimeout(
          `${geminiBase}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${geminiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gemini-2.5-flash",
              temperature: 0.85,
              messages: [
                { role: "system", content: "You are a senior cold email copywriter. Your emails follow one rule above all: every sentence advances a single argument. Problem → Proof → Ask, all on the same theme. No tangents. Output only the email as requested." },
                { role: "user", content: prompt },
              ],
            }),
          },
          30000
        );
        if (!geminiRes.ok) {
          const err = await geminiRes.text();
          console.error("Gemini fallback also failed:", err);
          res.status(500).json({ error: "AI request failed" });
          return;
        }
        const geminiData = await geminiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
        raw = geminiData.choices?.[0]?.message?.content ?? "";
      } else {
        const err = await response.text();
        console.error("AI error:", err);
        res.status(500).json({ error: "AI request failed" });
        return;
      }
    } else {
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      raw = data.choices?.[0]?.message?.content ?? "";
    }

    const subjectMatch = raw.match(/^Subject:\s*(.+)/m);
    const subject = subjectMatch?.[1]?.trim() ?? "";
    let body = raw;
    if (subjectMatch) {
      const idx = raw.indexOf(subjectMatch[0]);
      body = raw.slice(idx + subjectMatch[0].length).replace(/^\s*\n/, "").trim();
    }

    // Extract HOOK_SOURCE and THEME lines
    const hookSourceMatch = body.match(/\nHOOK_SOURCE:\s*(.+)/);
    const hookSourceRaw = hookSourceMatch?.[1]?.trim() ?? "";
    const hookSource = (hookSourceRaw && hookSourceRaw.toLowerCase() !== "pain point") ? hookSourceRaw : null;
    const themeMatch = body.match(/\nTHEME:\s*(.+)/);
    const emailTheme = themeMatch?.[1]?.trim() ?? "";
    // Strip the metadata lines from the displayed body
    if (hookSourceMatch || themeMatch) {
      const firstMetaIdx = Math.min(
        hookSourceMatch?.index ?? body.length,
        themeMatch?.index ?? body.length
      );
      body = body.slice(0, firstMetaIdx).trimEnd();
    }

    // ─── Filter citations to only relevant sources ─────────────────
    // Perplexity often returns junk citations (random government PDFs, pharma sites, disease databases)
    // when it can't find specific info about the person/company. Only keep URLs that are plausibly relevant.
    const relevanceTerms = [
      firstName?.toLowerCase(),
      lastName?.toLowerCase(),
      accountName?.toLowerCase(),
      domain?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase(),
    ].filter(Boolean) as string[];

    // Domains that are almost always relevant for dental/DSO research
    const trustedDomains = [
      "linkedin.com", "groupdentistrynow.com", "dentaleconomics.com",
      "dentistrytoday.com", "dsonews.com", "beckersdental.com",
      "prnewswire.com", "businesswire.com", "globenewswire.com",
      "bloomberg.com", "reuters.com", "pitchbook.com", "crunchbase.com",
    ];

    function isCitationRelevant(url: string): boolean {
      const lower = url.toLowerCase();
      // Always keep the company's own domain
      if (domain && lower.includes(domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])) return true;
      // Keep trusted industry/news domains
      if (trustedDomains.some(d => lower.includes(d))) return true;
      // Keep if URL or path contains the person's name or company name
      if (relevanceTerms.some(term => term.length > 2 && lower.includes(term))) return true;
      // Keep dental/DSO industry sources
      if (/dental|dso|dentist|orthodont/.test(lower)) return true;
      // Filter out everything else — random government, pharma, disease DBs, etc.
      return false;
    }

    const sources: string[] = [];
    if (hookSource && hookSource.startsWith("http") && !sources.includes(hookSource)) {
      sources.push(hookSource);
    }
    if (FIRECRAWL_KEY && domain && siteResearch) {
      const siteUrl = domain.startsWith("http") ? domain : `https://${domain}`;
      if (!sources.includes(siteUrl)) sources.push(siteUrl);
    }
    for (const url of allCitations) {
      if (url && !sources.includes(url) && isCitationRelevant(url)) sources.push(url);
    }

    res.json({
      subject,
      body,
      hasMicrosite,
      contactEmail,
      hookSource: hookSource ?? (hookSourceRaw === "pain point" ? "pain point" : null),
      emailTheme: emailTheme || null,
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
