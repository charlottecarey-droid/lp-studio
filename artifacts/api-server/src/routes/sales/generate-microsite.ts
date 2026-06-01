import { Router } from "express";
import { eq, desc, and, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesAccountsTable, salesBriefingsTable, salesContactsTable, salesContactBriefingsTable, lpPagesTable, lpBrandSettingsTable, lpMediaTable } from "@workspace/db";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";
import { pickExemplars, formatExemplarsSection, parseCustomExemplars } from "./microsite-exemplars";
import { getSalesBrandContext, type SalesBrandContext } from "../../lib/salesBrandContext";
// Image pipeline shared with the marketing generator so the sales path stays
// at parity: tenant-scoped media fetch, untagged-image surfacing, broad
// empty-slot backfill, and AI/Unsplash fallback gated per tenant.
import {
  fetchMediaCatalog,
  sanitizeAIImageUrls,
  validateAndDedupeAIImages,
  fillEmptyImages,
  aiFillEmptyImages,
} from "../lp/generate-page";
import { getTenantIndustry, getIndustryImageKeywords } from "../../lib/tenantIndustry";
import { getAiImageGenOutsideBuilderEnabled, getAiImageGenStatus } from "../../lib/tenantSettings";

const router = Router();

// Rate limit AI microsite generation: 5 per IP per minute (expensive operation).
const micrositeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many generation requests. Please wait before generating another microsite." },
});

// ── Media library utilities ────────────────────────────────────────────────

// NOTE: image catalog + fill helpers (fetchMediaCatalog, sanitizeAIImageUrls,
// validateAndDedupeAIImages, fillEmptyImages, aiFillEmptyImages) are imported
// from the marketing generator above so both paths stay at parity. The sales
// path keeps only its bespoke VIDEO catalog/fill below.

async function fetchVideoCatalog(tenantId: number | null): Promise<{ videoUrls: string[]; catalogText: string }> {
  // Tenant isolation: never surface another tenant's videos. Fail closed on a
  // missing tenantId so the generator ships empty rather than cross-tenant.
  if (tenantId == null) return { videoUrls: [], catalogText: "" };
  try {
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title })
      .from(lpMediaTable)
      .where(and(eq(lpMediaTable.mediaType, "video"), eq(lpMediaTable.tenantId, tenantId)))
      .orderBy(desc(lpMediaTable.createdAt))
      .limit(20);
    if (rows.length === 0) return { videoUrls: [], catalogText: "" };
    const videoUrls = rows.map(r => r.url);
    const catalogText = `\nVIDEO LIBRARY — ONLY use these URLs for any videoUrl / mediaUrl field:\n${videoUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n`;
    return { videoUrls, catalogText };
  } catch {
    return { videoUrls: [], catalogText: "" };
  }
}

/** Replace invented / missing video URLs with real media library videos. */
function fillEmptyVideos(blocks: unknown[], videoUrls: string[]): unknown[] {
  if (videoUrls.length === 0) return blocks;
  let vi = 0;
  const isInvented = (url: string) => !!url && !url.startsWith("/api/storage/");
  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown>) };
    for (const field of ["videoUrl", "mediaUrl"] as const) {
      if (field in props) {
        const val = props[field] as string;
        if (!val || isInvented(val)) {
          props[field] = videoUrls[vi % videoUrls.length];
          vi++;
        }
      }
    }
    b.props = props;
    return b;
  });
}

interface CtaOverride {
  mode: "url" | "chilipiper";
  url: string;
}

/** Force brand CTA color, Chili Piper URL, and default CTA URL into every block that needs them. */
function injectBrandIntoBlocks(blocks: unknown[], brand: Record<string, unknown>, ctaOverride?: CtaOverride): unknown[] {
  const ctaColor = (brand.ctaBackground as string) || (brand.accentColor as string) || (brand.primaryColor as string);

  // If ctaOverride is present it is authoritative — replace CTA on all relevant blocks unconditionally.
  // Without an override, fall back to brand-level config (only fill empty/# slots).
  const overrideUrl = ctaOverride?.url;
  const overrideMode = ctaOverride?.mode;
  const isChilipiperOverride = overrideMode === "chilipiper";

  const brandChilipiperUrl = brand.chilipiperUrl as string | undefined;
  const brandDefaultCtaUrl = brand.defaultCtaUrl as string | undefined;

  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown>) };
    if (ctaColor && "ctaColor" in props) props.ctaColor = ctaColor;

    if (overrideUrl) {
      // ctaOverride is authoritative: replace all CTA URL fields on every block that has them
      if ("primaryCtaUrl" in props) {
        props.primaryCtaUrl = overrideUrl;
        props.primaryCtaMode = isChilipiperOverride ? "chilipiper" : "link";
      }
      if ("ctaUrl" in props) {
        props.ctaUrl = overrideUrl;
        props.ctaMode = isChilipiperOverride ? "chilipiper" : "link";
      }
      if ("secondaryCtaUrl" in props) {
        props.secondaryCtaUrl = overrideUrl;
      }
    } else {
      // No override: use brand defaults, but only fill empty / "#" slots
      if (brandChilipiperUrl && typeof b.type === "string" && b.type.startsWith("dso-")) {
        if ("primaryCtaUrl" in props && (!props.primaryCtaUrl || props.primaryCtaUrl === "#")) {
          props.primaryCtaUrl = brandChilipiperUrl;
          props.primaryCtaMode = "chilipiper";
        }
        if ("ctaUrl" in props && (!props.ctaUrl || props.ctaUrl === "#")) {
          props.ctaUrl = brandChilipiperUrl;
          props.ctaMode = "chilipiper";
        }
      }
      if (brandDefaultCtaUrl) {
        if ("primaryCtaUrl" in props && (!props.primaryCtaUrl || props.primaryCtaUrl === "#")) {
          props.primaryCtaUrl = brandDefaultCtaUrl;
        }
        if ("ctaUrl" in props && (!props.ctaUrl || props.ctaUrl === "#")) {
          props.ctaUrl = brandDefaultCtaUrl;
        }
        if ("secondaryCtaUrl" in props && (!props.secondaryCtaUrl || props.secondaryCtaUrl === "#")) {
          props.secondaryCtaUrl = brandDefaultCtaUrl;
        }
      }
    }

    b.props = props;
    return b;
  });
}

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

type AiBlock = Record<string, unknown>;

// ── Compound business-case template personalisation ───────────────────────
// The business-case-* blocks are single, richly-structured "monograph" pages
// the AI can't reliably reproduce field-by-field. For these we deep-merge the
// AI's personalised copy OVER the authored template props (the complete,
// on-brand base) so every field stays present, then substitute the
// {{company_name}} / {{practice_count}} placeholders with real account data.
function isBusinessCaseType(type: unknown): boolean {
  return typeof type === "string" && type.startsWith("business-case");
}

// Deep-merge preferring AI values but ALWAYS shape-preserving: the authored
// base defines the complete, on-brand structure, and the renderer must never
// see a missing field or a wrong-typed value. Rules:
//   - Arrays: keep the AUTHORED length and merge AI items element-wise over the
//     authored items; authored items past the AI array's length are preserved.
//     An empty/absent or wrong-typed AI value keeps the authored array.
//   - Objects: merge AI keys over the authored object; a wrong-typed AI value
//     (primitive/array) keeps the authored object.
//   - Scalars: prefer the AI scalar; a blank string, null/undefined, or a
//     wrong-typed (object/array) AI value keeps the authored scalar.
function mergeAuthored(base: unknown, ai: unknown): unknown {
  if (Array.isArray(base)) {
    if (!Array.isArray(ai) || ai.length === 0) return base;
    return base.map((item, i) => (i < ai.length ? mergeAuthored(item, ai[i]) : item));
  }
  if (base && typeof base === "object") {
    if (!ai || typeof ai !== "object" || Array.isArray(ai)) return base;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const k of Object.keys(ai as Record<string, unknown>)) {
      out[k] = mergeAuthored((base as Record<string, unknown>)[k], (ai as Record<string, unknown>)[k]);
    }
    return out;
  }
  // base is a scalar (or null/undefined)
  if (typeof ai === "string") return ai.trim() === "" ? base : ai;
  if (typeof ai === "number" || typeof ai === "boolean") return ai;
  return base;
}

