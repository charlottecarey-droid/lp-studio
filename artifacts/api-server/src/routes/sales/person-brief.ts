import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable } from "@workspace/db";

const router = Router();

function getAIClient() {
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (integrationBase && integrationKey) return { baseURL: integrationBase, apiKey: integrationKey };
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

// POST /sales/person-brief
// Accepts the research text already gathered by draft-email and generates
// a structured call-prep brief for a specific contact.
router.post("/sales/person-brief", async (req, res) => {
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
    const titleLevel      = contact.titleLevel ?? "";
    const contactRole     = contact.contactRole ?? "";
    const buyerPersona    = contact.buyerPersona ?? "";
    const segment         = account.segment ?? "";
    const numLocations    = account.numLocations ?? "";
    const privateEquityFirm = account.privateEquityFirm ?? "";

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
    ].filter(Boolean).join("\n\n") || "No research available.";

    const contactContext = [
      `Name: ${fullName}`,
      title          && `Title: ${title}`,
      titleLevel     && `Seniority: ${titleLevel}`,
      contactRole    && `Functional Role: ${contactRole}`,
      buyerPersona   && `Buyer Persona: ${buyerPersona}`,
      company        && `Company: ${company}`,
      segment        && `Segment: ${segment}`,
      numLocations   && `Locations: ${numLocations}`,
      privateEquityFirm && `PE-backed: ${privateEquityFirm}`,
    ].filter(Boolean).join("\n");

    const prompt = `You are a sales intelligence analyst preparing a pre-call brief for a B2B sales rep at Dandy (a dental lab and clinical performance platform for DSOs).

Today is ${todayStr}. Recency cutoff: ${cutoffStr}. Only cite things that occurred after ${cutoffStr} as "recent."

=== RESEARCH ===
${researchBlock}

=== CONTACT ===
${contactContext}

Write a concise call-prep brief for ${fullName}. Structure it EXACTLY as follows (use these exact section headers):

**WHO THEY ARE**
2–3 bullet points: current role and how long they've been there, career background, anything notable about their path to this role.

**WHAT THEY CARE ABOUT**
2–3 bullet points: professional priorities, topics they engage with publicly, what drives someone in this role at this type of company.

**RECENT SIGNALS** *(last 6 months only — omit this section entirely if nothing recent found)*
Bullet points: specific talks, quotes, posts, articles, career moves, or company events from after ${cutoffStr}. Include date/source if known.

**CONVERSATION STARTERS**
3 numbered openers a sales rep could use on a cold call or meeting. Make them specific to this person — reference their background, company, or a recent signal if available. Not generic.

**DANDY ANGLE**
1–2 sentences: the single best Dandy messaging pillar for this person based on their role and background, and the most relevant proof point to lead with.

Rules:
- Be specific. Use names, numbers, and dates when found in the research.
- Do not invent facts. If research is thin, say so and lean on role-based insights.
- Keep each section tight — no padding.
- Output only the brief. No intro, no outro.`;

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
          temperature: 0.7,
          messages: [
            { role: "system", content: "You are a sales intelligence analyst. Output only the brief as requested. Nothing else." },
            { role: "user", content: prompt },
          ],
        }),
      },
      30000
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("AI error (person-brief):", err);
      return res.status(500).json({ error: "AI request failed" });
    }

    const json = await response.json() as { choices?: { message?: { content?: string } }[] };
    const brief = json.choices?.[0]?.message?.content?.trim() ?? "";

    res.json({ brief });
  } catch (err) {
    console.error("POST /sales/person-brief error:", err);
    res.status(500).json({ error: "Failed to generate contact brief" });
  }
});

export default router;
