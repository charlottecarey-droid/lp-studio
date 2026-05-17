import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function Privacy() {
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
              marginBottom: 12,
            }}
          >
            Privacy Policy
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
          <Section title="1. Information We Collect">
            <p>LP Studio collects information you provide directly — such as your name, email address, and workspace content — as well as information collected automatically when you use our services, including usage data, log files, and analytics events.</p>
            <p className="mt-3">We also collect information from third-party services you connect, such as Google (for sign-in) and Salesforce (when integrated). Specifically, when you sign in with Google we receive your Google account's email address, name, profile picture, and unique Google account identifier. We do not request access to your Gmail, Drive, Calendar, or any other Google service data.</p>
          </Section>

          <Section title="1a. Google User Data — Use and Sharing">
            <p>LP Studio's use and transfer of information received from Google APIs adheres to the <LegalLink href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</LegalLink>, including the Limited Use requirements.</p>
            <p className="mt-3">We use information received from Google solely to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Authenticate you and create or look up your LP Studio user account</li>
              <li>Display your name and profile picture in the LP Studio interface</li>
              <li>Associate your activity in the product with the correct account</li>
            </ul>
            <p className="mt-3">We do <strong style={{ color: "var(--ink)" }}>not</strong> use Google user data for advertising, sell it to third parties, transfer it to others except as needed to provide the service (e.g. our hosting and database providers under confidentiality), or allow humans to read it except (a) with your explicit consent, (b) for security investigations, or (c) to comply with applicable law.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Provide, operate, and improve LP Studio</li>
              <li>Authenticate your identity and manage your workspace</li>
              <li>Send you product updates, security alerts, and support messages</li>
              <li>Analyze usage patterns to improve the product</li>
              <li>Comply with legal obligations</li>
            </ul>
          </Section>

          <Section title="3. Information Sharing">
            <p>We do not sell, rent, or trade your personal information. We may share it with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li><strong style={{ color: "var(--ink)" }}>Service providers</strong> who help us operate LP Studio (hosting, analytics, email delivery) under confidentiality agreements</li>
              <li><strong style={{ color: "var(--ink)" }}>Your organization</strong> — workspace admins in your account can see member activity within their workspace</li>
              <li><strong style={{ color: "var(--ink)" }}>Law enforcement</strong> when required by law or to protect our rights</li>
            </ul>
          </Section>

          <Section title="4. Data Retention">
            <p>We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time by contacting us at <LegalLink href="mailto:admin@lpstudio.ai">admin@lpstudio.ai</LegalLink>.</p>
          </Section>

          <Section title="5. Cookies and Tracking">
            <p>LP Studio uses cookies and similar tracking technologies to maintain sessions, remember preferences, and analyze usage. You can control cookie behavior through your browser settings, though some features may not function correctly if cookies are disabled.</p>
          </Section>

          <Section title="6. Security">
            <p>We implement industry-standard security measures including encryption in transit (TLS), encrypted storage, access controls, and regular security audits. No system is 100% secure — please use a strong, unique password and keep your credentials private.</p>
            <p className="mt-3">Information received from Google sign-in is stored encrypted at rest in our managed PostgreSQL database, accessed only over TLS, and protected by the same role-based access controls as the rest of your workspace data.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your location, you may have rights to access, correct, port, or delete your personal data. To exercise these rights, contact us at <LegalLink href="mailto:admin@lpstudio.ai">admin@lpstudio.ai</LegalLink>.</p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>We may update this policy from time to time. We'll notify you of material changes via email or in-product notification. Continued use of LP Studio after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="9. Contact">
            <p>Questions about this policy? Email us at <LegalLink href="mailto:admin@lpstudio.ai">admin@lpstudio.ai</LegalLink>.</p>
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
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="underline underline-offset-4 transition-colors"
      style={{ color: "var(--indigo-accent)", textDecorationColor: "rgba(75, 71, 229, 0.4)" }}
    >
      {children}
    </a>
  );
}
