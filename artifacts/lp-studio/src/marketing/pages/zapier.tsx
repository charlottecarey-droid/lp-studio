import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { useShareCard } from "../hooks/useShareCard";

export default function ZapierDocs() {
  const og = useShareCard("zapier", {
    title: "Connect LP Studio to Zapier — LP Studio",
    description:
      "Use LP Studio's per-form webhooks to trigger Zapier Zaps. Send new leads, form fills, and events to 6,000+ apps without writing code.",
    imageUrl: "https://lpstudio.ai/opengraph.jpg",
  });
  usePageMeta({
    title: og.title,
    description: og.description,
    canonical: "https://lpstudio.ai/docs/integrations/zapier",
    ogImage: og.imageUrl,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: "image/jpeg",
    ogImageAlt: "Connect LP Studio to Zapier",
    siteName: "LP Studio",
  });
  return (
    <div className="min-h-screen paper-grain" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-36 pb-24">
        <div className="mb-14">
          <div className="marker marker-rule mb-6">Docs · Integrations</div>
          <h1
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(40px, 5.5vw, 64px)",
              lineHeight: 1.02,
              fontWeight: 500,
              letterSpacing: "-0.028em",
              marginBottom: 16,
            }}
          >
            Connect LP Studio to Zapier
          </h1>
          <p className="text-[16px] leading-[1.7]" style={{ color: "var(--ink-soft)" }}>
            LP Studio doesn't need a dedicated Zapier app — every form already supports
            outbound webhooks, and Zapier's <strong>Webhooks by Zapier</strong> trigger
            turns that into a connection to 6,000+ apps. Route new leads into a CRM,
            spreadsheet, Slack channel, or anything else Zapier supports, with no code.
          </p>
        </div>

        <div className="space-y-9 text-[15px] leading-[1.7]" style={{ color: "var(--ink-2)" }}>
          <Section title="What you'll need">
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>A published LP Studio landing page with a lead capture form</li>
              <li>A Zapier account (the Webhooks by Zapier trigger requires a paid Zapier plan)</li>
              <li>Permission to edit form settings in your LP Studio workspace</li>
            </ul>
          </Section>

          <Section title="Step 1 — Create a Catch Hook in Zapier">
            <p>In Zapier, create a new Zap and choose <strong>Webhooks by Zapier</strong> as the trigger app. Pick the <strong>Catch Hook</strong> event. Zapier will generate a unique webhook URL — copy it to your clipboard.</p>
          </Section>

          <Section title="Step 2 — Add the webhook to your LP Studio form">
            <p>In LP Studio, open the page in the builder, select your form block, and open its settings. Under <strong>Integrations → Webhooks</strong>, paste the Zapier Catch Hook URL and save. Every submission will now POST the form fields to Zapier as JSON.</p>
          </Section>

          <Section title="Step 3 — Send a test submission">
            <p>Publish (or preview) the page and submit the form once with test data. Back in Zapier, click <strong>Test trigger</strong> — your submission will appear, and Zapier will map the incoming fields (name, email, and any custom fields you collect) so you can use them downstream.</p>
          </Section>

          <Section title="Step 4 — Add your action">
            <p>Add any Zapier action step: create a CRM contact, append a row to Google Sheets, post to Slack, send an email, or fan out to multiple apps. Turn the Zap on and you're live.</p>
          </Section>

          <Section title="What gets sent">
            <p>The webhook payload includes the form's field values, the page slug and title, and submission metadata (timestamp and UTM parameters when present). Field keys match the labels configured on your form, so name them clearly for the cleanest Zapier mapping.</p>
          </Section>

          <Section title="Prefer a native integration?">
            <p>Salesforce, Marketo, Google Sheets, and Slack all ship as first-class integrations inside LP Studio — no Zapier required. Browse them on the <DocLink href="/features">features page</DocLink>, or email <DocLink href="mailto:admin@lpstudio.ai?subject=Integration%20request">admin@lpstudio.ai</DocLink> to request a new one.</p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="font-display mb-3"
        style={{
          color: "var(--ink)",
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.25,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="underline underline-offset-4 transition-colors"
      style={{ color: "var(--indigo-accent)", textDecorationColor: "rgba(75, 71, 229, 0.4)" }}
    >
      {children}
    </a>
  );
}
