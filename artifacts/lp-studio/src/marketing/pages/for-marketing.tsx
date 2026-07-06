import Navbar from "../components/Navbar";
import PersonaHero from "../components/PersonaHero";
import FeatureRow from "../components/FeatureRow";
import CreatePageOverlay from "../components/CreatePageOverlay";
import SmartTrafficDemo from "../components/SmartTrafficDemo";
import TemplatesEmbed from "../components/TemplatesEmbed";
import CampaignsScene from "../components/CampaignsScene";
import Integrations from "../components/Integrations";
import FinalCta from "../components/FinalCta";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { useShareCard } from "../hooks/useShareCard";

// /for-marketing — refactored per site-ia-plan.md. The old page reused the
// same four FeatureRow product embeds as the homepage (Builder · Templates ·
// Brand · Dashboard) which made it feel like a paraphrase. The new shape is
// marketing-specific: prompt-to-page · A/B + Smart Traffic (new component,
// the marketing buyer's biggest concrete value-add) · templates by motion ·
// the stack-integration story focused on MAP handoff.
//
// 7-section IA:
//   1  PersonaHero (indigo)         — "Ship campaigns without the design queue."
//   2  SmartTrafficDemo             — A/B/C variants + Smart Traffic routing
//   3  FeatureRow / AI generation   — Prompt → page, lifted hero pattern
//   4  CampaignsScene               — orchestration wizard + backflow signals
//                                     (moved from homepage #9 — fits the marketer
//                                     workflow story between generate and pick-a-template)
//   5  FeatureRow / Templates       — TemplatesEmbed (filtered, marketing motions)
//   6  Integrations                 — Marketo + GA4 lead-handoff story (HubSpot soon)
//   7  FinalCta + Footer
export default function ForMarketing() {
  const og = useShareCard("for-marketing", {
    title: "LP Studio for Marketing — Ship without the design queue",
    description:
      "Generate on-brand pages from a prompt, A/B test every variant with Smart Traffic auto-routing, and hand off leads to Marketo, HubSpot, GA4, or any webhook.",
    imageUrl: "https://lpstudio.ai/opengraph.jpg",
  });
  usePageMeta({
    title: og.title,
    description: og.description,
    canonical: "https://lpstudio.ai/for-marketing",
    ogImage: og.imageUrl,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: "image/jpeg",
    ogImageAlt: "LP Studio for marketing teams",
    siteName: "LP Studio",
  });

  return (
    <div
      style={{
        background: "var(--cream)",
        color: "var(--ink)",
        minHeight: "100vh",
      }}
    >
      <Navbar />
      <main>
        <PersonaHero
          persona="marketing"
          accent="var(--indigo)"
          title="Ship campaigns without the design queue."
          sub="Generate on-brand pages from a prompt, A/B every variant with Smart Traffic auto-routing the winner, and hand off leads to the MAP your demand-gen team already runs — launch in an afternoon, not a sprint."
          secondaryLabel="Talk to sales"
        />

        {/* 1 — A/B testing + Smart Traffic. The marketing-specific
            value-add that doesn't appear anywhere else on the site —
            led with here because variant testing + auto-routing is the
            sharpest thing demand-gen buyers are looking for. */}
        <SmartTrafficDemo />

        {/* 2 — AI page generation. Prompt → page sits underneath the
            A/B story now: once they buy into the testing motion, this
            shows how the variants get made in the first place. */}
        <FeatureRow
          id="generate"
          num="02"
          label="Generate"
          title="Prompt → page in under a minute."
          body={
            <>
              Type a brief, paste a URL, or drop a screenshot. AI drafts an
              on-brand page that obeys your fonts, colors, voice, and the
              approved facts library — so generated copy stays{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                honest and on-message
              </strong>{" "}
              the first time.
            </>
          }
          bullets={[
            "Prompt, URL, or screenshot → page",
            "Brand-locked blocks (colors, type, voice)",
            "Strict AI facts mode",
            "Inline copy editing after generation",
          ]}
          url="app.lpstudio.ai/pages?new=ai"
          bodyHeight={720}
          frame={<CreatePageOverlay />}
        />

        {/* 3 — Campaigns: orchestration wizard (audience → templates →
            push to MAP/CRM) + live engagement signals flowing back into
            Salesforce, Marketo, and Slack. Was on the homepage; moved
            here because this is a marketing-persona story. */}
        <CampaignsScene />

        {/* 4 — Templates by motion. Reuse the live TemplatesEmbed but frame
            it around demand-gen / events / product-launch motions in copy. */}
        <FeatureRow
          id="templates"
          num="04"
          label="Templates"
          title="Templates for the motions you actually run."
          body={
            <>
              Demand-gen, event RSVPs, product launches, webinars,
              gated guides — start from a category-tuned template and let
              your brand inherit on clone. Browse them live, then iterate in
              the builder.
            </>
          }
          bullets={[
            "Demand-gen + event + product-launch packs",
            "Live preview thumbnails (not Figma exports)",
            "Inherit your brand on clone",
            "Re-skin in seconds if the campaign pivots",
          ]}
          url="app.lpstudio.ai/templates?motion=marketing"
          bodyHeight={620}
          frame={<TemplatesEmbed />}
        />

        {/* 6 — Stack integrations. Same Integrations component as homepage
            and /features — but the copy above (in PersonaHero + this
            section's marker) frames it as the lead-handoff story. */}
        <Integrations />

        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

