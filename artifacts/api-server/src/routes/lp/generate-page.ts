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

const PURPOSE_TAGS = ["lp-hero", "lp-feature", "product-detail"] as const;
const SKIP_TAGS = new Set(["untitled folder", "web res", "high res", "abstract", "modern", "professional", "hat", "holographic hat", "green glow", "futuristic", "digital art", "lp-hero", "lp-feature", "product-detail"]);

/** Get the landing-page purpose of an image (first purpose tag found, or "" for unclassified) */
function getImagePurpose(img: MediaImage): string {
  for (const t of img.tags) {
    if (PURPOSE_TAGS.includes(t as typeof PURPOSE_TAGS[number])) return t;
  }
  return "";
}

/** Fetch all images from the media library, separated by purpose for AI context */
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

    // Separate into purpose buckets
    const heroImages = images.filter(i => getImagePurpose(i) === "lp-hero");
    const featureImages = images.filter(i => getImagePurpose(i) === "lp-feature");
    const detailImages = images.filter(i => getImagePurpose(i) === "product-detail");
    const unclassified = images.filter(i => getImagePurpose(i) === "");

    const buildSection = (imgs: MediaImage[], label: string): string => {
      const tagGroups = new Map<string, MediaImage[]>();
      for (const img of imgs) {
        for (const tag of img.tags) {
          const t = tag.toLowerCase();
          if (SKIP_TAGS.has(t)) continue;
          if (!tagGroups.has(t)) tagGroups.set(t, []);
          tagGroups.get(t)!.push(img);
        }
      }
      if (tagGroups.size === 0 && imgs.length > 0) {
        // No content tags — just list raw URLs
        const samples = imgs.slice(0, 6).map(i => i.url);
        return `[${label}]\n  (untagged, ${imgs.length} images): ${samples.join(" , ")}`;
      }
      if (tagGroups.size === 0) return "";
      const lines = [...tagGroups.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([tag, grpImgs]) => `  "${tag}" (${grpImgs.length}): ${grpImgs.slice(0, 3).map(i => i.url).join(" , ")}`);
      return `[${label}]\n${lines.join("\n")}`;
    };

    const sections: string[] = [];
    const heroSection = buildSection(heroImages, "HERO & LIFESTYLE — use these for hero imageUrl; lifestyle, people, clinic, results");
    const featureSection = buildSection(featureImages, "FEATURE IMAGES — use these for zigzag-features rows and photo-strip");
    const detailSection = buildSection(detailImages, "PRODUCT DETAIL — use ONLY for product-grid items, never for hero");
    const unclassifiedSection = buildSection(unclassified, "OTHER — unclassified images, use judiciously");
    if (heroSection) sections.push(heroSection);
    if (featureSection) sections.push(featureSection);
    if (detailSection) sections.push(detailSection);
    if (unclassifiedSection) sections.push(unclassifiedSection);

    const catalogText = sections.length > 0
      ? `\nIMAGE LIBRARY — Pick URLs from the correct section for each block type:\n${sections.join("\n\n")}\n`
      : "";

    return { images, catalogText };
  } catch {
    return { images: [], catalogText: "" };
  }
}

/**
 * Find the best matching image for a given context string.
 * preferredPurpose: "lp-hero" | "lp-feature" | "product-detail" | undefined
 *   — images matching the preferred purpose get a large score boost
 *   — images explicitly mismatched (e.g. product-detail requested for hero) get penalised
 */
