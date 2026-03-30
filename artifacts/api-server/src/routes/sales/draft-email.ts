import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable, salesHotlinksTable } from "@workspace/db";

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
): Promise<string> {
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
    if (!res.ok) return "";
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

// POST /sales/draft-email — rich cold email using all account/contact fields + dual Perplexity research
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

    if (contactId) {
      const [c] = await db.select().from(salesContactsTable)
        .where(eq(salesContactsTable.id, Number(contactId)));
      if (c) {
        firstName   = c.firstName ?? "";
        lastName    = c.lastName ?? "";
        title       = c.title ?? "";
        titleLevel  = c.titleLevel ?? "";
        contactRole = c.contactRole ?? "";
        department  = c.department ?? "";
        linkedinUrl = c.linkedinUrl ?? "";
        contactEmail = c.email ?? "";
      }
    }

    // ─── 2. Load account ────────────────────────────────────────
    let accountName = "";
    let domain = "";
    let segment = "";
    let dsoSize = "";
    let privateEquityFirm = "";
    let numLocations: number | null = null;
    let abmTier = "";
    let practiceSegment = "";
    let city = "";
    let state = "";

    if (accountId) {
      const [a] = await db.select().from(salesAccountsTable)
        .where(eq(salesAccountsTable.id, Number(accountId)));
      if (a) {
        accountName       = a.name ?? "";
        domain            = a.domain ?? "";
        segment           = a.segment ?? "";
        dsoSize           = a.dsoSize ?? "";
        privateEquityFirm = a.privateEquityFirm ?? "";
        numLocations      = a.numLocations ?? null;
        abmTier           = a.abmTier ?? "";
        practiceSegment   = a.practiceSegment ?? "";
        city              = a.city ?? "";
        state             = a.state ?? "";
      }
    }

    // ─── 3. Hotlink check ────────────────────────────────────────
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
      ? `A personalized microsite for ${accountName} is already live. Reference it naturally in the email using the exact placeholder [MICROSITE_URL] where the link should appear — do not write a real URL. Example: "I put together a quick look at how that works for ${accountName} — [MICROSITE_URL]"`
      : "No microsite exists for this company yet. Do not mention a microsite or link.";

    // ─── 4. Dual Perplexity research (parallel) ─────────────────
    const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
    let newsResearch = "";
    let siteResearch = "";

    if (PERPLEXITY_KEY && accountName) {
      const newsQuery = `Research this person and company for a B2B sales team at Dandy (a dental lab platform for DSOs):

Person: ${fullName}${title ? `, ${title}` : ""}
Company: ${accountName}${segment ? ` (${segment})` : ""}${numLocations ? `, ${numLocations} locations` : ""}${privateEquityFirm ? `, PE: ${privateEquityFirm}` : ""}

Search for:
- "${fullName} ${accountName}" — news, conference talks, quotes, LinkedIn posts, press mentions
- "${accountName} expansion acquisition growth 2025 2026" — press releases, DSO news, job postings
- Any recent (last 6 months) hook: new location, acquisition, leadership hire, partnership, award

Return ONLY what you find. If nothing relevant, say "No recent news found." Be brief and specific.`;

      const siteQuery = domain
        ? `Summarize the key facts about ${accountName} from their website at ${domain}. Focus on:
- What type of dental organization they are (DSO, group practice, independent)
- Number of locations or practices
- Geographic footprint (states, regions, markets)
- Any stated growth strategy, M&A activity, or expansion plans
- Key leadership or brand positioning
- Technology they mention using (scanners, digital workflow, etc.)

Be factual and specific. Only include what's on the site.`
        : "";

      [newsResearch, siteResearch] = await Promise.all([
        perplexitySearch(PERPLEXITY_KEY, newsQuery),
        domain ? perplexitySearch(PERPLEXITY_KEY, siteQuery, [domain]) : Promise.resolve(""),
      ]);
    }

    const researchBlock = [
      newsResearch && newsResearch !== "No recent news found."
        ? `WEB NEWS:\n${newsResearch}`
        : "WEB NEWS: No recent news found. Lead with a pain point.",
      siteResearch
        ? `COMPANY WEBSITE (${domain}):\n${siteResearch}`
        : domain
          ? `COMPANY WEBSITE: Could not retrieve content from ${domain}.`
          : "",
    ].filter(Boolean).join("\n\n");

    // ─── 5. Build the contact/account context ────────────────────
    const locationStr = [city, state].filter(Boolean).join(", ");
    const accountContext = [
      `Company: ${accountName}`,
      segment               && `Segment: ${segment}`,
      practiceSegment       && `Practice Profile: ${practiceSegment}`,
      dsoSize               && `DSO Size: ${dsoSize}`,
      numLocations          && `Locations: ${numLocations}`,
      privateEquityFirm     && `PE-backed by: ${privateEquityFirm}`,
      locationStr           && `HQ: ${locationStr}`,
      abmTier               && `ABM Tier: ${abmTier}`,
      domain                && `Website: ${domain}`,
    ].filter(Boolean).join("\n");

    const contactContext = [
      `Name: ${fullName}`,
      title                 && `Title: ${title}`,
      titleLevel            && `Seniority: ${titleLevel}`,
      (contactRole || department) && `Role/Dept: ${[contactRole, department].filter(Boolean).join(" / ")}`,
      linkedinUrl           && `LinkedIn: ${linkedinUrl}`,
    ].filter(Boolean).join("\n");

    // ─── 6. Write the email ──────────────────────────────────────
    const prompt = `You write short, human cold emails for Dandy — a vertically integrated dental lab and clinical performance platform for DSOs.

=== RESEARCH FINDINGS ===
${researchBlock}

=== CONTACT ===
${contactContext}
${micrositeNote}

=== ACCOUNT ===
${accountContext}

=== DANDY POSITIONING ===
Core message: "The world's fastest growing DSOs unlock more EBITDA with Dandy."

Dandy is an end-to-end lab partner built for DSOs at the growth stage where acquisitions are slowing and same-store performance is the primary lever. By embedding standardized workflows, AI-driven quality control, and centralized visibility into the clinical process, Dandy turns the lab from a fragmented cost center into a scalable revenue engine.

The four DSO pain points Dandy directly solves:
1. Pressure on same-store growth — acquisition pipelines are slowing; DSOs must get more from existing practices
2. Fragmented, non-actionable data — leaders have dashboards but can't intervene early or standardize outcomes
3. Standardization vs. clinical autonomy — executives need consistency; doctors need to feel trust, not surveillance
4. Capital constraints — scanner cost ($40-75K per operatory) limits deployment and production volume

The five messaging pillars (pick the one most relevant to this contact's role):
- "Same-store growth is the new growth engine" — the lab is one of the few remaining EBITDA levers
- "Growth breaks without a standard that scales" — variability creeps in as networks expand; one standard prevents it
- "Waste is the hidden tax on every DSO" — remakes and chair-time loss don't show as line items but quietly drain margin
- "Visibility isn't reporting, it's control" — ability to intervene early, manage by exception, catch variability before it scales
- "Enterprise growth shouldn't require enterprise risk" — validate value during a pilot before committing at scale

=== PROOF POINTS BY PERSONA ===
CFO / Finance:
- A $10 "savings" on a crown = $780 in lost value once remakes, chair time, and patient dropout are factored in. Across 50,000 procedures = $2M+ annual impact.
- APEX Dental Partners reduced remake rate 29% → projected 12.5% increase in annualized revenue
- Zero scanner CAPEX — Dandy placed $1.5M+ in free scanners at APEX; DCA (400 practices) got 100 scanners placed vs 4-6 with competitors
- Month-to-month scanner terms — no 3-5 year penalty contracts like iTero/3Shape

COO / VP Operations:
- DCA had 400 practices and 400+ different lab relationships. Dan Gast: "It was a nightmare."
- Dandy Hub = real-time dashboard across every location: remake rates, scanner utilization, who's ordering, case mix.
- DCA consolidated to a preferred program without forcing doctors

CDO / Clinical Director:
- APEX remake rate down 29%; providers with consistent scanning habits hit zero remakes within a year
- DCA remake rate ~1% — with full transparent tracking, not estimates
- AI margin detection means RDAs handle prep review without pulling the doctor

CEO / President:
- APEX projected 12.5% revenue increase; unlocked previously unprofitable denture and complex case revenue
- Low-risk entry: free scanner + lab credits = "almost a no-lose situation"

Growth / M&A / Strategy:
- Free intraoral scanner per operatory — eliminates the $40-75K capital barrier per location
- Dandy scales with you: same workflow at 10 locations or 200+

=== EMAIL FORMAT ===
Subject: [subject line]

Hi ${firstName || "[First Name]"},

[1-sentence hook — use company website or news research if specific and recent, otherwise pain point tailored to their role]

[1-sentence Dandy proof point with a real number or quote, matched to their persona]

[1-sentence soft CTA]

Best,

=== RULES ===
- 3 sentences max in the body. One sentence per line. Blank line between each.
- Sound like a real person messaging a peer, not a sales rep filing an outreach task
- RECENCY RULE: Only use news as a hook if it happened within the last 6 months. Older news — ignore and lead with a pain point.
- Website research can always be used to make the hook more specific (location count, geography, growth stage, etc.)
- Never open with: "I hope", "My name is", "I'm reaching out", "I came across your profile"
- No buzzwords: leverage, synergy, streamline, revolutionize, excited to connect, game-changer, innovative solution, transform, empower, robust, cutting-edge
- If a microsite exists, use the placeholder [MICROSITE_URL] exactly once where the link belongs naturally
- CTA should be low-commitment ("Worth a quick call?" / "Happy to share the math?" / "Open to a 15-min chat?")
- End with "Best,"
- Subject line first, prefixed "Subject: ", then blank line, then body

Output ONLY the email. Nothing else.`;

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
            { role: "system", content: "You are a world-class B2B sales email copywriter. Write exactly what is asked. Output only the email, nothing else." },
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

    res.json({
      subject,
      body,
      hasMicrosite,
      contactEmail,
      researchUsed: !!(newsResearch && newsResearch !== "No recent news found."),
      siteResearched: !!siteResearch,
    });
  } catch (err) {
    console.error("POST /sales/draft-email error:", err);
    res.status(500).json({ error: "Failed to generate email draft" });
  }
});

export default router;
