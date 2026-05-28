import { Router } from "express";
import { randomBytes } from "crypto";
import OpenAI from "openai";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";

const router = Router();

export function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured. Please set up Replit AI Integrations.");
  }
  // maxRetries: 1 honors the proxy's Retry-After once on 429s (the proxy is
  // strict about parallel bursts) but doesn't multiply our per-extractor
  // budget by 3 like the default would. Timeout caps each call.
  return new OpenAI({ baseURL, apiKey, maxRetries: 1, timeout: 18_000 });
}

export type ImportSection = "colors" | "typography" | "buttons" | "voice" | "products" | "segments" | "all";

const COLOR_FIELDS = [
  "primaryColor", "accentColor", "navBgColor", "textColor",
  "ctaBackground", "ctaText", "pageBackground", "cardBackground",
  "navText", "borderColor", "secondary1", "secondary2", "secondary3",
  "secondary4", "secondary5",
];

const TYPOGRAPHY_FIELDS = [
  "displayFont", "bodyFont", "numbersFont", "h1Size", "h2Size", "h3Size",
  "headingWeight", "headingLetterSpacing", "bodyTextSize", "eyebrowStyle",
];

const BUTTON_FIELDS = [
  "buttonRadius", "buttonShadow", "buttonPaddingX", "buttonPaddingY",
  "buttonFontWeight", "buttonTextCase", "buttonLetterSpacing",
  "secondaryButtonStyle",
];

const VOICE_FIELDS = [
  "brandName", "taglines", "messagingPillars", "toneOfVoice",
  "toneKeywords", "avoidPhrases", "targetAudience", "copyExamples",
  "copyrightName", "defaultCtaText", "navCtaText",
  // Streaming URL importer surfaces these two from the content +
  // derived-from-voice flatten step. They must be allow-listed here so
  // the non-streaming `/lp/brand-import` (pasted-text) and legacy
  // `/from-url` paths preserve them rather than silently stripping at
  // sanitize time.
  "companyDescription", "copyInstructions",
];

const PRODUCT_FIELDS = [
  "productLines",
];

const SEGMENT_FIELDS = [
  "segments",
];

// Media fields are only meaningful when we have access to a real source
// (e.g. a website import) — they're omitted from the section-specific
// imports that operate on pasted brand-guidelines text.
const MEDIA_FIELDS = [
  "logoUrl",
];

export function getFieldsForSection(section: ImportSection): string[] {
  switch (section) {
    case "colors": return COLOR_FIELDS;
    case "typography": return TYPOGRAPHY_FIELDS;
    case "buttons": return BUTTON_FIELDS;
    case "voice": return VOICE_FIELDS;
    case "products": return PRODUCT_FIELDS;
    case "segments": return SEGMENT_FIELDS;
    case "all": return [...COLOR_FIELDS, ...TYPOGRAPHY_FIELDS, ...BUTTON_FIELDS, ...VOICE_FIELDS, ...PRODUCT_FIELDS, ...SEGMENT_FIELDS, ...MEDIA_FIELDS];
  }
}

