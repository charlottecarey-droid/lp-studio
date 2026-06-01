import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesContactsTable,
  salesAccountsTable,
  salesBriefingsTable,
  salesContactBriefingsTable,
} from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { getAIClient, fetchWithTimeout, type BriefingData } from "../../lib/ai-utils";
import { getSalesBrandContext, type SalesBrandContext } from "../../lib/salesBrandContext";

const router = Router();

// ─── Simple in-memory rate limiter for AI routes ────────────
const AI_RATE_WINDOW_MS = 60_000;
const AI_RATE_MAX = 10;
const aiRateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkAIRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = aiRateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    aiRateBuckets.set(key, { count: 1, resetAt: now + AI_RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= AI_RATE_MAX) return false;
  bucket.count++;
  return true;
}

type ResearchText = { person?: string; linkedin?: string; company?: string; site?: string };

/**
 * Pure brief generator — given a contact + account (already loaded and
 * tenant-scoped) and optional web-research text, returns markdown call-prep
 * brief text. Throws on hard failure.
 *
 * Pulled out of the original POST handler so both the legacy
 * /person-brief route (called from DraftEmailModal with rich research)
 * and the new contact-detail panel (no research, leans on account
 * briefing) can share the same prompt + LLM fallback chain.
 */
async function generateContactBriefText(args: {
  contact: typeof salesContactsTable.$inferSelect;
  account: typeof salesAccountsTable.$inferSelect;
  briefing: BriefingData | null;
  researchText?: ResearchText;
  brandCtx: SalesBrandContext;
}): Promise<string> {
  const ai = getAIClient();
  if (!ai) throw new Error("No AI client configured");

  const { contact, account, briefing, researchText, brandCtx } = args;
  const firstName = contact.firstName ?? "";
  const lastName  = contact.lastName  ?? "";
  const fullName  = [firstName, lastName].filter(Boolean).join(" ") || "this contact";
  const title     = contact.title ?? "";
  const company   = account.name ?? "";
  const domain    = account.domain ?? "";
  const titleLevel      = contact.titleLevel ?? "";
  const contactRole     = contact.contactRole ?? "";
  const buyerPersona    = contact.role ?? "";
  const segment         = account.segment ?? "";
  const numLocations    = account.numLocations ?? "";
  const privateEquityFirm = account.privateEquityFirm ?? "";
  const industry        = account.industry ?? "";
  const dsoSize         = account.dsoSize ?? "";
  const abmTier         = account.abmTier ?? "";
  const city            = account.city ?? "";
  const state           = account.state ?? "";

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

  // ─── Brand-aware framing (per-tenant; no hardcoded "Dandy") ───
  // Dandy (tenant 1) is seeded with brandName "Dandy" and a briefBlurb
  // "(a dental lab and clinical performance platform for DSOs)", so the
  // intro + angle header below render identically to the old hardcoded
  // copy. Other tenants supply their own — and a tenant with no Sales
  // Console config falls back to brand-neutral phrasing (no "Dandy",
  // no empty gaps).
  // Intro framing mirrors the source priority Generate Email / draft-email
  // use (salesIntroLine → briefBlurb → brand-neutral), but adapted to the
  // brief's grammar: the analyst intro needs a *noun phrase* ("a B2B sales
  // rep at X"), and Dandy's seeded salesIntroLine is an email-rep voice line,
  // so we surface salesIntroLine as positioning context rather than splicing
  // it mid-sentence. briefBlurb still anchors the framing — which keeps Dandy
  // byte-identical (brandName "Dandy" + parenthetical blurb).
  const repBrandName = brandCtx.brandName || "our company";
  const briefBlurb   = brandCtx.briefBlurb.trim();
  const salesIntroLine = brandCtx.salesIntroLine.trim();
  const repFraming = briefBlurb
    ? `a B2B sales rep at ${repBrandName} ${briefBlurb}`
    : `a B2B sales rep at ${repBrandName}`;
  const angleHeader = brandCtx.brandName
    ? `${brandCtx.brandName.toUpperCase()} ANGLE`
    : "RECOMMENDED ANGLE";
  // Possessive-free subject so the no-brand fallback reads naturally:
  // "the single best Dandy messaging pillar" vs "the single best messaging pillar".
  const angleSubject = brandCtx.brandName ? `${brandCtx.brandName} ` : "";
  const valuePropPairs = Array.isArray(brandCtx.valuePropPairs) ? brandCtx.valuePropPairs : [];
  const positioningLines = [
    salesIntroLine && `Brand positioning / voice: ${salesIntroLine}`,
    ...valuePropPairs.map(p => {
      const rolesLine = (p.roles ?? []).filter(Boolean).join(" / ");
      const header = rolesLine ? `For ${rolesLine} → ${p.theme}` : p.theme;
      return [header, p.pain && `  Pain: ${p.pain}`, p.proof && `  Proof: ${p.proof}`].filter(Boolean).join("\n");
    }),
  ].filter(Boolean);
  const valuePropBlock = positioningLines.length > 0
    ? `\n=== ${repBrandName.toUpperCase()} POSITIONING & VALUE PROPS (pick the angle that best fits this person's role) ===\n${positioningLines.join("\n")}\n`
    : "";

  const prompt = `You are a sales intelligence analyst preparing a pre-call brief for ${repFraming}.

Today is ${todayStr}. Recency cutoff: ${cutoffStr}. Only cite things that occurred after ${cutoffStr} as "recent."

${hasResearch ? `=== WEB RESEARCH ===\n${researchBlock}` : "No web research was available for this contact."}

${briefingBlock || "No account briefing available."}
${valuePropBlock}
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

**${angleHeader}**
1–2 sentences: the single best ${angleSubject}messaging pillar or value prop for this person based on their role and background, and the most relevant proof point to lead with. Draw on the positioning, value props, and the account briefing's fit analysis above; do not invent proof points.

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
      body: JSON.stringify({ model: "gpt-5", messages }),
    },
    45000
  );

  if (response.ok) {
    const json = await response.json() as { choices?: { message?: { content?: string } }[] };
    const brief = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!brief) throw new Error("AI returned empty brief");
    return brief;
  }

  // Fallback to Gemini
  const geminiBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (geminiBase && geminiKey) {
    console.warn("OpenAI failed for person-brief, falling back to Gemini");
    const geminiRes = await fetchWithTimeout(
      `${geminiBase}/chat/completions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${geminiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gemini-2.5-flash", temperature: 0.7, messages }),
      },
      30000
    );
    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error("Gemini fallback also failed (person-brief):", err);
      throw new Error("AI request failed");
    }
    const geminiData = await geminiRes.json() as { choices?: { message?: { content?: string } }[] };
    const brief = geminiData.choices?.[0]?.message?.content?.trim() ?? "";
    if (!brief) throw new Error("AI returned empty brief");
    return brief;
  }

  const err = await response.text();
  console.error("AI error (person-brief):", err);
  throw new Error("AI request failed");
}

