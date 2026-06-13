/**
 * Phase 3 — AI-assisted publishing for the first-party marketing blog.
 *
 * PURE, dependency-free helpers (no db, no express, no network) so they can be
 * unit-tested in isolation and shared by the superadmin AI endpoints
 * (routes/lp/blog-ai.ts). The OpenAI client is INJECTED into the runner
 * functions, mirroring the critique-pass / brand-import pattern, so tests mock
 * a fake `chat.completions.create` rather than the network.
 *
 * The blog's "brand" is LP STUDIO ITSELF — the marketing site. There is no
 * tenant brand row for the first-party blog (fetchBrand is tenant-scoped), so
 * the voice grounding is hard-coded here from LP Studio's own Brand Guidelines
 * (the AI revenue workspace; confident, plainspoken, allergic to fluff;
 * answer-first for GEO; sentence-case headings; the Say/Don't banned list; no
 * invented stats / fake logos). This is the SAME strict-facts + brand-voice
 * discipline the page/microsite generators use (getCopyPrinciplesSection /
 * getCoreForbiddenPhrases), specialised for editorial blog prose.
 */

import { getCoreForbiddenPhrases } from "./ai-prompts/copy-principles";

// ── Editable editorial writing instructions ──────────────────────────────────

/**
 * The DEFAULT editorial brief seeded onto blog_program_settings.writing_instructions
 * (only when null/empty). The superadmin can edit it in the Content-program tab;
 * the edited text is injected into EVERY outline + draft + metadata generation
 * call so the program's writing standard evolves WITHOUT engineering. Exported
 * so the migrate.ts seed + the settings "reset to default" affordance share the
 * single source of truth. Kept verbatim per the task spec.
 */
export const DEFAULT_BLOG_WRITING_INSTRUCTIONS =
  "You are writing on behalf of LP Studio. Write for experienced B2B marketers, demand generation leaders, growth teams, and revenue teams. Your writing should be: Clear and practical. Insightful without being academic. Confident without sounding overly promotional. Structured with strong transitions and logical flow. Grounded in examples, frameworks, and real-world applications. Helpful enough that readers would save or share the article. Avoid: Generic AI phrasing. Excessive hype. Empty buzzwords. Thin sections that restate the heading without adding value. Each section should answer a meaningful question or advance the reader's understanding. Prioritize usefulness over word count. Assume the reader is intelligent, busy, and skeptical. The objective is not simply to publish content. The objective is to publish content that builds trust, demonstrates expertise, and helps readers make better decisions.";

/**
 * Normalise a stored writing-instructions value, falling back to the seeded
 * default when null/empty/whitespace. Pure — used by every prompt builder so a
 * blank settings row still generates against a strong brief.
 */
export function resolveWritingInstructions(stored?: string | null): string {
  const s = String(stored ?? "").trim();
  return s || DEFAULT_BLOG_WRITING_INSTRUCTIONS;
}

/**
 * Render the editorial-instructions block injected into every generation system
 * prompt. Pure. Always present (falls back to the default) so the brief always
 * applies.
 */
export function buildEditorialInstructionsSection(stored?: string | null): string {
  return [
    `EDITORIAL INSTRUCTIONS — the operator's living writing standard (follow these exactly; they are tuned by the team and override generic defaults):`,
    resolveWritingInstructions(stored),
  ].join("\n");
}

// ── LP Studio marketing-blog voice grounding ────────────────────────────────

/**
 * The blog-specific banned-word list. Folds the shared core cliché list
 * (getCoreForbiddenPhrases — "leverage", "seamless", "innovative", etc.)
 * together with the brand's explicit Say/Don't blog bans
 * ("revolutionary / seamless / supercharge"). De-duped, lower-cased.
 */
