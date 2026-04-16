import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpPagesTable, lpPageVisitsTable } from "@workspace/db";

const router = Router();

type Audience = "executive" | "clinical" | "practice-manager";

interface AudienceFeature { icon: string; title: string; description: string; }
interface AudienceContent { subtitle: string; features: AudienceFeature[]; }

const AUDIENCE_CONTENT: Record<Audience, AudienceContent> = {
  executive: {
    subtitle: "Achieve quality, consistency, and control at scale.",
    features: [
      { icon: "Users", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your practices up to speed fast with free onboarding." },
      { icon: "MessageCircle", title: "Clinical collaboration", description: "Live Chat and Live Scan Review connect clinicians directly with our team of lab technicians in real time." },
      { icon: "Bot", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "BarChart2", title: "Dandy Insights", description: "Dandy surfaces aggregate, pilot-level insights including scanner utilization, workflow adoption, and quality signals." },
      { icon: "Clipboard", title: "Case management simplified", description: "Access the Dandy Portal to track, manage, and review active orders and our dashboard to streamline invoicing." },
      { icon: "DollarSign", title: "Exclusive pricing for your organization", description: "Contact the team below to access a product guide with approved pricing." },
    ],
  },
  clinical: {
    subtitle: "Fully embrace digital dentistry with smarter technology and seamless workflows.",
    features: [
      { icon: "MessageCircle", title: "Clinical collaboration", description: "Clinicians and staff can speak with our team of clinical experts in just 60 seconds or collaborate on complex cases virtually." },
      { icon: "Bot", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "Activity", title: "2-Appointment Dentures", description: "Utilize seamless digital workflows like 2-Appointment Dentures to save chair time and create a better patient experience." },
      { icon: "Users", title: "Onsite and virtual training", description: "No downtime needed. Get up to speed fast with free onboarding and unlimited access to ongoing digital CPD credit education." },
    ],
  },
  "practice-manager": {
    subtitle: "Reduce operational friction and administrative burden with Dandy.",
    features: [
      { icon: "DollarSign", title: "Invoicing made easy", description: "Our dashboard makes invoicing a simple and efficient process." },
      { icon: "BarChart2", title: "Get insights in Practice Portal", description: "Gain visibility into order delivery dates, communicate with the lab, manage payment, and more." },
      { icon: "MessageCircle", title: "Real-time lab communication", description: "Our team of clinical experts handle lab communication including live collaboration, fielding questions, and issue resolution." },
      { icon: "Users", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your teams up to speed fast with free onboarding and CPD training." },
    ],
  },
};

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

router.post("/sales/web-one-pager", async (req, res): Promise<void> => {
  try {
    const {
      dsoName,
      audience = "executive",
      sideImageUrl,
      phone,
      teamMembers,
      ctaUrl,
      tenantId = 1,
    } = req.body as {
      dsoName: string;
      audience?: Audience;
      sideImageUrl?: string;
      phone?: string;
      teamMembers?: { name: string; role: string; email?: string; photo?: string; chilipiperUrl?: string }[];
      ctaUrl?: string;
      tenantId?: number;
    };

    if (!dsoName || typeof dsoName !== "string") {
      res.status(400).json({ error: "dsoName is required" });
      return;
    }

    const content = AUDIENCE_CONTENT[audience] ?? AUDIENCE_CONTENT.executive;

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
          headline: "Meet your contacts for training, clinical support, and pilot check-ins.",
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
              subtitle: "Start with 5–10 locations",
              desc: "Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows — no CAPEX, no disruption.",
              details: [
                "Premium hardware included for every operatory",
                "Dedicated field team manages change management",
                "Doctors trained and scanning within days",
              ],
            },
            {
              title: "Validate Impact",
              subtitle: "Measure results in 60–90 days",
              desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time — proving ROI before you scale.",
              details: [
                "Live dashboard tracks pilot KPIs",
                "Compare pilot offices vs. control group",
                "Executive-ready reporting for leadership review",
              ],
            },
            {
              title: "Scale With Confidence",
              subtitle: "Roll out across the network",
              desc: "Expand with the same standard, same playbook, and same results — predictable execution at enterprise scale.",
              details: [
                "Consistent onboarding across all locations",
                "One standard across every office and brand",
                "MSA ensures network-wide alignment at scale",
              ],
            },
          ],
        },
      },
      {
        id: `bottom-cta-${makeId()}`,
        type: "bottom-cta",
        props: {
          headline: "Ready to partner with Dandy?",
          subheadline: "Start a risk-free 90-day pilot. No long-term commitment required.",
          ctaText: "Start Your Pilot",
          ctaUrl: ctaUrl ?? "https://meetdandy.com/dso",
        },
      },
    ];

    const baseSlug = `onepager-${slugify(dsoName)}`;
    let finalSlug = baseSlug;

    for (let attempt = 1; attempt <= 20; attempt++) {
      const conflict = await db
        .select({ id: lpPagesTable.id })
        .from(lpPagesTable)
        .where(eq(lpPagesTable.slug, finalSlug))
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

    res.json({ pageId: page.id, slug: page.slug, url: `/p/${page.slug}` });
  } catch (err) {
    console.error("[web-one-pager] error", err);
    res.status(500).json({ error: "Failed to generate one pager" });
  }
});

router.get("/sales/web-one-pager/views/:pageId", async (req, res): Promise<void> => {
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
