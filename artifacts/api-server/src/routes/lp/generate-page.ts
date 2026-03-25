import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { lpBrandSettingsTable, lpMediaTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error("AI integration not configured.");
  }
  return new OpenAI({ baseURL, apiKey });
}

interface ProductLine {
  name: string;
  description: string;
  valueProps: string[];
  claims: string[];
  keywords: string[];
}

interface BrandConfig {
  brandName?: string;
  toneOfVoice?: string;
  messagingPillars?: { label: string; description: string }[];
  copyExamples?: string[];
  toneKeywords?: string[];
  avoidPhrases?: string[];
  targetAudience?: string;
  copyInstructions?: string;
  primaryColor?: string;
  accentColor?: string;
  ctaBackground?: string;
  ctaTextColor?: string;
  productLines?: ProductLine[];
}

// ── Media library helpers ────────────────────────────────────────────────

interface MediaImage {
  url: string;
  title: string;
  tags: string[];
}

/** Fetch all images from the media library grouped by tag for AI context */
async function fetchMediaCatalog(): Promise<{ images: MediaImage[]; catalogText: string }> {
  try {
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(eq(lpMediaTable.mediaType, "image"))
      .orderBy(desc(lpMediaTable.createdAt))
      .limit(500);

    const images: MediaImage[] = rows.map(r => ({
      url: r.url,
      title: r.title ?? "",
      tags: (r.tags as string[]) ?? [],
    }));

    if (images.length === 0) return { images, catalogText: "" };

    // Group by primary tag and pick representative images per tag
    const tagGroups = new Map<string, MediaImage[]>();
    for (const img of images) {
      for (const tag of img.tags) {
        const lowerTag = tag.toLowerCase();
        // Skip generic tags
        if (["untitled folder", "web res", "high res", "abstract", "modern", "professional", "hat", "holographic hat", "green glow", "futuristic", "digital art"].includes(lowerTag)) continue;
        if (!tagGroups.has(lowerTag)) tagGroups.set(lowerTag, []);
        tagGroups.get(lowerTag)!.push(img);
      }
    }

    // Build a concise catalog — up to 3 representative URLs per tag
    const lines: string[] = [];
    for (const [tag, imgs] of [...tagGroups.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const samples = imgs.slice(0, 3).map(i => i.url);
      lines.push(`  "${tag}" (${imgs.length} images): ${samples.join(" , ")}`);
    }

    const catalogText = lines.length > 0
      ? `\nIMAGE LIBRARY — Use these real image URLs in imageUrl, image, and src props:\n${lines.join("\n")}\n`
      : "";

    return { images, catalogText };
  } catch {
    return { images: [], catalogText: "" };
  }
}

/** Find the best matching image from the library for a given context string */
function findBestImage(context: string, images: MediaImage[], usedUrls: Set<string>): string {
  if (images.length === 0) return "";
  const contextLower = context.toLowerCase();
  const contextWords = contextLower.split(/\s+/);

  // Score each image by how many of its tags appear in the context
  let best: MediaImage | null = null;
  let bestScore = 0;

  for (const img of images) {
    if (usedUrls.has(img.url)) continue; // avoid duplicates
    let score = 0;
    for (const tag of img.tags) {
      const tagLower = tag.toLowerCase();
      // Skip generic tags
      if (["untitled folder", "web res", "high res", "abstract", "modern", "professional"].includes(tagLower)) continue;
      if (contextLower.includes(tagLower)) score += 3;
      // Partial word matches
      for (const word of tagLower.split(/\s+/)) {
        if (word.length > 3 && contextWords.some(w => w.includes(word) || word.includes(w))) score += 1;
      }
    }
    // Title match
    const titleLower = (img.title ?? "").toLowerCase();
    if (titleLower && contextWords.some(w => w.length > 3 && titleLower.includes(w))) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }

  if (best && bestScore > 0) {
    usedUrls.add(best.url);
    return best.url;
  }
  return "";
}

/** Post-process blocks to fill in empty image URLs from the media library */
function fillEmptyImages(blocks: unknown[], images: MediaImage[]): unknown[] {
  if (images.length === 0) return blocks;
  const usedUrls = new Set<string>();

  // First pass: collect already-used URLs
  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    const props = b.props as Record<string, unknown> | undefined;
    if (!props) continue;
    if (typeof props.imageUrl === "string" && props.imageUrl) usedUrls.add(props.imageUrl);
    if (Array.isArray(props.images)) {
      for (const img of props.images) {
        const i = img as Record<string, unknown>;
        if (typeof i.src === "string" && i.src) usedUrls.add(i.src);
      }
    }
    if (Array.isArray(props.rows)) {
      for (const row of props.rows) {
        const r = row as Record<string, unknown>;
        if (typeof r.imageUrl === "string" && r.imageUrl) usedUrls.add(r.imageUrl);
      }
    }
    if (Array.isArray(props.items)) {
      for (const item of props.items) {
        const it = item as Record<string, unknown>;
        if (typeof it.image === "string" && it.image) usedUrls.add(it.image);
      }
    }
  }

  // Second pass: fill empty URLs
  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown>) };
    const blockType = b.type as string;
    const headline = (props.headline as string) ?? "";
    const subheadline = (props.subheadline as string) ?? "";
    const blockContext = `${blockType} ${headline} ${subheadline}`;

    // Hero / product-showcase imageUrl
    if (("imageUrl" in props) && !props.imageUrl) {
      props.imageUrl = findBestImage(blockContext, images, usedUrls);
    }

    // zigzag-features rows
    if (Array.isArray(props.rows)) {
      props.rows = (props.rows as Record<string, unknown>[]).map((row) => {
        if (!row.imageUrl) {
          const rowContext = `${row.tag ?? ""} ${row.headline ?? ""} ${row.body ?? ""}`;
          return { ...row, imageUrl: findBestImage(rowContext, images, usedUrls) };
        }
        return row;
      });
    }

    // photo-strip images
    if (blockType === "photo-strip" && Array.isArray(props.images)) {
      props.images = (props.images as Record<string, unknown>[]).map((img) => {
        if (!img.src) {
          const alt = (img.alt as string) ?? blockContext;
          return { ...img, src: findBestImage(alt, images, usedUrls) };
        }
        return img;
      });
    }

    // product-grid items
    if (Array.isArray(props.items)) {
      props.items = (props.items as Record<string, unknown>[]).map((item) => {
        if ("image" in item && !item.image) {
          const itemContext = `${item.title ?? ""} ${item.description ?? ""}`;
          return { ...item, image: findBestImage(itemContext, images, usedUrls) };
        }
        return item;
      });
    }

    b.props = props;
    return b;
  });
}

