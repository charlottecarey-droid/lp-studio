import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Terms() {
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
            Terms of Service
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)" }} className="text-sm">Last updated: April 2026</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using LP Studio ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including workspace admins and individual members.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>LP Studio is a landing page builder and sales enablement platform that allows revenue teams to create, publish, and optimize landing pages using a visual builder, AI copy generation, A/B testing, and related tools.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Your Account</h2>
            <p>You are responsible for maintaining the security of your account credentials. You must notify us immediately of any unauthorized access. LP Studio is not liable for losses resulting from unauthorized use of your account.</p>
            <p className="mt-3">You must provide accurate information when creating your account and keep it up to date.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to use LP Studio to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Publish content that is illegal, misleading, defamatory, or harmful</li>
              <li>Violate the intellectual property rights of others</li>
              <li>Send spam or unsolicited communications</li>
              <li>Attempt to gain unauthorized access to any system or data</li>
              <li>Resell or sublicense access to the Service without written permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Intellectual Property</h2>
            <p>LP Studio and its underlying technology, design, and content are owned by LP Studio, Inc. and protected by intellectual property laws. You retain ownership of content you create using the Service, but grant LP Studio a license to host, store, and display that content in order to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Billing and Cancellation</h2>
            <p>Paid plans are billed monthly or annually as selected at signup. You can cancel at any time; access continues until the end of the current billing period. We do not offer refunds for partial periods except where required by law.</p>
            <p className="mt-3">We reserve the right to change pricing with 30 days' notice to active subscribers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Limitation of Liability</h2>
            <p>LP Studio is provided "as is." To the maximum extent permitted by law, LP Studio, Inc. is not liable for indirect, incidental, special, or consequential damages arising from your use of the Service, including lost revenue or data loss.</p>
            <p className="mt-3">Our total liability for any claim is limited to the amount you paid us in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Termination</h2>
            <p>We may suspend or terminate your account for violation of these terms, non-payment, or for any reason with reasonable notice. Upon termination, your access to the Service ends and we may delete your data after a 30-day grace period.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Governing Law</h2>
            <p>These terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
            <p>Questions about these terms? Email us at <a href="mailto:legal@lpstudio.ai" className="underline" style={{ color: "#C7E738" }}>legal@lpstudio.ai</a>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
