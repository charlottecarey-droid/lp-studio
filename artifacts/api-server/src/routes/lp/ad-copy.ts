import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable, lpBrandSettingsTable, lpPageAdCopyRunsTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { getOpenAIClient } from "./brand-import";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";

const router = Router();

// ─── Channel spec ─────────────────────────────────────────────────────────
// Per-channel field schemas with hard character limits. The route enforces
// these server-side after the model returns; over-limit variants are kept
// in the response with `overLimit: true` so the UI can flag them and let
// the user regenerate that single cell.
type FieldSpec = { key: string; label: string; max: number; count: number };
type ChannelSpec = { id: string; name: string; fields: FieldSpec[] };

const CHANNELS: ChannelSpec[] = [
  {
    id: "google_rsa",
    name: "Google Search (RSA)",
    fields: [
      { key: "headlines", label: "Headline", max: 30, count: 15 },
      { key: "descriptions", label: "Description", max: 90, count: 4 },
    ],
  },
  {
    id: "meta",
    name: "Meta / Instagram",
    fields: [
      { key: "primaryText", label: "Primary text", max: 125, count: 5 },
      { key: "headline", label: "Headline", max: 27, count: 5 },
      { key: "description", label: "Description", max: 27, count: 5 },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn Sponsored",
    fields: [
      { key: "introductoryText", label: "Introductory text", max: 150, count: 5 },
      { key: "headline", label: "Headline", max: 70, count: 5 },
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    fields: [
      { key: "post", label: "Post", max: 280, count: 5 },
    ],
  },
];

const CHANNEL_BY_ID = new Map(CHANNELS.map((c) => [c.id, c] as const));

type Variant = { value: string; overLimit: boolean };
type ChannelOutput = { id: string; name: string; fields: Record<string, Variant[]> };

// ─── Page content extraction ──────────────────────────────────────────────
// Pull every plausibly-copy field out of the page's blocks so the model has
// real headlines, value props, and CTAs to compress into ad copy. Walks
// nested children (containers/grids) recursively. Field keys we already
// surface in COPY_FIELDS aren't imported here — we just take any string
// prop with reasonable length.
const COPY_KEYS = new Set([
  "headline", "subheadline", "subhead", "title", "subtitle", "eyebrow",
  "body", "bodyText", "description", "text", "content",
  "ctaText", "primaryCtaText", "secondaryCtaText", "buttonText",
  "label", "caption", "quote", "author", "value", "stat",
]);

interface BlockLike {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  children?: BlockLike[];
}

function extractCopySnippets(blocks: BlockLike[], out: { type: string; key: string; value: string }[] = []): { type: string; key: string; value: string }[] {
  for (const b of blocks) {
    const type = typeof b?.type === "string" ? b.type : "block";
    const props = (b?.props ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(props)) {
      if (typeof v === "string") {
        const trimmed = v.trim();
        if (trimmed.length === 0 || trimmed.length > 600) continue;
        if (COPY_KEYS.has(k) || /headline|title|cta|button|body|description|tagline|stat|quote/i.test(k)) {
          out.push({ type, key: k, value: trimmed });
        }
      } else if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string" && item.trim().length > 0 && item.length <= 300) {
            out.push({ type, key: k, value: item.trim() });
          } else if (item && typeof item === "object") {
            for (const [ik, iv] of Object.entries(item as Record<string, unknown>)) {
              if (typeof iv === "string" && iv.trim().length > 0 && iv.length <= 300) {
                if (COPY_KEYS.has(ik) || /headline|title|label|text|description/i.test(ik)) {
                  out.push({ type: `${type}.${k}`, key: ik, value: iv.trim() });
                }
              }
            }
          }
        }
      }
    }
    if (Array.isArray(b?.children)) extractCopySnippets(b.children, out);
  }
  return out;
}

// ─── Brand context ────────────────────────────────────────────────────────
interface BrandConfig {
  brandName?: string;
  toneOfVoice?: string;
  toneKeywords?: string[];
  avoidPhrases?: string[];
  targetAudience?: string;
  copyExamples?: string[];
  segments?: {
    id: string;
    name: string;
    description?: string;
    messagingAngle?: string;
    /** Task #253 — per-segment approved-only stat pool. */
    stats?: { value?: string; label?: string; approvedForAi?: boolean }[];
  }[];
  productLines?: {
    name?: string;
    claims?: Array<string | { text?: string; approvedForAi?: boolean }>;
  }[];
  /** Task #253 — when true, only approved claims/stats may be used and the
   *  model is instructed not to invent numeric facts. */
  aiStrictFactsMode?: boolean;
}