export function buildPromptForSection(section: ImportSection): string {
  const fieldDescriptions: Record<string, string> = {
    primaryColor: 'hex "#RRGGBB"',
    accentColor: 'hex "#RRGGBB"',
    navBgColor: 'hex "#RRGGBB"',
    textColor: 'hex "#RRGGBB" — main body/heading text color',
    ctaBackground: 'hex "#RRGGBB" — primary button fill',
    ctaText: 'hex "#RRGGBB" — text on primary buttons',
    pageBackground: 'hex "#RRGGBB" — default page/section background',
    cardBackground: 'hex "#RRGGBB" — card and panel surfaces',
    navText: 'hex "#RRGGBB" — nav bar text/links color',
    borderColor: 'hex "#RRGGBB" — dividers, borders',
    secondary1: 'hex "#RRGGBB" — optional palette color 1',
    secondary2: 'hex "#RRGGBB" — optional palette color 2',
    secondary3: 'hex "#RRGGBB" — optional palette color 3',
    secondary4: 'hex "#RRGGBB" — optional palette color 4',
    secondary5: 'hex "#RRGGBB" — optional palette color 5',
    displayFont: "string — font family for headings (e.g. Inter, Playfair Display)",
    bodyFont: "string — font family for body text",
    numbersFont: "string — optional font family for big stat numbers (TrustBar, StatCallout). Leave unset to inherit displayFont.",
    h1Size: 'one of "sm","md","lg","xl","2xl"',
    h2Size: 'one of "sm","md","lg","xl","2xl"',
    h3Size: 'one of "sm","md","lg","xl","2xl"',
    headingWeight: 'one of "semibold","bold","extrabold","black"',
    headingLetterSpacing: 'one of "tight","normal","wide"',
    bodyTextSize: 'one of "sm","md","lg"',
    eyebrowStyle: 'one of "uppercase","normal"',
    buttonRadius: 'one of "pill","rounded","slight","square"',
    buttonShadow: 'one of "none","sm","md","lg"',
    buttonPaddingX: 'one of "compact","regular","spacious"',
    buttonPaddingY: 'one of "compact","regular","spacious"',
    buttonFontWeight: 'one of "normal","medium","semibold","bold"',
    buttonTextCase: 'one of "uppercase","capitalize","normal"',
    buttonLetterSpacing: 'one of "tight","normal","wide","wider"',
    secondaryButtonStyle: 'one of "outline","ghost","filled"',
    copyrightName: "string — company/brand name for copyright footer",
    defaultCtaText: "string — primary call-to-action button text",
    navCtaText: "string — navigation bar CTA button text",
    brandName: "string — company/brand name",
    taglines: "string[] — up to 5 brand taglines",
    messagingPillars: '{ label: string, description: string }[] — up to 8 messaging themes',
    toneOfVoice: "string — 1-3 sentences describing brand voice",
    toneKeywords: 'string[] — e.g. ["knowledgeable","warm","uncomplicated"]',
    avoidPhrases: "string[] — words/phrases to never use",
    targetAudience: "string — who the copy speaks to",
    copyExamples: "string[] — up to 6 sample headlines or CTAs representing brand voice",
    productLines: '{ name: string, description: string, valueProps: string[], claims: string[], keywords: string[] }[] — up to 12 product lines. name = product name, description = one-line summary, valueProps = key benefits, claims = provable statements (e.g. "50% faster"), keywords = SEO target keywords',
    logoUrl: 'string — absolute http(s) URL to the brand\'s primary logo image (svg/png/jpg). Pick the logo shown in the site header / nav. Prefer SVG when available, then PNG. Must be a fully-qualified URL, not a relative path.',
    segments: '{ name: string, description: string, messagingAngle: string, uniqueContext: string, valueProps: string[], segmentProducts: string[], personas: { role: string, painPoints: string[] }[], challenges: { title: string, desc: string }[], stats: { value: string, label: string }[], comparisonRows: { need: string, us: string, them: string }[] }[] — audience segments. name = segment name (e.g. "DSO Leaders"), description = brief overview, messagingAngle = core pitch angle for this segment, uniqueContext = what makes this segment distinct, valueProps = up to 8 key benefits for this segment, segmentProducts = product names most relevant to this segment, personas = up to 6 buyer roles with their pain points, challenges = up to 8 problems this segment faces, stats = up to 6 proof-point metrics (value + label), comparisonRows = up to 8 comparison rows (need, what we offer, what competitors offer)',
  };

  const fields = getFieldsForSection(section);
  const fieldList = fields.map((f) => `  - ${f}: ${fieldDescriptions[f] ?? "string"}`).join("\n");

  return `You are a brand configuration parser. Given brand guidelines text, extract a JSON object with two keys:
1. "proposed" — a partial config object with only fields you can confidently determine
2. "confidence" — a Record<string, "high"|"medium"|"low"> for each field in proposed

Return ONLY valid JSON (no markdown, no explanation).

Available fields:
${fieldList}

Rules:
- Only include fields you can determine from the text
- Color values must be valid 6-digit hex codes (#RRGGBB)
- Enum values must match exactly
- String arrays (taglines, toneKeywords, etc.) must be arrays of strings
- messagingPillars must be an array of {label, description} objects
- For each proposed field, assign a confidence: "high" if clearly stated, "medium" if reasonably inferred, "low" if loosely inferred
- Omit fields you cannot determine at all
- Return {"proposed":{},"confidence":{}} if nothing can be determined`;
}

