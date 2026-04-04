import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable, salesBriefingsTable } from "@workspace/db";
import { getAIClient, fetchWithTimeout, type BriefingData } from "../../lib/ai-utils";

const router = Router();

// POST /person-brief  (mounted under /api/sales by the parent router)
// Accepts the research text already gathered by draft-email and generates
// a structured call-prep brief for a specific contact.
router.post("/person-brief", async (req, res) => {
  try {
    const ai = getAIClient();
    if (!ai) return res.status(503).json({ error: "No AI client configured" });

    const { contactId, accountId, researchText } = req.body as {
      contactId?: number;
      accountId?: number;
      researchText?: { person?: string; linkedin?: string; company?: string; site?: string; };
    };

    if (!contactId || !accountId) return res.status(400).json({ error: "contactId and accountId required" });

    const [contact] = await db.select().from(salesContactsTable).where(eq(salesContactsTable.id, contactId)).limit(1);
    const [account] = await db.select().from(salesAccountsTable).where(eq(salesAccountsTable.id, accountId)).limit(1);
    if (!contact || !account) return res.status(404).json({ error: "Contact or account not found" });

    const firstName = contact.firstName ?? "";
    const lastName  = contact.lastName  ?? "";
    const fullName  = [firstName, lastName].filter(Boolean).join(" ") || "this contact";
    const title     = contact.title ?? "";
    const company   = account.name ?? "";
    const domain    = account.domain ?? "";
    const titleLevel      = contact.titleLevel ?? "";
    const contactRole     = contact.contactRole ?? "";
    const buyerPersona    = contact.buyerPersona ?? "";
    const segment         = account.segment ?? "";
    const numLocations    = account.numLocations ?? "";
    const privateEquityFirm = account.privateEquityFirm ?? "";
    const industry        = account.industry ?? "";
    const dsoSize         = account.dsoSize ?? "";
    const abmTier         = account.abmTier ?? "";
    const city            = account.city ?? "";
    const state           = account.state ?? "";

    // ─── Load account briefing (pre-generated intelligence) ─────
    let briefing: BriefingData | null = null;
    const [br] = await db.select().from(salesBriefingsTable)
      .where(eq(salesBriefingsTable.accountId, accountId))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);
    if (br?.briefingData && (br.briefingData as Record<string, unknown>).overview) {
      briefing = br.briefingData as BriefingData;
    }

    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setMonth(cutoff.getMonth() - 6);
    const todayStr  = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const cutoffStr = cutoff.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const researchBlock = [
      researchText?.person   && `=== PERSON RESEARCH ===\n${researchText.person}`,
      researchText?.linkedin && `=== LINKEDIN / PROFESSIONAL PRESENCE ===\n${researchText.linkedin}`,
      researchText?.company  && `=== COMPANY NEWS ===\n${researchText.company}`,
      researchText?.site     && `=== COMPANY WEBSITE ===\n${researchText.site}`,
    ].filter(Boolean).join("\n\n") || "No web research available.";

    // ─── Build briefing context ──────────────────────────────────
    const briefingBlock = (() => {
      if (!briefing) return "";
      const parts: string[] = ["=== ACCOUNT INTELLIGENCE (pre-generated briefing) ==="];
      if (briefing.overview) parts.push(`Overview: ${briefing.overview}`);
      const sl = briefing.sizeAndLocations;
      if (sl) {
        if (sl.locationCount) parts.push(`Locations: ${sl.locationCount}`);
        if (sl.headquarters)  parts.push(`HQ: ${sl.headquarters}`);
        if (sl.regions?.length) parts.push(`Regions: ${sl.regions.join(", ")}`);
        if (sl.ownership)     parts.push(`Ownership: ${sl.ownership}`);
      }
      if (briefing.organizationalModel) parts.push(`Org model: ${briefing.organizationalModel}`);
      if (briefing.leadership?.length) {
        parts.push(`Leadership: ${briefing.leadership.map(l => `${l.name} (${l.title})`).join(", ")}`);
      }
      if (briefing.recentNews?.length) {
        parts.push("\nRecent news from briefing:");
        briefing.recentNews.slice(0, 3).forEach(n => {
          parts.push(`- ${n.headline}${n.date ? ` (${n.date})` : ""}: ${n.summary}`);
        });
      }
      const fit = briefing.fitAnalysis;
      if (fit) {
        if (fit.primaryValueProp)     parts.push(`\nPrimary value prop: ${fit.primaryValueProp}`);
        if (fit.keyPainPoints?.length) parts.push(`Key pain points: ${fit.keyPainPoints.join(" | ")}`);
        if (fit.proofPoints?.length)   parts.push(`Proof points: ${fit.proofPoints.join(" | ")}`);
        if (fit.recommendedApproach)   parts.push(`Recommended approach: ${fit.recommendedApproach}`);
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
      if (briefing.talkingPoints?.length) {
        parts.push(`\nTalking points:\n${briefing.talkingPoints.map(t => `- ${t}`).join("\n")}`);
      }
      return parts.join("\n");
    })();

    const contactContext = [
      `Name: ${fullName}`,
      title          && `Title: ${title}`,
      titleLevel     && `Seniority: ${titleLevel}`,
      contactRole    && `Functional Role: ${contactRole}`,
      buyerPersona   && `Buyer Persona: ${buyerPersona}`,
      company        && `Company: ${company}`,
      domain         && `Website: ${domain}`,
      industry       && `Industry: ${industry}`,
      segment        && `Segment: ${segment}`,
      dsoSize        && `DSO Size: ${dsoSize}`,
      numLocations   && `Locations: ${numLocations}`,
      privateEquityFirm && `PE-backed: ${privateEquityFirm}`,
      abmTier        && `ABM Tier: ${abmTier}`,
      (city || state) && `Location: ${[city, state].filter(Boolean).join(", ")}`,
    ].filter(Boolean).join("\n");

    const hasResearch = !!(researchText?.person || researchText?.linkedin || researchText?.company || researchText?.site);
    const researchIsWeak = !researchText?.person && !researchText?.linkedin && !researchText?.company;

    const prompt = `You are a sales intelligence analyst preparing a pre-call brief for a B2B sales rep at Dandy (a dental lab and clinical performance platform for DSOs).

Today is ${todayStr}. Recency cutoff: ${cutoffStr}. Only cite things that occurred after ${cutoffStr} as "recent."

${hasResearch ? `=== WEB RESEARCH ===\n${researchBlock}` : "No web research was available for this contact."}

${briefingBlock || "No account briefing available."}

=== CONTACT ===
${contactContext}

${researchIsWeak && briefing ? `NOTE: Web research was thin for this person. The ACCOUNT INTELLIGENCE briefing above is your best source of context. Use it heavily — especially the buying committee persona match, pain points, and talking points. Make conversation starters specific to ${company} using the briefing data, not generic.` : ""}

Write a concise call-prep brief for ${fullName}. Structure it EXACTLY as follows (use these exact section headers):

**WHO THEY ARE**
2–3 bullet points: current role and how long they've been there, career background, anything notable about their path to this role. If web research is thin, note their title and company context from the briefing.

**WHAT THEY CARE ABOUT**
2–3 bullet points: professional priorities, topics they engage with publicly, what drives someone in this role at this type of company. Use the buying committee persona match from the briefing if available.

**RECENT SIGNALS** *(last 6 months only — omit this section entirely if nothing recent found)*
Bullet points: specific talks, quotes, posts, articles, career moves, or company events from after ${cutoffStr}. Include date/source if known. Account briefing "recent news" counts if dated after ${cutoffStr}.

**CONVERSATION STARTERS**
3 numbered openers a sales rep could use on a cold call or meeting. Make them specific to this person and ${company} — reference their background, role-specific pain points, company details from the briefing, or a recent signal if available. NEVER generic.

**DANDY ANGLE**
1–2 sentences: the single best Dandy messaging pillar for this person based on their role and background, and the most relevant proof point to lead with.

Rules:
- Be specific. Use names, numbers, and dates when found in the research or briefing.
- Do not invent facts. If research is thin, lean on the account briefing and role-based insights.
- Keep each section tight — no padding.
- Output only the brief. No intro, no outro.`;

    const systemMsg = "You are a sales intelligence analyst. Output only the brief as requested. Nothing else.";
    const messages = [
      { role: "system", content: systemMsg },
      { role: "user", content: prompt },
    ];

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
          messages,
        }),
      },
      45000
    );

    let brief = "";
    if (!response.ok) {
      // Fallback to Gemini
      const geminiBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (geminiBase && geminiKey) {
        console.warn("OpenAI failed for person-brief, falling back to Gemini");
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
              temperature: 0.7,
              messages,
            }),
          },
          30000
        );
        if (!geminiRes.ok) {
          const err = await geminiRes.text();
          console.error("Gemini fallback also failed (person-brief):", err);
          return res.status(500).json({ error: "AI request failed" });
        }
        const geminiData = await geminiRes.json() as { choices?: { message?: { content?: string } }[] };
        brief = geminiData.choices?.[0]?.message?.content?.trim() ?? "";
      } else {
        const err = await response.text();
        console.error("AI error (person-brief):", err);
        return res.status(500).json({ error: "AI request failed" });
      }
    } else {
      const json = await response.json() as { choices?: { message?: { content?: string } }[] };
      brief = json.choices?.[0]?.message?.content?.trim() ?? "";
    }

    res.json({ brief });
  } catch (err) {
    console.error("POST /sales/person-brief error:", err);
    res.status(500).json({ error: "Failed to generate contact brief" });
  }
});

export default router;