async function fetchBrand(): Promise<BrandConfig> {
  try {
    const rows = await db.select().from(lpBrandSettingsTable).limit(1);
    if (rows.length === 0) return {};
    return (rows[0].config as BrandConfig) ?? {};
  } catch {
    return {};
  }
}

function buildBrandContext(brand: BrandConfig): string {
  const parts: string[] = [];
  if (brand.brandName) parts.push(`Brand: ${brand.brandName}`);
  if (brand.toneOfVoice) parts.push(`Tone: ${brand.toneOfVoice}`);
  const ctaHex = brand.ctaBackground || brand.accentColor || brand.primaryColor;
  if (ctaHex) parts.push(`CTA button color: "${ctaHex}" — use this exact hex for ALL ctaColor props`);
  if (brand.messagingPillars?.length) {
    parts.push(`Key themes: ${brand.messagingPillars.map(p => `${p.label} (${p.description})`).join("; ")}`);
  }
  if (brand.toneKeywords?.length) parts.push(`Style: ${brand.toneKeywords.join(", ")}`);
  if (brand.avoidPhrases?.length) parts.push(`Never say: ${brand.avoidPhrases.join(", ")}`);
  if (brand.targetAudience) parts.push(`Audience: ${brand.targetAudience}`);
  if (brand.copyExamples?.length) parts.push(`Example headlines: ${brand.copyExamples.join(" | ")}`);
  if (brand.copyInstructions?.trim()) parts.push(brand.copyInstructions.trim());
  if (brand.productLines?.length) {
    const productInfo = brand.productLines
      .filter((p) => p.name)
      .map((p) => {
        const bits = [`- ${p.name}`];
        if (p.description) bits.push(`  ${p.description}`);
        if (p.valueProps?.length) bits.push(`  Value props: ${p.valueProps.join(", ")}`);
        if (p.claims?.length) bits.push(`  Claims: ${p.claims.join(", ")}`);
        if (p.keywords?.length) bits.push(`  Keywords: ${p.keywords.join(", ")}`);
        return bits.join("\n");
      }).join("\n");
    parts.push(`Product lines:\n${productInfo}\nUse these product details to make copy specific and credible.`);
  }
  return parts.join("\n");
}