/**
 * Persist the latest brief for (tenant, contact). Single row per pair —
 * UPSERT on the unique index so the contact-detail page always sees the
 * freshest version without an unbounded history table.
 */
async function persistContactBrief(tenantId: number, contactId: number, briefText: string) {
  const [row] = await db.insert(salesContactBriefingsTable)
    .values({ tenantId, contactId, briefText, status: "complete" })
    .onConflictDoUpdate({
      target: [salesContactBriefingsTable.tenantId, salesContactBriefingsTable.contactId],
      set: {
        briefText,
        status: "complete",
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row;
}

async function loadContactAndAccount(tenantId: number, contactId: number) {
  const [contact] = await db.select().from(salesContactsTable)
    .where(and(eq(salesContactsTable.id, contactId), eq(salesContactsTable.tenantId, tenantId))).limit(1);
  if (!contact) return { contact: null, account: null };
  const [account] = await db.select().from(salesAccountsTable)
    .where(and(eq(salesAccountsTable.id, contact.accountId), eq(salesAccountsTable.tenantId, tenantId))).limit(1);
  return { contact, account: account ?? null };
}

async function loadAccountBriefing(tenantId: number, accountId: number): Promise<BriefingData | null> {
  const [br] = await db.select().from(salesBriefingsTable)
    .where(and(
      eq(salesBriefingsTable.tenantId, tenantId),
      eq(salesBriefingsTable.accountId, accountId),
    ))
    .orderBy(desc(salesBriefingsTable.updatedAt))
    .limit(1);
  if (br?.briefingData && (br.briefingData as Record<string, unknown>).overview) {
    return br.briefingData as BriefingData;
  }
  return null;
}

// POST /person-brief  (mounted under /api/sales by the parent router)
// Legacy entry-point used by DraftEmailModal — accepts pre-gathered web
// research, generates the brief, AND persists it so the contact-detail
// page sees the freshest version next time the rep visits.
router.post("/person-brief", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const tenantKey = `person-brief-${tenantId}`;
    if (!checkAIRateLimit(tenantKey)) {
      res.status(429).json({ error: "Too many AI requests. Please wait a minute before trying again." });
      return;
    }

    const { contactId, accountId, researchText } = req.body as {
      contactId?: number;
      accountId?: number;
      researchText?: ResearchText;
    };

    if (!contactId || !accountId) {
      res.status(400).json({ error: "contactId and accountId required" });
      return;
    }

    const { contact, account } = await loadContactAndAccount(tenantId, contactId);
    if (!contact || !account || account.id !== accountId) {
      res.status(404).json({ error: "Contact or account not found" });
      return;
    }

    const briefing = await loadAccountBriefing(tenantId, accountId);
    const brandCtx = await getSalesBrandContext(tenantId);
    const brief = await generateContactBriefText({ contact, account, briefing, researchText, brandCtx });

    // Persist (best-effort — don't fail the response if the write hiccups)
    await persistContactBrief(tenantId, contactId, brief).catch((err) => {
      console.error("persistContactBrief failed (non-fatal):", err);
    });

    res.json({ brief });
  } catch (err) {
    console.error("POST /sales/person-brief error:", err);
    res.status(500).json({ error: "Failed to generate contact brief" });
  }
});

// GET /contacts/:id/brief — read latest persisted brief for the contact-detail panel
router.get("/contacts/:id/brief", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const contactId = Number(req.params.id);
  if (!Number.isInteger(contactId) || contactId <= 0) {
    res.status(400).json({ error: "Invalid contact id" });
    return;
  }
  try {
    // Tenant-check the contact first so we don't leak briefs across tenants
    // even if a hypothetical FK-only constraint were ever loosened.
    const [contact] = await db.select({ id: salesContactsTable.id })
      .from(salesContactsTable)
      .where(and(eq(salesContactsTable.id, contactId), eq(salesContactsTable.tenantId, tenantId)))
      .limit(1);
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    const [row] = await db.select().from(salesContactBriefingsTable)
      .where(and(
        eq(salesContactBriefingsTable.tenantId, tenantId),
        eq(salesContactBriefingsTable.contactId, contactId),
      ))
      .limit(1);
    res.json(row ?? null);
  } catch (err) {
    console.error("GET /sales/contacts/:id/brief error:", err);
    res.status(500).json({ error: "Failed to load contact brief" });
  }
});