/** Task #253 — mirrors `STRICT_FACTS_INSTRUCTION` in lp-studio/brand-config
 *  and api-server/routes/lp/generate-page.ts. Keep wording in sync — the
 *  same placeholder string is used everywhere strict mode applies. */
const STRICT_FACTS_INSTRUCTION =
  "STRICT FACTS MODE: Use ONLY the statistics, percentages, customer counts, " +
  "claims, and case studies explicitly listed in this brief. Do NOT invent, " +
  "extrapolate, round, or paraphrase numbers. If a slot would require a stat " +
  "or proof point that is not provided, write the placeholder \u2014 add a stat in Brand Settings \u2014 instead.";

function getClaimText(c: string | { text?: string } | null | undefined): string {
  if (!c) return "";
  if (typeof c === "string") return c.trim();
  return (c.text ?? "").trim();
}
function isClaimApproved(c: string | { approvedForAi?: boolean } | null | undefined): boolean {
  if (!c) return false;
  if (typeof c === "string") return true; // legacy unmigrated rows are trusted
  return c.approvedForAi !== false;
}

async function fetchBrand(tenantId: number): Promise<BrandConfig> {
  try {
    const rows = await db.select().from(lpBrandSettingsTable).where(eq(lpBrandSettingsTable.tenantId, tenantId)).limit(1);
    return (rows[0]?.config as BrandConfig | undefined) ?? {};
  } catch {
    return {};
  }
}

function buildBrandPrompt(brand: BrandConfig, segmentName?: string, toneOverride?: string, audienceOverride?: string): string {
  const parts: string[] = [];
  if (brand.brandName) parts.push(`Brand: ${brand.brandName}.`);
  const tone = (toneOverride && toneOverride.trim()) || brand.toneOfVoice;
  if (tone) parts.push(`Tone: ${tone}.`);
  if (brand.toneKeywords?.length) parts.push(`Style keywords: ${brand.toneKeywords.join(", ")}.`);
  if (brand.avoidPhrases?.length) parts.push(`Never use: ${brand.avoidPhrases.join(", ")}.`);
  const audience = (audienceOverride && audienceOverride.trim()) || (segmentName && brand.segments?.find((s) => s.name === segmentName || s.id === segmentName)?.description) || brand.targetAudience;
  if (audience) parts.push(`Audience: ${audience}.`);
  if (segmentName) {
    const seg = brand.segments?.find((s) => s.name === segmentName || s.id === segmentName);
    if (seg?.messagingAngle) parts.push(`Messaging angle: ${seg.messagingAngle}.`);
  }
  if (brand.copyExamples?.length) parts.push(`Style references: ${brand.copyExamples.slice(0, 6).join(" | ")}.`);

  // Task #253 — surface approved facts (claims + per-segment stats) and, in
  // strict mode, instruct the model not to invent numbers. We always show
  // approved facts (so the model can quote them) but only emit the strict
  // instruction when the toggle is on.
  const strict = brand.aiStrictFactsMode !== false;
  const approvedClaims: string[] = [];
  for (const pl of brand.productLines ?? []) {
    for (const c of pl.claims ?? []) {
      if (strict && !isClaimApproved(c)) continue;
      const t = getClaimText(c);
      if (t) approvedClaims.push(t);
    }
  }
  if (approvedClaims.length) {
    parts.push(`${strict ? "APPROVED CLAIMS (use ONLY these for proof points)" : "Approved claims"}: ${approvedClaims.slice(0, 12).join(" | ")}.`);
  }
  const segStats: string[] = [];
  for (const seg of brand.segments ?? []) {
    for (const s of seg.stats ?? []) {
      if (strict && s.approvedForAi === false) continue;
      const v = (s.value ?? "").trim();
      const l = (s.label ?? "").trim();
      if (!v && !l) continue;
      segStats.push(`${v} ${l}`.trim());
    }
  }
  if (segStats.length) {
    parts.push(`${strict ? "APPROVED STATS (use ONLY these — do not invent numbers)" : "Stats"}: ${segStats.slice(0, 12).join(" | ")}.`);
  }
  if (strict) parts.push(STRICT_FACTS_INSTRUCTION);

  return parts.join("\n");
}

