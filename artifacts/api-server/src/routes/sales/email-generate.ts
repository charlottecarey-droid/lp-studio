import { Router } from "express";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesContactsTable, salesAccountsTable } from "@workspace/db";

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

// ─── AI email generation ────────────────────────────────────

router.post("/generate-email", async (req, res): Promise<void> => {
  const { contactId, accountId, purpose, tone, additionalContext, includesMicrositeLink } = req.body;

  const openai = getOpenAIClient();
  if (!openai) {
    res.status(503).json({ error: "AI not configured. Set OPENAI_API_KEY." });
    return;
  }

  try {
    // Gather context
    let contactContext = "";
    let accountContext = "";

    if (contactId) {
      const [contact] = await db.select().from(salesContactsTable)
        .where(eq(salesContactsTable.id, Number(contactId)));
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
        .where(eq(salesAccountsTable.id, Number(accountId)));
      if (account) {
        accountContext = `Company: ${account.name}`;
        if (account.segment) accountContext += ` (${account.segment})`;
        if (account.industry) accountContext += `, ${account.industry}`;
      }
    }

    const systemPrompt = [
      "You are a sales email copywriter for Dandy, a dental technology company.",
      "Dandy provides digital dental lab services, AI-powered scan review, and practice management tools.",
      "Write concise, personalized B2B sales emails that feel human and genuine — never spammy.",
      "Use merge variables where appropriate: {{first_name}}, {{last_name}}, {{company}}, {{microsite_url}}, {{sender_name}}.",
      "CRITICAL: Only ever use these exact variable names. NEVER write {{null}}, {{undefined}}, or any other placeholder. If you don't know the recipient's name, omit the variable entirely.",
      "Return JSON with exactly these fields: { subject: string, bodyHtml: string }",
      "The bodyHtml should be clean HTML suitable for email (no <html>/<head>/<body> tags — just the content).",
      "Use <p>, <br>, <strong>, <a> tags. Keep paragraphs short (2-3 sentences max).",
      includesMicrositeLink ? 'Include a natural CTA linking to {{microsite_url}} — e.g. "I put together a quick page with some relevant info: {{microsite_url}}"' : "",
      "Sign off with {{sender_name}}.",
    ].filter(Boolean).join("\n");

    const userPrompt = [
      `Purpose: ${purpose ?? "intro outreach"}`,
      `Tone: ${tone ?? "professional but warm"}`,
      contactContext,
      accountContext,
      additionalContext ? `Additional context: ${additionalContext}` : "",
    ].filter(Boolean).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    res.json({
      subject: parsed.subject ?? "",
      bodyHtml: parsed.bodyHtml ?? "",
    });
  } catch (err) {
    console.error("POST /sales/generate-email error:", err);
    res.status(500).json({ error: "Failed to generate email" });
  }
});

export default router;