const SYSTEM_PROMPT = `You are an expert landing page architect. You generate complete, high-converting landing page structures as JSON.

AVAILABLE BLOCK TYPES (use these exact type strings):
- "hero": Main hero section. Props: headline (string), subheadline (string), ctaText (string), ctaUrl (string, default "#"), ctaColor (string, hex), heroType ("static-image"|"none"), layout ("centered"|"split"|"minimal"), backgroundStyle ("white"|"dark"), showSocialProof (boolean), socialProofText (string), imageUrl (string), mediaUrl (string)
- "trust-bar": Stat bar with metrics. Props: items (array of {value, label}), countUpEnabled (boolean, default true)
- "pas-section": Problem-Agitate-Solve. Props: headline (string), body (string), bullets (string[])
- "comparison": Old way vs new way. Props: headline (string), ctaText (string), ctaUrl ("#"), oldWayLabel (string), oldWayBullets (string[]), newWayLabel (string), newWayBullets (string[])
- "stat-callout": Single big stat. Props: stat (string), description (string), footnote (string), countUpEnabled (boolean, default true)
- "benefits-grid": Feature/benefit cards. Props: headline (string), columns (2|3), items (array of {icon, title, description}). Available icons: "Zap","ScanLine","RefreshCcw","HeadphonesIcon","BarChart2","DollarSign","Shield","Clock","Star","Check","Target","TrendingUp","Award","Heart","Users","Globe","Lock","Sparkles"
- "testimonial": Customer quote. Props: quote (string), author (string), role (string), practiceName (string)
- "how-it-works": Numbered steps. Props: headline (string), steps (array of {number: "01"|"02"|etc, title, description})
- "product-grid": Product/service cards. Props: headline (string), subheadline (string), items (array of {image, title, description})
- "bottom-cta": Final call to action. Props: headline (string), subheadline (string), ctaText (string), ctaUrl ("#")
- "form": Lead capture form. Props: headline (string), subheadline (string), multiStep (boolean), steps (array of {title, fields: [{id, type, label, placeholder, required, options?}]}), submitButtonText (string), successMessage (string), redirectUrl (string), backgroundStyle ("white"|"light-gray"|"dark")
- "video-section": Video embed. Props: layout ("full-width"|"split-left"|"split-right"), headline (string), subheadline (string), ctaText (string), ctaUrl ("#"), videoUrl (string), aspectRatio ("16/9"), backgroundStyle ("white"|"dark")
- "zigzag-features": Alternating image/text rows. Props: rows (array of {tag, headline, body, ctaText, ctaUrl, imageUrl})
- "photo-strip": Scrolling image gallery. Props: images (array of {src, alt})

RULES:
1. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.
2. The JSON must have: { "title": string, "slug": string, "blocks": [...] }
3. Each block must have: { "id": string (unique, format "block-TYPE-INDEX"), "type": string, "props": {...} }
4. Generate 5-10 blocks per page. Always start with a "hero" block and end with a "bottom-cta" block.
5. All copy must be specific, punchy, and conversion-focused — never use placeholder or lorem ipsum text.
6. Make the copy match the prompt's topic, industry, and audience.
7. For form blocks, create realistic fields with proper types (email, phone, text, select, textarea).
8. The slug should be a URL-friendly version of the topic (lowercase, hyphens, no special chars).
9. IMAGES: If an IMAGE LIBRARY section is provided, use the real image URLs from it for hero imageUrl, zigzag-features imageUrl, photo-strip src, and product-grid image props. Match images to content by choosing URLs from the most relevant tag category (e.g. use "crown & bridge" images for crown content, "full dentures" images for denture content, "doctors & staff" for people shots). Use heroType "static-image" when you have a hero image. If no library is provided or no relevant images exist, use empty string "".
10. IMPORTANT: If the brand context includes a CTA button color, use that EXACT hex value for every ctaColor prop. Never invent random colors for buttons.
11. Always include at least one image-bearing block type (hero with image, zigzag-features, photo-strip, or product-grid) to make pages visually rich.`;

router.post("/lp/generate-page", async (req, res): Promise<void> => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  let openai: OpenAI;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    res.status(503).json({ error: String(e) });
    return;
  }

  const [brand, mediaCatalog] = await Promise.all([fetchBrand(), fetchMediaCatalog()]);
  const brandContext = buildBrandContext(brand);

  let userPromptParts: string[] = [];
  if (brandContext) userPromptParts.push(`BRAND CONTEXT:\n${brandContext}`);
  if (mediaCatalog.catalogText) userPromptParts.push(mediaCatalog.catalogText);
  userPromptParts.push(`USER REQUEST:\n${prompt.trim()}`);
  userPromptParts.push("Generate a complete landing page for this request. Use the brand context to inform tone, audience, and messaging. Use real image URLs from the image library where relevant.");

  const userPrompt = userPromptParts.join("\n\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";

    let parsed: { title?: string; slug?: string; blocks?: unknown[] };
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!parsed.title || !parsed.slug || !Array.isArray(parsed.blocks)) {
      res.status(500).json({ error: "AI response missing required fields (title, slug, blocks)" });
      return;
    }

    // Sanitize slug
    parsed.slug = parsed.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Force brand CTA color onto all blocks (safety net)
    const brandCtaColor = brand.ctaBackground || brand.accentColor || brand.primaryColor;

    parsed.blocks = parsed.blocks.map((block: unknown, i: number) => {
      const b = block as Record<string, unknown>;
      if (!b.id) b.id = `block-${b.type ?? "unknown"}-${i}`;

      // Inject brand CTA color into any block that has a ctaColor prop
      if (brandCtaColor && b.props && typeof b.props === "object") {
        const props = b.props as Record<string, unknown>;
        if ("ctaColor" in props || b.type === "hero") {
          props.ctaColor = brandCtaColor;
        }
      }
      return b;
    });

    // Fill in any remaining empty image URLs from the media library
    parsed.blocks = fillEmptyImages(parsed.blocks, mediaCatalog.images);

    res.json({
      title: parsed.title,
      slug: parsed.slug,
      blocks: parsed.blocks,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