export function getBlogBannedPhrases(): string[] {
  const brandBans = [
    "revolutionary",
    "revolutionize",
    "seamless",
    "seamlessly",
    "supercharge",
    "supercharged",
    "game-changer",
    "game-changing",
    "next-level",
    "unlock",
    "unleash",
    "elevate",
    "in today's fast-paced world",
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...getCoreForbiddenPhrases(), ...brandBans]) {
    const key = p.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * The system grounding shared by EVERY blog AI call — the LP Studio brand
 * voice + strict-facts rules. Kept as a single source of truth so the metadata
 * and draft endpoints speak in exactly the same voice.
 */
export function buildLpStudioBlogVoicePrompt(): string {
  return [
    `You are the editorial voice of LP Studio — "the AI revenue workspace" (describe a page, watch it build). You write LP Studio's OWN marketing blog, published on lpstudio.ai/blog for SEO + GEO (AI answer engines).`,
    ``,
    `BRAND VOICE — non-negotiable:`,
    `- Confident, plainspoken, allergic to fluff. Write like one expert talking to another across a desk, not a press release.`,
    `- Answer-first (GEO rule): the first two sentences answer the title directly. AI answer engines cite the opening, so put the payoff there.`,
    `- Real mechanics over abstraction. Explain how something actually works — steps, trade-offs, specifics.`,
    `- Parallel triads and short, active sentences. One idea per sentence. Cut any word that can go.`,
    `- Sentence-case headings (capital first letter + proper nouns/acronyms only — never Title Case, never all-lowercase).`,
    `- Horizontal positioning: LP Studio is vertical-agnostic ("the same canvas works for any revenue team"). Vary examples across SaaS, events, agencies, local services — never imply it's a dentistry tool.`,
    ``,
    `RADICALLY HONEST — strict facts (this is a brand pillar AND a trust differentiator):`,
    `- NEVER invent statistics, percentages, dollar figures, study results, customer counts, or quotes. If you don't have a real, given number, write a sentence that doesn't need one.`,
    `- NEVER name or imply fake customers, logos, or testimonials.`,
    `- NEVER fabricate product capabilities. Describe only what's reasonable for an AI page/site builder; keep claims general rather than inventing specifics.`,
    `- When the author supplies facts (notes, keywords), prefer those exact facts over anything generic.`,
    ``,
    `BANNED WORDS — never use, anywhere (headlines, body, metadata):`,
    getBlogBannedPhrases().map((p) => `- "${p}"`).join("\n"),
  ].join("\n");
}

// ── JSON parsing / repair of model output ────────────────────────────────────

/**
 * Strip a ```json … ``` (or bare ```) fence if the model wrapped its JSON,
 * and trim. Pure + exported for unit tests.
 */
export function stripCodeFence(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

/**
 * Best-effort parse + repair of a model's JSON object reply. Tolerates:
 *   - markdown code fences,
 *   - leading/trailing prose around the object (extracts the first {...} span),
 *   - trailing commas before } or ].
 * Returns the parsed object, or null if nothing salvageable. Pure — the single
 * place model JSON is trusted, so it's unit-tested directly.
 */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const fenced = stripCodeFence(raw);
  let v = tryParse(fenced);
  if (v) return v;
  // Extract the first balanced-looking {...} span.
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const span = fenced.slice(start, end + 1);
    v = tryParse(span);
    if (v) return v;
    // Repair trailing commas (… ,} or … ,]).
    const repaired = span.replace(/,(\s*[}\]])/g, "$1");
    v = tryParse(repaired);
    if (v) return v;
  }
  return null;
}

// ── Metadata clamping / slugify ──────────────────────────────────────────────

export const SEO_TITLE_MAX = 60;
export const META_DESCRIPTION_MAX = 155;
const SEO_TITLE_HARD = 70; // absolute persisted ceiling (matches seo-meta-generate)
const META_DESC_HARD = 170;
const EXCERPT_MAX = 320;
const COVER_PROMPT_MAX = 600;