const ALLOWED_ENUMS: Record<string, Set<string>> = {
  headingWeight: new Set(["semibold", "bold", "extrabold", "black"]),
  headingLetterSpacing: new Set(["tight", "normal", "wide"]),
  bodyTextSize: new Set(["sm", "md", "lg"]),
  h1Size: new Set(["sm", "md", "lg", "xl", "2xl"]),
  h2Size: new Set(["sm", "md", "lg", "xl", "2xl"]),
  h3Size: new Set(["sm", "md", "lg", "xl", "2xl"]),
  eyebrowStyle: new Set(["uppercase", "normal"]),
  buttonRadius: new Set(["pill", "rounded", "slight", "square"]),
  buttonShadow: new Set(["none", "sm", "md", "lg"]),
  buttonPaddingX: new Set(["compact", "regular", "spacious"]),
  buttonPaddingY: new Set(["compact", "regular", "spacious"]),
  buttonFontWeight: new Set(["normal", "medium", "semibold", "bold"]),
  buttonTextCase: new Set(["uppercase", "capitalize", "normal"]),
  buttonLetterSpacing: new Set(["tight", "normal", "wide", "wider"]),
  secondaryButtonStyle: new Set(["outline", "ghost", "filled"]),
};

const hexRe = /^#[0-9a-fA-F]{6}$/;

const COLOR_FIELD_SET = new Set(COLOR_FIELDS);
const STRING_FIELDS = new Set(["displayFont", "bodyFont", "numbersFont", "brandName", "toneOfVoice", "targetAudience", "copyrightName", "defaultCtaText", "navCtaText", "companyDescription", "copyInstructions"]);
const STRING_ARRAY_FIELDS = new Set(["taglines", "toneKeywords", "avoidPhrases", "copyExamples"]);