// Replace {{company_name}} / {{practice_count}} everywhere (safety net for any
// field the AI left as the authored placeholder), then collapse double spaces.
function substituteAccountVars(value: unknown, companyName: string, practiceCount: string): unknown {
  if (typeof value === "string") {
    return value
      .replace(/\{\{\s*company_name\s*\}\}/g, companyName)
      .replace(/\{\{\s*practice_count\s*\}\}/g, practiceCount)
      .replace(/ {2,}/g, " ");
  }
  if (Array.isArray(value)) return value.map(v => substituteAccountVars(v, companyName, practiceCount));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteAccountVars(v, companyName, practiceCount);
    }
    return out;
  }
  return value;
}

// Image-bearing prop names to restore from the template block at each position.
const SCALAR_IMAGE_PROPS = ["imageUrl", "backgroundImageUrl", "heroImageUrl", "mediaUrl"] as const;
// Array fields + the image key within each element
const ARRAY_IMAGE_SPECS = [
  { field: "rows",     imgKey: "imageUrl" },
  { field: "items",    imgKey: "image" },
  { field: "chapters", imgKey: "imageUrl" },
  { field: "tiles",    imgKey: "imageUrl" },
  { field: "cases",    imgKey: "image" },
  { field: "images",   imgKey: "src" },
] as const;

/**
 * After AI generation, restore image props from the original template blocks.
 * The AI updates all copy but keeps the same block positions — so we zip by
 * position and copy any non-empty image URL from the template into the
 * AI-generated block, preventing the AI from inventing (or badly picking)
 * images when a perfectly good one already exists in the template.
 */
function restoreTemplateImages(generatedBlocks: AiBlock[], tmplBlocks: AiBlock[]): AiBlock[] {
  return generatedBlocks.map((block, i) => {
    const tmpl = tmplBlocks[i];
    if (!tmpl) return block;
    const tp = (tmpl.props ?? {}) as Record<string, unknown>;
    const gp = { ...((block.props ?? {}) as Record<string, unknown>) };

    // Restore scalar image props
    for (const f of SCALAR_IMAGE_PROPS) {
      if (typeof tp[f] === "string" && tp[f]) gp[f] = tp[f];
    }

    // Restore per-element image props inside arrays
    for (const { field, imgKey } of ARRAY_IMAGE_SPECS) {
      if (Array.isArray(tp[field]) && Array.isArray(gp[field])) {
        const tmplArr = tp[field] as Record<string, unknown>[];
        gp[field] = (gp[field] as Record<string, unknown>[]).map((item, j) => {
          const tmplItem = tmplArr[j];
          if (tmplItem && typeof tmplItem[imgKey] === "string" && tmplItem[imgKey]) {
            return { ...item, [imgKey]: tmplItem[imgKey] };
          }
          return item;
        });
      }
    }

    return { ...block, props: gp };
  });
}

interface FallbackBrand {
  /** Display name used in fallback copy. Empty = "us". */
  name: string;
  /** Tagline (first non-empty brand.taglines entry). Empty = none. */
  tagline: string;
  /**
   * Resolved value-prop pairs from the tenant's brand context. Used as
   * brand-aware fallback content for items lists (benefits-grid,
   * trust-bar) when the AI returns an empty list. Falls back to []
   * when neither salesConsole nor brand config provides any.
   */
  valuePropPairs: { theme: string; proof: string }[];
}

function normalizeBlock(raw: AiBlock, index: number, brand: FallbackBrand): AiBlock {
  const type = (raw.type as string) ?? "hero";
  if (raw.props && typeof raw.props === "object") {
    return {
      id: raw.id ?? `${type}-${index}`,
      type,
      props: mergeWithDefaults(type, raw.props as AiBlock, brand),
    };
  }
  const { type: _t, id: _id, ...rest } = raw;
  return {
    id: `${type}-${index}`,
    type,
    props: mergeWithDefaults(type, rest, brand),
  };
}