// POST /contacts/:id/brief — generate a brief on demand from the contact-detail
// page. No caller-supplied web research; the prompt leans on the existing
// account briefing for context (the heavy research has already been done at
// the account level).
router.post("/contacts/:id/brief", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const contactId = Number(req.params.id);
  if (!Number.isInteger(contactId) || contactId <= 0) {
    res.status(400).json({ error: "Invalid contact id" });
    return;
  }
  try {
    const tenantKey = `person-brief-${tenantId}`;
    if (!checkAIRateLimit(tenantKey)) {
      res.status(429).json({ error: "Too many AI requests. Please wait a minute before trying again." });
      return;
    }

    const { contact, account } = await loadContactAndAccount(tenantId, contactId);
    if (!contact || !account) {
      res.status(404).json({ error: "Contact or account not found" });
      return;
    }

    const briefing = await loadAccountBriefing(tenantId, account.id);
    const brandCtx = await getSalesBrandContext(tenantId);
    const brief = await generateContactBriefText({ contact, account, briefing, brandCtx });
    const row = await persistContactBrief(tenantId, contactId, brief);
    res.json(row);
  } catch (err) {
    console.error("POST /sales/contacts/:id/brief error:", err);
    const msg = err instanceof Error ? err.message : "Failed to generate contact brief";
    res.status(500).json({ error: msg });
  }
});

export default router;