export function sanitizeField(field: string, value: unknown): { valid: boolean; sanitized: unknown } {
  if (COLOR_FIELD_SET.has(field)) {
    if (typeof value === "string" && hexRe.test(value)) return { valid: true, sanitized: value };
    return { valid: false, sanitized: null };
  }
  if (ALLOWED_ENUMS[field]) {
    if (typeof value === "string" && ALLOWED_ENUMS[field].has(value)) return { valid: true, sanitized: value };
    return { valid: false, sanitized: null };
  }
  if (STRING_FIELDS.has(field)) {
    if (typeof value === "string" && value.trim().length > 0 && value.length <= 500) return { valid: true, sanitized: value.trim() };
    return { valid: false, sanitized: null };
  }
  if (STRING_ARRAY_FIELDS.has(field)) {
    if (Array.isArray(value)) {
      const filtered = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
      if (filtered.length > 0) return { valid: true, sanitized: filtered.slice(0, field === "taglines" ? 5 : field === "copyExamples" ? 6 : 20) };
    }
    return { valid: false, sanitized: null };
  }
  if (field === "productLines") {
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (v): v is { name: string; description: string; valueProps: string[]; claims: string[]; keywords: string[] } =>
          typeof v === "object" && v !== null && typeof v.name === "string" && v.name.trim().length > 0
      ).map((v) => ({
        name: v.name.trim(),
        description: typeof v.description === "string" ? v.description.trim() : "",
        valueProps: Array.isArray(v.valueProps) ? v.valueProps.filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0).map((s: string) => s.trim()).slice(0, 8) : [],
        claims: Array.isArray(v.claims) ? v.claims.filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0).map((s: string) => s.trim()).slice(0, 8) : [],
        keywords: Array.isArray(v.keywords) ? v.keywords.filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0).map((s: string) => s.trim()).slice(0, 12) : [],
      }));
      if (filtered.length > 0) return { valid: true, sanitized: filtered.slice(0, 12) };
    }
    return { valid: false, sanitized: null };
  }
  if (field === "messagingPillars") {
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (v): v is { label: string; description: string } =>
          typeof v === "object" && v !== null && typeof v.label === "string" && typeof v.description === "string" && v.label.trim().length > 0
      ).map((v) => ({ label: v.label.trim(), description: v.description.trim() }));
      if (filtered.length > 0) return { valid: true, sanitized: filtered.slice(0, 8) };
    }
    return { valid: false, sanitized: null };
  }
  if (field === "segments") {
    if (Array.isArray(value)) {
      const sanitizeStrArr = (arr: unknown, max: number): string[] =>
        Array.isArray(arr)
          ? arr.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim()).slice(0, max)
          : [];
      const filtered = value
        .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).name === "string" && ((v as Record<string, unknown>).name as string).trim().length > 0)
        .map((v) => ({
          id: `seg-${Date.now()}-${randomBytes(4).toString("hex")}`,
          name: (v.name as string).trim(),
          description: typeof v.description === "string" ? v.description.trim() : "",
          messagingAngle: typeof v.messagingAngle === "string" ? v.messagingAngle.trim() : "",
          uniqueContext: typeof v.uniqueContext === "string" ? v.uniqueContext.trim() : "",
          valueProps: sanitizeStrArr(v.valueProps, 8),
          segmentProducts: sanitizeStrArr(v.segmentProducts, 12),
          personas: Array.isArray(v.personas)
            ? v.personas.filter((p): p is { role: string; painPoints: string[] } => typeof p === "object" && p !== null && typeof (p as { role?: unknown }).role === "string")
                .map((p) => ({ role: (p.role as string).trim(), painPoints: sanitizeStrArr((p as { painPoints?: unknown }).painPoints, 8) })).slice(0, 6)
            : [],
          challenges: Array.isArray(v.challenges)
            ? v.challenges.filter((c): c is { title: string; desc: string } => typeof c === "object" && c !== null && typeof (c as { title?: unknown }).title === "string")
                .map((c) => ({ title: (c.title as string).trim(), desc: typeof (c as { desc?: unknown }).desc === "string" ? ((c as { desc: string }).desc).trim() : "" })).slice(0, 8)
            : [],
          stats: Array.isArray(v.stats)
            ? v.stats.filter((s): s is { value: string; label: string } => typeof s === "object" && s !== null && typeof (s as { value?: unknown }).value === "string")
                .map((s) => ({ value: (s.value as string).trim(), label: typeof (s as { label?: unknown }).label === "string" ? ((s as { label: string }).label).trim() : "" })).slice(0, 6)
            : [],
          comparisonRows: Array.isArray(v.comparisonRows)
            ? v.comparisonRows.filter((r): r is { need: string; us: string; them: string } => typeof r === "object" && r !== null && typeof (r as { need?: unknown }).need === "string")
                .map((r) => ({ need: (r.need as string).trim(), us: typeof (r as { us?: unknown }).us === "string" ? ((r as { us: string }).us).trim() : "", them: typeof (r as { them?: unknown }).them === "string" ? ((r as { them: string }).them).trim() : "" })).slice(0, 8)
            : [],
        }));
      if (filtered.length > 0) return { valid: true, sanitized: filtered.slice(0, 20) };
    }
    return { valid: false, sanitized: null };
  }
  // ── Streaming-importer additive fields ────────────────────────────
  // These come from our own orchestrator (well-typed) so we mainly enforce
  // shape + size caps rather than per-field whitelists.
  if (field === "logoAlternates") {
    if (!Array.isArray(value)) return { valid: false, sanitized: null };
    const out = value
      .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null && typeof (v as { url?: unknown }).url === "string")
      .slice(0, 12)
      .map((v) => ({
        url: String(v.url).slice(0, 2000),
        source: typeof v.source === "string" ? v.source : "favicon",
        format: typeof v.format === "string" ? v.format : "unknown",
        estimatedArea: typeof v.estimatedArea === "number" ? v.estimatedArea : null,
        transparent: typeof v.transparent === "boolean" ? v.transparent : null,
        score: typeof v.score === "number" ? v.score : 0,
      }));
    return { valid: out.length > 0, sanitized: out };
  }
  if (field === "salesConsole") {
    // Sales-console seed from the importer. Validate the shape we know
    // (valuePropPairs + three string prompts) and drop anything else
    // so the FE merge can't pick up rogue keys. Length caps mirror the
    // content extractor's slicing.
    if (typeof value !== "object" || value === null) return { valid: false, sanitized: null };
    const o = value as Record<string, unknown>;
    const pairsIn = Array.isArray(o.valuePropPairs) ? o.valuePropPairs : [];
    const pairs = pairsIn
      .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map((p) => {
        const theme = typeof p.theme === "string" ? p.theme.trim().slice(0, 80) : "";
        const pain = typeof p.pain === "string" ? p.pain.trim().slice(0, 200) : "";
        const proof = typeof p.proof === "string" ? p.proof.trim().slice(0, 240) : "";
        const rolesArr = Array.isArray(p.roles)
          ? p.roles.filter((r): r is string => typeof r === "string" && r.trim().length > 0).map((r) => r.trim().slice(0, 80)).slice(0, 6)
          : [];
        return { roles: rolesArr, theme, pain, proof };
      })
      .filter((p) => p.theme || p.pain || p.proof)
      .slice(0, 8);
    const brief = typeof o.briefBlurb === "string" ? o.briefBlurb.trim().slice(0, 800) : "";
    const naming = typeof o.customerNameRules === "string" ? o.customerNameRules.trim().slice(0, 400) : "";
    const intro = typeof o.salesIntroLine === "string" ? o.salesIntroLine.trim().slice(0, 280) : "";
    if (pairs.length === 0 && !brief && !naming && !intro) return { valid: false, sanitized: null };
    return { valid: true, sanitized: { valuePropPairs: pairs, briefBlurb: brief, customerNameRules: naming, salesIntroLine: intro } };
  }
  if (field === "photographyProfile" || field === "voiceProfile" || field === "buttonStyleRaw" || field === "surfaceStyle") {
    if (typeof value !== "object" || value === null) return { valid: false, sanitized: null };
    // Cap serialized size at 32KB to prevent runaway JSON
    try {
      const json = JSON.stringify(value);
      if (json.length > 32_000) return { valid: false, sanitized: null };
      return { valid: true, sanitized: JSON.parse(json) };
    } catch {
      return { valid: false, sanitized: null };
    }
  }
  if (field === "displayFontUrl" || field === "bodyFontUrl" || field === "numbersFontUrl") {
    if (typeof value !== "string") return { valid: false, sanitized: null };
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 2000) return { valid: false, sanitized: null };
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "https:" && u.protocol !== "http:") return { valid: false, sanitized: null };
      return { valid: true, sanitized: u.toString() };
    } catch { return { valid: false, sanitized: null }; }
  }
  if (field === "logoUrl") {
    if (typeof value !== "string") return { valid: false, sanitized: null };
    const trimmed = value.trim();
    if (trimmed.length === 0) return { valid: false, sanitized: null };
    // Allow inline-SVG data URLs produced by the Playwright logo worker.
    // Worker caps serialized SVG at 64KB; base64 inflates ~1.33×, plus the
    // `data:image/svg+xml;base64,` prefix — 100KB is a comfortable ceiling
    // that also blocks pathological payloads. Only `image/svg+xml;base64`
    // is accepted (no other media types, no plain `data:` URLs, no
    // `javascript:` scheme).
    const SVG_DATA_PREFIX = "data:image/svg+xml;base64,";
    const SVG_DATA_MAX = 100_000;
    if (trimmed.startsWith(SVG_DATA_PREFIX)) {
      if (trimmed.length > SVG_DATA_MAX) return { valid: false, sanitized: null };
      const payload = trimmed.slice(SVG_DATA_PREFIX.length);
      if (!/^[A-Za-z0-9+/=]+$/.test(payload)) return { valid: false, sanitized: null };
      return { valid: true, sanitized: trimmed };
    }
    // The brand-import asset mirror rewrites the chosen logo to a
    // tenant-scoped `/api/storage/objects/uploads/...` path. Accept
    // that shape (relative, no scheme) alongside fully-qualified
    // http(s) URLs — the existing upload route already produces this
    // exact prefix (see routes/lp/brand-upload.ts), so it's a known-safe
    // origin, not arbitrary user input.
    if (trimmed.startsWith("/api/storage/")) {
      if (trimmed.length > 2000) return { valid: false, sanitized: null };
      if (!/^\/api\/storage\/[A-Za-z0-9._\-/]+$/.test(trimmed)) return { valid: false, sanitized: null };
      return { valid: true, sanitized: trimmed };
    }
    if (trimmed.length > 2000) return { valid: false, sanitized: null };
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") return { valid: false, sanitized: null };
      return { valid: true, sanitized: u.toString() };
    } catch {
      return { valid: false, sanitized: null };
    }
  }
  if (typeof value === "string" && value.trim().length > 0) return { valid: true, sanitized: value.trim() };
  return { valid: false, sanitized: null };
}