function mergeWithDefaults(type: string, p: AiBlock, brand: FallbackBrand): AiBlock {
  // `brand` is the tenant's resolved brand context. All fallback copy
  // here fires when the AI omits a field (rare error paths). Every
  // string must stay brand-neutral — never literal "Dandy" or
  // dental-industry-specific copy that would leak into another tenant.
  const us = brand.name || "us";
  const tagline = brand.tagline || "";
  switch (type) {
    // ── Standard practice blocks ────────────────────────────────────
    case "hero":
      return {
        headline: p.headline ?? p.heading ?? `See what ${us} can do for you`,
        subheadline: p.subheadline ?? p.subheading ?? p.subtitle ?? tagline,
        ctaText: p.ctaText ?? "Get started",
        ctaUrl: p.ctaUrl ?? "#",
        ctaColor: p.ctaColor,
        ctaTextColor: p.ctaTextColor,
        heroType: p.heroType ?? "static-image",
        layout: p.layout ?? "centered",
        backgroundStyle: p.backgroundStyle ?? "dark",
        showSocialProof: p.showSocialProof ?? false,
        socialProofText: p.socialProofText ?? "",
        imageUrl: p.imageUrl ?? "",
        mediaUrl: p.mediaUrl ?? "",
      };

    case "benefits-grid":
    case "features": {
      const items = (p.items ?? p.features ?? p.benefits ?? []) as AiBlock[];
      // When AI omits items, fall back to the tenant's brand-config
      // value props (themes + proof) so non-Dandy tenants see
      // brand-aware content instead of an empty section.
      const fromBrand = brand.valuePropPairs
        .filter(v => v.theme.trim().length > 0)
        .slice(0, 6)
        .map(v => ({ icon: "Zap", title: v.theme, description: v.proof }));
      return {
        headline: p.headline ?? p.heading ?? (brand.name ? `Why teams choose ${us}` : "Why teams choose us"),
        columns: p.columns ?? 3,
        items: items.length > 0
          ? items.map(f => ({ icon: f.icon ?? "Zap", title: f.title ?? f.name ?? "", description: f.description ?? f.body ?? "" }))
          : fromBrand,
      };
    }

    case "trust-bar":
    case "stats": {
      const items = (p.items ?? p.stats ?? []) as AiBlock[];
      // When AI omits items, surface up to 4 brand value-prop themes
      // as short proof statements ("✓ Theme") rather than leaving
      // an empty bar.
      const fromBrand = brand.valuePropPairs
        .filter(v => v.theme.trim().length > 0)
        .slice(0, 4)
        .map(v => ({ value: "✓", label: v.theme }));
      return {
        items: items.length > 0
          ? items.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : fromBrand,
      };
    }

    case "testimonial":
    case "testimonials": {
      const list = (p.testimonials ?? []) as AiBlock[];
      const t = list[0] ?? p;
      return {
        quote: t.quote ?? t.body ?? "",
        author: t.author ?? t.name ?? "",
        role: t.role ?? t.title ?? "",
        practiceName: t.practiceName ?? t.company ?? "",
      };
    }

    case "bottom-cta":
    case "cta":
      return {
        headline: p.headline ?? p.heading ?? `Ready to get started with ${us}?`,
        subheadline: p.subheadline ?? p.subheading ?? "",
        ctaText: p.ctaText ?? "Get started",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };

    case "how-it-works": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        headline: p.headline ?? p.heading ?? "How it works",
        steps: steps.length > 0
          ? steps.map((s, i) => ({ number: s.number ?? `0${i + 1}`, title: s.title ?? s.name ?? "", description: s.description ?? s.body ?? "" }))
          : [],
      };
    }

    case "comparison":
      return {
        headline: p.headline ?? p.heading ?? "Compare your options.",
        ctaText: p.ctaText ?? "Get started",
        ctaUrl: p.ctaUrl ?? "#",
        oldWayLabel: p.oldWayLabel || "The old way",
        oldWayBullets: (Array.isArray(p.oldWayBullets) && p.oldWayBullets.length > 0)
          ? p.oldWayBullets
          : [],
        newWayLabel: p.newWayLabel || us,
        newWayBullets: (Array.isArray(p.newWayBullets) && p.newWayBullets.length > 0)
          ? p.newWayBullets
          : [],
      };

    case "pas-section":
      return {
        headline: p.headline ?? p.heading ?? "",
        body: p.body ?? p.description ?? "",
        bullets: Array.isArray(p.bullets) ? p.bullets : [],
      };

    case "stat-callout":
      return {
        stat: p.stat ?? p.value ?? "",
        description: p.description ?? p.label ?? "",
        footnote: p.footnote ?? "",
      };

    case "rich-text":
      return { content: p.content ?? p.body ?? p.html ?? "", maxWidth: p.maxWidth ?? "prose" };

    // ── DSO Corporate blocks ─────────────────────────────────────────
    case "dso-heartland-hero": {
      const stats = (p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? (brand.name ? `The ${us} difference` : ""),
        headline: p.headline ?? p.heading ?? "Built for your scale.",
        companyName: p.companyName ?? p.company ?? "",
        subheadline: p.subheadline ?? p.subheading ?? tagline,
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Schedule a conversation",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        stats: stats.length > 0
          ? stats.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [],
        showScrollIndicator: true,
      };
    }

    case "dso-stat-bar": {
      const stats = (p.stats ?? p.items ?? []) as AiBlock[];
      return {
        stats: stats.length > 0
          ? stats.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-challenges": {
      const challenges = (p.challenges ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "At scale, small inefficiencies compound fast.",
        backgroundStyle: p.backgroundStyle ?? "muted",
        layout: p.layout ?? "4-col",
        challenges: challenges.length > 0
          ? challenges.map(c => ({ title: c.title ?? c.name ?? "", desc: c.desc ?? c.description ?? c.body ?? "" }))
          : [],
      };
    }

    case "dso-insights-dashboard":
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "One dashboard for every location.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        practiceLabel: p.practiceLabel ?? "locations",
        backgroundStyle: p.backgroundStyle ?? "muted",
        dashboardVariant: p.dashboardVariant ?? "light",
      };

    case "dso-success-stories": {
      const cases = (p.cases ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Proven results",
        headline: p.headline ?? p.heading ?? "Customers that switched and never looked back.",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
        cases: cases.length > 0
          ? cases.map(c => ({ name: c.name ?? "", stat: c.stat ?? "", label: c.label ?? "", quote: c.quote ?? "", author: c.author ?? "" }))
          : [],
      };
    }

    case "dso-pilot-steps": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "How it works",
        headline: p.headline ?? p.heading ?? "Start small. Prove it out. Then scale.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        backgroundStyle: p.backgroundStyle ?? "muted",
        steps: steps.length > 0
          ? steps.map(s => ({
              title: s.title ?? s.name ?? "",
              subtitle: s.subtitle ?? "",
              desc: s.desc ?? s.description ?? s.body ?? "",
              details: Array.isArray(s.details) ? s.details : [],
            }))
          : [],
      };
    }

    case "dso-final-cta":
      return {
        eyebrow: p.eyebrow ?? "Next steps",
        headline: p.headline ?? p.heading ?? "Prove ROI. Then scale.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Get pricing",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
      };

    case "dso-comparison": {
      const rows = (p.rows ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? (brand.name ? `The ${us} difference` : ""),
        headline: p.headline ?? p.heading ?? "Built for scale. Designed for trust.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        companyName: p.companyName ?? p.company ?? "",
        ctaText: p.ctaText ?? "Request a demo",
        ctaUrl: p.ctaUrl ?? "#",
        // The `dandy` column key is an internal field name used by
        // BlockDsoComparison — it renders as the tenant's "us" column.
        // Leaving the key name unchanged here to keep stored block JSON
        // compatible with the renderer; copy is brand-neutral.
        rows: rows.map(r => ({ feature: r.feature ?? "", dandy: r.dandy ?? r.us ?? "", traditional: r.traditional ?? "" })),
        backgroundStyle: p.backgroundStyle ?? "muted",
      };
    }

    case "dso-lab-tour":
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "See it in action.",
        body: p.body ?? p.description ?? "",
        quote: p.quote ?? "",
        quoteAttribution: p.quoteAttribution ?? "",
        imageUrl: p.imageUrl ?? "",
        videoUrl: p.videoUrl ?? "",
        ctaText: p.ctaText ?? "Request a tour",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "white",
      };

    // ── DSO Practice blocks ──────────────────────────────────────────
    case "dso-practice-nav": {
      const links = (p.links ?? []) as AiBlock[];
      return {
        dsoName: p.dsoName ?? p.companyName ?? "",
        links: links.length > 0
          ? links.map((l: AiBlock) => ({ label: l.label ?? "", anchor: l.anchor ?? "#" }))
          : [],
        ctaText: p.ctaText ?? "Book a demo",
        ctaUrl: p.ctaUrl ?? "#",
      };
    }

    case "dso-practice-hero":
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? (brand.name ? `Your team. Elevated by ${us}.` : "Your team. Elevated."),
        subheadline: p.subheadline ?? p.subheading ?? tagline,
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Get started",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "See how it works",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        trustLine: p.trustLine ?? "",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };

    case "dso-stat-row": {
      const items = (p.items ?? p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "By the numbers",
        headline: p.headline ?? p.heading ?? "Results that speak for themselves.",
        items: items.length > 0
          ? items.map(s => ({ value: s.value ?? "", label: s.label ?? "", detail: s.detail ?? "" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-partnership-perks": {
      const perks = (p.perks ?? p.benefits ?? p.items ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Partnership benefits",
        headline: p.headline ?? p.heading ?? (brand.name ? `Perks that come with every ${us} partnership.` : "Partnership perks."),
        subheadline: p.subheadline ?? p.subheading ?? "",
        perks: perks.length > 0
          ? perks.map(pk => ({ icon: pk.icon ?? "star", title: pk.title ?? pk.name ?? "", desc: pk.desc ?? pk.description ?? "" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-split-feature": {
      const bullets = (p.bullets ?? []) as string[];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "",
        body: p.body ?? p.description ?? "",
        bullets: bullets.length > 0 ? bullets : [],
        ctaText: p.ctaText ?? "",
        ctaUrl: p.ctaUrl ?? "#",
        imageUrl: p.imageUrl ?? "",
        imagePosition: p.imagePosition ?? "right",
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-software-showcase": {
      const features = (p.features ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "",
        body: p.body ?? p.description ?? "",
        imageUrl: p.imageUrl ?? "",
        features: features.length > 0
          ? features.map(f => ({ icon: f.icon ?? "zap", label: f.label ?? f.title ?? "" }))
          : [],
        ctaText: p.ctaText ?? "See it in action",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
        layout: p.layout ?? "centered",
      };
    }

    case "dso-faq": {
      const items = (p.items ?? p.questions ?? p.faqs ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Common questions",
        headline: p.headline ?? p.heading ?? "Everything you're wondering about.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        items: items.length > 0
          ? items.map(i => ({ question: i.question ?? i.q ?? i.title ?? "", answer: i.answer ?? i.a ?? i.body ?? "" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-activation-steps": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Getting started",
        headline: p.headline ?? p.heading ?? (brand.name ? `Steps to going live with ${us}.` : "Steps to going live."),
        subheadline: p.subheadline ?? p.subheading ?? "",
        steps: steps.length > 0
          ? steps.map((s, i) => ({ step: s.step ?? `${i + 1}`, title: s.title ?? s.name ?? "", desc: s.desc ?? s.description ?? s.body ?? "" }))
          : [],
        ctaText: p.ctaText ?? "Book your kickoff call",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-promo-cards": {
      const cards = (p.cards ?? p.offers ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Limited-time offers",
        headline: p.headline ?? p.heading ?? "Exclusive promotions for partners.",
        subheadline: p.subheadline ?? p.subheading ?? "",
        cards: cards.length > 0
          ? cards.map(c => ({ title: c.title ?? c.name ?? "", desc: c.desc ?? c.description ?? "", badge: c.badge ?? "OFFER", ctaText: c.ctaText ?? "Claim now" }))
          : [],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "footer": {
      const columns = (p.columns ?? []) as AiBlock[];
      return {
        columns: Array.isArray(columns) ? columns : [],
        copyrightText: p.copyrightText ?? (brand.name ? `© ${new Date().getFullYear()} ${us}. All rights reserved.` : `© ${new Date().getFullYear()}. All rights reserved.`),
        showSocialLinks: p.showSocialLinks ?? false,
        backgroundColor: p.backgroundColor,
        accentColor: p.accentColor,
      };
    }

    default:
      return { ...p };
  }
}

const BLOCK_PROP_SCHEMAS: Record<string, string> = {
  "hero": "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle (\"dark\"|\"white\"|\"light-gray\") }",
  "trust-bar": "{ items: [{ value, label }] } — 3–4 key proof stats",
  "benefits-grid": "{ headline, columns (3), items: [{ icon (lucide name), title, description }] } — 6 benefits",
  "features": "{ headline, columns (3), items: [{ icon (lucide name), title, description }] } — 6 benefits",
  "testimonial": "{ quote, author, role, practiceName }",
  "testimonials": "{ quote, author, role, practiceName }",
  "how-it-works": "{ headline, steps: [{ number, title, description }] }",
  "comparison": "{ headline, oldWayLabel, oldWayBullets: string[], newWayLabel, newWayBullets: string[] }",
  "bottom-cta": "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle }",
  "cta": "{ headline, subheadline, ctaText, ctaUrl, backgroundStyle }",
  "stats": "{ items: [{ value, label }] }",
  "pas-section": "{ headline, body, bullets: string[] }",
  "stat-callout": "{ stat, description, footnote }",
  "rich-text": "{ content, maxWidth }",
  "dso-heartland-hero": "{ eyebrow, headline, companyName, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, stats: [{ value, label }] }",
  "dso-stat-bar": "{ stats: [{ value, label }], backgroundStyle }",
  "dso-challenges": "{ eyebrow, headline, backgroundStyle, layout (\"4-col\"), challenges: [{ title, desc }] } — 4 pain points specific to this account",
  "dso-insights-dashboard": "{ eyebrow, headline, subheadline, practiceLabel, backgroundStyle, dashboardVariant (\"light\"|\"dark\") }",
  "dso-success-stories": "{ eyebrow, headline, backgroundStyle, cases: [{ name, stat, label, quote, author }] } — 2–3 DSO case studies",
  "dso-pilot-steps": "{ eyebrow, headline, subheadline, backgroundStyle, steps: [{ title, subtitle, desc, details: string[] }] }",
  "dso-final-cta": "{ eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, backgroundStyle }",
  "dso-comparison": "{ eyebrow, headline, subheadline, companyName, ctaText, ctaUrl, rows: [{ feature, dandy, traditional }], backgroundStyle }",
  "dso-lab-tour": "{ eyebrow, headline, body, quote, quoteAttribution, ctaText, ctaUrl, backgroundStyle }",
  "dso-practice-nav": "{ dsoName, links: [{ label, anchor }], ctaText, ctaUrl } — sticky nav bar; use the DSO/practice name for dsoName; keep links to 3–4 section anchors on this page",
  "dso-practice-hero": "{ eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, trustLine, backgroundStyle }",
  "dso-stat-row": "{ eyebrow, headline, items: [{ value, label, detail }], backgroundStyle }",
  "dso-partnership-perks": "{ eyebrow, headline, subheadline, perks: [exactly 6 × { icon, title, desc }], backgroundStyle }",
  "dso-split-feature": "{ eyebrow, headline, body, bullets: string[], ctaText, ctaUrl, imagePosition (\"left\"|\"right\"), backgroundStyle }",
  "dso-software-showcase": "{ eyebrow, headline, body, features: [{ icon, label }], ctaText, ctaUrl, backgroundStyle, layout }",
  "dso-faq": "{ eyebrow, headline, subheadline, items: [{ question, answer }], backgroundStyle } — 4–5 questions",
  "dso-activation-steps": "{ eyebrow, headline, subheadline, steps: [{ step, title, desc }], ctaText, ctaUrl, backgroundStyle }",
  "dso-promo-cards": "{ eyebrow, headline, subheadline, cards: [{ title, desc, badge, ctaText }], backgroundStyle }",
  "footer": "{ columns: [] (always empty array), copyrightText, showSocialLinks: false, backgroundColor: \"#003A30\" }",
  "video-section": "{ headline, subheadline, videoUrl, backgroundStyle }",
  "business-case-split": "{ heroEyebrow, heroHeadline, heroSubhead, situationHeading, situationBody, situationStats: [{ value, label }], signalHeading, signalCards: [{ icon, stat, body, attribution }], costHeading, costItems: [{ stat, label, description }], shiftHeading, shiftOldBullets: [{ title, body }], shiftNewBullets: [{ title, body }], mathHeading, mathSubhead, mathOfficeCount, mathVolumeLabel, mathVolumeValue, mathStats: [{ label, value, caption }], proofHeading, proofFeatured: { quote, name, title }, proofSecondary: [{ quote, name, title }], planHeading, planSteps: [{ num, title, timeframe, description }], finalCtaHeading, finalCtaSubhead } — a single full-page consultative DSO business-case document; rewrite ALL copy specifically for this account; keep the same array lengths; keep stats realistic; do NOT invent image URLs",
  "business-case-centered": "{ heroEyebrow, heroHeadline, heroSubhead, situationHeading, situationBody, situationBodyExtra, situationStats: [{ value, label, description }], signalHeading, signalCards: [{ stat, body, attribution }], costHeading, costSubhead, costItems: [{ num, stat, label, description }], shiftHeading, shiftRows: [{ category, oldWay, withDandy }], mathHeading, mathSubhead, mathOfficeCount, mathVolumeLabel, mathVolumeValue, mathStats: [{ label, value, caption }], proofHeading, proofFeatured: { quote, name, title }, proofSecondary: [{ quote, name, title }], planHeading, planSubhead, planSteps: [{ num, title, timeframe, description }], finalCtaHeading, finalCtaSubhead } — a single full-page centered DSO business-case document; rewrite ALL copy specifically for this account; keep the same array lengths; keep stats realistic; do NOT invent image URLs",
  "business-case-premium": "{ heroEyebrow, heroHeadline, heroSubhead, situationHeading, situationBody, situationBodyExtra, situationStats: [{ value, label, description }], signalHeading, signalCards: [{ stat, body, attribution }], costHeading, costSubhead, costItems: [{ num, stat, label, description }], shiftHeading, shiftRows: [{ category, oldWay, withDandy }], mathHeading, mathSubhead, mathOfficeCount, mathVolumeLabel, mathVolumeValue, mathHeroEyebrow, mathHeroStat, mathHeroDescription, mathStats: [{ value, label, caption }], proofHeading, proofFeatured: { quote, name, title }, proofSecondary: [{ quote, name, title }], planHeading, planSubhead, planSteps: [{ num, title, timeframe, description }], finalCtaEyebrow, finalCtaHeading, finalCtaSubhead } — a single full-page premium editorial DSO field-study; rewrite ALL copy specifically for this account; keep the same array lengths; keep stats realistic; do NOT invent image URLs",
};

// ── Brand catalog types (server-side mirrors of lp-studio brand-config) ────
// We intentionally duplicate these shapes here rather than cross-importing
// from the lp-studio package — the brand row is stored as JSON in
// lp_brand_settings.config so the server only needs the read shape.
interface BrandProductLine {
  name?: string;
  description?: string;
  valueProps?: string[];
  claims?: string[];
  keywords?: string[];
}
interface BrandSegmentPersona {
  role?: string;
  painPoints?: string[];
}
interface BrandSegmentChallenge {
  title?: string;
  desc?: string;
}
interface BrandSegmentStat {
  value?: string;
  label?: string;
}
interface BrandSegmentComparisonRow {
  need?: string;
  us?: string;
  them?: string;
}
interface BrandMicrositeBlockListEntry {
  type?: string;
  schemaHint?: string;
}
interface BrandAudienceSegment {
  id?: string;
  name?: string;
  description?: string;
  messagingAngle?: string;
  uniqueContext?: string;
  valueProps?: string[];
  segmentProducts?: string[];
  personas?: BrandSegmentPersona[];
  challenges?: BrandSegmentChallenge[];
  stats?: BrandSegmentStat[];
  comparisonRows?: BrandSegmentComparisonRow[];
  micrositeBlockList?: BrandMicrositeBlockListEntry[];
}

// Built-in neutral microsite block list — the legacy "independent" set,
// used when neither the selected segment nor the brand defines one. No
// DSO / dental vocabulary, so it's safe for any tenant.
const NEUTRAL_MICROSITE_BLOCK_LIST: BrandMicrositeBlockListEntry[] = [
  { type: "hero" },
  { type: "trust-bar" },
  { type: "benefits-grid" },
  { type: "testimonial" },
  { type: "how-it-works" },
  { type: "comparison" },
  { type: "bottom-cta" },
];

// Three-tier schema resolution for a block-list entry: explicit per-entry
// schemaHint → server-side BLOCK_PROP_SCHEMAS registry default → generic
// "{ ...fields }" placeholder. Never throws on missing data.
function resolveBlockSchema(entry: BrandMicrositeBlockListEntry): string {
  const hint = entry.schemaHint?.trim();
  if (hint) return hint;
  return BLOCK_PROP_SCHEMAS[entry.type ?? ""] ?? "{ ...fields }";
}

/**
 * Format productLines into a structured PRODUCT CATALOG section. Returns
 * empty string when no products are defined so the prompt stays clean for
 * tenants who haven't filled this in yet.
 */
function buildProductCatalogSection(productLines: BrandProductLine[] | undefined): string {
  if (!Array.isArray(productLines) || productLines.length === 0) return "";
  const valid = productLines.filter(p => p?.name?.trim());
  if (valid.length === 0) return "";

  const blocks = valid.map(p => {
    const lines: string[] = [`• ${p.name!.trim()}`];
    if (p.description?.trim()) lines.push(`  Description: ${p.description.trim()}`);
    if (p.valueProps?.length) lines.push(`  Value props: ${p.valueProps.filter(v => v?.trim()).join("; ")}`);
    if (p.claims?.length) lines.push(`  Claims: ${p.claims.filter(c => c?.trim()).join("; ")}`);
    if (p.keywords?.length) lines.push(`  Keywords: ${p.keywords.filter(k => k?.trim()).join(", ")}`);
    return lines.join("\n");
  }).join("\n\n");

  return [
    "PRODUCT CATALOG — use the relevant product's value props, claims, and keywords when writing copy:",
    "",
    blocks,
  ].join("\n");
}

/**
 * Find the brand segment that matches the account's segment field. Matches
 * by name or id, case-insensitive after trim. Returns undefined if no
 * match (caller should fall back gracefully — no empty section markers).
 */
function findMatchingSegment(
  segments: BrandAudienceSegment[] | undefined,
  accountSegment: string | null | undefined,
): BrandAudienceSegment | undefined {
  if (!Array.isArray(segments) || segments.length === 0) return undefined;
  if (!accountSegment) return undefined;
  const target = accountSegment.trim().toLowerCase();
  if (!target) return undefined;
  return segments.find(s =>
    (s?.name?.trim().toLowerCase() === target) ||
    (s?.id?.trim().toLowerCase() === target),
  );
}

/**
 * Format the matched segment into a TARGET SEGMENT section with personas,
 * challenges, stats and comparison rows. Returns empty string when no
 * segment matches.
 */
function buildSegmentSection(segment: BrandAudienceSegment | undefined): string {
  if (!segment) return "";
  const lines: string[] = [
    `TARGET SEGMENT — ${segment.name?.trim() || "this account's segment"} (use this segment's specific data in copy):`,
    "",
  ];

  if (segment.messagingAngle?.trim()) {
    lines.push(`Messaging angle: ${segment.messagingAngle.trim()}`);
  }
  if (segment.uniqueContext?.trim()) {
    lines.push(`What makes this segment unique: ${segment.uniqueContext.trim()}`);
  }
  if (segment.valueProps?.length) {
    const vp = segment.valueProps.filter(v => v?.trim());
    if (vp.length) lines.push(`Segment-specific value props: ${vp.join("; ")}`);
  }

  const validPersonas = (segment.personas ?? []).filter(p => p?.role?.trim());
  if (validPersonas.length) {
    lines.push("");
    lines.push("Key personas (use their pain points when writing pain-section copy):");
    validPersonas.forEach(p => {
      const pains = (p.painPoints ?? []).filter(pp => pp?.trim()).join(", ");
      lines.push(`• ${p.role!.trim()}${pains ? ` — ${pains}` : ""}`);
    });
  }

  const validChallenges = (segment.challenges ?? []).filter(c => c?.title?.trim());
  if (validChallenges.length) {
    lines.push("");
    lines.push("Industry challenges (reference these as the problems we solve):");
    validChallenges.forEach(c => {
      lines.push(`• ${c.title!.trim()}${c.desc?.trim() ? `: ${c.desc.trim()}` : ""}`);
    });
  }

  const validStats = (segment.stats ?? []).filter(s => s?.value?.trim());
  if (validStats.length) {
    lines.push("");
    lines.push("Pre-validated stats — use ONLY these in any stats block:");
    validStats.forEach(s => {
      lines.push(`• ${s.value!.trim()}${s.label?.trim() ? `: ${s.label.trim()}` : ""}`);
    });
  }

  const validRows = (segment.comparisonRows ?? []).filter(r => r?.need?.trim());
  if (validRows.length) {
    lines.push("");
    lines.push("Pre-validated comparisons — use these in any comparison block:");
    validRows.forEach(r => {
      const us = r.us?.trim() ?? "";
      const them = r.them?.trim() ?? "";
      lines.push(`• ${r.need!.trim()} — Us: ${us} · Them: ${them}`);
    });
  }

  return lines.join("\n");
}

function buildSystemPrompt(
  segment: BrandAudienceSegment,
  brand: Record<string, unknown>,
  templateBlockTypes?: string[],
  accountSegment?: string | null,
): string {
  const tone            = brand.toneOfVoice as string | undefined;
  const pillars         = brand.messagingPillars as Array<{ label: string; description: string }> | undefined;
  const taglines        = brand.taglines as string[] | undefined;
  const toneKeywords    = brand.toneKeywords as string[] | undefined;
  const avoidPhrases    = brand.avoidPhrases as string[] | undefined;
  const copyExamples    = brand.copyExamples as string[] | undefined;
  const copyInstructions = brand.copyInstructions as string | undefined;
  const brandName       = (brand.brandName as string | undefined) ?? "";
  const companyDescription = brand.companyDescription as string | undefined;
  const targetAudience  = brand.targetAudience as string | undefined;
  const productLines    = brand.productLines as BrandProductLine[] | undefined;
  const segments        = brand.segments as BrandAudienceSegment[] | undefined;
  const matchedSegment  = findMatchingSegment(segments, accountSegment);
  const productCatalog  = buildProductCatalogSection(productLines);
  const segmentSection  = buildSegmentSection(matchedSegment);
  // Phase B: few-shot examples — pick up to 2 hand-curated exemplars
  // matching the requested audience (and boosted by segment hints).
  // Returns "" when no exemplars apply (e.g. independent-practice audience
  // for which we don't ship an exemplar yet) so the prompt stays clean.
  const salesConsole = (brand.salesConsole ?? {}) as {
    useBuiltInExemplars?: boolean;
    customMicrositeExemplars?: unknown;
  };
  const useBuiltInExemplars = salesConsole.useBuiltInExemplars === true;
  // Tenant-authored exemplars are always applied (the generic, white-label
  // path); built-in Dandy sample pages stay opt-in via useBuiltInExemplars.
  const exemplarsSection = formatExemplarsSection(
    pickExemplars(segment.id ?? "", accountSegment, 2, { useBuiltIn: useBuiltInExemplars }),
    parseCustomExemplars(salesConsole.customMicrositeExemplars),
  );

  // Core forbidden list always applied; brand's avoidPhrases add to it
  const coreForbidden = [
    "cutting-edge", "state-of-the-art", "best-in-class", "world-class", "industry-leading",
    "leverage", "utilize", "streamline", "synergy", "empower", "enable", "facilitate",
    "revolutionize", "transformative", "game-changing", "innovative", "disruptive",
    "seamless", "seamlessly", "effortlessly", "frictionless",
    "comprehensive", "holistic", "robust", "scalable solutions", "end-to-end",
    "in today's competitive landscape", "in the current climate", "now more than ever",
    "take it to the next level", "elevate your practice", "transform your business",
    "partner of choice", "trusted partner", "strategic partner",
    "unique positioning", "competitive advantage",
    "solution", "ecosystem", "Discover", "Unlock", "Unleash",
    "optimize", "maximize" ,"best practices", "value-add",
  ];
  const forbiddenList = [...new Set([...coreForbidden, ...(avoidPhrases ?? [])])];

  const chilipiperUrl = brand.chilipiperUrl as string | undefined;
  const defaultCtaUrl = brand.defaultCtaUrl as string | undefined;

  const brandSection = [
    tone              ? `VOICE: ${tone}` : null,
    toneKeywords?.length ? `Style words — your copy should feel: ${toneKeywords.join(", ")}` : null,
    pillars?.length   ? `Messaging pillars:\n${pillars.map(p => `- ${p.label}: ${p.description}`).join("\n")}` : null,
    taglines?.length  ? `Brand taglines (reference these, don't repeat them verbatim): ${taglines.join(" | ")}` : null,
    copyExamples?.length ? `Copy that nails the voice — study these and write in this register:\n${copyExamples.map(e => `  "${e}"`).join("\n")}` : null,
    copyInstructions?.trim() ? copyInstructions.trim() : null,
    chilipiperUrl ? `Chili Piper booking URL: "${chilipiperUrl}" — use this as ctaUrl for ALL blocks; set ctaMode: "chilipiper" on every block with ctaText/ctaUrl props` : null,
    !chilipiperUrl && defaultCtaUrl ? `Default CTA URL: "${defaultCtaUrl}" — use this as ctaUrl on EVERY block that has a ctaUrl prop. Never leave ctaUrl as "#".` : null,
  ].filter(Boolean).join("\n");

  const copyPrinciples = `
COPY QUALITY PRINCIPLES — follow every one of these without exception:

1. Specific always beats vague. Every claim needs a number, a process, or a policy behind it.
   BAD: "Faster turnaround times that improve efficiency"
   GOOD: "5-day crown delivery with real-time case tracking"
   BAD: "${brandName || "Our"}'s advanced technology ensures better outcomes"
   GOOD: "96% first-time fit rate. If a case doesn't seat, we remake it for free."

2. Lead with the customer's benefit — not ${brandName || "the seller"}'s features.
   BAD: "${brandName || "We"} use AI-powered quality control on every case"
   GOOD: "You get a better-fitting result without the back-and-forth phone calls"

3. Write like one person talking directly to another across a desk. Not a press release. Not a brochure.
   BAD: "Leveraging next-generation digital workflows to optimize practice efficiency"
   GOOD: "Send a scan. Get a perfect-fit crown in 5 days."

4. Short sentences. Active voice. One idea per sentence. If you can cut a word without losing meaning, cut it.

5. Headlines are declarative and direct. No vague questions. No "How to..." or "Why...".
   BAD: "Discover how ${brandName || "we"} can help your practice grow"
   GOOD: "More cases. Zero lab drama."

6. Every subheadline should deepen or add to the headline — not just restate it in different words.

7. Reference this specific account — their name, their scale, their situation — naturally throughout. It should feel written for them, not filled in with a mail-merge.

8. Never stack adjectives. One strong word beats three weak ones.
   BAD: "Powerful, comprehensive, industry-leading digital solutions"
   GOOD: "A lab that backs every case with a guarantee"

${matchedSegment ? `9. VALIDATED FACTS ONLY — when this prompt includes a TARGET SEGMENT section with pre-validated stats, comparisons, and persona pain points, you MUST use ONLY those exact facts:
   a) STATS: Pull every number, percentage, dollar amount, and time-frame ONLY from the "Pre-validated stats" list. Never invent statistics. Never round, embellish, or extrapolate. If no stat fits a slot, write a different sentence rather than fabricating a number.
   b) COMPARISONS: In any comparison block (oldWayBullets/newWayBullets, comparison rows, "us vs them" tables), use ONLY the "Pre-validated comparisons" entries. Never invent contrasts.
   c) PERSONA PAIN POINTS: When writing pain-section copy or addressing buyer concerns, use ONLY the pain points listed under "Key personas". Never fabricate a persona or invent a pain point not on the list.

10. CAPITALIZATION — Two absolute rules that BOTH apply at all times:` : `9. CAPITALIZATION — Two absolute rules that BOTH apply at all times:`}
   a) ALWAYS start every sentence, headline, eyebrow, bullet point, step title, card title, FAQ question, and label with a capital letter. Every piece of text that starts a new thought begins with a capital. Never begin any text with a lowercase letter.
   b) NEVER title-case — do not capitalize every word. Only the first word of a sentence + proper nouns (person names, companies, cities) + acronyms (DSO, AI, ROI) + official product names get capitals.
   WRONG (all lowercase start): "more cases. zero lab drama." → WRONG: sentence starts with lowercase
   WRONG (title case): "More Cases. Zero Lab Drama." → WRONG: mid-sentence words capitalized
   CORRECT: "More cases. Zero lab drama."
   WRONG: "send a scan. get a perfect-fit crown in 5 days." → WRONG
   CORRECT: "Send a scan. Get a perfect-fit crown in 5 days."
   WRONG: "join hundreds of practices already using ${(brandName || "us").toLowerCase()}" → WRONG: lowercase sentence start; brand names are proper nouns
   CORRECT: "Join hundreds of practices already using ${brandName || "us"}."

NEVER USE any of the following — not in headlines, not in body copy, not anywhere:
${forbiddenList.map(p => `- "${p}"`).join("\n")}
`.trim();

  // Build dynamic identity — use companyDescription if set, else compose from brandName + targetAudience
  const sellerIdentity = companyDescription?.trim()
    || (targetAudience ? `${brandName}, serving ${targetAudience}` : `${brandName}, a B2B technology company`);
  const audienceDescription = targetAudience ? `${targetAudience} accounts` : "specific accounts";

  const header = [
    `You are an expert B2B copywriter for ${sellerIdentity}. You write personalized microsites for ${audienceDescription}.`,
    "",
    brandSection ? `BRAND VOICE & GUIDELINES:\n${brandSection}` : "",
    productCatalog ? `\n${productCatalog}` : "",
    segmentSection ? `\n${segmentSection}` : "",
    exemplarsSection ? `\n${exemplarsSection}` : "",
    "",
    copyPrinciples,
    "",
    "Return ONLY valid JSON: { \"title\": string, \"slug\": string, \"blocks\": Block[] }",
    "Each Block MUST use: { \"type\": string, \"props\": { ...fields } }",
    "Never put content fields at the top level of a block. Always nest inside props.",
  ].filter(s => s !== "").join("\n");

  // Audience copy guidance — single segment-driven source of truth. Replaces
  // the legacy hardcoded `audience === "dso-*"` branches; any Dandy-specific
  // copy now lives in Dandy's seeded segment data and is only emitted when
  // Dandy is the active tenant.
  const themes = (segment.valueProps ?? []).map(v => v?.trim()).filter(Boolean);
  const audienceSection = [
    segment.description?.trim()
      ? `AUDIENCE: ${segment.description.trim()}`
      : `AUDIENCE: ${segment.name?.trim() || "this account's audience"}`,
    segment.messagingAngle?.trim() ? `Messaging angle: ${segment.messagingAngle.trim()}` : null,
    segment.uniqueContext?.trim() ? `Unique context: ${segment.uniqueContext.trim()}` : null,
    themes.length ? `Messaging themes: ${themes.join(", ")}.` : null,
  ].filter(Boolean).join("\n");

  // Block list resolution order: selected segment's micrositeBlockList →
  // brand-level defaultMicrositeBlockList → built-in neutral fallback.
  const brandDefaultBlockList = brand.defaultMicrositeBlockList as BrandMicrositeBlockListEntry[] | undefined;
  const resolvedBlockList: BrandMicrositeBlockListEntry[] =
    (segment.micrositeBlockList?.length ? segment.micrositeBlockList : undefined)
    ?? (brandDefaultBlockList?.length ? brandDefaultBlockList : undefined)
    ?? NEUTRAL_MICROSITE_BLOCK_LIST;
  const resolvedBlockTypes = resolvedBlockList.filter(b => (b.type ?? "").trim());

  const blockCount = templateBlockTypes ? templateBlockTypes.length : resolvedBlockTypes.length;
  const footer = [
    "",
    `Build a page with exactly ${blockCount} blocks in the order listed.`,
    "Every block's copy must feel written specifically for this account — their name, scale, and situation woven in naturally.",
    "Use plain, direct language. If a phrase sounds like it belongs in a pitch deck or a press release, rewrite it.",
    "FINAL CAPITALIZATION REMINDER: Every single string value — headlines, eyebrows, subheadlines, bullet points, step titles, labels, FAQ questions — MUST start with a capital letter. NEVER start any text value with a lowercase letter. NEVER title-case (capitalize every word). Only the first word + proper nouns + acronyms get capitals.",
  ].join("\n");

  // When a template layout is provided, override the default block order with the template's blocks
  if (templateBlockTypes && templateBlockTypes.length > 0) {
    const blockList = templateBlockTypes.map((type, i) => {
      const schema = BLOCK_PROP_SCHEMAS[type] ?? "{ ...fields }";
      return `${i + 1}. "${type}": ${schema}`;
    }).join("\n");

    return [
      header,
      "",
      audienceSection,
      "",
      "IMPORTANT: This page uses a fixed template layout. You MUST output EXACTLY these blocks in EXACTLY this order — do not add, remove, or reorder blocks. Customize ALL text copy for the specific account.",
      "",
      "BLOCKS TO GENERATE (fixed order):",
      blockList,
      footer,
    ].join("\n");
  }

  const blockList = resolvedBlockTypes
    .map((entry, i) => `${i + 1}. "${entry.type}": ${resolveBlockSchema(entry)}`)
    .join("\n");

  return [
    header,
    "",
    audienceSection,
    "",
    "AVAILABLE BLOCKS (use only these, in this order):",
    blockList,
    footer,
  ].join("\n");
}

/**
 * POST /sales/accounts/:accountId/generate-microsite
 */
router.post("/accounts/:accountId/generate-microsite", requireAuth, micrositeLimiter, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const accountId = Number(req.params.accountId);
  // `segmentId` is the current field. `audience` is a one-release legacy alias
  // (the old enum values doubled as segment ids); both resolve against
  // brand.segments by id after the brand row is loaded inside the try block.
  const { prompt: userPrompt, segmentId, audience, templateId, ctaOverride, contactId } = req.body as { prompt?: string; segmentId?: string; audience?: string; templateId?: number; ctaOverride?: CtaOverride; contactId?: number };

  try {
    const [account] = await db.select().from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.id, accountId), eq(salesAccountsTable.tenantId, tenantId)));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const [briefing] = await db.select().from(salesBriefingsTable)
      .where(and(
        eq(salesBriefingsTable.tenantId, tenantId),
        eq(salesBriefingsTable.accountId, accountId),
      ))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);

    // Optional: personalise the microsite toward a specific contact. Scope the
    // lookup to BOTH this tenant AND this account so we never pull another
    // account's people (or another tenant's) into the prompt. Its AI brief
    // (sales_contact_briefings.briefText) is injected into the context below.
    let contact: typeof salesContactsTable.$inferSelect | undefined;
    let contactBriefText: string | null = null;
    if (contactId != null && Number.isInteger(contactId)) {
      const [c] = await db.select().from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.id, contactId),
          eq(salesContactsTable.tenantId, tenantId),
          eq(salesContactsTable.accountId, accountId),
        ))
        .limit(1);
      if (c) {
        contact = c;
        const [cb] = await db.select().from(salesContactBriefingsTable)
          .where(and(
            eq(salesContactBriefingsTable.tenantId, tenantId),
            eq(salesContactBriefingsTable.contactId, contactId),
          ))
          .orderBy(desc(salesContactBriefingsTable.updatedAt))
          .limit(1);
        contactBriefText = (cb?.briefText as string | undefined) ?? null;
      }
    }

    const brandRows = await db.select().from(lpBrandSettingsTable)
      .where(eq(lpBrandSettingsTable.tenantId, account.tenantId))
      .limit(1);
    const brand = brandRows.length > 0 ? (brandRows[0].config as Record<string, unknown>) : {};

    // Resolve the audience segment the user picked from this tenant's own
    // brand.segments. No hardcoded enum — unknown ids fail closed with a 400
    // so non-Dandy tenants never silently fall through to DSO/dental copy.
    const brandSegments = (brand.segments as BrandAudienceSegment[] | undefined) ?? [];
    const requestedSegmentId = (segmentId ?? audience ?? "").trim();
    const segment = brandSegments.find(s => (s?.id ?? "").trim() === requestedSegmentId);
    if (!requestedSegmentId || !segment) {
      res.status(400).json({
        error: requestedSegmentId
          ? `Unknown segmentId "${requestedSegmentId}". Configure audience segments in Brand Settings.`
          : "segmentId is required.",
      });
      return;
    }

    // Resolved brand context — used to drive brand-neutral fallback copy
    // when the AI omits a field. Reads brandName + tagline from
    // lpBrandSettings.config (and salesConsole overrides) so non-Dandy
    // tenants never see literal "Dandy" / dental-industry leakage.
    const brandCtx: SalesBrandContext = await getSalesBrandContext(account.tenantId);
    const fallbackBrand: FallbackBrand = {
      name: brandCtx.brandName,
      tagline: brandCtx.tagline,
      valuePropPairs: brandCtx.valuePropPairs.map(v => ({ theme: v.theme, proof: v.proof })),
    };

    // Fetch media library so the AI uses real assets, not invented URLs
    const [{ images, allImages, catalogText: imageCatalogText }, { videoUrls, catalogText: videoCatalogText }] =
      await Promise.all([fetchMediaCatalog(tenantId), fetchVideoCatalog(tenantId)]);

    const openai = getOpenAIClient();
    if (!openai) { res.status(503).json({ error: "AI not configured" }); return; }

    // If a template ID was provided, fetch its block types to use as a fixed layout
    // and store the original blocks so we can restore images after AI generation.
    let templateBlockTypes: string[] | undefined;
    let templateBlocks: AiBlock[] | undefined;
    if (typeof templateId === "number") {
      // Scope the lookup: only a real template (isTemplate=true) that is either
      // owned by the caller's tenant OR a global flagship template may be used.
      // Without this guard a caller could pass an arbitrary page id and pull a
      // different tenant's private page content into their generated microsite.
      const [templatePage] = await db
        .select()
        .from(lpPagesTable)
        .where(
          and(
            eq(lpPagesTable.id, templateId),
            eq(lpPagesTable.isTemplate, true),
            or(
              eq(lpPagesTable.tenantId, tenantId),
              eq(lpPagesTable.isGlobal, true),
            ),
          ),
        );
      if (templatePage?.blocks && Array.isArray(templatePage.blocks)) {
        templateBlocks = templatePage.blocks as AiBlock[];
        templateBlockTypes = templateBlocks.map(b => b.type as string).filter(Boolean);
      }
    }

    const briefingData = briefing?.briefingData as Record<string, unknown> | undefined;
    const systemPrompt = buildSystemPrompt(segment, brand, templateBlockTypes, account.segment);

    const contextParts: string[] = [];
    contextParts.push(`ACCOUNT: ${account.displayName ?? account.name}`);
    if (account.domain) contextParts.push(`Domain: ${account.domain}`);
    if (account.segment) contextParts.push(`Segment: ${account.segment}`);
    if (account.industry) contextParts.push(`Industry: ${account.industry}`);
    contextParts.push(`MICROSITE AUDIENCE: ${segment.name?.trim() || segment.id || ""}`);

    if (briefingData) {
      if (briefingData.overview) contextParts.push(`\nACCOUNT OVERVIEW:\n${briefingData.overview}`);
      if (briefingData.tier) contextParts.push(`Tier: ${briefingData.tier}`);

      const sizeAndLocations = briefingData.sizeAndLocations as Record<string, unknown> | undefined;
      if (sizeAndLocations) {
        if (sizeAndLocations.locationCount) contextParts.push(`Locations: ${sizeAndLocations.locationCount}`);
        if (sizeAndLocations.headquarters) contextParts.push(`HQ: ${sizeAndLocations.headquarters}`);
        if (sizeAndLocations.ownership) contextParts.push(`Ownership: ${sizeAndLocations.ownership}`);
      }

      const fitAnalysis = briefingData.fitAnalysis as Record<string, unknown> | undefined;
      if (fitAnalysis) {
        if (fitAnalysis.primaryValueProp) contextParts.push(`\nPRIMARY VALUE PROP:\n${fitAnalysis.primaryValueProp}`);
        if (Array.isArray(fitAnalysis.keyPainPoints) && fitAnalysis.keyPainPoints.length > 0) {
          contextParts.push(`KEY PAIN POINTS:\n${(fitAnalysis.keyPainPoints as string[]).map(p => `- ${p}`).join("\n")}`);
        }
        if (Array.isArray(fitAnalysis.proofPoints) && fitAnalysis.proofPoints.length > 0) {
          contextParts.push(`PROOF POINTS:\n${(fitAnalysis.proofPoints as string[]).map(p => `- ${p}`).join("\n")}`);
        }
        if (fitAnalysis.recommendedApproach) contextParts.push(`RECOMMENDED APPROACH:\n${fitAnalysis.recommendedApproach}`);
      }

      const buyingCommittee = briefingData.buyingCommittee as Array<{ role: string; painPoints: string }> | undefined;
      if (buyingCommittee?.length) {
        contextParts.push("\nBUYING COMMITTEE:");
        buyingCommittee.forEach(p => contextParts.push(`- ${p.role}: ${p.painPoints}`));
      }

      const pageRec = briefingData.pageRecommendations as Record<string, string> | undefined;
      if (pageRec) {
        if (pageRec.heroHeadline) contextParts.push(`\nSUGGESTED HERO HEADLINE: "${pageRec.heroHeadline}"`);
        if (pageRec.contentFocus) contextParts.push(`CONTENT FOCUS: ${pageRec.contentFocus}`);
        if (pageRec.ctaStrategy) contextParts.push(`CTA STRATEGY: ${pageRec.ctaStrategy}`);
      }
    }

    // Personalisation toward the targeted contact, if any. Tailor messaging
    // toward this individual's role and priorities (from their AI brief).
    if (contact) {
      const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
      const who = [contactName, contact.title].filter(Boolean).join(" — ");
      if (who) contextParts.push(`\nTARGET CONTACT: ${who}`);
      if (contact.role) contextParts.push(`Buyer persona: ${contact.role}`);
      if (contactBriefText) {
        contextParts.push(`\nCONTACT BRIEF — tailor the hero, value props, pain points, and tone toward this person's priorities (do not paste this verbatim onto the page):\n${contactBriefText}`);
      }
    }

    // Inject media library so AI uses real assets instead of inventing URLs
    if (imageCatalogText) contextParts.push(imageCatalogText);
    if (videoCatalogText) contextParts.push(videoCatalogText);
    if (imageCatalogText || videoCatalogText) {
      contextParts.push("CRITICAL: You MUST ONLY use URLs listed above for imageUrl, backgroundImageUrl, heroImageUrl, videoUrl, and mediaUrl fields. NEVER fabricate or invent any media URLs. If no suitable URL exists for a slot, use empty string \"\".");
    }

    if (userPrompt) contextParts.push(`\nADDITIONAL INSTRUCTIONS:\n${userPrompt}`);
    contextParts.push(`\nGenerate a personalised microsite for ${account.displayName ?? account.name} targeting the ${segment.name?.trim() || "specified"} audience. Make every block specific to their business.`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextParts.join("\n") },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; slug?: string; blocks?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    if (!parsed.title || !parsed.slug || !Array.isArray(parsed.blocks)) {
      res.status(500).json({ error: "AI response missing required fields" });
      return;
    }

    let baseSlug = parsed.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Belt-and-suspenders: we feed the human-readable segment name into the
    // prompt, never the id, so the id should never reach the slug. If the AI
    // ever echoes it from somewhere we haven't found, strip ONLY the active
    // segment's id (not all segment ids) and log a warning so we know it fired.
    const activeSegmentId = (segment.id ?? "").trim().toLowerCase();
    if (activeSegmentId) {
      const escaped = activeSegmentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const idPattern = new RegExp(`-?${escaped}-?`, "g");
      const stripped = baseSlug.replace(idPattern, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
      if (stripped !== baseSlug) {
        console.warn(`[generate-microsite] segment id "${activeSegmentId}" leaked into AI slug "${baseSlug}"; stripped to "${stripped}".`);
        baseSlug = stripped;
      }
    }

    let normalizedBlocks = (parsed.blocks as AiBlock[]).map((b, i) => normalizeBlock(b, i, fallbackBrand));

    // ── Image pipeline (parity with the marketing generator) ──────────────
    // Page-level topic context biases image scoring toward on-topic library
    // imagery even when a block headline is generic.
    const industryForImages = await getTenantIndustry(tenantId);
    const pageImageContext = [
      getIndustryImageKeywords(industryForImages).join(" "),
      account.industry ?? "",
      account.segment ?? "",
      (userPrompt ?? "").trim(),
    ].join(" ").trim().slice(0, 240);

    // Clear AI-assigned URLs that are hallucinated or excluded (OG/social/ads)
    // so the fill passes below can replace them.
    normalizedBlocks = sanitizeAIImageUrls(normalizedBlocks, allImages) as AiBlock[];
    // Subject the model's own picks to the same dedupe + relevance guardrails.
    normalizedBlocks = validateAndDedupeAIImages(normalizedBlocks, images, pageImageContext) as AiBlock[];
    // Fill remaining empty image slots from the tenant media library (surfaces
    // untagged images + broad block-type coverage).
    normalizedBlocks = fillEmptyImages(normalizedBlocks, images, pageImageContext) as AiBlock[];
    // Replace invented / missing video URLs with real library videos.
    normalizedBlocks = fillEmptyVideos(normalizedBlocks, videoUrls) as AiBlock[];
    normalizedBlocks = injectBrandIntoBlocks(normalizedBlocks, brand, ctaOverride) as AiBlock[];

    // If a template was used, restore images from the template blocks — the AI
    // updated copy but we keep the original carefully chosen images.
    if (templateBlocks) {
      normalizedBlocks = restoreTemplateImages(normalizedBlocks, templateBlocks) as AiBlock[];

      // Compound business-case templates are a single rich monograph block.
      // Rather than trust the AI to emit every nested field, merge its copy
      // over the authored template props and substitute account placeholders,
      // guaranteeing a complete, on-brand, personalised page.
      if (templateBlocks.length === 1 && isBusinessCaseType(templateBlocks[0]?.type)) {
        const tmpl = templateBlocks[0];
        const companyName = (account.displayName ?? account.name ?? "").trim();
        const sizeAndLocations = briefingData?.sizeAndLocations as Record<string, unknown> | undefined;
        const rawCount = sizeAndLocations?.locationCount;
        const practiceCount = rawCount != null && String(rawCount).trim() !== ""
          ? String(rawCount).trim()
          : "multiple";
        const aiProps = (normalizedBlocks[0]?.props ?? {}) as Record<string, unknown>;
        const mergedProps = substituteAccountVars(
          mergeAuthored((tmpl.props ?? {}) as Record<string, unknown>, aiProps),
          companyName,
          practiceCount,
        ) as Record<string, unknown>;
        normalizedBlocks = [{
          id: (normalizedBlocks[0]?.id as string) ?? (tmpl.id as string),
          type: tmpl.type,
          props: mergedProps,
        }];
      }
    }

    // AI image-gen / Unsplash fallback for slots the library couldn't fill —
    // gated per-tenant exactly like the marketing generator. Best-effort:
    // failures fall through to the empty-string defaults the editor handles.
    const [outsideBuilderOn, imageGenStatus] = await Promise.all([
      getAiImageGenOutsideBuilderEnabled(tenantId),
      getAiImageGenStatus(tenantId),
    ]);
    if (outsideBuilderOn || imageGenStatus.enabled) {
      normalizedBlocks = await aiFillEmptyImages(
        normalizedBlocks as unknown as Array<Record<string, unknown>>,
        tenantId,
        brand as unknown as Parameters<typeof aiFillEmptyImages>[2],
        userPrompt,
      ) as unknown as AiBlock[];
    }

    // Slug uniqueness retry: on a unique-constraint violation (pg error 23505),
    // try appending -2, -3, ... up to MAX_ATTEMPTS before giving up.
    const MAX_SLUG_ATTEMPTS = 5;
    let page: typeof lpPagesTable.$inferInsert & { id: number } | undefined;
    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
      try {
        const [inserted] = await db.insert(lpPagesTable).values({
          tenantId: account.tenantId,
          title: parsed.title,
          slug,
          blocks: normalizedBlocks,
          status: "draft",
          mode: "sales",
          accountId,
          sfdcAccountId: account.salesforceId ?? null,
        }).returning();
        page = inserted as typeof page;
        break;
      } catch (insertErr: unknown) {
        const pgCode = (insertErr as { code?: string }).code;
        if (pgCode === "23505") {
          if (attempt < MAX_SLUG_ATTEMPTS) continue; // try next suffix
          res.status(409).json({
            error: `Slug "${baseSlug}" (and variants up to -${MAX_SLUG_ATTEMPTS}) are already taken. Please retry.`,
          });
          return;
        }
        throw insertErr; // non-duplicate error — let outer catch handle it
      }
    }

    res.json({ page, blocks: normalizedBlocks });
  } catch (err) {
    console.error("Generate microsite error:", err);
    res.status(500).json({ error: "Failed to generate microsite" });
  }
});

export default router;