// ─── Generation ───────────────────────────────────────────────────────────
function buildGenerationPrompt(channels: ChannelSpec[], page: { title: string; slug: string }, snippets: { type: string; key: string; value: string }[], toneSlider: string, brandPrompt: string): { system: string; user: string } {
  const channelSpec = channels.map((c) => {
    const fields = c.fields.map((f) => `    "${f.key}": ${f.count} string${f.count === 1 ? "" : "s"}, each ≤ ${f.max} characters`).join("\n");
    return `  "${c.id}": {\n${fields}\n  }`;
  }).join(",\n");

  const system = [
    brandPrompt,
    `You write ad copy for paid acquisition. You are given a landing page's existing copy and must produce ready-to-ship ad sets for multiple channels that drive clicks to that page.`,
    `Strict rules:`,
    `- Sentence casing only. Capitalize first word and proper nouns. Never title-case.`,
    `- Stay under each channel's character limits — the response will be rejected if over.`,
    `- Each variant must be distinct. No near-duplicates. Vary angle, hook, and benefit.`,
    `- Reuse the page's actual value props and product names when present. Don't invent products.`,
    `- ${toneSlider === "urgent" ? "Lean urgent — scarcity, deadlines, immediate benefit." : toneSlider === "playful" ? "Lean playful — light, conversational, witty when on-brand." : "Lean professional — credible, specific, benefit-led."}`,
    `Return ONLY valid JSON matching this exact schema (no markdown, no commentary):`,
    `{`,
    channelSpec,
    `}`,
  ].filter(Boolean).join("\n");

  const snippetText = snippets.slice(0, 60).map((s) => `- [${s.type}.${s.key}] ${s.value}`).join("\n");
  const user = [
    `Page title: ${page.title}`,
    `Page slug: /${page.slug}`,
    snippetText.length > 0 ? `\nPage copy on the live landing page:\n${snippetText}` : "\nPage has no extractable copy yet — write generic on-brand ads.",
  ].join("\n");

  return { system, user };
}

function enforceLimits(channels: ChannelSpec[], parsed: Record<string, unknown>): ChannelOutput[] {
  const out: ChannelOutput[] = [];
  for (const ch of channels) {
    const raw = (parsed[ch.id] ?? {}) as Record<string, unknown>;
    const fields: Record<string, Variant[]> = {};
    for (const f of ch.fields) {
      const arr = Array.isArray(raw[f.key]) ? (raw[f.key] as unknown[]) : [];
      const variants: Variant[] = arr
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
        .slice(0, f.count)
        .map((v) => ({ value: v, overLimit: v.length > f.max }));
      fields[f.key] = variants;
    }
    out.push({ id: ch.id, name: ch.name, fields });
  }
  return out;
}

// ─── Routes ───────────────────────────────────────────────────────────────
router.get("/lp/pages/:id/ad-copy/runs", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(pageId)) { res.status(400).json({ error: "invalid page id" }); return; }

  const owner = await db.select({ id: lpPagesTable.id }).from(lpPagesTable)
    .where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId))).limit(1);
  if (owner.length === 0) { res.status(404).json({ error: "page not found" }); return; }

  const rows = await db.select({
    id: lpPageAdCopyRunsTable.id,
    inputSummary: lpPageAdCopyRunsTable.inputSummary,
    output: lpPageAdCopyRunsTable.output,
    createdBy: lpPageAdCopyRunsTable.createdBy,
    createdAt: lpPageAdCopyRunsTable.createdAt,
  }).from(lpPageAdCopyRunsTable)
    .where(and(eq(lpPageAdCopyRunsTable.pageId, pageId), eq(lpPageAdCopyRunsTable.tenantId, tenantId)))
    .orderBy(desc(lpPageAdCopyRunsTable.createdAt))
    .limit(20);

  res.json({ runs: rows, channels: CHANNELS });
});