router.post("/lp/brand-import", aiLightLimiter, aiLightHourlyLimiter, async (req, res): Promise<void> => {
  const { section = "all", content, guidelines } = req.body as {
    section?: ImportSection;
    content?: string;
    guidelines?: string;
  };

  const text = content || guidelines;
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "content text is required" });
    return;
  }

  const validSections = new Set<ImportSection>(["colors", "typography", "buttons", "voice", "products", "segments", "all"]);
  if (!validSections.has(section)) {
    res.status(400).json({ error: "section must be one of: colors, typography, buttons, voice, products, segments, all" });
    return;
  }

  try {
    let openai: OpenAI;
    try {
      openai = getOpenAIClient();
    } catch (e) {
      res.status(503).json({ error: String(e) });
      return;
    }

    const systemPrompt = buildPromptForSection(section);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text.slice(0, 12000) },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response as JSON", raw });
      return;
    }

    const proposed = (parsed.proposed ?? parsed) as Record<string, unknown>;
    const rawConfidence = (parsed.confidence ?? {}) as Record<string, string>;

    const allowedFields = new Set(getFieldsForSection(section));
    const sanitized: Record<string, unknown> = {};
    const confidence: Record<string, "high" | "medium" | "low"> = {};
    const unparsed: string[] = [];

    for (const [field, value] of Object.entries(proposed)) {
      if (!allowedFields.has(field)) continue;
      const result = sanitizeField(field, value);
      if (result.valid) {
        sanitized[field] = result.sanitized;
        const conf = rawConfidence[field];
        confidence[field] = conf === "high" || conf === "medium" || conf === "low" ? conf : "medium";
      } else {
        unparsed.push(field);
      }
    }

    res.json({ proposed: sanitized, confidence, unparsed, config: sanitized });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
