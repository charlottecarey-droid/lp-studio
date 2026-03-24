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

type ImportSection = "colors" | "typography" | "buttons" | "voice" | "all";

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

function getFieldsForSection(section: ImportSection): string[] {
  switch (section) {
    case "colors": return COLOR_FIELDS;
    case "typography": return TYPOGRAPHY_FIELDS;
    case "buttons": return BUTTON_FIELDS;
    case "voice": return VOICE_FIELDS;
    case "all": return [...COLOR_FIELDS, ...TYPOGRAPHY_FIELDS, ...BUTTON_FIELDS, ...VOICE_FIELDS];
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

  const validSections = new Set<ImportSection>(["colors", "typography", "buttons", "voice", "all"]);
  if (!validSections.has(section)) {
    res.status(400).json({ error: "section must be one of: colors, typography, buttons, voice, all" });
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
      model: "gpt-5-mini",
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
