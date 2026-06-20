import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { callAIChat, aiErrorMessage } from "../../lib/ai-utils";
import { getSalesBrandContext, type SalesBrandContext } from "../../lib/salesBrandContext";
import { detectAdvisoryFacts, trackFactEvent, type FactWarning } from "../../lib/factFlags";

const router = Router();

// ─── Pure prompt builder (extracted so brand framing is unit-testable) ──
// Mirrors draft-email.ts / person-brief.ts: the route loads + tenant-scopes
// the Sales Console brand context and microsite intent, then hands them here.
// Brand framing is strictly per-tenant — no "Dandy" string is hardcoded.
// Dandy (tenant 1) renders its original framing only because its Sales
// Console config seeds brandName "Dandy" + briefBlurb; other tenants supply
// their own, and a no-config tenant gets brand-neutral phrasing with no gaps.

export interface GenerateEmailPromptArgs {
  brandCtx: SalesBrandContext;
  /** Whether to include a CTA linking to the recipient's microsite. */
  includesMicrositeLink: boolean;
}

export function buildGenerateEmailSystemPrompt(args: GenerateEmailPromptArgs): string {
  const { brandCtx, includesMicrositeLink } = args;

  // ─── Brand-derived framing (per-tenant; never hardcodes "Dandy") ───
  const brandName = brandCtx.brandName || "our team";
  const brandIntro = brandCtx.salesIntroLine
    || (brandCtx.briefBlurb
      ? `You are a sales email copywriter for ${brandName} — ${brandCtx.briefBlurb}.`
      : `You are a sales email copywriter for ${brandName}.`);

  return [
    brandIntro,
    "Write concise, personalized B2B sales emails that feel human and genuine — never spammy.",
    "Use merge variables where appropriate: {{first_name}}, {{last_name}}, {{company}}, {{microsite_url}}, {{sender_name}}.",
    "CRITICAL: Only ever use these exact variable names. NEVER write {{null}}, {{undefined}}, or any other placeholder. If you don't know the recipient's name, omit the variable entirely.",
    "Return JSON with exactly these fields: { subject: string, bodyHtml: string }",
    "The bodyHtml should be clean HTML suitable for email (no <html>/<head>/<body> tags — just the content).",
    "Use <p>, <br>, <strong>, <a> tags. Keep paragraphs short (2-3 sentences max).",
    brandCtx.customerNameRules?.trim()
      ? `MANDATORY customer naming & phrasing rules (follow exactly, even when paraphrasing a proof point): ${brandCtx.customerNameRules.trim()}`
      : "",
    includesMicrositeLink ? 'Include a natural CTA linking to {{microsite_url}} — e.g. "I put together a quick page with some relevant info: {{microsite_url}}"' : "",
    "Sign off with {{sender_name}}.",
  ].filter(Boolean).join("\n");
}

router.post("/generate-email", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const { contactId, accountId, purpose, tone, additionalContext, includesMicrositeLink } = req.body;

  try {
    let contactContext = "";
    let accountContext = "";

    if (contactId) {
      const [contact] = await db.select().from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.id, Number(contactId)),
          eq(salesContactsTable.tenantId, tenantId),
        ));
      if (contact) {
        const firstName = contact.firstName ?? "";
        const lastName = contact.lastName ?? "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || "the recipient";
        contactContext = `Recipient: ${fullName}`;
        if (contact.title) contactContext += `, ${contact.title}`;
        if (contact.role) contactContext += ` (${contact.role})`;
      }
    }

    if (accountId) {
      const [account] = await db.select().from(salesAccountsTable)
        .where(and(
          eq(salesAccountsTable.id, Number(accountId)),
          eq(salesAccountsTable.tenantId, tenantId),
        ));
      if (account) {
        accountContext = `Company: ${account.name}`;
        if (account.segment) accountContext += ` (${account.segment})`;
        if (account.industry) accountContext += `, ${account.industry}`;
      }
    }

    // Pull this tenant's Sales Console context so the prompt reflects
    // *their* brand, not Dandy.
    const genBrandCtx = await getSalesBrandContext(tenantId);
    const systemPrompt = buildGenerateEmailSystemPrompt({
      brandCtx: genBrandCtx,
      includesMicrositeLink: Boolean(includesMicrositeLink),
    });

    const userPrompt = [
      `Purpose: ${purpose ?? "intro outreach"}`,
      `Tone: ${tone ?? "professional but warm"}`,
      contactContext,
      accountContext,
      additionalContext ? `Additional context: ${additionalContext}` : "",
    ].filter(Boolean).join("\n");

    let raw: string;
    try {
      raw = await callAIChat({
        model: "gpt-4o",
        temperature: 0.8,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        timeoutMs: 45000,
      });
    } catch (err) {
      const { status, message } = aiErrorMessage(err, "Failed to generate email");
      console.error("[generate-email] AI call failed:", err);
      res.status(status).json({ error: message });
      return;
    }

    let parsed: { subject?: string; bodyHtml?: string };
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("[generate-email] AI response was not JSON:", err, raw.slice(0, 500));
      res.status(502).json({ error: "AI returned a malformed response. Please try again." });
      return;
    }

    const subject = parsed.subject ?? "";
    const bodyHtml = parsed.bodyHtml ?? "";
    // Strip HTML tags for clients that prefer/expect plain text.
    const bodyText = bodyHtml.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();

    // Task #1138 — advisory (non-persistent) fact detection. Best-effort so a
    // detection hiccup never blocks the generated email.
    let factWarnings: FactWarning[] = [];
    try {
      factWarnings = await detectAdvisoryFacts(tenantId, { subject, body: bodyText });
    } catch (err) {
      console.warn("[generate-email] fact detection failed", String(err));
    }
    if (factWarnings.length > 0) {
      trackFactEvent("fact_flag_advisory_detected", { tenantId, source: "generate-email", count: factWarnings.length });
    }

    res.json({ subject, bodyHtml, bodyText, factWarnings });
  } catch (err) {
    console.error("POST /sales/generate-email error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate email";
    res.status(500).json({ error: `Failed to generate email: ${message}` });
  }
});

export default router;
