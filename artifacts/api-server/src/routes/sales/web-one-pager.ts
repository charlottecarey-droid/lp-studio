import { Router } from "express";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable, lpPageVisitsTable, salesLayoutDefaultsTable } from "@workspace/db";
import { getSalesBrandContext, type SalesBrandContext } from "../../lib/salesBrandContext";
import { isDandyTenant } from "../../lib/planFeatures";
import { detectAndWriteFlagsForPage } from "../../lib/factFlags";
import { isDandyGatedBuiltin } from "@workspace/one-pager-types/constants";
import { stripContentFromGlobalLayoutConfig } from "../../lib/onePagerGlobalLayout";

const router = Router();

type Audience = "executive" | "clinical" | "practice-manager";

interface AudienceFeature { icon: string; title: string; description: string; }
interface AudienceContent { subtitle: string; features: AudienceFeature[]; }

/**
 * Build the per-audience feature copy for the one-pager default template.
 *
 * Brand-aware: any reference to the seller's product/platform is interpolated
 * from the tenant's brand context (brandName). Tenants without brand config
 * see a neutral "we"/"our" voice — never a literal "Dandy".
 */
function buildAudienceContent(brand: SalesBrandContext): Record<Audience, AudienceContent> {
  const name = brand.brandName || "";
  const possessive = name ? `${name}'s` : "our";
  const productLabel = name ? `${name} Insights` : "our insights dashboard";
  const portalLabel = name ? `the ${name} portal` : "our partner portal";
  const reduceFrictionWith = name ? `with ${name}` : "with us";

  return {
    executive: {
      subtitle: "Achieve quality, consistency, and control at scale.",
      features: [
        { icon: "Users", title: "Onsite and virtual training", description: "No downtime needed. We handle setup end to end, then get your teams up to speed fast with free onboarding." },
        { icon: "MessageCircle", title: "Real-time collaboration", description: "Live chat and review connect your teams directly with our experts in real time." },
        { icon: "Bot", title: "AI-powered quality checks", description: "Automated review catches issues early — before they become rework — so quality stays consistent." },
        { icon: "BarChart2", title: productLabel, description: `${possessive} dashboard surfaces aggregate, program-level insights including adoption, utilization, and quality signals.` },
        { icon: "Clipboard", title: "Operations simplified", description: `Access ${portalLabel} to track, manage, and review active work, and use our dashboard to streamline invoicing.` },
        { icon: "DollarSign", title: "Exclusive pricing for your organization", description: "Contact the team below to access a tailored proposal with approved pricing." },
      ],
    },
    clinical: {
      subtitle: "Embrace smarter technology and seamless workflows across your teams.",
      features: [
        { icon: "MessageCircle", title: "Expert collaboration", description: "Your teams can reach our experts in seconds or collaborate on complex work virtually." },
        { icon: "Bot", title: "AI-powered quality checks", description: "Automated review catches issues early — before they become rework — so quality stays consistent." },
        { icon: "Activity", title: "Streamlined workflows", description: "Adopt seamless digital workflows that save time and create a better experience for everyone involved." },
        { icon: "Users", title: "Onsite and virtual training", description: "No downtime needed. Get up to speed fast with free onboarding and unlimited access to ongoing education." },
      ],
    },
    "practice-manager": {
      subtitle: `Reduce operational friction and administrative burden ${reduceFrictionWith}.`,
      features: [
        { icon: "DollarSign", title: "Invoicing made easy", description: "Our dashboard makes invoicing a simple and efficient process." },
        { icon: "BarChart2", title: "Insights in one place", description: `Gain visibility into timelines, communicate with our team, manage payment, and more in ${portalLabel}.` },
        { icon: "MessageCircle", title: "Real-time communication", description: "Our experts handle communication end to end, including live collaboration, fielding questions, and issue resolution." },
        { icon: "Users", title: "Onsite and virtual training", description: "No downtime needed. We handle setup end to end, then get your teams up to speed fast with free onboarding and training." },
      ],
    },
  };
}

interface PartnerFeature { title: string; desc: string; }
interface PartnerStat { value: string; desc: string; }
interface PartnerContent {
  headline: string;
  /** May contain a `{dso}` placeholder that is replaced with the prospect name. */
  intro: string;
  features: PartnerFeature[];
  stats: PartnerStat[];
  boldHeading: boolean;
}

