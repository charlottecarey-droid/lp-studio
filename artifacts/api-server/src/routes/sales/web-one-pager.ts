import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable, lpPageVisitsTable } from "@workspace/db";
import { getSalesBrandContext, type SalesBrandContext } from "../../lib/salesBrandContext";
import { isDandyTenant } from "../../lib/planFeatures";
import { isDandyGatedBuiltin } from "@workspace/one-pager-types/constants";

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
    // from non-Dandy tenants (mirrors the picker gate in the client).
    if ((isDandyGatedBuiltin(builtinId) || isDandyGatedBuiltin(template)) && !(await isDandyTenant(tenantId))) {
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

    const bottomHeadline = brandName
      ? `Ready to partner with ${brandName}?`
      : "Ready to start your pilot?";

    const blocks = [
      {
        id: `one-pager-hero-${makeId()}`,
        type: "one-pager-hero",
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
        props: {
          headline: "What to expect during your pilot",
          columns: 3,
          items: content.features,
        },
      },
      {
        id: `dso-meet-team-${makeId()}`,
        type: "dso-meet-team",
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
        props: {
          headline: bottomHeadline,
          subheadline: "Start a risk-free 90-day pilot. No long-term commitment required.",
          ctaText: "Start Your Pilot",
          ctaUrl: resolvedCtaUrl,
        },
      },
    ];

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
