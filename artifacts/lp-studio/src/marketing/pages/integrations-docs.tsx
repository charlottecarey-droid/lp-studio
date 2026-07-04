import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { useShareCard } from "../hooks/useShareCard";

// Single integrations docs hub. Documents every shipped integration, each in
// its own section with a stable anchor id. The marketing Integrations section
// (components/Integrations.tsx) links every tile and the featured Salesforce
// panel to its matching #anchor here. The old /docs/integrations/zapier URL
// redirects to #zapier (see MarketingApp.tsx) so existing links/share cards
// keep resolving.
//
// Source of truth for "what ships": artifacts/api-server/src/lib/* and
// artifacts/api-server/src/routes/*. Do not document an integration here
// unless there is a shipped backend to back it.

interface IntegrationDoc {
  id: string;
  name: string;
  category: string;
}

// Order mirrors the marketing Integrations grouping (featured CRM first, then
// lead handoff, scheduling & ops, signals & analytics).
const INDEX: IntegrationDoc[] = [
  { id: "salesforce", name: "Salesforce", category: "CRM" },
  { id: "marketo", name: "Marketo", category: "Lead handoff" },
  { id: "hubspot", name: "HubSpot", category: "Lead handoff" },
  { id: "google-sheets", name: "Google Sheets", category: "Lead handoff" },
  { id: "webhooks", name: "Webhooks", category: "Lead handoff" },
  { id: "zapier", name: "Zapier", category: "Lead handoff" },
  { id: "chili-piper", name: "Chili Piper", category: "Scheduling & ops" },
  { id: "asana", name: "Asana", category: "Scheduling & ops" },
  { id: "resend", name: "Resend", category: "Scheduling & ops" },
  { id: "slack", name: "Slack", category: "Scheduling & ops" },
  { id: "rb2b", name: "RB2B", category: "Signals & analytics" },
  { id: "apollo", name: "Apollo", category: "Signals & analytics" },
  { id: "ga4", name: "Google Analytics 4", category: "Signals & analytics" },
];