/**
 * Build the Partner Practices one-pager copy.
 *
 * Brand-aware and tenant-neutral: any product/partner reference interpolates
 * the tenant's brandName, falling back to a neutral "we"/"our" voice. Never a
 * literal "Dandy" for tenants without brand config. These are only the *defaults*
 * — a tenant's saved Partner template layout (dandy_partner_template_layout)
 * overrides each field in buildPartnerBlocks.
 */
function buildPartnerContent(brand: SalesBrandContext, isDandy: boolean): PartnerContent {
  const name = brand.brandName || "";
  const possessive = name ? `${name}'s` : "our";
  return {
    headline: name
      ? `Unlock the power of a smarter partnership with ${name}`
      : "Unlock the power of a smarter partnership",
    intro: name
      ? `As {dso}'s newest preferred partner, ${name} is here to help your organization thrive — delivering smarter, faster, and more predictable outcomes while elevating your customer experience and your bottom line.`
      : `As {dso}'s newest preferred partner, we're here to help your organization thrive — delivering smarter, faster, and more predictable outcomes while elevating your customer experience and your bottom line.`,
    features: [
      { title: "Increase predictability", desc: "Get real-time expert guidance for confident, accurate outcomes every time." },
      { title: "Digitize every workflow", desc: "Adopt seamless digital workflows that save time and reduce friction across your teams." },
      { title: "Access state-of-the-art quality", desc: "Deliver high-quality results with digital precision, premium materials, and unmatched consistency." },
      { title: "Unlock partnership perks and preferred pricing", desc: "Contact the team below to access a tailored proposal with approved pricing." },
    ],
    // The 88/83/67% figures are DANDY survey results. They must never be
    // published attributed to another brand — non-Dandy tenants get no
    // default stats (the stat block is omitted downstream until the tenant
    // saves real numbers in the Partner template editor).
    stats: isDandy
      ? [
          { value: "88%", desc: `say ${possessive} real-time support makes case management easier.` },
          { value: "83%", desc: `say they have saved time using ${possessive} portal to manage their work.` },
          { value: "67%", desc: `say ${possessive} technology gives them a competitive edge.` },
        ]
      : [],
    boldHeading: true,
  };
}

function asNonEmptyString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

/**
 * Overlay the tenant's saved Partner template layout (if any) onto the
 * brand-aware defaults. Mirrors how the PDF generator reads
 * `dandy_partner_template_layout` (partnerHeadline / partnerIntro /
 * partnerFeatures / partnerStats + headerCfg.boldHeading).
 */
