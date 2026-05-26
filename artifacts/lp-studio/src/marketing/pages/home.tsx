import Navbar from "../components/Navbar";
import AssembleScene from "../components/AssembleScene";
import UseCases from "../components/UseCases";
import DeepFeatures from "../components/DeepFeatures";
import Integrations from "../components/Integrations";
import Pricing from "../components/Pricing";
import FAQ from "../components/FAQ";
import Waitlist from "../components/Waitlist";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";

// Marketing accuracy pass (May 2026):
// StatsBand and Testimonials were removed — LP Studio is in private beta and
// the previous metrics ("1.2M pages launched", "4.8× lift", "1,200+ teams")
// and testimonials (Rachel Tran / Marcus Jordan / Priya Shah) were fabricated.
// Do not re-add fabricated social proof; if/when real numbers and customer
// quotes exist, build new components with verifiable sources.
// (Note: this is "no fake stats", not "no shipped product" — the template
//  library, Salesforce sync, Sales Console, A/B testing, etc. are all real
//  and shipped; surface them honestly in DeepFeatures and Integrations.)
export default function Home() {
  usePageMeta({
    // Title + description + ogImage temporarily commented out until the Dandy
    // cutover is complete — sales flagged that social previews surface LP Studio
    // copy/branding on links that still need to look like Dandy. Restore all
    // three post-cutover.
    // title: "Fast, branded landing pages for revenue teams.",
    // description:
    //   "LP Studio is the AI-native landing page builder for revenue teams. Compose pages from on-brand blocks, A/B test, and ship faster than your designer can open Figma.",
    canonical: "https://lpstudio.ai/",
    // ogImage: "https://lpstudio.ai/lpstudio-og.png",
  });
  return (
    <div className="min-h-screen paper-grain" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <Navbar />
      <main>
        <AssembleScene />
        <UseCases />
        <DeepFeatures />
        <Integrations />
        <Pricing />
        <FAQ />
        <Waitlist />
      </main>
      <Footer />
    </div>
  );
}