function findBestImage(
  context: string,
  images: MediaImage[],
  usedUrls: Set<string>,
  preferredPurpose?: string,
): string {
  if (images.length === 0) return "";
  const contextLower = context.toLowerCase();
  const contextWords = contextLower.split(/\s+/);

  let best: MediaImage | null = null;
  let bestScore = -Infinity;

  for (const img of images) {
    if (usedUrls.has(img.url)) continue;
    let score = 0;

    const imgPurpose = getImagePurpose(img);

    // Purpose scoring
    if (preferredPurpose) {
      if (imgPurpose === preferredPurpose) {
        score += 8; // strong boost for matching purpose
      } else if (imgPurpose !== "" && imgPurpose !== preferredPurpose) {
        // penalise mismatches — especially keep product-detail out of hero slots
        if (preferredPurpose === "lp-hero" && imgPurpose === "product-detail") score -= 10;
        else if (preferredPurpose === "lp-feature" && imgPurpose === "product-detail") score -= 4;
        else score -= 2;
      }
      // unclassified images (imgPurpose === "") are neutral — no bonus, no penalty
    }

    // Content tag matching
    for (const tag of img.tags) {
      const tagLower = tag.toLowerCase();
      if (SKIP_TAGS.has(tagLower)) continue;
      if (contextLower.includes(tagLower)) score += 3;
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

  // Only use images with a non-negative score (avoids forcing a product-detail into hero)
  if (best && bestScore >= 0) {
    usedUrls.add(best.url);
    return best.url;
  }
  return "";
}

/** Post-process blocks to fill in empty image URLs from the media library.
 *  Each block type requests images with the appropriate landing-page purpose:
 *    hero           → "lp-hero"   (lifestyle, people, clinic shots)
 *    zigzag-features → "lp-feature" (clean product/procedure angles)
 *    photo-strip    → "lp-feature"
 *    product-grid   → "product-detail" (close-ups OK here)
 */
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

  // Second pass: fill empty URLs with purpose-aware selection
  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown>) };
    const blockType = b.type as string;
    const headline = (props.headline as string) ?? "";
    const subheadline = (props.subheadline as string) ?? "";
    const blockContext = `${blockType} ${headline} ${subheadline}`;

    // Hero imageUrl → prefer lifestyle/people shots
    if (blockType === "hero" && "imageUrl" in props && !props.imageUrl) {
      props.imageUrl = findBestImage(blockContext, images, usedUrls, "lp-hero");
    } else if ("imageUrl" in props && !props.imageUrl) {
      // Other blocks with imageUrl (e.g. product-showcase) → feature images
      props.imageUrl = findBestImage(blockContext, images, usedUrls, "lp-feature");
    }

    // zigzag-features rows → feature images
    if (Array.isArray(props.rows)) {
      props.rows = (props.rows as Record<string, unknown>[]).map((row) => {
        if (!row.imageUrl) {
          const rowContext = `${row.tag ?? ""} ${row.headline ?? ""} ${row.body ?? ""}`;
          return { ...row, imageUrl: findBestImage(rowContext, images, usedUrls, "lp-feature") };
        }
        return row;
      });
    }

    // photo-strip → feature images (lifestyle/environment variety)
    if (blockType === "photo-strip" && Array.isArray(props.images)) {
      props.images = (props.images as Record<string, unknown>[]).map((img) => {
        if (!img.src) {
          const alt = (img.alt as string) ?? blockContext;
          return { ...img, src: findBestImage(alt, images, usedUrls, "lp-feature") };
        }
        return img;
      });
    }

    // product-grid items → product-detail is fine here
    if (Array.isArray(props.items)) {
      props.items = (props.items as Record<string, unknown>[]).map((item) => {
        if ("image" in item && !item.image) {
          const itemContext = `${item.title ?? ""} ${item.description ?? ""}`;
          return { ...item, image: findBestImage(itemContext, images, usedUrls, "product-detail") };
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
9. IMAGES: The IMAGE LIBRARY is divided into sections — you MUST follow these rules strictly:
   - hero imageUrl → use ONLY images from the "HERO & LIFESTYLE" section (lifestyle, people, clinic, results shots). NEVER use product-detail or close-up images in a hero.
   - zigzag-features imageUrl and photo-strip src → use images from "FEATURE IMAGES" section. "HERO & LIFESTYLE" is also acceptable here.
   - product-grid image → use images from "PRODUCT DETAIL" section. "FEATURE IMAGES" is also acceptable.
   - Match images to the specific content topic (e.g. crown images for crown content, team photos for people-focused sections).
   - Set heroType "static-image" when you assign a hero imageUrl. If no suitable image exists for a slot, use empty string "".
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