function applyPartnerLayout(base: PartnerContent, saved: Record<string, unknown> | null): PartnerContent {
  if (!saved) return base;
  const headerCfg = (saved.headerCfg ?? {}) as Record<string, unknown>;
  const savedFeatures = Array.isArray(saved.partnerFeatures)
    ? (saved.partnerFeatures as unknown[])
        .map((f) => {
          const obj = (f ?? {}) as Record<string, unknown>;
          const title = asNonEmptyString(obj.title);
          if (!title) return null;
          return { title, desc: typeof obj.desc === "string" ? obj.desc : "" } as PartnerFeature;
        })
        .filter((f): f is PartnerFeature => f !== null)
    : null;
  const savedStats = Array.isArray(saved.partnerStats)
    ? (saved.partnerStats as unknown[])
        .map((s) => {
          const obj = (s ?? {}) as Record<string, unknown>;
          const value = asNonEmptyString(obj.value);
          if (!value) return null;
          return { value, desc: typeof obj.desc === "string" ? obj.desc : "" } as PartnerStat;
        })
        .filter((s): s is PartnerStat => s !== null)
    : null;
  return {
    headline: asNonEmptyString(saved.partnerHeadline) ?? base.headline,
    intro: asNonEmptyString(saved.partnerIntro) ?? base.intro,
    features: savedFeatures && savedFeatures.length > 0 ? savedFeatures : base.features,
    stats: savedStats && savedStats.length > 0 ? savedStats : base.stats,
    // The Partner header "Bold heading" toggle: undefined/true keeps bold;
    // only an explicit false flips to normal weight.
    boldHeading: headerCfg.boldHeading === false ? false : true,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Default per-block style settings baked onto every freshly generated web
// One Pager so it reads with comfortable, consistent padding and slightly
// smaller type out of the box. Editors can still override these per block
// from the Block Layout / Text Size controls in the builder.
//
// - `textScale: "90"` renders all type at 90% of the base size.
// - `paddingX: "md"` (40px) on the content sections combines with each
//   section's own 24px inner padding to inset readable content ~64px from the
//   sheet edge — matching the hero band's internal 64px text inset (see
//   BlockOnePagerHero), so the hero and the sections below it line up.
const CONTENT_SETTINGS = { textScale: "90", paddingX: "md" } as const;
// The hero is a full-bleed band: it must reach the sheet edges, so it takes
// the text scale but NO paddingX (its own internal padding insets the text).
const HERO_SETTINGS = { textScale: "90" } as const;

router.post("/web-one-pager", async (req, res): Promise<void> => {
  try {
    const {
      dsoName,
      audience = "executive",
      sideImageUrl,
      phone,
      teamMembers,
      ctaUrl,
      tenantId,
      builtinId,
      template,
    } = req.body as {
      dsoName: string;
      audience?: Audience;
      sideImageUrl?: string;
      phone?: string;
      teamMembers?: { name: string; role: string; email?: string; photo?: string; chilipiperUrl?: string }[];
      ctaUrl?: string;
      tenantId?: number;
      builtinId?: string;
      template?: string;
    };

    if (!dsoName || typeof dsoName !== "string") {
      res.status(400).json({ error: "dsoName is required" });
      return;
    }

    // Require an explicit tenantId — refuse to silently default to Dandy
    // (tenant 1). This route is callable without auth, so the caller must
    // identify which tenant the page belongs to.
    if (typeof tenantId !== "number" || !Number.isFinite(tenantId) || tenantId <= 0) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    // Gate the Dandy-only built-ins: reject explicit requests to publish them
    // from non-Dandy tenants (mirrors the picker gate in the client). The flag
    // is reused below to decide whether Dandy's default survey stats may render.
    const dandyTenant = await isDandyTenant(tenantId);
    if ((isDandyGatedBuiltin(builtinId) || isDandyGatedBuiltin(template)) && !dandyTenant) {
      res.status(403).json({ error: "This built-in template is not available for your workspace." });
      return;
    }

    const brandCtx = await getSalesBrandContext(tenantId);
    const audienceContent = buildAudienceContent(brandCtx);
    const content = audienceContent[audience] ?? audienceContent.executive;

    const brandName = brandCtx.brandName;
    // Resolve the final CTA URL: explicit caller URL → brand's Chili Piper
    // URL → brand's defaultCtaUrl → "#". Never fall back to a hardcoded
    // meetdandy.com URL.
    const resolvedCtaUrl = ctaUrl || brandCtx.chilipiperUrl || brandCtx.defaultCtaUrl || "#";

    // The Partner Practices template ("new-partner"/"partner2") builds a
    // different block layout (hero + benefits + stats + CTA) from the pilot.
    // Anything else falls through to the 90-Day Pilot layout below.
    const isPartner = template === "new-partner" || template === "partner2";

    let blocks: Array<{ id: string; type: string; blockSettings: Record<string, string>; props: Record<string, unknown> }>;

    if (isPartner) {
      // Pull the saved Partner template layout (copy + boldHeading) so the web
      // page mirrors what the rep configured for the PDF. Resolution order
      // matches GET /sales/layout-defaults/:key — tenant row → global row
      // (tenant_id NULL, superadmin-managed) → brand-aware defaults. Partner is
      // not a Dandy-gated built-in, so the global fallback needs no brand gate,
      // BUT a global row serves LAYOUT ONLY (stripContentFromGlobalLayoutConfig):
      // its copy/stats were authored under the operator's brand and must not
      // publish under this tenant's — in particular global partnerStats must
      // never re-create the stat block for a tenant that saved no stats itself.
      // Best-effort: a missing/unreadable row just leaves the defaults in place.
      let savedPartner: Record<string, unknown> | null = null;
      try {
        const rows = await db
          .select({ tenantId: salesLayoutDefaultsTable.tenantId, config: salesLayoutDefaultsTable.config })
          .from(salesLayoutDefaultsTable)
          .where(
            and(
              or(
                eq(salesLayoutDefaultsTable.tenantId, tenantId),
                isNull(salesLayoutDefaultsTable.tenantId),
              ),
              eq(salesLayoutDefaultsTable.templateKey, "dandy_partner_template_layout"),
            ),
          );
        const tenantRow = rows.find((r) => r.tenantId !== null);
        const globalRow = rows.find((r) => r.tenantId === null);
        const resolved = tenantRow?.config ?? stripContentFromGlobalLayoutConfig(globalRow?.config ?? null);
        if (resolved && typeof resolved === "object") {
          savedPartner = resolved as Record<string, unknown>;
        }
      } catch (e) {
        console.warn("[web-one-pager] failed to load partner layout default", e);
      }

      const partner = applyPartnerLayout(buildPartnerContent(brandCtx, dandyTenant), savedPartner);
      // Replace the {dso} placeholder (used in the Partner intro) with the
      // prospect name, matching the PDF generator's substitution.
      const partnerIntro = partner.intro.replace(/\{dso\}/g, dsoName);
      const partnerCtaHeadline = brandName
        ? `Ready to partner with ${brandName}?`
        : "Ready to start the partnership?";

      blocks = [
        {
          id: `one-pager-hero-${makeId()}`,
          type: "one-pager-hero",
          blockSettings: HERO_SETTINGS,
          props: {
            partnerName: dsoName,
            headline: partner.headline,
            tagline: "Your partnership overview",
            subtitle: partnerIntro,
            sideImageUrl: sideImageUrl ?? "",
            phone: phone ?? "",
            // Carry the saved "Bold heading" toggle onto the web hero so
            // BlockOnePagerHero renders the matching weight.
            boldHeading: partner.boldHeading,
          },
        },
        {
          id: `benefits-grid-${makeId()}`,
          type: "benefits-grid",
          blockSettings: CONTENT_SETTINGS,
          props: {
            headline: brandName ? `Why partner with ${brandName}` : "Why partner with us",
            columns: partner.features.length === 4 ? 2 : 3,
            items: partner.features.map((f) => ({
              icon: "CheckCircle",
              title: f.title,
              description: f.desc,
            })),
          },
        },
        // Stat showcase only when there are stats to show — non-Dandy tenants
        // with no saved partner stats get no block instead of a page section
        // publishing Dandy's survey numbers under their own brand.
        ...(partner.stats.length > 0
          ? [{
              id: `dso-stat-showcase-${makeId()}`,
              type: "dso-stat-showcase",
              blockSettings: CONTENT_SETTINGS as unknown as Record<string, string>,
              props: {
                eyebrow: "By the Numbers",
                headline: "Results that speak for themselves.",
                backgroundStyle: "dark",
                stats: partner.stats.map((s) => ({ value: s.value, label: s.desc })),
              } as Record<string, unknown>,
            }]
          : []),
        {
          id: `bottom-cta-${makeId()}`,
          type: "bottom-cta",
          blockSettings: CONTENT_SETTINGS,
          props: {
            headline: partnerCtaHeadline,
            subheadline: "Let's build a partnership that scales with your organization.",
            ctaText: "Get Started",
            ctaUrl: resolvedCtaUrl,
          },
        },
      ];
    } else {
      const bottomHeadline = brandName
        ? `Ready to partner with ${brandName}?`
        : "Ready to start your pilot?";

      blocks = [
        {
          id: `one-pager-hero-${makeId()}`,
          type: "one-pager-hero",
          // Render the headline/body one notch smaller by default. The hero is a
          // full-bleed band, so it gets NO paddingX (the band must reach the sheet
          // edges); its internal padding handles the text inset instead.
          blockSettings: HERO_SETTINGS,
          props: {
            partnerName: dsoName,
            tagline: "Your custom partnership overview",
            subtitle: content.subtitle,
            sideImageUrl: sideImageUrl ?? "",
            phone: phone ?? "",
          },
        },
        {
          id: `benefits-grid-${makeId()}`,
          type: "benefits-grid",
          blockSettings: CONTENT_SETTINGS,
          props: {
            headline: "What to expect during your pilot",
            columns: 3,
            items: content.features,
          },
        },
        {
          id: `dso-meet-team-${makeId()}`,
          type: "dso-meet-team",
          blockSettings: CONTENT_SETTINGS,
          props: {
            eyebrow: "Your Dedicated Team",
            headline: "Meet your contacts for training, support, and pilot check-ins.",
            subheadline: "",
            backgroundStyle: "dark",
            members: teamMembers && teamMembers.length > 0
              ? teamMembers
              : [
                  { name: "Your Account Executive", role: "Enterprise Account Executive", email: "" },
                  { name: "Your Account Manager", role: "Account Manager", email: "" },
                ],
          },
        },
        {
          id: `dso-pilot-steps-${makeId()}`,
          type: "dso-pilot-steps",
          blockSettings: CONTENT_SETTINGS,
          props: {
            eyebrow: "Your Pilot",
            headline: "90 days. No long-term commitment.",
            subheadline: "Start small, prove the impact, then scale across your network.",
            backgroundStyle: "muted",
            steps: [
              {
                title: "Launch a Pilot",
                subtitle: "Start with a handful of locations",
                desc: `${brandName || "We"} ${brandName ? "handles" : "handle"} setup, onboard${brandName ? "s" : ""} your teams with hands-on training, and integrate${brandName ? "s" : ""} into existing workflows — no upfront investment, no disruption.`,
                details: [
                  "Everything you need included from day one",
                  "Dedicated team manages change management",
                  "Teams trained and up to speed within days",
                ],
              },
              {
                title: "Validate Impact",
                subtitle: "Measure results in 60–90 days",
                desc: "Track efficiency gains, time recovered, and revenue lift in real time — proving ROI before you scale.",
                details: [
                  "Live dashboard tracks pilot KPIs",
                  "Compare pilot locations vs. control group",
                  "Executive-ready reporting for leadership review",
                ],
              },
              {
                title: "Scale With Confidence",
                subtitle: "Roll out across your organization",
                desc: "Expand with the same standard, same playbook, and same results — predictable execution at scale.",
                details: [
                  "Consistent onboarding across all locations",
                  "One standard across every location and team",
                  "Agreement ensures alignment at scale",
                ],
              },
            ],
          },
        },
        {
          id: `bottom-cta-${makeId()}`,
          type: "bottom-cta",
          blockSettings: CONTENT_SETTINGS,
          props: {
            headline: bottomHeadline,
            subheadline: "Start a risk-free 90-day pilot. No long-term commitment required.",
            ctaText: "Start Your Pilot",
            ctaUrl: resolvedCtaUrl,
          },
        },
      ];
    }

    const baseSlug = `onepager-${slugify(dsoName)}`;
    let finalSlug = baseSlug;

    // Slug conflicts are scoped per tenant — two tenants can each have an
    // "onepager-acme" page. Only check within this tenant's namespace.
    for (let attempt = 1; attempt <= 20; attempt++) {
      const conflict = await db
        .select({ id: lpPagesTable.id })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, finalSlug)))
        .limit(1);
      if (conflict.length === 0) break;
      finalSlug = `${baseSlug}-${attempt}`;
    }

    const [page] = await db.insert(lpPagesTable).values({
      tenantId,
      title: `${dsoName} One Pager`,
      slug: finalSlug,
      status: "published",
      blocks: blocks as unknown as typeof lpPagesTable.$inferInsert["blocks"],
    }).returning({ id: lpPagesTable.id, slug: lpPagesTable.slug });

    // Task #1138 — detect + persist per-page fact flags (account-specific stats
    // pulled into the one-pager are exactly what the reviewer should vet). Best-
    // effort so detection never blocks one-pager generation.
    if (page?.id) {
      try {
        await detectAndWriteFlagsForPage({ tenantId, pageId: page.id, blocks });
      } catch (flagErr) {
        console.warn("[web-one-pager] fact-flag sync failed", String(flagErr));
      }
    }

    res.json({ pageId: page.id, slug: page.slug, url: `/lp/${page.slug}` });
  } catch (err) {
    console.error("[web-one-pager] error", err);
    res.status(500).json({ error: "Failed to generate one pager" });
  }
});

router.get("/web-one-pager/views/:pageId", async (req, res): Promise<void> => {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    if (isNaN(pageId)) {
      res.status(400).json({ error: "Invalid pageId" });
      return;
    }
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lpPageVisitsTable)
      .where(eq(lpPageVisitsTable.pageId, pageId));
    res.json({ viewCount: row?.count ?? 0 });
  } catch (err) {
    console.error("[web-one-pager/views] error", err);
    res.status(500).json({ error: "Failed to fetch view count" });
  }
});

export default router;
