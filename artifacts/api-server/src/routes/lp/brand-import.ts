import { Router } from "express";
import OpenAI from "openai";

const router = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured. Please set up Replit AI Integrations.");
  }
  return new OpenAI({ baseURL, apiKey });
}

type ImportSection = "colors" | "typography" | "buttons" | "voice" | "products" | "segments" | "all";

const COLOR_FIELDS = [
  "primaryColor", "accentColor", "navBgColor", "textColor",
  "ctaBackground", "ctaText", "pageBackground", "cardBackground",
  "navText", "borderColor", "secondary1", "secondary2", "secondary3",
  "secondary4", "secondary5",
];

const TYPOGRAPHY_FIELDS = [
  "displayFont", "bodyFont", "h1Size", "h2Size", "h3Size",
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
];

const PRODUCT_FIELDS = [
  "productLines",
];

const SEGMENT_FIELDS = [
  "segments",
];

function getFieldsForSection(section: ImportSection): string[] {
  switch (section) {
    case "colors": return COLOR_FIELDS;
    case "typography": return TYPOGRAPHY_FIELDS;
    case "buttons": return BUTTON_FIELDS;
    case "voice": return VOICE_FIELDS;
    case "products": return PRODUCT_FIELDS;
    case "segments": return SEGMENT_FIELDS;
    case "all": return [...COLOR_FIELDS, ...TYPOGRAPHY_FIELDS, ...BUTTON_FIELDS, ...VOICE_FIELDS, ...PRODUCT_FIELDS, ...SEGMENT_FIELDS];
  }
}

function buildPromptForSection(section: ImportSection): string {
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
const STRING_FIELDS = new Set(["displayFont", "bodyFont", "brandName", "toneOfVoice", "targetAudience", "copyrightName", "defaultCtaText", "navCtaText"]);
const STRING_ARRAY_FIELDS = new Set(["taglines", "toneKeywords", "avoidPhrases", "copyExamples"]);

function sanitizeField(field: string, value: unknown): { valid: boolean; sanitized: unknown } {
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
          id: `seg-${Date.now()}-${require("crypto").randomBytes(4).toString("hex")}`,
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
  if (typeof value === "string" && value.trim().length > 0) return { valid: true, sanitized: value.trim() };
  return { valid: false, sanitized: null };
}

router.post("/lp/brand-import", async (req, res): Promise<void> => {
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