export default function IntegrationsDocs() {
  const og = useShareCard("integrations-docs", {
    title: "LP Studio integrations — connect your revenue stack",
    description:
      "Every LP Studio integration in one place: Salesforce, Marketo, HubSpot, Google Sheets, Webhooks, Zapier, Chili Piper, Asana, Resend, Slack, RB2B, Apollo, and Google Analytics 4. What each one does and how to connect it.",
    imageUrl: "https://lpstudio.ai/opengraph.jpg",
  });
  usePageMeta({
    title: og.title,
    description: og.description,
    canonical: "https://lpstudio.ai/docs/integrations",
    ogImage: og.imageUrl,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: "image/jpeg",
    ogImageAlt: "LP Studio integrations",
    siteName: "LP Studio",
  });

  // Native anchor scrolling is unreliable here: the section the URL hash points
  // at hasn't rendered when the browser tries to jump, and the fixed Navbar
  // would cover it anyway. Scroll to the hashed section after mount, honoring
  // the scroll-margin-top set on each <Section>.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      // Defer a frame so layout is settled before scrolling.
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "auto", block: "start" }));
    }
  }, []);

  return (
    <div className="min-h-screen paper-grain" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-36 pb-24">
        <div className="mb-12">
          <div className="marker marker-rule mb-6">Docs · Integrations</div>
          <h1
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(40px, 5.5vw, 64px)",
              lineHeight: 1.02,
              fontWeight: 600,
              letterSpacing: "-0.028em",
              marginBottom: 16,
            }}
          >
            LP Studio integrations
          </h1>
          <p className="text-[16px] leading-[1.7]" style={{ color: "var(--ink-soft)" }}>
            Form fills land in your CRM, meetings get booked, reviews route to the right
            person, and events flow to analytics. Below is every integration LP Studio
            ships today — what each one does and how to connect it. Anything not listed
            can almost always be wired up with a per-form webhook.
          </p>
        </div>

        {/* On-page index */}
        <nav
          aria-label="Integrations index"
          className="mb-14 p-5 rounded-2xl"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
          }}
        >
          <div
            className="font-mono uppercase mb-3"
            style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.18em", fontWeight: 600 }}
          >
            Jump to an integration
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {INDEX.map((it) => (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  className="text-[14px] transition-colors inline-block"
                  style={{ color: "var(--indigo-accent)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--indigo-accent)")}
                >
                  {it.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12 text-[15px] leading-[1.7]" style={{ color: "var(--ink-2)" }}>
          <Section id="salesforce" title="Salesforce" category="CRM">
            <p>
              The deepest integration LP Studio ships: two-way sync with per-tenant custom
              field mapping. Form fills create Salesforce Leads or Opportunities routed by
              account ownership, and the Sales Console pulls campaign and opportunity context
              back into LP Studio so reps build pages around live pipeline.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> open <strong>Settings → Integrations → Salesforce</strong>,
              authorize your org, then map LP Studio form fields to Salesforce Lead/Opportunity
              fields. Once mapped, new submissions sync automatically and synced records carry
              their Salesforce IDs for de-duplication.
            </p>
          </Section>

          <Section id="marketo" title="Marketo" category="Lead handoff">
            <p>
              Two-way lead sync with Marketo. New form fills are pushed to Marketo as leads, and
              a scheduled poller pulls Marketo lead updates back so your LP Studio records stay
              current. Each submission is de-duplicated by Marketo lead ID.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> in <strong>Settings → Integrations → Marketo</strong>,
              paste your Marketo REST endpoint plus the Client ID and Client Secret from a Marketo
              LaunchPoint service. LP Studio verifies the credentials and begins syncing.
            </p>
          </Section>

          <Section id="hubspot" title="HubSpot" category="Lead handoff">
            <p>
              Sync LP Studio leads into HubSpot as contacts. Submissions are pushed to your HubSpot
              CRM and de-duplicated so re-submissions update the existing contact rather than creating
              duplicates.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> create a HubSpot private app with CRM scopes, then add its
              access token under <strong>Settings → Integrations → HubSpot</strong>. New form fills
              flow to HubSpot from then on.
            </p>
          </Section>

          <Section id="google-sheets" title="Google Sheets" category="Lead handoff">
            <p>
              Append every form submission as a new row in a Google Sheet — a fast, no-CRM way to
              collect and share leads with a team that lives in spreadsheets.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> authorize Google from <strong>Settings → Integrations →
              Google Sheets</strong>, pick the destination spreadsheet and tab, and map columns to
              your form fields. Submissions are appended in real time.
            </p>
          </Section>

          <Section id="webhooks" title="Webhooks" category="Lead handoff">
            <p>
              Every form supports outbound webhooks. On each submission LP Studio POSTs the form's
              field values, the page slug and title, and submission metadata (timestamp and UTM
              parameters when present) as JSON to any URL you provide — the universal way to connect a
              tool that doesn't have a native integration.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> open the page in the builder, select the form block, and under
              <strong> Integrations → Webhooks</strong> paste your endpoint URL and save. Field keys
              match the labels configured on your form, so name them clearly for the cleanest mapping.
            </p>
          </Section>

          <Section id="zapier" title="Zapier" category="Lead handoff">
            <p>
              LP Studio doesn't need a dedicated Zapier app — every form already supports outbound
              webhooks, and Zapier's <strong>Webhooks by Zapier</strong> trigger turns that into a
              connection to 6,000+ apps. Route new leads into a CRM, spreadsheet, Slack channel, or
              anything else Zapier supports, with no code.
            </p>

            <SubSection title="What you'll need">
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li>A published LP Studio landing page with a lead capture form</li>
                <li>A Zapier account (the Webhooks by Zapier trigger requires a paid Zapier plan)</li>
                <li>Permission to edit form settings in your LP Studio workspace</li>
              </ul>
            </SubSection>

            <SubSection title="Step 1 — Create a Catch Hook in Zapier">
              <p>In Zapier, create a new Zap and choose <strong>Webhooks by Zapier</strong> as the trigger app. Pick the <strong>Catch Hook</strong> event. Zapier will generate a unique webhook URL — copy it to your clipboard.</p>
            </SubSection>

            <SubSection title="Step 2 — Add the webhook to your LP Studio form">
              <p>In LP Studio, open the page in the builder, select your form block, and open its settings. Under <strong>Integrations → Webhooks</strong>, paste the Zapier Catch Hook URL and save. Every submission will now POST the form fields to Zapier as JSON.</p>
            </SubSection>

            <SubSection title="Step 3 — Send a test submission">
              <p>Publish (or preview) the page and submit the form once with test data. Back in Zapier, click <strong>Test trigger</strong> — your submission will appear, and Zapier will map the incoming fields (name, email, and any custom fields you collect) so you can use them downstream.</p>
            </SubSection>

            <SubSection title="Step 4 — Add your action">
              <p>Add any Zapier action step: create a CRM contact, append a row to Google Sheets, post to Slack, send an email, or fan out to multiple apps. Turn the Zap on and you're live.</p>
            </SubSection>

            <SubSection title="What gets sent">
              <p>The webhook payload includes the form's field values, the page slug and title, and submission metadata (timestamp and UTM parameters when present). Field keys match the labels configured on your form, so name them clearly for the cleanest Zapier mapping.</p>
            </SubSection>
          </Section>

          <Section id="chili-piper" title="Chili Piper" category="Scheduling & ops">
            <p>
              Let qualified leads book a meeting the moment they submit. LP Studio embeds Chili Piper's
              scheduler so prospects pick a time and get routed to the right rep without leaving your
              landing page, and bookings are tracked alongside the lead.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> add your Chili Piper booking domain in the workspace integration
              settings, then enable booking on a page's hero or CTA button so submitting opens the
              scheduler inline.
            </p>
          </Section>

          <Section id="asana" title="Asana" category="Scheduling & ops">
            <p>
              Turn submissions into work. LP Studio can create an Asana task per lead (or per routed
              review) so follow-up lands in the right project and nothing falls through the cracks.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> authorize Asana from <strong>Settings → Integrations →
              Asana</strong> and choose the destination project. New submissions create tasks there.
            </p>
          </Section>

          <Section id="resend" title="Resend" category="Scheduling & ops">
            <p>
              Resend powers LP Studio's transactional and notification email. Every workspace can send
              from a branded address with zero setup, and teams that want their own domain can verify it
              for fully branded delivery.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> branded sending works out of the box. To send from your own
              domain, add it under <strong>Settings → Email</strong> and publish the DNS records LP
              Studio generates; once verified, your mail sends from your domain.
            </p>
          </Section>

          <Section id="slack" title="Slack" category="Scheduling & ops">
            <p>
              Get a Slack ping when a lead comes in. LP Studio posts new submissions (and other
              notifications) to a channel so your team sees activity in real time without watching a
              dashboard.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> create a Slack incoming webhook for the destination channel and
              add its URL in your workspace notification settings. New events post there automatically.
            </p>
          </Section>

          <Section id="rb2b" title="RB2B" category="Signals & analytics">
            <p>
              Know who's on the page. RB2B's website-visitor identification resolves anonymous traffic to
              known people and companies, so you can see which accounts are engaging with your landing
              pages even before they fill a form.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> paste your RB2B script/site key into the workspace analytics
              settings. LP Studio injects it on your published pages so RB2B can identify visitors.
            </p>
          </Section>

          <Section id="apollo" title="Apollo" category="Signals & analytics">
            <p>
              Enrich and act on inbound interest with Apollo's data and engagement tooling. Pair Apollo
              with LP Studio's visitor signals to prioritize the accounts worth a rep's time.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> add your Apollo tracking/site key in the workspace analytics
              settings, and LP Studio includes it on your published pages.
            </p>
          </Section>

          <Section id="ga4" title="Google Analytics 4" category="Signals & analytics">
            <p>
              Send page views and conversion events from your landing pages straight into GA4, so LP
              Studio traffic shows up alongside the rest of your marketing analytics and attribution.
            </p>
            <p className="mt-3">
              <strong>Connect:</strong> add your GA4 Measurement ID (<code>G-XXXXXXX</code>) in the
              workspace analytics settings. LP Studio loads the GA4 tag on published pages and reports
              page views and form conversions.
            </p>
          </Section>
        </div>

        {/* Request an integration */}
        <div
          className="mt-16 p-6 rounded-2xl flex flex-wrap items-center gap-4"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
          }}
        >
          <span
            className="font-display"
            style={{ color: "var(--ink)", fontSize: 18, fontWeight: 600, letterSpacing: "-0.018em", lineHeight: 1.2 }}
          >
            Don't see your tool?
          </span>
          <span className="text-[13.5px]" style={{ color: "var(--ink-soft)", flex: "1 1 320px", lineHeight: 1.5 }}>
            Every form supports custom webhooks — most teams wire a new tool in under five minutes. New
            native integrations ship by request from beta customers.
          </span>
          <a
            href="mailto:admin@lpstudio.ai?subject=Integration%20request"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-colors"
            style={{
              background: "var(--ink)",
              color: "var(--cream)",
              fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
              letterSpacing: "-0.005em",
              boxShadow: "0 4px 10px -4px rgba(26,24,21,0.3)",
            }}
          >
            Request an integration
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({
  id,
  title,
  category,
  children,
}: {
  id: string;
  title: string;
  category: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 120 }}>
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2
          className="font-display"
          style={{
            color: "var(--ink)",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
        <span
          className="font-mono uppercase"
          style={{ color: "var(--ink-mute)", fontSize: 10.5, letterSpacing: "0.16em", fontWeight: 600 }}
        >
          {category}
        </span>
      </div>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3
        className="font-display mb-2"
        style={{
          color: "var(--ink)",
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "-0.012em",
          lineHeight: 1.25,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
