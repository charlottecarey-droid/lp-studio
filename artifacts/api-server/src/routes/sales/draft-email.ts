import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable, salesHotlinksTable, salesBriefingsTable, lpPagesTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { getSalesBrandContext, type SalesBrandContext } from "../../lib/salesBrandContext";
import { getAIClient, fetchWithTimeout, type BriefingData } from "../../lib/ai-utils";
import { getTenantOutboundOrigin } from "../../lib/tenantHosts";
import { detectAdvisoryFacts, trackFactEvent, type FactWarning } from "../../lib/factFlags";

/** Best-effort wrapper: log + return a default if the promise rejects. */
async function bestEffort<T>(label: string, p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.warn(`[draft-email] ${label} failed (continuing):`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

/**
 * Ensure a blank line between every content line so the email reads as
 * distinct sections. The composer renders the body in a <textarea> that
 * preserves newlines verbatim, and the model is told to leave a blank line
 * between sentences but doesn't always comply — so we normalize
 * deterministically: drop blank/whitespace-only lines, then rejoin the
 * remaining content lines with a single blank line between each.
 */
export function spaceOutEmailSections(text: string): string {
  return text
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
    .join("\n\n");
}

const router = Router();

// ─── Simple in-memory rate limiter for AI routes ────────────
const AI_RATE_WINDOW_MS = 60_000; // 1 minute
const AI_RATE_MAX = 10; // max requests per minute
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

// ─── Pure prompt builder (extracted so brand framing is unit-testable) ──
// Mirrors person-brief.ts: the route loads + tenant-scopes the contact,
// account, briefing, research, and microsite state, then hands them here.
// Brand framing is strictly per-tenant — no "Dandy" string is hardcoded.
// Dandy (tenant 1) renders its old copy only because its Sales Console
// config seeds brandName "Dandy" + briefBlurb; other tenants supply their
// own, and a no-config tenant gets brand-neutral phrasing with no gaps.

export interface DraftEmailContactFields {
  firstName: string;
  lastName: string;
  title: string;
  titleLevel: string;
  contactRole: string;
  department: string;
  linkedinUrl: string;
  buyerPersona: string;
  contactTier: string;
}

export interface DraftEmailAccountFields {
  accountName: string;
  domain: string;
  industry: string;
  segment: string;
  dsoSize: string;
  privateEquityFirm: string;
  numLocations: number | null;
  abmTier: string;
  abmStage: string;
  practiceSegment: string;
  msaSigned: string;
  enterprisePilot: string;
  city: string;
  state: string;
  accountNotes: string;
}

export interface DraftEmailResearch {
  person: string;
  company: string;
  linkedin: string;
  site: string;
}

export interface DraftEmailPromptArgs {
  brandCtx: SalesBrandContext;
  contact: DraftEmailContactFields;
  account: DraftEmailAccountFields;
  briefing: BriefingData | null;
  research: DraftEmailResearch;
  /** Whether a published microsite hotlink exists for this contact. */
  hasMicrosite: boolean;
  /** Injected for deterministic dates in tests; defaults to now. */
  now?: Date;
}

export const DRAFT_EMAIL_SYSTEM_MSG =
  "You are a senior cold email copywriter. Your emails follow one rule above all: every sentence advances a single argument. Problem → Proof → Ask, all on the same theme. No tangents. Output only the email as requested.";

export function buildDraftEmailPrompt(args: DraftEmailPromptArgs): {
  systemMsg: string;
  prompt: string;
} {
  const { brandCtx, contact, account, briefing, research, hasMicrosite } = args;

  // ─── Brand-derived framing (per-tenant; never hardcodes "Dandy") ───
  const tenantBrandName = brandCtx.brandName || "our team";
  const tenantBrandBlurb = brandCtx.briefBlurb
    ? `${tenantBrandName} — ${brandCtx.briefBlurb}`
    : tenantBrandName;
  const tenantIntroLine = brandCtx.salesIntroLine
    || `You write short, human cold emails for ${tenantBrandBlurb}.`;
  const valuePropPairs = Array.isArray(brandCtx.valuePropPairs) ? brandCtx.valuePropPairs : [];

  const {
    firstName, lastName, title, titleLevel, contactRole,
    department, linkedinUrl, buyerPersona, contactTier,
  } = contact;
  const {
    accountName, domain, industry, segment, dsoSize, privateEquityFirm,
    numLocations, abmTier, abmStage, practiceSegment, msaSigned,
    enterprisePilot, city, state, accountNotes,
  } = account;
  const {
    person: personResearch,
    company: companyResearch,
    linkedin: linkedinResearch,
    site: siteResearch,
  } = research;

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "the contact";

  const micrositeNote = hasMicrosite
    ? `A personalized microsite for ${accountName} is already live. Include a reference to it using the exact placeholder [MICROSITE_URL] where the link belongs naturally in the email. Example: "I put together a quick look at how ${tenantBrandName} would work for ${accountName} — [MICROSITE_URL]". Do NOT invent a URL — always use the literal placeholder [MICROSITE_URL]; the system will swap it for the real link.`
    : "No microsite exists for this contact yet. Do NOT mention a microsite, a page, a link, or anything the recipient should click on. Do NOT include the placeholder [MICROSITE_URL] anywhere.";

  // Per-tenant naming & phrasing rules (brand/legal copy constraints). Editable
  // in brand settings ("Customer naming rules"); injected verbatim so the model
  // can't paraphrase an approved proof point into language the brand disallows.
  const customerRules = brandCtx.customerNameRules?.trim() ?? "";

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

  // ─── Build contact/account context ────────────────────────
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

  // ─── Build briefing block ──────────────────────────────────
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

  // ─── Dates ────────────────────────────────────────────────
  const today = args.now ?? new Date();
  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() - 6);
  const todayStr  = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const cutoffStr = cutoff.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Build the THEME OPTIONS section from this tenant's configured
  // pain/proof pairs. If a tenant hasn't seeded any, we fall back to a
  // generic prompt-time instruction that tells the model to pick a
  // role-appropriate pain/proof itself based on the account briefing —
  // never leaking another tenant's customer names or stats.
  const themeOptionsSection = valuePropPairs.length > 0
    ? [
        "THEME OPTIONS (pick exactly one — match the role; if no exact role match, pick the closest):",
        "",
        ...valuePropPairs.flatMap(p => {
          const rolesLine = (p.roles ?? []).filter(Boolean).join(" / ");
          const header = rolesLine
            ? `For ${rolesLine} → Theme: "${p.theme}"`
            : `Theme: "${p.theme}"`;
          return [header, `  Pain: ${p.pain}`, `  Proof: ${p.proof}`, ""];
        }),
      ].join("\n").trimEnd()
    : [
        "THEME GUIDANCE:",
        "Pick ONE pain point relevant to this person's role and ONE proof point that directly answers it.",
        "Draw the proof point only from the ACCOUNT INTELLIGENCE briefing or verified research above.",
        "Do NOT invent customer names, statistics, or case studies.",
      ].join("\n");

  const prompt = `${tenantIntroLine}

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

${themeOptionsSection}

STEP 2 — WRITE THREE SENTENCES, ALL ON-THEME

Sentence 1 (THE PROBLEM): Name the specific pain from your chosen theme. If you have recent research about this person or company that relates to this theme, weave it in. Otherwise, state the pain plainly as it applies to their role at ${accountName}.

Sentence 2 (THE PROOF): State the ONE proof point from your chosen theme. This sentence should feel like the natural answer to sentence 1. It should make the reader think "oh, someone already solved this."

Sentence 3 (THE ASK): A low-pressure CTA that connects back to the theme. Reference ${accountName} by name. If a microsite exists, the CTA should include the [MICROSITE_URL] placeholder.

THE COHERENCE TEST — Read your three sentences back. If you removed the greeting and sign-off, would a stranger understand what single argument you're making? If any sentence feels like it belongs in a different email, rewrite it.
${customerRules ? `
=== CUSTOMER NAMING & PHRASING RULES (MANDATORY — these override your own wording) ===
Follow these exactly, even when paraphrasing, shortening, or rewording a proof point:
${customerRules}
` : ""}
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
- Don't over-explain ${tenantBrandName} — one clause about what they do is plenty
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

  return { systemMsg: DRAFT_EMAIL_SYSTEM_MSG, prompt };
}

// POST /sales/draft-email — rich cold email using all account/contact fields + Perplexity research + Firecrawl site crawl
router.post("/draft-email", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  // Rate limit: max 10 AI requests per minute per tenant
  const tenantKey = `draft-email-${tenantId}`;
  if (!checkAIRateLimit(tenantKey)) {
    res.status(429).json({ error: "Too many AI requests. Please wait a minute before trying again." });
    return;
  }

  const { contactId, accountId } = req.body;

  const ai = getAIClient();
  if (!ai) {
    res.status(503).json({ error: "AI not configured. Set AI integration or OPENAI_API_KEY." });
    return;
  }

  try {
    // ─── 0. Load this tenant's Sales Console brand context ─────
    // All hard-coded "Dandy"/customer-name strings have been removed
    // from the prompt — the tenant configures these in Brand Settings →
    // Sales Console. When unset we fall back to generic phrasing so we
    // never accidentally leak another tenant's brand.
    const brandCtx = await getSalesBrandContext(tenantId);

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

    let verifiedContactId: number | null = null;
    if (contactId) {
      const [c] = await db.select().from(salesContactsTable)
        .where(and(eq(salesContactsTable.id, Number(contactId)), eq(salesContactsTable.tenantId, tenantId)));
      if (c) {
        verifiedContactId = c.id;
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
        .where(and(eq(salesAccountsTable.id, Number(accountId)), eq(salesAccountsTable.tenantId, tenantId)));
      if (a) {
        accountName       = a.displayName ?? a.name ?? "";
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
        .where(and(
          eq(salesBriefingsTable.tenantId, tenantId),
          eq(salesBriefingsTable.accountId, Number(accountId)),
        ))
        .orderBy(desc(salesBriefingsTable.updatedAt))
        .limit(1);
      if (br?.briefingData && (br.briefingData as Record<string, unknown>).overview) {
        briefing = br.briefingData as BriefingData;
      }
    }

    // ─── 4. Hotlink check ────────────────────────────────────────
    // Pick the most recent active hotlink for this contact, if any, and build
    // the public microsite URL from it. We'll inject the real URL into the
    // email body below so reps don't have to look anything up.
    let hasMicrosite = false;
    let micrositeUrl: string | null = null;
    if (verifiedContactId !== null) {
      // Hotlinks have no tenantId column — gate on the verified, tenant-scoped
      // contact ID loaded above so we can never leak a foreign tenant's hotlink.
      // Also require the linked page to be PUBLISHED; we never share or
      // auto-insert links to draft / pending-review microsites.
      const [hl] = await db.select({ token: salesHotlinksTable.token })
        .from(salesHotlinksTable)
        .innerJoin(lpPagesTable, eq(salesHotlinksTable.pageId, lpPagesTable.id))
        .where(and(
          eq(salesHotlinksTable.contactId, verifiedContactId),
          eq(salesHotlinksTable.isActive, true),
          eq(lpPagesTable.status, "published"),
        ))
        .orderBy(desc(salesHotlinksTable.createdAt))
        .limit(1);
      if (hl?.token) {
        hasMicrosite = true;
        const host = await getTenantOutboundOrigin(tenantId, req);
        micrositeUrl = `${host}/p/${hl.token}`;
      }
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "the contact";

    // ─── 5. Research: Perplexity (news + LinkedIn) + Firecrawl (site) — all parallel ────
    const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
    const FIRECRAWL_KEY  = process.env.FIRECRAWL_API_KEY;

    let personResearch   = "";
    let companyResearch  = "";
    let linkedinResearch = "";
    let siteResearch     = "";
    const allCitations: string[] = [];

    // Industry context for the research queries, derived from the account so
    // searches are never hardcoded to a single vertical (this is a multi-tenant
    // app). An empty hint means "search the whole web with no industry filter".
    const industryHint = [industry, segment].filter(Boolean).join(", ").trim();

    const researchTasks: Promise<void>[] = [];

    if (PERPLEXITY_KEY && accountName) {
      // ── Person-specific search: talks, quotes, interviews, articles ──
      const personQuery = `Find public professional information about this specific person for a B2B sales outreach:

Name: ${fullName}
Title: ${title || "unknown"}
Company: ${accountName}

Search broadly across the web for:
- "${fullName}" conference talk, keynote, panel, or presentation${industryHint ? ` (${industryHint})` : ""}
- "${fullName}" quoted or interviewed in news outlets, trade publications, podcasts, or industry blogs
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
- "${accountName}"${industryHint ? ` ${industryHint}` : ""} industry news, job postings signaling growth

Return ONLY recent news (last 6 months). If nothing found, say "No recent company news found." Be brief.`;

      // ── LinkedIn: broad web search for this person's profile + activity ──
      const linkedinQuery = linkedinUrl
        ? `Look up ${fullName}'s LinkedIn profile at ${linkedinUrl} and also search the web for any of their recent LinkedIn posts, comments, or professional activity.

Also search: "${fullName}" site:linkedin.com OR "${fullName}" "${accountName}" LinkedIn

Extract:
- How long they've been in their current role and what they did before
- Any recent posts, shared articles, or comments (last 6 months) — what topics do they engage with?
- Career trajectory and stated professional priorities
- Any shared content about growth, operations, technology, or${industryHint ? ` ${industryHint}` : ""} industry trends

Be specific. If LinkedIn content is behind a paywall, report what's visible from search snippets.`
        : `Search for "${fullName}" "${accountName}" on LinkedIn and across the web.
Find their career background, current role details, any public posts or professional activity, and stated interests.
Only report what you can confirm from public sources.`;

      researchTasks.push(
        bestEffort("perplexity person", perplexitySearch(PERPLEXITY_KEY, personQuery), { content: "", citations: [] as string[] })
          .then(r => { personResearch = r.content; allCitations.push(...r.citations); }),
        bestEffort("perplexity company", perplexitySearch(PERPLEXITY_KEY, companyQuery), { content: "", citations: [] as string[] })
          .then(r => { companyResearch = r.content; allCitations.push(...r.citations); }),
        bestEffort("perplexity linkedin", perplexitySearch(PERPLEXITY_KEY, linkedinQuery), { content: "", citations: [] as string[] })
          .then(r => { linkedinResearch = r.content; allCitations.push(...r.citations); }),
      );
    }

    if (FIRECRAWL_KEY && domain) {
      researchTasks.push(
        bestEffort("firecrawl scrape", firecrawlScrape(FIRECRAWL_KEY, domain), "")
          .then(r => { siteResearch = r; }),
      );
    } else if (PERPLEXITY_KEY && domain && accountName) {
      // Fallback: use Perplexity for site if no Firecrawl key
      const siteQuery = `Summarize the key facts about ${accountName} from their website at ${domain}. Focus on:
- What type of organization they are and what they do
- Number of locations or practices
- Geographic footprint (states, regions)
- Any stated growth strategy, M&A activity, or expansion plans
- Key leadership or brand positioning
Be factual and specific. Only include what's on the site.`;
      researchTasks.push(
        bestEffort("perplexity site", perplexitySearch(PERPLEXITY_KEY, siteQuery, [domain]), { content: "", citations: [] as string[] })
          .then(r => { siteResearch = r.content; allCitations.push(...r.citations); }),
      );
    }

    await Promise.all(researchTasks);

    const noPersonInfo = !personResearch || personResearch.includes("No person-level information found");
    const noCompanyNews = !companyResearch || companyResearch.includes("No recent company news found");

    // ─── 6-8. Build the brand-aware prompt (per-tenant; extracted) ──
    const { systemMsg, prompt } = buildDraftEmailPrompt({
      brandCtx,
      contact: {
        firstName, lastName, title, titleLevel, contactRole,
        department, linkedinUrl, buyerPersona, contactTier,
      },
      account: {
        accountName, domain, industry, segment, dsoSize, privateEquityFirm,
        numLocations, abmTier, abmStage, practiceSegment, msaSigned,
        enterprisePilot, city, state, accountNotes,
      },
      briefing,
      research: {
        person: personResearch,
        company: companyResearch,
        linkedin: linkedinResearch,
        site: siteResearch,
      },
      hasMicrosite,
    });

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
            { role: "system", content: systemMsg },
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
                { role: "system", content: systemMsg },
                { role: "user", content: prompt },
              ],
            }),
          },
          30000
        );
        if (!geminiRes.ok) {
          const err = await geminiRes.text();
          console.error("Gemini fallback also failed:", geminiRes.status, err.slice(0, 500));
          res.status(502).json({ error: `AI provider error (OpenAI ${response.status}, Gemini ${geminiRes.status}). Please try again.` });
          return;
        }
        const geminiData = await geminiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
        raw = geminiData.choices?.[0]?.message?.content ?? "";
      } else {
        const err = await response.text();
        console.error("AI error:", response.status, err.slice(0, 500));
        res.status(502).json({ error: `AI provider error (${response.status}). Please try again in a moment.` });
        return;
      }
    } else {
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      raw = data.choices?.[0]?.message?.content ?? "";
    }

    const subjectMatch = raw.match(/^Subject:\s*(.+)/m);
    let subject = subjectMatch?.[1]?.trim() ?? "";
    let body = raw;
    if (subjectMatch) {
      const idx = raw.indexOf(subjectMatch[0]);
      body = raw.slice(idx + subjectMatch[0].length).replace(/^\s*\n/, "").trim();
    }

    // ─── Substitute [MICROSITE_URL] placeholder with the real hotlink URL ──
    // If a hotlink exists, swap every placeholder variant for the real URL so
    // the rep can send the email without editing. If no hotlink exists, scrub
    // any stray placeholder the model may have leaked despite the instruction.
    const placeholderRe = /\[\s*microsite[\s_-]*url\s*\]|\{\{\s*microsite[\s_-]*url\s*\}\}/gi;
    if (micrositeUrl) {
      body = body.replace(placeholderRe, micrositeUrl);
      subject = subject.replace(placeholderRe, micrositeUrl);
    } else {
      // Strip leaked placeholders (and a trailing " — " / " - " / ": " before them, if any)
      // so the email reads cleanly even if the model ignored the instruction.
      body = body
        .replace(/\s*[—\-:]\s*\[\s*microsite[\s_-]*url\s*\]/gi, "")
        .replace(/\s*[—\-:]\s*\{\{\s*microsite[\s_-]*url\s*\}\}/gi, "")
        .replace(placeholderRe, "")
        .replace(/[ \t]+\n/g, "\n");
      subject = subject.replace(placeholderRe, "").trim();
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

    // Normalize section spacing so each part (greeting, problem, proof, ask,
    // sign-off) reads on its own — the composer textarea preserves newlines
    // verbatim and the model is inconsistent about leaving a blank line between
    // sentences.
    body = spaceOutEmailSections(body);

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

    // Task #1138 — advisory fact detection for the (ephemeral) email draft. No
    // persistent flag/gate; the composer surfaces a soft "review before sending"
    // notice. Best-effort so detection never blocks the draft.
    const factWarnings: FactWarning[] = await bestEffort(
      "draft-email fact detection",
      detectAdvisoryFacts(tenantId, { subject, body }),
      [],
    );
    if (factWarnings.length > 0) {
      trackFactEvent("fact_flag_advisory_detected", { tenantId, source: "draft-email", count: factWarnings.length });
    }

    res.json({
      subject,
      body,
      factWarnings,
      hasMicrosite,
      micrositeUrl,
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
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to generate email draft: ${message}` });
  }
});

export default router;