router.post("/lp/pages/:id/ad-copy", requireAuth, aiLightLimiter, aiLightHourlyLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(pageId)) { res.status(400).json({ error: "invalid page id" }); return; }

  const body = req.body as {
    tone?: "professional" | "playful" | "urgent";
    audienceOverride?: string;
    /**
     * Free-form follow-up nudge appended to the prompt (e.g. "make it
     * punchier"). Kept distinct from `audienceOverride` so the audience
     * description doesn't grow with every follow-up click.
     */
    instruction?: string;
    channels?: string[];
    regenerate?: { channelId: string; fieldKey: string; instruction?: string };
  };
  const tone = body.tone === "playful" || body.tone === "urgent" ? body.tone : "professional";
  const audienceOverride = typeof body.audienceOverride === "string" ? body.audienceOverride.slice(0, 500) : "";
  const followUpInstruction = typeof body.instruction === "string" ? body.instruction.slice(0, 400) : "";

  const requestedIds = Array.isArray(body.channels) && body.channels.length > 0
    ? body.channels.filter((id) => CHANNEL_BY_ID.has(id))
    : CHANNELS.map((c) => c.id);
  const channels = requestedIds.map((id) => CHANNEL_BY_ID.get(id)!).filter(Boolean);
  if (channels.length === 0) { res.status(400).json({ error: "no valid channels" }); return; }

  const pageRows = await db.select().from(lpPagesTable)
    .where(and(eq(lpPagesTable.id, pageId), eq(lpPagesTable.tenantId, tenantId))).limit(1);
  if (pageRows.length === 0) { res.status(404).json({ error: "page not found" }); return; }
  const page = pageRows[0];

  const brand = await fetchBrand(tenantId);
  const blocks = Array.isArray(page.blocks) ? (page.blocks as BlockLike[]) : [];
  const snippets = extractCopySnippets(blocks);
  const segmentName = page.segmentId ?? undefined;
  const brandPrompt = buildBrandPrompt(brand, segmentName ?? undefined, tone, audienceOverride);

  // Single-cell regenerate path: same prompt, but constrain output to one channel/field.
  let promptChannels = channels;
  if (body.regenerate) {
    const ch = CHANNEL_BY_ID.get(body.regenerate.channelId);
    const f = ch?.fields.find((x) => x.key === body.regenerate!.fieldKey);
    if (!ch || !f) { res.status(400).json({ error: "invalid regenerate target" }); return; }
    promptChannels = [{ ...ch, fields: [f] }];
  }

  let openai;
  try { openai = getOpenAIClient(); } catch (e) { res.status(503).json({ error: String(e) }); return; }

  const { system, user } = buildGenerationPrompt(promptChannels, { title: page.title, slug: page.slug }, snippets, tone, brandPrompt);
  const extras: string[] = [];
  if (followUpInstruction) extras.push(`Additional creative direction: ${followUpInstruction}`);
  if (body.regenerate?.instruction) extras.push(`Regenerate instruction: ${body.regenerate.instruction.slice(0, 300)}`);
  const extra = extras.length > 0 ? `\n\n${extras.join("\n")}` : "";

  let raw = "{}";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.85,
      max_completion_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user + extra },
      ],
    });
    raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  } catch (err) {
    res.status(500).json({ error: `AI generation failed: ${String(err)}` });
    return;
  }

  // Strip optional ```json fences before parsing — response_format=json_object
  // should prevent these but we've seen Gemini-routed proxies leak them.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(cleaned); } catch {
    res.status(502).json({ error: "AI returned invalid JSON", raw });
    return;
  }

  const result = enforceLimits(promptChannels, parsed);

  // Single-cell regenerate: don't persist a new run — just return the variants
  // for the requested field so the client can splice them in.
  if (body.regenerate) {
    const ch = result[0];
    const fieldKey = body.regenerate.fieldKey;
    res.json({ regenerated: { channelId: ch.id, fieldKey, variants: ch.fields[fieldKey] ?? [] } });
    return;
  }

  const inputSummary = {
    tone,
    audienceOverride: audienceOverride || null,
    instruction: followUpInstruction || null,
    channels: requestedIds,
    snippetCount: snippets.length,
    segmentId: segmentName ?? null,
    pageTitle: page.title,
  };

  try {
    await db.insert(lpPageAdCopyRunsTable).values({
      pageId,
      tenantId,
      inputSummary,
      output: { channels: result },
      createdBy: req.authUser?.email ?? null,
    });
  } catch (err) {
    // Persistence failure shouldn't block returning copy to the user.
    console.error("[ad-copy] persist failed:", err);
  }

  res.json({ channels: result, inputSummary });
});

export default router;
