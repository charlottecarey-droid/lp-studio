import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { salesAccountsTable, salesBriefingsTable, lpPagesTable, lpBrandSettingsTable, lpMediaTable } from "@workspace/db";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";

const router = Router();

// Rate limit AI microsite generation: 5 per IP per minute (expensive operation).
const micrositeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many generation requests. Please wait before generating another microsite." },
});

export type MicrositeAudience = "dso-corporate" | "dso-practice" | "independent";

// ── Media library utilities ────────────────────────────────────────────────

interface MediaImage { url: string; title: string; tags: string[]; }
const PURPOSE_TAGS = ["lp-hero", "lp-feature", "product-detail"] as const;
const SKIP_TAGS = new Set(["lp-hero", "lp-feature", "product-detail", "web res", "high res", "untitled folder"]);
const EXCLUDE_TAGS = new Set(["og-image", "og", "social", "open-graph", "text-based", "call to action", "advertisement", "ad creative"]);

function getImagePurpose(img: MediaImage): string {
  for (const t of img.tags) {
    if (PURPOSE_TAGS.includes(t as typeof PURPOSE_TAGS[number])) return t;
  }
  return "";
}

async function fetchMediaCatalog(): Promise<{ images: MediaImage[]; catalogText: string }> {
  try {
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(eq(lpMediaTable.mediaType, "image"))
      .orderBy(desc(lpMediaTable.createdAt))
      .limit(500);
    const allImages: MediaImage[] = rows.map(r => ({ url: r.url, title: r.title ?? "", tags: (r.tags as string[]) ?? [] }));
    const images = allImages.filter(img => !img.tags.some(t => EXCLUDE_TAGS.has(t.toLowerCase())));
    if (images.length === 0) return { images, catalogText: "" };

    const heroImages    = images.filter(i => getImagePurpose(i) === "lp-hero");
    const featureImages = images.filter(i => getImagePurpose(i) === "lp-feature");

    const buildSection = (imgs: MediaImage[], label: string): string => {
      if (imgs.length === 0) return "";
      const samples = imgs.slice(0, 8).map(i => i.url);
      return `[${label}]\n${samples.join("\n")}`;
    };
    const sections: string[] = [
      buildSection(heroImages,    "HERO & LIFESTYLE IMAGES — use for hero imageUrl, backgroundImageUrl, heroImageUrl"),
      buildSection(featureImages, "FEATURE IMAGES — use for dso-split-feature, dso-lab-tour, zigzag-features imageUrl"),
    ].filter(Boolean);

    const catalogText = sections.length > 0
      ? `\nIMAGE LIBRARY — ONLY use these URLs for any imageUrl / backgroundImageUrl / heroImageUrl field:\n${sections.join("\n\n")}\n`
      : "";
    return { images, catalogText };
  } catch {
    return { images: [], catalogText: "" };
  }
}

async function fetchVideoCatalog(): Promise<{ videoUrls: string[]; catalogText: string }> {
  try {
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title })
      .from(lpMediaTable)
      .where(eq(lpMediaTable.mediaType, "video"))
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

function findBestImage(context: string, images: MediaImage[], usedUrls: Set<string>, preferredPurpose?: string): string {
  if (images.length === 0) return "";
  const contextLower = context.toLowerCase();
  let best: MediaImage | null = null;
  let bestScore = -Infinity;
  for (const img of images) {
    if (usedUrls.has(img.url)) continue;
    let score = 0;
    const imgPurpose = getImagePurpose(img);
    if (preferredPurpose) {
      if (imgPurpose === preferredPurpose) score += 8;
      else if (imgPurpose !== "" && imgPurpose !== preferredPurpose) {
        if (preferredPurpose === "lp-hero" && imgPurpose === "product-detail") score -= 10;
        else score -= 2;
      }
    }
    for (const tag of img.tags) {
      const t = tag.toLowerCase();
      if (!SKIP_TAGS.has(t) && contextLower.includes(t)) score += 3;
    }
    if (score > bestScore) { bestScore = score; best = img; }
  }
  if (best && bestScore >= 0) { usedUrls.add(best.url); return best.url; }
  return "";
}

function fillEmptyImages(blocks: unknown[], images: MediaImage[]): unknown[] {
  if (images.length === 0) return blocks;
  const usedUrls = new Set<string>();
  for (const block of blocks) {
    const props = (block as Record<string, unknown>).props as Record<string, unknown> | undefined;
    if (!props) continue;
    if (typeof props.imageUrl === "string" && props.imageUrl) usedUrls.add(props.imageUrl);
    if (typeof props.backgroundImageUrl === "string" && props.backgroundImageUrl) usedUrls.add(props.backgroundImageUrl);
    if (typeof props.heroImageUrl === "string" && props.heroImageUrl) usedUrls.add(props.heroImageUrl);
  }
  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown>) };
    const blockType = b.type as string;
    const ctx = `${blockType} ${(props.headline as string) ?? ""} ${(props.subheadline as string) ?? ""}`;

    if (blockType === "hero" && "imageUrl" in props && !props.imageUrl)
      props.imageUrl = findBestImage(ctx, images, usedUrls, "lp-hero");

    if (blockType === "dso-heartland-hero") {
      if (props.layout === "split") {
        if (!props.heroImageUrl) props.heroImageUrl = findBestImage(ctx, images, usedUrls, "lp-hero");
      } else {
        if (!props.backgroundImageUrl) props.backgroundImageUrl = findBestImage(ctx, images, usedUrls, "lp-hero");
      }
    }

    if ((blockType === "dso-split-feature" || blockType === "dso-lab-tour") && "imageUrl" in props && !props.imageUrl)
      props.imageUrl = findBestImage(ctx, images, usedUrls, "lp-feature");

    if (blockType.startsWith("dso-") && "imageUrl" in props && !props.imageUrl)
      props.imageUrl = findBestImage(ctx, images, usedUrls, "lp-feature");

    b.props = props;
    return b;
  });
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