/** Collapse whitespace + trim. */
export function normalizeWhitespace(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Clamp a generated string to a max length WITHOUT cutting a word in half:
 * trims to the limit, then back to the last word boundary (never producing a
 * dangling partial word or trailing hyphen). Pure + unit-tested.
 */
export function clampToLength(value: unknown, max: number): string {
  const s = normalizeWhitespace(value);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // If there's a reasonable word boundary, snap to it; else hard-cut.
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s,;:.\-–—]+$/, "").trim();
}

/**
 * Slugify a generated slug or title to the blog's URL grammar (matches
 * lib/blog.ts slugifyTitle): lowercase, non-alphanumerics → hyphens, trimmed,
 * bounded to 80 chars. Empty/symbol-only input returns "".
 */
export function slugifyGenerated(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export interface BlogMetadata {
  seoTitle: string;
  metaDescription: string;
  slug: string;
  excerpt: string;
  ogTitle: string;
  ogDescription: string;
  coverImagePrompt: string;
}

/** Which metadata fields a generate/improve call should produce. */
export type MetadataField = keyof BlogMetadata;
export const METADATA_FIELDS: MetadataField[] = [
  "seoTitle",
  "metaDescription",
  "slug",
  "excerpt",
  "ogTitle",
  "ogDescription",
  "coverImagePrompt",
];

export function isMetadataField(v: unknown): v is MetadataField {
  return typeof v === "string" && (METADATA_FIELDS as string[]).includes(v);
}

/**
 * Clamp + normalise a raw metadata object from the model into the persisted,
 * length-bounded shape. Missing fields become "". Pure + unit-tested so the
 * SEO-length contract (title ≤70, meta ≤170, slug grammar) is enforced
 * regardless of what the model returns.
 */
export function clampMetadata(raw: Record<string, unknown> | null): BlogMetadata {
  const r = raw ?? {};
  return {
    seoTitle: clampToLength(r.seoTitle, SEO_TITLE_HARD),
    metaDescription: clampToLength(r.metaDescription, META_DESC_HARD),
    slug: slugifyGenerated(r.slug),
    excerpt: clampToLength(r.excerpt, EXCERPT_MAX),
    ogTitle: clampToLength(r.ogTitle ?? r.seoTitle, SEO_TITLE_HARD),
    ogDescription: clampToLength(r.ogDescription ?? r.metaDescription, META_DESC_HARD),
    coverImagePrompt: clampToLength(r.coverImagePrompt, COVER_PROMPT_MAX),
  };
}

/** Pick only the requested fields out of a full metadata object. */
export function pickMetadataFields(meta: BlogMetadata, fields: MetadataField[]): Partial<BlogMetadata> {
  const out: Partial<BlogMetadata> = {};
  for (const f of fields) out[f] = meta[f];
  return out;
}

// ── Prompt assembly ──────────────────────────────────────────────────────────

/**
 * Strip HTML tags to plain text for prompting (the model reasons over prose,
 * not markup) and bound the length so a huge body can't blow the token budget.
 */
export function htmlToPromptText(html: string, maxChars = 6000): string {
  const text = String(html ?? "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

const FIELD_RULES: Record<MetadataField, string> = {
  seoTitle: `seoTitle: ≤ ${SEO_TITLE_MAX} characters, answer-first, reflects THIS post's core payoff. Include the primary keyword early if natural. Sentence case.`,
  metaDescription: `metaDescription: ≤ ${META_DESCRIPTION_MAX} characters. Summarise the post's specific value in the brand voice, lead with the answer, end with a light implicit reason to click. No clickbait.`,
  slug: `slug: 2–6 words, lowercase, hyphen-separated, no stop words ("the", "and", "for"), keyword-rich, derived from THIS post's topic.`,
  excerpt: `excerpt: 1–2 sentences (≤ 300 chars), the card dek — answer-first, scannable, no fluff.`,
  ogTitle: `ogTitle: ≤ ${SEO_TITLE_MAX} chars, the social-share headline. May differ slightly from seoTitle to read well as a shared card. Sentence case.`,
  ogDescription: `ogDescription: ≤ ${META_DESCRIPTION_MAX} chars, the social-share subhead. Concrete, voice-consistent.`,
  coverImagePrompt: `coverImagePrompt: a TEXT PROMPT (1–3 sentences) the author can paste into an image generator or hand to a designer. Describe a warm, real, on-brand visual: cream/ink/indigo palette with a single coral spark accent, generous whitespace, never cool/sterile stock, never rainbow gradients, no text baked into the image. Do NOT return a URL — return a description.`,
};

/**
 * Build the messages for a metadata generate/improve call. When `improve` is
 * true and existing values are supplied, the model is told to sharpen them
 * rather than start from scratch. `fields` scopes the output to the requested
 * subset (individual buttons) or all of them ("generate all").
 */
export function buildMetadataMessages(args: {
  title: string;
  bodyHtml: string;
  targetKeyword?: string;
  fields: MetadataField[];
  improve?: boolean;
  existing?: Partial<BlogMetadata>;
  writingInstructions?: string | null;
}): Array<{ role: "system" | "user"; content: string }> {
  const fields = args.fields.length ? args.fields : METADATA_FIELDS;
  const rules = fields.map((f) => `- ${FIELD_RULES[f]}`).join("\n");
  const jsonShape = `{ ${fields.map((f) => `"${f}": "..."`).join(", ")} }`;

  const system = [
    buildLpStudioBlogVoicePrompt(),
    ``,
    buildEditorialInstructionsSection(args.writingInstructions),
    ``,
    `TASK: ${args.improve ? "IMPROVE the existing" : "Generate"} SEO/social metadata for one blog post, from its title + body${args.targetKeyword ? " + target keyword" : ""}.`,
    `${args.improve ? "Sharpen the existing values without changing their meaning — tighter, more answer-first, within the limits." : "Write each field fresh from the post content."}`,
    ``,
    `FIELD RULES:`,
    rules,
    ``,
    `Return ONLY valid JSON, no prose, no markdown fence: ${jsonShape}`,
  ].join("\n");

  const userParts: string[] = [
    `Post title: ${normalizeWhitespace(args.title) || "(untitled)"}`,
  ];
  if (args.targetKeyword && args.targetKeyword.trim()) {
    userParts.push(`Target keyword(s): ${normalizeWhitespace(args.targetKeyword)}`);
  }
  if (args.improve && args.existing) {
    const existingLines = fields
      .map((f) => {
        const v = args.existing?.[f];
        return v ? `- ${f}: ${v}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (existingLines) userParts.push(`\nCurrent values to improve:\n${existingLines}`);
  }
  userParts.push(`\nPOST BODY (plain text):\n${htmlToPromptText(args.bodyHtml)}`);

  return [
    { role: "system", content: system },
    { role: "user", content: userParts.join("\n") },
  ];
}

// ── Draft generation (outline + full HTML) ───────────────────────────────────

export interface DraftBrief {
  topic: string;
  audience?: string;
  /** Primary SEO keyword. (Historically `targetKeyword`; kept for callers.) */
  targetKeyword?: string;
  notes?: string;
  // ── Blog-specific guidance (threaded into outline + draft so the article
  //    targets the right intent / stage / keywords / CTA). All optional. ──
  /** Comma- or line-separated SECONDARY keywords to work in naturally. */
  secondaryKeywords?: string;
  /** Search intent: e.g. informational / comparison / transactional / navigational. */
  searchIntent?: string;
  /** Funnel stage: e.g. TOFU / MOFU / BOFU (awareness / consideration / decision). */
  funnelStage?: string;
  /** The single desired call-to-action this post should drive toward. */
  desiredCta?: string;
  /** Topic category / content pillar (helps frame the angle + internal linking). */
  topicCategory?: string;
}

export interface OutlineSection {
  h2: string;
  h3?: string[];
}

/**
 * The optional editorial-instructions override threaded through every prompt
 * builder. When omitted, the builders use the seeded default — so generation is
 * always governed by a brief, even before the operator has tuned one.
 */
export interface PromptOptions {
  writingInstructions?: string | null;
}

/**
 * Render the blog-specific guidance lines (primary/secondary keyword, search
 * intent, funnel stage, CTA, topic category, audience, notes) shared by the
 * outline + draft user messages. Pure. Only non-empty fields appear.
 */
export function buildGuidanceLines(brief: DraftBrief): string[] {
  const lines: string[] = [];
  if (brief.audience) lines.push(`Audience: ${normalizeWhitespace(brief.audience)}`);
  if (brief.targetKeyword) lines.push(`Primary keyword: ${normalizeWhitespace(brief.targetKeyword)}`);
  if (brief.secondaryKeywords) lines.push(`Secondary keywords (work in naturally, never stuff): ${normalizeWhitespace(brief.secondaryKeywords)}`);
  if (brief.searchIntent) lines.push(`Search intent: ${normalizeWhitespace(brief.searchIntent)}`);
  if (brief.funnelStage) lines.push(`Funnel stage: ${normalizeWhitespace(brief.funnelStage)}`);
  if (brief.topicCategory) lines.push(`Topic category: ${normalizeWhitespace(brief.topicCategory)}`);
  if (brief.desiredCta) lines.push(`Desired call-to-action (the post should lead here): ${normalizeWhitespace(brief.desiredCta)}`);
  if (brief.notes) lines.push(`Notes / guidance: ${normalizeWhitespace(brief.notes)}`);
  return lines;
}

/** Build messages for the OUTLINE step (H2/H3 structure, shown for review). */
export function buildOutlineMessages(
  brief: DraftBrief,
  opts?: PromptOptions,
): Array<{ role: "system" | "user"; content: string }> {
  const system = [
    buildLpStudioBlogVoicePrompt(),
    ``,
    buildEditorialInstructionsSection(opts?.writingInstructions),
    ``,
    `TASK: Propose a blog post OUTLINE (section structure only — no body copy yet) for a COMPLETE, substantive article — not a thin listicle.`,
    `- 4–7 H2 sections, sentence case, scannable, in a logical answer-first order (the first section delivers the core answer).`,
    `- Each H2 must be a section that can be FULLY developed into multiple substantive paragraphs (a real question to answer, a framework to explain, a decision to inform) — never a heading that would only restate the title.`,
    `- Each H2 may have 0–4 H3 subsections where genuinely useful.`,
    `- Match the SEARCH INTENT and FUNNEL STAGE in the brief: an informational/TOFU piece teaches; a comparison/MOFU piece weighs trade-offs; a decision/BOFU piece drives toward the CTA.`,
    `- Plan a logical place for the desired CTA near the end (do not add a separate "conclusion" section that just summarises).`,
    `- Also propose a working title (sentence case, ≤ ${SEO_TITLE_MAX} chars, answer-first, includes the primary keyword early if natural).`,
    ``,
    `Return ONLY valid JSON, no prose: { "title": "...", "sections": [ { "h2": "...", "h3": ["...", "..."] } ] }`,
  ].join("\n");

  const user = [`Topic: ${normalizeWhitespace(brief.topic)}`, ...buildGuidanceLines(brief)].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export interface ParsedOutline {
  title: string;
  sections: OutlineSection[];
}

/** Parse + clamp a model outline reply into a clean shape. Pure. */
export function parseOutline(raw: string): ParsedOutline {
  const obj = parseJsonObject(raw) ?? {};
  const sectionsRaw = Array.isArray(obj.sections) ? obj.sections : [];
  const sections: OutlineSection[] = [];
  for (const s of sectionsRaw) {
    if (!s || typeof s !== "object") continue;
    const rec = s as Record<string, unknown>;
    const h2 = normalizeWhitespace(rec.h2);
    if (!h2) continue;
    const h3 = Array.isArray(rec.h3)
      ? rec.h3.map((x) => normalizeWhitespace(x)).filter(Boolean).slice(0, 6)
      : undefined;
    sections.push(h3 && h3.length ? { h2, h3 } : { h2 });
    if (sections.length >= 10) break;
  }
  return { title: clampToLength(obj.title, SEO_TITLE_HARD), sections };
}

/**
 * Serialise an (author-edited) outline back to a compact text form the full-
 * draft prompt can consume. Pure.
 */
export function outlineToText(outline: ParsedOutline): string {
  const lines: string[] = [];
  if (outline.title) lines.push(`Title: ${outline.title}`);
  for (const s of outline.sections) {
    lines.push(`H2: ${s.h2}`);
    for (const h3 of s.h3 ?? []) lines.push(`  H3: ${h3}`);
  }
  return lines.join("\n");
}

/** Build messages for the FULL DRAFT step (clean semantic HTML body). */
export function buildDraftMessages(args: {
  brief: DraftBrief;
  outlineText: string;
  opts?: PromptOptions;
}): Array<{ role: "system" | "user"; content: string }> {
  const system = [
    buildLpStudioBlogVoicePrompt(),
    ``,
    buildEditorialInstructionsSection(args.opts?.writingInstructions),
    ``,
    `QUALITY OBJECTIVE — the bar every section must clear: "Would an intelligent, busy, skeptical reader BOOKMARK or SHARE this?" If a passage would not earn a save or a share, it is not done. The objective is not to publish content; it is to publish content that builds trust, demonstrates expertise, and helps the reader make a better decision.`,
    ``,
    `TASK: Write the FULL, COMPLETE blog post body as clean, semantic HTML, following the supplied outline. This is a finished article, NOT an expanded outline.`,
    ``,
    `DEPTH — non-negotiable (this is the difference between an outline and an article):`,
    `- FULLY develop every H2 section before moving on. Each section is multiple substantive paragraphs (aim for ~150–300+ words of real content per H2), not one or two sentences under a heading.`,
    `- Every section must do real work: answer a meaningful question, explain HOW something works step by step, weigh a trade-off, or give a concrete, usable framework or example. Never restate the heading and move on.`,
    `- Include specifics: examples, mini-frameworks, checklists, before/after contrasts, or a worked walkthrough. Show the mechanics, not abstractions.`,
    `- Strong transitions + logical flow between sections — each builds on the last; the reader is carried forward, not dropped into disconnected bullet lists.`,
    `- Target a complete standard guide/how-to of roughly 1,200–2,000 words — but PRIORITIZE USEFULNESS OVER WORD COUNT. Never pad, never repeat, never add filler to hit a number. A tight, dense article beats a bloated one.`,
    `- No thin sections. No heading-restatement. No "in conclusion" paragraph that only summarises — end by helping the reader act.`,
    ``,
    `TARGETING — honour the brief's guidance: write to the AUDIENCE, satisfy the SEARCH INTENT, pitch to the FUNNEL STAGE, work the PRIMARY + SECONDARY keywords in naturally (never keyword-stuff), and build toward the DESIRED CTA.`,
    ``,
    `OUTPUT RULES — the HTML is re-sanitized on render against a strict allowlist, so use ONLY these tags:`,
    `- Structure: <h2>, <h3>, <p>, <ul>/<ol>/<li>, <blockquote>, <table>/<thead>/<tbody>/<tr>/<th>/<td>, <figure>/<figcaption>, <hr>.`,
    `- Inline: <strong>, <em>, <a href="...">, <code>, <br>.`,
    `- Use lists, tables, and blockquotes to make dense content scannable — but only when they carry real content, never as a substitute for developed prose.`,
    `- Do NOT emit <h1> (the page renders the title). Do NOT emit <script>, <style>, inline event handlers, <html>/<head>/<body>, or markdown — HTML only.`,
    `- Answer-first intro: the first <p> answers the title in its first two sentences (AI answer engines cite the opening).`,
    `- Scannable <h2> sections (sentence case), short paragraphs, parallel triads, real mechanics.`,
    `- You MAY include ONE simple inline <svg> infographic if it genuinely aids understanding: brand-colored (cream #F6F2E9 / ink #1A1815 / indigo #4B47E5, a single coral #E26B4F spark), with a viewBox, no scripts, no external refs. Keep it optional — omit it if it would be filler.`,
    `- End with one clear, imperative CTA paragraph driving the desired action (e.g. "Describe a page. Watch it build.") — never stacked CTAs.`,
    `- NEVER use any of the banned words listed above, and avoid generic AI phrasing, empty buzzwords, and hype.`,
    ``,
    `Return ONLY the HTML body. No JSON, no code fence, no commentary before or after.`,
  ].join("\n");

  const user = [
    `Topic: ${normalizeWhitespace(args.brief.topic)}`,
    ...buildGuidanceLines(args.brief),
    ``,
    `OUTLINE to follow (develop EACH section fully):`,
    args.outlineText,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/**
 * Clean a model HTML reply: strip an accidental ```html fence and any leading/
 * trailing prose outside the first real tag. Pure. The caller still runs it
 * through the server sanitizer before persisting.
 */
export function cleanDraftHtml(raw: string): string {
  let s = String(raw ?? "").trim();
  // Strip ```html … ``` fence if present.
  if (/^```/.test(s)) {
    s = s.replace(/^```(?:html)?\s*\n?/i, "").replace(/\n?```$/i, "").trim();
  }
  // Drop a leading <h1> the model may have added despite the rule (the page
  // renders the title itself).
  s = s.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
  return s.trim();
}

// ── HTML validity against the sanitizer allowlist ────────────────────────────

/**
 * Tags the blog sanitizer (lib/blogHtml.ts sanitizeRawBlogHtml /
 * marketing/lib/sanitizeBlogHtml) keeps. Kept in sync here so we can flag, at
 * generation time, any tag the model used that the sanitizer would strip —
 * surfacing it to the author rather than letting content silently disappear.
 */
export const SANITIZER_ALLOWED_TAGS = new Set<string>([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
  "polygon", "text", "tspan", "defs", "lineargradient", "radialgradient",
  "stop", "title", "desc", "use", "symbol", "marker", "clippath", "mask",
  "img", "figure", "figcaption", "br", "span", "div", "a",
  "p", "h1", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "pre", "code",
  "hr", "strong", "em", "b", "i", "u", "s", "mark", "sub", "sup", "small",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "iframe",
]);

/**
 * Inspect generated HTML and report any tags that the sanitizer would strip
 * (i.e. NOT on the allowlist). Pure. Returns the unique disallowed tag names
 * (lower-cased). An empty array means the draft is sanitizer-clean. Used both
 * in tests (HTML-validity assertion) and at runtime (author-facing warning).
 */
export function findDisallowedTags(html: string): string[] {
  const found = new Set<string>();
  const re = /<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(html ?? ""))) !== null) {
    const name = m[1].toLowerCase();
    if (!SANITIZER_ALLOWED_TAGS.has(name)) found.add(name);
  }
  return [...found];
}

// ── Phase 4: topic recommendations ───────────────────────────────────────────

/** A theme the recommender draws from (mirrors blog_content_themes). */
export interface ThemeBrief {
  name: string;
  description?: string;
  priority?: number;
  targetKeywords?: string[];
  audience?: string;
}

/** One AI-recommended topic. */
export interface RecommendedTopic {
  title: string;
  angle: string;
  targetKeyword: string;
  rationale: string;
  /** The theme name this topic belongs to (echoed back for linking). */
  theme?: string;
}

/**
 * Build messages for the topic-RECOMMENDATION step. The model proposes N net-new
 * topics grounded in the active themes + their priorities/keywords/audience,
 * deliberately AVOIDING titles already published (gap analysis). Each topic
 * carries a short rationale for the editor's approve/reject decision.
 */
export function buildTopicRecommendationMessages(args: {
  themes: ThemeBrief[];
  count: number;
  existingTitles?: string[];
}): Array<{ role: "system" | "user"; content: string }> {
  const n = Math.max(1, Math.min(25, Math.round(args.count) || 5));
  const system = [
    buildLpStudioBlogVoicePrompt(),
    ``,
    `TASK: Recommend ${n} NET-NEW blog post topics for LP Studio's marketing blog, grounded in the content themes below.`,
    `- Prefer higher-priority themes; spread across themes rather than clustering on one.`,
    `- Each topic must be answer-first and SEO/GEO-worthy: a real question a revenue team would search.`,
    `- Vary examples across industries (SaaS, events, agencies, local services) — never imply LP Studio is vertical-specific.`,
    `- Do NOT repeat or lightly reword any ALREADY-PUBLISHED title listed below (fill gaps instead).`,
    `- title: sentence case, ≤ ${SEO_TITLE_MAX} chars. angle: one sentence on the take/structure. targetKeyword: the primary search phrase. rationale: one sentence on why it's worth writing now (the editor reads this to approve/reject).`,
    ``,
    `Return ONLY valid JSON, no prose: { "topics": [ { "title": "...", "angle": "...", "targetKeyword": "...", "rationale": "...", "theme": "<one of the theme names>" } ] }`,
  ].join("\n");

  const themeLines = args.themes
    .map((t) => {
      const parts = [
        `- ${normalizeWhitespace(t.name)}`,
        typeof t.priority === "number" ? ` (priority ${t.priority})` : "",
        t.description ? `: ${normalizeWhitespace(t.description)}` : "",
      ];
      const kw = (t.targetKeywords ?? []).map((k) => normalizeWhitespace(k)).filter(Boolean);
      if (kw.length) parts.push(` [keywords: ${kw.join(", ")}]`);
      if (t.audience) parts.push(` [audience: ${normalizeWhitespace(t.audience)}]`);
      return parts.join("");
    })
    .join("\n");

  const titles = (args.existingTitles ?? []).map((x) => normalizeWhitespace(x)).filter(Boolean);
  const user = [
    `THEMES (the strategic guardrails):`,
    themeLines || "- (no themes configured — propose broadly on-brand revenue/marketing topics)",
    ``,
    titles.length
      ? `ALREADY-PUBLISHED TITLES (do not duplicate):\n${titles.map((t) => `- ${t}`).join("\n")}`
      : `ALREADY-PUBLISHED TITLES: (none yet)`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Parse + clamp the recommender's JSON reply into clean topics. Pure. */
export function parseRecommendedTopics(raw: string): RecommendedTopic[] {
  const obj = parseJsonObject(raw) ?? {};
  const list = Array.isArray(obj.topics) ? obj.topics : Array.isArray(obj) ? obj : [];
  const out: RecommendedTopic[] = [];
  const seen = new Set<string>();
  for (const t of list as unknown[]) {
    if (!t || typeof t !== "object") continue;
    const rec = t as Record<string, unknown>;
    const title = clampToLength(rec.title, SEO_TITLE_HARD);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title,
      angle: normalizeWhitespace(rec.angle),
      targetKeyword: normalizeWhitespace(rec.targetKeyword),
      rationale: normalizeWhitespace(rec.rationale),
      theme: normalizeWhitespace(rec.theme) || undefined,
    });
    if (out.length >= 25) break;
  }
  return out;
}

// ── Injectable OpenAI runner type ────────────────────────────────────────────

/** Minimal shape of the OpenAI chat client, so tests can inject a fake. */
export interface ChatClient {
  chat: {
    completions: {
      create: (args: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        max_completion_tokens?: number;
        max_tokens?: number;
        temperature?: number;
      }) => Promise<{ choices?: Array<{ message?: { content?: string | null } }> }>;
    };
  };
}

/** Pull the text content out of a chat completion, or "" if absent. */
export function completionText(
  resp: { choices?: Array<{ message?: { content?: string | null } }> } | null | undefined,
): string {
  return resp?.choices?.[0]?.message?.content?.trim() ?? "";
}
