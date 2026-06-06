import Navbar from "../components/Navbar";
import PersonaHero from "../components/PersonaHero";
import FeatureRow from "../components/FeatureRow";
import SalesConsoleEmbed from "../components/SalesConsoleEmbed";
import NewMicrositeOverlay from "../components/NewMicrositeOverlay";
import DraftEmailOverlay from "../components/DraftEmailOverlay";
import IdentityWedge from "../components/IdentityWedge";
import SalesforceSyncDemo from "../components/SalesforceSyncDemo";
import FinalCta from "../components/FinalCta";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { useShareCard } from "../hooks/useShareCard";

// /for-sales — refactored per site-ia-plan.md. Old shape was 3 FeatureRows
// that read as "Sales Console at three workflow steps." New shape adds the
// two sales-specific differentiators that don't appear on /for-marketing:
// per-recipient identity (IdentityWedge moved here from the homepage), and
// the Salesforce sync demo (new component).
//
// 7-section IA:
//   1  PersonaHero (coral)          — "Personalize every account. In one click."
//   2  FeatureRow / Command center  — SalesConsoleEmbed (AI Briefing)
//   3  FeatureRow / Microsites      — NewMicrositeOverlay (per-account)
//   4  FeatureRow / AI outreach     — DraftEmailOverlay (brief-grounded email)
//   5  IdentityWedge                — Per-recipient identity (the wedge)
//   6  SalesforceSyncDemo           — Bidirectional CRM sync + custom fields
//   7  FinalCta + Footer
export default function ForSales() {
  const og = useShareCard("for-sales", {
    title: "LP Studio for Sales — Personalize every account in one click",
    description:
      "An ABM workspace where every account gets a tailored microsite and AI-drafted outreach, with per-recipient identity in every link.",
    imageUrl: "https://lpstudio.ai/opengraph.jpg",
  });
  usePageMeta({
    title: og.title,
    description: og.description,
    canonical: "https://lpstudio.ai/for-sales",
    ogImage: og.imageUrl,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: "image/jpeg",
    ogImageAlt: "LP Studio for sales teams",
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
          eyebrow="For Sales & RevOps"
          accent="var(--coral)"
          title="Personalize every account. In one click."
          sub="An ABM workspace where every account gets a tailored microsite and AI-drafted outreach — with per-recipient identity baked into every link and bidirectional Salesforce sync so every signal lands on the right contact."
          secondaryLabel="Book a demo"
        />

        <FeatureRow
          id="command-center"
          num="01"
          label="Command center"
          title="The whole book of business, warm and scannable."
          body={
            <>
              Hot accounts, live visitor signals, and one-click outreach in a
              single view. See who&apos;s engaging this week and act before the
              moment passes —{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                AI briefs every hot account on demand.
              </strong>
            </>
          }
          bullets={[
            "Accounts ranked by engagement",
            "Live visitor + intent signals",
            "AI account briefings",
            "Quick access to email, ROI, one-pagers",
          ]}
          url="app.lpstudio.ai/sales"
          bodyHeight={640}
          frame={<SalesConsoleEmbed />}
        />

        <FeatureRow
          id="microsites"
          num="02"
          label="Microsites"
          title="A microsite for every account."
          body={
            <>
              Open an account, hit Generate Microsite, and AI drafts a
              personalized page for the deal — one tailored link per contact,
              tracked end to end.
            </>
          }
          bullets={[
            "One-click per-account generation",
            "Per-contact tracked links",
            "Brand-locked, every time",
            "Approved-facts library keeps copy honest",
          ]}
          url="app.lpstudio.ai/sales/accounts/cobalt-systems"
          bodyHeight={680}
          variant="cream-2"
          frame={<NewMicrositeOverlay />}
        />

        <FeatureRow
          id="ai-outreach"
          num="03"
          label="AI outreach"
          title="Email that writes from the brief."
          body={
            <>
              LP Studio builds a contact brief, finds the role-based pain
              point, and drafts a subject line and email you can send from
              Gmail or your client in a click. Paired with the microsite link,
              every send is identified end to end.
            </>
          }
          bullets={[
            "Brief-grounded drafting",
            "Per-contact link auto-inserted",
            "Send from Gmail or Outlook",
            "Open + click tracking per contact",
          ]}
          url="app.lpstudio.ai/sales/draft-email"
          bodyHeight={680}
          frame={<DraftEmailOverlay />}
        />

        {/* 4 — Per-recipient identity. Lifted from /new homepage per IA plan.
            Sales buyers care about identity more than marketing buyers; this
            is the page that needs the full wedge framing. */}
        <IdentityWedge />

        {/* 5 — Salesforce sync. The "every signal lands on the right contact"
            story, with custom field mapping on Scale. New component. */}
        <SalesforceSyncDemo />

        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
