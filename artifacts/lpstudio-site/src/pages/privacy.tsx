import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Privacy() {
  return (
    <div className="min-h-screen" style={{ background: "#000", color: "#F5F5F5" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-32">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: "rgba(199,231,56,0.08)", color: "#C7E738", border: "1px solid rgba(199,231,56,0.18)" }}>
            Legal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
            Privacy Policy
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)" }} className="text-sm">Last updated: April 2026</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>LP Studio collects information you provide directly — such as your name, email address, and workspace content — as well as information collected automatically when you use our services, including usage data, log files, and analytics events.</p>
            <p className="mt-3">We also collect information from third-party services you connect, such as Google (for sign-in) and Salesforce (when integrated).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Provide, operate, and improve LP Studio</li>
              <li>Authenticate your identity and manage your workspace</li>
              <li>Send you product updates, security alerts, and support messages</li>
              <li>Analyze usage patterns to improve the product</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Information Sharing</h2>
            <p>We do not sell, rent, or trade your personal information. We may share it with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li><strong className="text-white">Service providers</strong> who help us operate LP Studio (hosting, analytics, email delivery) under confidentiality agreements</li>
              <li><strong className="text-white">Your organization</strong> — workspace admins in your account can see member activity within their workspace</li>
              <li><strong className="text-white">Law enforcement</strong> when required by law or to protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time by contacting us at <a href="mailto:privacy@lpstudio.ai" className="underline" style={{ color: "#C7E738" }}>privacy@lpstudio.ai</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Cookies and Tracking</h2>
            <p>LP Studio uses cookies and similar tracking technologies to maintain sessions, remember preferences, and analyze usage. You can control cookie behavior through your browser settings, though some features may not function correctly if cookies are disabled.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Security</h2>
            <p>We implement industry-standard security measures including encryption in transit (TLS), encrypted storage, access controls, and regular security audits. No system is 100% secure — please use a strong, unique password and keep your credentials private.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights</h2>
            <p>Depending on your location, you may have rights to access, correct, port, or delete your personal data. To exercise these rights, contact us at <a href="mailto:privacy@lpstudio.ai" className="underline" style={{ color: "#C7E738" }}>privacy@lpstudio.ai</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We'll notify you of material changes via email or in-product notification. Continued use of LP Studio after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact</h2>
            <p>Questions about this policy? Email us at <a href="mailto:privacy@lpstudio.ai" className="underline" style={{ color: "#C7E738" }}>privacy@lpstudio.ai</a>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
