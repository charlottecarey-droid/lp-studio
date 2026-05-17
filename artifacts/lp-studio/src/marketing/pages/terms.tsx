import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen paper-grain" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-36 pb-24">
        <div className="mb-14">
          <div className="marker marker-rule mb-6">Legal</div>
          <h1
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(40px, 5.5vw, 64px)",
              lineHeight: 1.02,
              fontWeight: 500,
              letterSpacing: "-0.028em",
              fontVariationSettings: "'opsz' 144",
              marginBottom: 12,
            }}
          >
            Terms of Service
          </h1>
          <p
            className="font-mono uppercase"
            style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
          >
            Last updated: May 2026
          </p>
        </div>

        <div
          className="space-y-9 text-[15px] leading-[1.7]"
          style={{ color: "var(--ink-2)" }}
        >
          <Section title="1. Acceptance of Terms">
            <p>By accessing or using LP Studio ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including workspace admins and individual members.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>LP Studio is a landing page builder and sales enablement platform that allows revenue teams to create, publish, and optimize landing pages using a visual builder, AI copy generation, A/B testing, and related tools.</p>
          </Section>

          <Section title="3. Your Account">
            <p>You are responsible for maintaining the security of your account credentials. You must notify us immediately of any unauthorized access. LP Studio is not liable for losses resulting from unauthorized use of your account.</p>
            <p className="mt-3">You must provide accurate information when creating your account and keep it up to date.</p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to use LP Studio to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Publish content that is illegal, misleading, defamatory, or harmful</li>
              <li>Violate the intellectual property rights of others</li>
              <li>Send spam or unsolicited communications</li>
              <li>Attempt to gain unauthorized access to any system or data</li>
              <li>Resell or sublicense access to the Service without written permission</li>
            </ul>
          </Section>

          <Section title="5. Intellectual Property">
            <p>LP Studio and its underlying technology, design, and content are owned by LP Studio, Inc. and protected by intellectual property laws. You retain ownership of content you create using the Service, but grant LP Studio a license to host, store, and display that content in order to provide the Service.</p>
          </Section>

          <Section title="6. Billing and Cancellation">
            <p>Paid plans are billed monthly or annually as selected at signup. You can cancel at any time; access continues until the end of the current billing period. We do not offer refunds for partial periods except where required by law.</p>
            <p className="mt-3">We reserve the right to change pricing with 30 days' notice to active subscribers.</p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>LP Studio is provided "as is." To the maximum extent permitted by law, LP Studio, Inc. is not liable for indirect, incidental, special, or consequential damages arising from your use of the Service, including lost revenue or data loss.</p>
            <p className="mt-3">Our total liability for any claim is limited to the amount you paid us in the 12 months preceding the claim.</p>
          </Section>

          <Section title="8. Termination">
            <p>We may suspend or terminate your account for violation of these terms, non-payment, or for any reason with reasonable notice. Upon termination, your access to the Service ends and we may delete your data after a 30-day grace period.</p>
          </Section>

          <Section title="9. Governing Law">
            <p>These terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.</p>
          </Section>

          <Section title="10. Contact">
            <p>Questions about these terms? Email us at <LegalLink href="mailto:legal@lpstudio.ai">legal@lpstudio.ai</LegalLink>.</p>
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

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
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