/** Force brand CTA color and Chili Piper URL into every block that needs them. */
function injectBrandIntoBlocks(blocks: unknown[], brand: Record<string, unknown>): unknown[] {
  const ctaColor = (brand.ctaBackground as string) || (brand.accentColor as string) || (brand.primaryColor as string);
  const chilipiperUrl = brand.chilipiperUrl as string | undefined;
  return blocks.map((block) => {
    const b = { ...(block as Record<string, unknown>) };
    const props = { ...(b.props as Record<string, unknown>) };
    if (ctaColor && "ctaColor" in props) props.ctaColor = ctaColor;
    if (chilipiperUrl && typeof b.type === "string" && b.type.startsWith("dso-")) {
      if ("primaryCtaUrl" in props && (!props.primaryCtaUrl || props.primaryCtaUrl === "#")) {
        props.primaryCtaUrl = chilipiperUrl;
        props.primaryCtaMode = "chilipiper";
      }
      if ("ctaUrl" in props && (!props.ctaUrl || props.ctaUrl === "#")) {
        props.ctaUrl = chilipiperUrl;
        props.ctaMode = "chilipiper";
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

function normalizeBlock(raw: AiBlock, index: number): AiBlock {
  const type = (raw.type as string) ?? "hero";
  if (raw.props && typeof raw.props === "object") {
    return {
      id: raw.id ?? `${type}-${index}`,
      type,
      props: mergeWithDefaults(type, raw.props as AiBlock),
    };
  }
  const { type: _t, id: _id, ...rest } = raw;
  return {
    id: `${type}-${index}`,
    type,
    props: mergeWithDefaults(type, rest),
  };
}

function mergeWithDefaults(type: string, p: AiBlock): AiBlock {
  switch (type) {
    // ── Standard practice blocks ────────────────────────────────────
    case "hero":
      return {
        headline: p.headline ?? p.heading ?? "See What Dandy Can Do For You",
        subheadline: p.subheadline ?? p.subheading ?? p.subtitle ?? "Digital-first lab workflows that save time, reduce remakes, and delight your patients.",
        ctaText: p.ctaText ?? "Book a Demo",
        ctaUrl: p.ctaUrl ?? "#",
        ctaColor: p.ctaColor ?? "#C7E738",
        ctaTextColor: p.ctaTextColor ?? "#001a14",
        heroType: p.heroType ?? "static-image",
        layout: p.layout ?? "centered",
        backgroundStyle: p.backgroundStyle ?? "dark",
        showSocialProof: p.showSocialProof ?? true,
        socialProofText: p.socialProofText ?? "Trusted by 12,000+ dental practices across the US",
        imageUrl: p.imageUrl ?? "",
        mediaUrl: p.mediaUrl ?? "",
      };

    case "benefits-grid":
    case "features": {
      const items = (p.items ?? p.features ?? p.benefits ?? []) as AiBlock[];
      return {
        headline: p.headline ?? p.heading ?? "Why practices choose Dandy",
        columns: p.columns ?? 3,
        items: items.length > 0
          ? items.map(f => ({ icon: f.icon ?? "Zap", title: f.title ?? f.name ?? "", description: f.description ?? f.body ?? "" }))
          : [
              { icon: "Zap", title: "Faster Turnaround", description: "5-day crown delivery with real-time case tracking." },
              { icon: "RefreshCcw", title: "Free Remakes", description: "If a case doesn't fit, we remake it at no charge." },
              { icon: "HeadphonesIcon", title: "Dedicated Support", description: "A real person answers your calls and knows your preferences." },
            ],
      };
    }

    case "trust-bar":
    case "stats": {
      const items = (p.items ?? p.stats ?? []) as AiBlock[];
      return {
        items: items.length > 0
          ? items.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [{ value: "12,000+", label: "Dental Practices" }, { value: "48 hrs", label: "Avg. Turnaround" }, { value: "99.2%", label: "Perfect Fit Rate" }],
      };
    }

    case "testimonial":
    case "testimonials": {
      const list = (p.testimonials ?? []) as AiBlock[];
      const t = list[0] ?? p;
      return {
        quote: t.quote ?? t.body ?? "",
        author: t.author ?? t.name ?? "Dental Practice Owner",
        role: t.role ?? t.title ?? "Dentist",
        practiceName: t.practiceName ?? t.company ?? "",
      };
    }

    case "bottom-cta":
    case "cta":
      return {
        headline: p.headline ?? p.heading ?? "Ready to upgrade your lab — with zero risk?",
        subheadline: p.subheadline ?? p.subheading ?? "No contracts. No setup fees. Free shipping both ways.",
        ctaText: p.ctaText ?? "Book a Demo",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };

    case "how-it-works": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        headline: p.headline ?? p.heading ?? "Simple to start.",
        steps: steps.length > 0
          ? steps.map((s, i) => ({ number: s.number ?? `0${i + 1}`, title: s.title ?? s.name ?? "", description: s.description ?? s.body ?? "" }))
          : [
              { number: "01", title: "Scan & Send", description: "Take an intraoral scan and send it to Dandy in seconds." },
              { number: "02", title: "We Manufacture", description: "Your case enters our digital lab immediately." },
              { number: "03", title: "Delivered to Your Door", description: "Your restoration arrives in 5 business days." },
            ],
      };
    }

    case "comparison":
      return {
        headline: p.headline ?? p.heading ?? "A paradigm shift for your practice.",
        ctaText: p.ctaText ?? "Get Started Free",
        ctaUrl: p.ctaUrl ?? "#",
        oldWayLabel: p.oldWayLabel || "Traditional Lab",
        oldWayBullets: (Array.isArray(p.oldWayBullets) && p.oldWayBullets.length > 0)
          ? p.oldWayBullets
          : ["Long wait times", "Inconsistent fits", "Opaque pricing", "No accountability", "Manual re-work"],
        newWayLabel: p.newWayLabel || "Dandy",
        newWayBullets: (Array.isArray(p.newWayBullets) && p.newWayBullets.length > 0)
          ? p.newWayBullets
          : ["5-day crown delivery", "Free remakes — no questions asked", "Transparent pricing", "Real-time case tracking", "AI-powered quality control"],
      };

    case "pas-section":
      return {
        headline: p.headline ?? p.heading ?? "Your lab is costing you more than money.",
        body: p.body ?? p.description ?? "",
        bullets: Array.isArray(p.bullets) ? p.bullets : [],
      };

    case "stat-callout":
      return {
        stat: p.stat ?? p.value ?? "89%",
        description: p.description ?? p.label ?? "Average reduction in remakes when partnering with Dandy",
        footnote: p.footnote ?? "",
      };

    case "rich-text":
      return { content: p.content ?? p.body ?? p.html ?? "", maxWidth: p.maxWidth ?? "prose" };

    // ── DSO Corporate blocks ─────────────────────────────────────────
    case "dso-heartland-hero": {
      const stats = (p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "The Dandy Difference",
        headline: p.headline ?? p.heading ?? "Built for your DSO.",
        companyName: p.companyName ?? p.company ?? "Your DSO",
        subheadline: p.subheadline ?? p.subheading ?? "The lab partner built to match your DSO's scale — precision manufacturing, AI quality control, and network-wide visibility.",
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Schedule a Conversation",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "See the ROI",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        stats: stats.length > 0
          ? stats.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [{ value: "30%", label: "Avg case acceptance lift" }, { value: "96%", label: "First-time right rate" }, { value: "4.2 days", label: "Avg turnaround" }, { value: "$0", label: "CAPEX to start" }],
        showScrollIndicator: true,
      };
    }

    case "dso-stat-bar": {
      const stats = (p.stats ?? p.items ?? []) as AiBlock[];
      return {
        stats: stats.length > 0
          ? stats.map(s => ({ value: s.value ?? "", label: s.label ?? "" }))
          : [{ value: "30%", label: "Avg case acceptance lift" }, { value: "96%", label: "First-time right rate" }, { value: "50%", label: "Denture appointments saved" }, { value: "$0", label: "CAPEX to start" }],
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-challenges": {
      const challenges = (p.challenges ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "The Hidden Cost",
        headline: p.headline ?? p.heading ?? "At scale — even small inefficiencies compound fast.",
        backgroundStyle: p.backgroundStyle ?? "muted",
        layout: p.layout ?? "4-col",
        challenges: challenges.length > 0
          ? challenges.map(c => ({ title: c.title ?? c.name ?? "", desc: c.desc ?? c.description ?? c.body ?? "" }))
          : [
              { title: "Same-Store Growth Pressure", desc: "Acquisition pipelines have slowed. DSOs must unlock more revenue from existing practices to protect EBITDA." },
              { title: "Fragmented Lab Relationships", desc: "Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage." },
              { title: "Standards That Don't Scale", desc: "Variability creeps in, outcomes drift, and operational discipline erodes with every new location." },
              { title: "Capital Constraints", desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast." },
            ],
      };
    }

    case "dso-insights-dashboard":
      return {
        eyebrow: p.eyebrow ?? "Dandy Hub & Insights",
        headline: p.headline ?? p.heading ?? "One dashboard for every location.",
        subheadline: p.subheadline ?? p.subheading ?? "Dandy Insights gives your leadership team actionable data — not just reports. Know where to intervene before problems scale.",
        practiceLabel: p.practiceLabel ?? "practices",
        backgroundStyle: p.backgroundStyle ?? "muted",
        dashboardVariant: p.dashboardVariant ?? "light",
      };

    case "dso-success-stories": {
      const cases = (p.cases ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Proven Results",
        headline: p.headline ?? p.heading ?? "DSOs that switched and never looked back.",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
        cases: cases.length > 0
          ? cases.map(c => ({ name: c.name ?? "", stat: c.stat ?? "", label: c.label ?? "", quote: c.quote ?? "", author: c.author ?? "" }))
          : [
              { name: "APEX Dental Partners", stat: "12.5%", label: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner.", author: "Dr. Layla Lohmann, Founder" },
              { name: "Smile Brands", stat: "2–3 min", label: "saved per crown appointment", quote: "The efficiency gains were immediate. Our doctors noticed the difference from the very first case.", author: "VP of Clinical Operations" },
            ],
      };
    }

    case "dso-pilot-steps": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "How It Works",
        headline: p.headline ?? p.heading ?? "Start small. Prove it out. Then scale.",
        subheadline: p.subheadline ?? p.subheading ?? "Validate impact with a focused pilot, then expand with confidence.",
        backgroundStyle: p.backgroundStyle ?? "muted",
        steps: steps.length > 0
          ? steps.map(s => ({
              title: s.title ?? s.name ?? "",
              subtitle: s.subtitle ?? "",
              desc: s.desc ?? s.description ?? s.body ?? "",
              details: Array.isArray(s.details) ? s.details : [],
            }))
          : [
              { title: "Launch a Pilot", subtitle: "Start with 5–10 offices", desc: "Dandy deploys scanners, onboards doctors, and integrates into existing workflows — no CAPEX, no disruption.", details: ["Premium hardware included", "Dedicated field team", "Doctors trained within days"] },
              { title: "Validate Impact", subtitle: "Measure results in 60–90 days", desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time.", details: ["Live dashboard tracks KPIs", "Compare pilot vs. control group", "Executive-ready reporting"] },
              { title: "Scale With Confidence", subtitle: "Roll out across the network", desc: "Expand with the same standard, same playbook, and same results — predictable execution at enterprise scale.", details: ["Consistent onboarding", "One standard across every office", "MSA ensures network-wide alignment"] },
            ],
      };
    }

    case "dso-final-cta":
      return {
        eyebrow: p.eyebrow ?? "Next Steps",
        headline: p.headline ?? p.heading ?? "Prove ROI. Then scale.",
        subheadline: p.subheadline ?? p.subheading ?? "Validate impact with a focused pilot. Measure remake reduction, chair time recovered, and same-store revenue lift in real time.",
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Get Pricing",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "Calculate ROI",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dandy-green",
      };

    case "dso-comparison": {
      const rows = (p.rows ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "The Dandy Difference",
        headline: p.headline ?? p.heading ?? "Built for DSO scale.\nDesigned for provider trust.",
        subheadline: p.subheadline ?? p.subheading ?? "Dandy combines the lab providers choose with advanced manufacturing, AI-driven quality control, and network-wide insights.",
        companyName: p.companyName ?? p.company ?? "Your DSO",
        ctaText: p.ctaText ?? "Request a Demo",
        ctaUrl: p.ctaUrl ?? "#",
        rows: rows.map(r => ({ feature: r.feature ?? "", dandy: r.dandy ?? "", traditional: r.traditional ?? "" })),
        backgroundStyle: p.backgroundStyle ?? "muted",
      };
    }

    case "dso-lab-tour":
      return {
        eyebrow: p.eyebrow ?? "Built in the USA",
        headline: p.headline ?? p.heading ?? "See vertical integration in action.",
        body: p.body ?? p.description ?? "Unlike traditional labs, Dandy owns the entire manufacturing process — from scan to delivery.",
        quote: p.quote ?? "Dandy is a true partner, not just a vendor.",
        quoteAttribution: p.quoteAttribution ?? "DSO Clinical Operations Officer",
        imageUrl: p.imageUrl ?? "",
        videoUrl: p.videoUrl ?? "",
        ctaText: p.ctaText ?? "Request a Lab Tour",
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
          : [
              { label: "How it works", anchor: "#steps" },
              { label: "Partnership perks", anchor: "#perks" },
              { label: "FAQ", anchor: "#faq" },
            ],
        ctaText: p.ctaText ?? "Book a demo",
        ctaUrl: p.ctaUrl ?? "#",
      };
    }

    case "dso-practice-hero":
      return {
        eyebrow: p.eyebrow ?? "",
        headline: p.headline ?? p.heading ?? "Your practice. Elevated by Dandy.",
        subheadline: p.subheadline ?? p.subheading ?? "As a network partner, your practice gets dedicated support, premium scanners at no cost, and a lab that backs every case with a first-time fit guarantee.",
        primaryCtaText: p.primaryCtaText ?? p.ctaText ?? "Start your first case",
        primaryCtaUrl: p.primaryCtaUrl ?? p.ctaUrl ?? "#",
        secondaryCtaText: p.secondaryCtaText ?? "See how it works",
        secondaryCtaUrl: p.secondaryCtaUrl ?? "#",
        trustLine: p.trustLine ?? "Join hundreds of practices in your network already using Dandy",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };

    case "dso-stat-row": {
      const items = (p.items ?? p.stats ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "By the numbers",
        headline: p.headline ?? p.heading ?? "Results that speak for themselves.",
        items: items.length > 0
          ? items.map(s => ({ value: s.value ?? "", label: s.label ?? "", detail: s.detail ?? "" }))
          : [{ value: "96%", label: "First-time fit rate", detail: "Industry average is 78%" }, { value: "50%", label: "Fewer remakes", detail: "vs. traditional labs" }, { value: "2x", label: "Faster turnaround", detail: "Same-day delivery available" }],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-partnership-perks": {
      const perks = (p.perks ?? p.benefits ?? p.items ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Partnership Benefits",
        headline: p.headline ?? p.heading ?? "Perks that come with every Dandy partnership.",
        subheadline: p.subheadline ?? p.subheading ?? "From day one, your practice gets dedicated support, premium hardware, and exclusive incentives.",
        perks: perks.length > 0
          ? perks.map(pk => ({ icon: pk.icon ?? "star", title: pk.title ?? pk.name ?? "", desc: pk.desc ?? pk.description ?? "" }))
          : [
              { icon: "gift",     title: "$1,500 Lab Credit",         desc: "Get $1,500 toward your first cases — experience Dandy quality risk-free." },
              { icon: "zap",      title: "AI Scan Review",            desc: "Real-time AI flags margin issues while your patient is still in the chair." },
              { icon: "star",     title: "Dedicated DSO Support",     desc: "Your own account team. Direct line, same-day response." },
              { icon: "shield",   title: "Free CE Credits",           desc: "Accredited courses on digital dentistry, scan technique, and restorative workflows." },
              { icon: "users",    title: "Live Clinical Collaboration", desc: "Chat directly with Dandy lab technicians in real time to dial in your preps." },
              { icon: "sparkles", title: "$100 UberEats Gift Card",   desc: "Book a lunch-and-learn for your team — we'll cover the food and walk you through going digital." },
            ],
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
        eyebrow: p.eyebrow ?? "Chairside Software",
        headline: p.headline ?? p.heading ?? "The only chairside software built for same-day dentistry.",
        body: p.body ?? p.description ?? "Dandy's AI-powered platform gives clinicians real-time scan review, prep guidance, and digital workflows — all in one seamless experience.",
        imageUrl: p.imageUrl ?? "",
        features: features.length > 0
          ? features.map(f => ({ icon: f.icon ?? "zap", label: f.label ?? f.title ?? "" }))
          : [{ icon: "zap", label: "Real-time scan analysis" }, { icon: "check", label: "AI-flagged margin errors" }, { icon: "clock", label: "2–3 min saved per case" }],
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
        headline: p.headline ?? p.heading ?? "Everything you're wondering about switching.",
        subheadline: p.subheadline ?? p.subheading ?? "We know change feels risky. Here's what practices ask us most.",
        items: items.length > 0
          ? items.map(i => ({ question: i.question ?? i.q ?? i.title ?? "", answer: i.answer ?? i.a ?? i.body ?? "" }))
          : [
              { question: "Will switching labs disrupt my workflow?", answer: "No. We design the transition around your schedule. Most practices see zero disruption to active cases." },
              { question: "What if a case doesn't come back right?", answer: "We back every case with our first-time fit guarantee. If it doesn't seat, we remake it at no cost." },
            ],
        backgroundStyle: p.backgroundStyle ?? "white",
      };
    }

    case "dso-activation-steps": {
      const steps = (p.steps ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Getting Started",
        headline: p.headline ?? p.heading ?? "Four steps to going live with Dandy.",
        subheadline: p.subheadline ?? p.subheading ?? "Our onboarding team handles every detail — from scanner delivery to your first case.",
        steps: steps.length > 0
          ? steps.map((s, i) => ({ step: s.step ?? `${i + 1}`, title: s.title ?? s.name ?? "", desc: s.desc ?? s.description ?? s.body ?? "" }))
          : [
              { step: "1", title: "Schedule Your Kickoff", desc: "Meet your Dandy activation manager to align on rollout timeline and goals." },
              { step: "2", title: "Equipment Setup", desc: "We ship and install your intraoral scanners — every operatory fully configured and ready." },
              { step: "3", title: "Clinical Training", desc: "Hands-on training for doctors and staff covering scan technique and workflow." },
              { step: "4", title: "First Cases & Go Live", desc: "Submit your first cases and experience real-time tracking, guaranteed fit, and dedicated support." },
            ],
        ctaText: p.ctaText ?? "Book Your Activation Call",
        ctaUrl: p.ctaUrl ?? "#",
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "dso-promo-cards": {
      const cards = (p.cards ?? p.offers ?? []) as AiBlock[];
      return {
        eyebrow: p.eyebrow ?? "Limited-Time Offers",
        headline: p.headline ?? p.heading ?? "Exclusive promotions for DSO partners.",
        subheadline: p.subheadline ?? p.subheading ?? "Activate your practice and take advantage of offers available only through your group partnership.",
        cards: cards.length > 0
          ? cards.map(c => ({ title: c.title ?? c.name ?? "", desc: c.desc ?? c.description ?? "", badge: c.badge ?? "OFFER", ctaText: c.ctaText ?? "Claim now" }))
          : [
              { title: "$1,500 Lab Credit", desc: "Activate your practice and get $1,500 toward your first cases — experience our 96% fit rate with zero risk.", badge: "CREDIT", ctaText: "Claim my credit" },
              { title: "Free Scanner + Cart", desc: "Get a premium intraoral scanner and all-in-one operatory cart at zero cost — included with your DSO partnership.", badge: "FREE", ctaText: "Reserve yours" },
            ],
        backgroundStyle: p.backgroundStyle ?? "dark",
      };
    }

    case "footer": {
      const columns = (p.columns ?? []) as AiBlock[];
      return {
        columns: Array.isArray(columns) ? columns : [],
        copyrightText: p.copyrightText ?? `© ${new Date().getFullYear()} Dandy. All rights reserved.`,
        showSocialLinks: p.showSocialLinks ?? false,
        backgroundColor: p.backgroundColor ?? "#003A30",
        accentColor: p.accentColor ?? "#C7E738",
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
};

function buildSystemPrompt(audience: MicrositeAudience, brand: Record<string, unknown>, templateBlockTypes?: string[]): string {
  const tone            = brand.toneOfVoice as string | undefined;
  const pillars         = brand.messagingPillars as Array<{ label: string; description: string }> | undefined;
  const taglines        = brand.taglines as string[] | undefined;
  const toneKeywords    = brand.toneKeywords as string[] | undefined;
  const avoidPhrases    = brand.avoidPhrases as string[] | undefined;
  const copyExamples    = brand.copyExamples as string[] | undefined;
  const copyInstructions = brand.copyInstructions as string | undefined;
  const brandName       = (brand.brandName as string | undefined) ?? "Dandy";

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

  const brandSection = [
    tone              ? `VOICE: ${tone}` : null,
    toneKeywords?.length ? `Style words — your copy should feel: ${toneKeywords.join(", ")}` : null,
    pillars?.length   ? `Messaging pillars:\n${pillars.map(p => `- ${p.label}: ${p.description}`).join("\n")}` : null,
    taglines?.length  ? `Brand taglines (reference these, don't repeat them verbatim): ${taglines.join(" | ")}` : null,
    copyExamples?.length ? `Copy that nails the voice — study these and write in this register:\n${copyExamples.map(e => `  "${e}"`).join("\n")}` : null,
    copyInstructions?.trim() ? copyInstructions.trim() : null,
  ].filter(Boolean).join("\n");

  const copyPrinciples = `
COPY QUALITY PRINCIPLES — follow every one of these without exception:

1. Specific always beats vague. Every claim needs a number, a process, or a policy behind it.
   BAD: "Faster turnaround times that improve efficiency"
   GOOD: "5-day crown delivery with real-time case tracking"
   BAD: "Dandy's advanced technology ensures better outcomes"
   GOOD: "96% first-time fit rate. If a case doesn't seat, we remake it for free."

2. Lead with the dentist's benefit — not Dandy's features.
   BAD: "Dandy uses AI-powered quality control on every case"
   GOOD: "You get a better-fitting crown without the back-and-forth phone calls"

3. Write like one person talking directly to another across a desk. Not a press release. Not a brochure.
   BAD: "Leveraging next-generation digital workflows to optimize practice efficiency"
   GOOD: "Send a scan. Get a perfect-fit crown in 5 days."

4. Short sentences. Active voice. One idea per sentence. If you can cut a word without losing meaning, cut it.

5. Headlines are declarative and direct. No vague questions. No "How to..." or "Why...".
   BAD: "Discover how Dandy can help your practice grow"
   GOOD: "More cases. Zero lab drama."

6. Every subheadline should deepen or add to the headline — not just restate it in different words.

7. Reference this specific account — their name, their scale, their situation — naturally throughout. It should feel written for them, not filled in with a mail-merge.

8. Never stack adjectives. One strong word beats three weak ones.
   BAD: "Powerful, comprehensive, industry-leading digital solutions"
   GOOD: "A lab that backs every case with a guarantee"

9. CAPITALIZATION — Two absolute rules that BOTH apply at all times:
   a) ALWAYS start every sentence, headline, eyebrow, bullet point, step title, card title, FAQ question, and label with a capital letter. Every piece of text that starts a new thought begins with a capital. Never begin any text with a lowercase letter.
   b) NEVER title-case — do not capitalize every word. Only the first word of a sentence + proper nouns (person names, companies, cities) + acronyms (DSO, AI, ROI) + official Dandy product names (AI Scan Review, Smile Simulation) get capitals.
   WRONG (all lowercase start): "more cases. zero lab drama." → WRONG: sentence starts with lowercase
   WRONG (title case): "More Cases. Zero Lab Drama." → WRONG: mid-sentence words capitalized
   CORRECT: "More cases. Zero lab drama."
   WRONG: "send a scan. get a perfect-fit crown in 5 days." → WRONG
   CORRECT: "Send a scan. Get a perfect-fit crown in 5 days."
   WRONG: "join hundreds of practices already using dandy" → WRONG: lowercase start + "dandy" is a proper noun
   CORRECT: "Join hundreds of practices already using Dandy."

NEVER USE any of the following — not in headlines, not in body copy, not anywhere:
${forbiddenList.map(p => `- "${p}"`).join("\n")}
`.trim();

  const header = [
    `You are an expert B2B copywriter for ${brandName}, a dental technology company. You write personalized microsites for specific dental accounts.`,
    "",
    brandSection ? `BRAND VOICE & GUIDELINES:\n${brandSection}` : "",
    "",
    copyPrinciples,
    "",
    "Return ONLY valid JSON: { \"title\": string, \"slug\": string, \"blocks\": Block[] }",
    "Each Block MUST use: { \"type\": string, \"props\": { ...fields } }",
    "Never put content fields at the top level of a block. Always nest inside props.",
  ].filter(s => s !== "").join("\n");

  const blockCount = templateBlockTypes ? templateBlockTypes.length : "5–7";
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
      `AUDIENCE: ${audience === "dso-corporate" ? "DSO corporate leadership — VP of Operations, CFO, Chief Dental Officer" : audience === "dso-practice" ? "Individual dental practice within a DSO network — the dentist or office manager" : "Independent dental practice — solo dentist or small group"}`,
      "",
      "IMPORTANT: This page uses a fixed template layout. You MUST output EXACTLY these blocks in EXACTLY this order — do not add, remove, or reorder blocks. Customize ALL text copy for the specific account.",
      "",
      "BLOCKS TO GENERATE (fixed order):",
      blockList,
      footer,
    ].join("\n");
  }

  if (audience === "dso-corporate") {
    return [
      header,
      "",
      "AUDIENCE: DSO corporate leadership — VP of Operations, CFO, Chief Dental Officer.",
      "Messaging themes: same-store growth, EBITDA protection, standardization at scale, network-wide visibility, pilot-then-scale, zero CAPEX.",
      "",
      "AVAILABLE BLOCKS (use only these, in this order):",
      "1. \"dso-heartland-hero\": { eyebrow, headline, companyName, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, stats: [{ value, label }] }",
      "2. \"dso-stat-bar\": { stats: [{ value, label }], backgroundStyle }",
      "3. \"dso-challenges\": { eyebrow, headline, backgroundStyle, layout (\"4-col\"), challenges: [{ title, desc }] } — 4 DSO pain points specific to this account",
      "4. \"dso-insights-dashboard\": { eyebrow, headline, subheadline, practiceLabel, backgroundStyle, dashboardVariant (\"light\"|\"dark\") }",
      "5. \"dso-success-stories\": { eyebrow, headline, backgroundStyle, cases: [{ name, stat, label, quote, author }] } — 2–3 real DSO case studies",
      "6. \"dso-pilot-steps\": { eyebrow, headline, subheadline, backgroundStyle, steps: [{ title, subtitle, desc, details: string[] }] }",
      "7. \"dso-final-cta\": { eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, backgroundStyle }",
      footer,
    ].join("\n");
  }

  if (audience === "dso-practice") {
    return [
      header,
      "",
      "AUDIENCE: Individual dental practice within a DSO network — the dentist or office manager, not corporate leadership.",
      "Messaging themes: practice-level benefits, $0 CAPEX scanner, $1,500 lab credit, first-time fit guarantee, chairside AI, easy onboarding, DSO partnership perks.",
      "",
      "AVAILABLE BLOCKS (use only these, in EXACTLY this order):",
      "1. \"dso-practice-nav\": { dsoName, links: [{ label, anchor }], ctaText, ctaUrl } — sticky top nav; dsoName = the DSO or practice group name; links should match section anchors below (e.g. #perks, #steps, #faq)",
      "2. \"dso-practice-hero\": { eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, trustLine, backgroundStyle }",
      "3. \"dso-stat-row\": { eyebrow, headline, items: [{ value, label, detail }], backgroundStyle }",
      "4. \"dso-partnership-perks\": { eyebrow, headline, subheadline, perks: [exactly 6 × { icon, title, desc }], backgroundStyle } — list the exclusive DSO partnership benefits",
      "5. \"dso-split-feature\": { eyebrow, headline, body, bullets: string[], ctaText, ctaUrl, imagePosition (\"left\"|\"right\"), backgroundStyle } — highlight AI Scan Review",
      "6. \"dso-software-showcase\": { eyebrow, headline, body, features: [{ icon, label }], ctaText, ctaUrl, backgroundStyle, layout }",
      "7. \"dso-faq\": { eyebrow, headline, subheadline, items: [{ question, answer }], backgroundStyle } — 4–5 questions practices actually ask",
      "8. \"dso-activation-steps\": { eyebrow, headline, subheadline, steps: [{ step, title, desc }], ctaText, ctaUrl, backgroundStyle }",
      "9. \"dso-final-cta\": { eyebrow, headline, subheadline, primaryCtaText, primaryCtaUrl, secondaryCtaText, secondaryCtaUrl, backgroundStyle } — closing call to action",
      footer,
    ].join("\n");
  }

  // independent
  return [
    header,
    "",
    "AUDIENCE: Independent dental practice — solo dentist or small group, not part of a DSO.",
    "Messaging themes: lab quality, turnaround time, free remakes, digital workflow, practice growth, no contracts.",
    "",
    "AVAILABLE BLOCKS (use only these, in this order):",
    "1. \"hero\": { headline, subheadline, ctaText, ctaUrl, backgroundStyle (\"dark\"|\"white\"|\"light-gray\") }",
    "2. \"trust-bar\": { items: [{ value, label }] } — 3–4 key proof stats",
    "3. \"benefits-grid\": { headline, columns (3), items: [{ icon (lucide name), title, description }] } — 6 specific Dandy benefits",
    "4. \"testimonial\": { quote, author, role, practiceName } — a real, specific practitioner voice",
    "5. \"how-it-works\": { headline, steps: [{ number, title, description }] }",
    "6. \"comparison\": { headline, oldWayLabel, oldWayBullets: string[], newWayLabel, newWayBullets: string[] }",
    "7. \"bottom-cta\": { headline, subheadline, ctaText, ctaUrl, backgroundStyle }",
    footer,
  ].join("\n");
}

/**
 * POST /sales/accounts/:accountId/generate-microsite
 */
router.post("/accounts/:accountId/generate-microsite", micrositeLimiter, async (req, res): Promise<void> => {
  const accountId = Number(req.params.accountId);
  const { prompt: userPrompt, audience, templateId } = req.body as { prompt?: string; audience?: MicrositeAudience; templateId?: number };

  if (!audience || !["dso-corporate", "dso-practice", "independent"].includes(audience)) {
    res.status(400).json({ error: "audience is required: 'dso-corporate' | 'dso-practice' | 'independent'" });
    return;
  }

  try {
    const [account] = await db.select().from(salesAccountsTable).where(eq(salesAccountsTable.id, accountId));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const [briefing] = await db.select().from(salesBriefingsTable)
      .where(eq(salesBriefingsTable.accountId, accountId))
      .orderBy(desc(salesBriefingsTable.updatedAt))
      .limit(1);

    const brandRows = await db.select().from(lpBrandSettingsTable).limit(1);
    const brand = brandRows.length > 0 ? (brandRows[0].config as Record<string, unknown>) : {};

    // Fetch media library so the AI uses real assets, not invented URLs
    const [{ images, catalogText: imageCatalogText }, { videoUrls, catalogText: videoCatalogText }] =
      await Promise.all([fetchMediaCatalog(), fetchVideoCatalog()]);

    const openai = getOpenAIClient();
    if (!openai) { res.status(503).json({ error: "AI not configured" }); return; }

    // If a template ID was provided, fetch its block types to use as a fixed layout
    // and store the original blocks so we can restore images after AI generation.
    let templateBlockTypes: string[] | undefined;
    let templateBlocks: AiBlock[] | undefined;
    if (typeof templateId === "number") {
      const [templatePage] = await db.select().from(lpPagesTable).where(eq(lpPagesTable.id, templateId));
      if (templatePage?.blocks && Array.isArray(templatePage.blocks)) {
        templateBlocks = templatePage.blocks as AiBlock[];
        templateBlockTypes = templateBlocks.map(b => b.type as string).filter(Boolean);
      }
    }

    const briefingData = briefing?.briefingData as Record<string, unknown> | undefined;
    const systemPrompt = buildSystemPrompt(audience, brand, templateBlockTypes);

    const contextParts: string[] = [];
    contextParts.push(`ACCOUNT: ${account.displayName ?? account.name}`);
    if (account.domain) contextParts.push(`Domain: ${account.domain}`);
    if (account.segment) contextParts.push(`Segment: ${account.segment}`);
    if (account.industry) contextParts.push(`Industry: ${account.industry}`);
    contextParts.push(`MICROSITE AUDIENCE: ${audience}`);

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

    // Inject media library so AI uses real assets instead of inventing URLs
    if (imageCatalogText) contextParts.push(imageCatalogText);
    if (videoCatalogText) contextParts.push(videoCatalogText);
    if (imageCatalogText || videoCatalogText) {
      contextParts.push("CRITICAL: You MUST ONLY use URLs listed above for imageUrl, backgroundImageUrl, heroImageUrl, videoUrl, and mediaUrl fields. NEVER fabricate or invent any media URLs. If no suitable URL exists for a slot, use empty string \"\".");
    }

    if (userPrompt) contextParts.push(`\nADDITIONAL INSTRUCTIONS:\n${userPrompt}`);
    contextParts.push(`\nGenerate a personalised microsite for ${account.displayName ?? account.name} targeting ${audience} audience. Make every block specific to their business.`);

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

    const baseSlug = parsed.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    let normalizedBlocks = (parsed.blocks as AiBlock[]).map((b, i) => normalizeBlock(b, i));

    // Post-process: fill any empty image slots, replace invented video URLs, inject brand
    normalizedBlocks = fillEmptyImages(normalizedBlocks, images) as AiBlock[];
    normalizedBlocks = fillEmptyVideos(normalizedBlocks, videoUrls) as AiBlock[];
    normalizedBlocks = injectBrandIntoBlocks(normalizedBlocks, brand) as AiBlock[];

    // If a template was used, restore images from the template blocks — the AI
    // updated copy but we keep the original carefully chosen images.
    if (templateBlocks) {
      normalizedBlocks = restoreTemplateImages(normalizedBlocks, templateBlocks) as AiBlock[];
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
