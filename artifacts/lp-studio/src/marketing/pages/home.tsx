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
  // The marketing prerender (scripts/prerender-marketing.mjs) bakes these
  // tags into the static dist/public/index.html that lpstudio.ai serves, so
  // social scrapers (which never run JS) see real OG metadata. og:image must
  // be an absolute URL to a small file — opengraph.jpg is 1280×720 / ~61KB;
  // the legacy opengraph.png is 6.5MB and large images frequently time out
  // in scrapers' short fetch windows, which is why previews "rarely showed".
  usePageMeta({
    title: "LP Studio",
    description:
      "Skip the brief, ship the page. Fast, branded landing pages for revenue teams — ABM for the rest of us. One page for every account, built on your lunch break with time left to eat.",
    canonical: "https://lpstudio.ai/",
    ogImage: "https://lpstudio.ai/opengraph.jpg",
    ogImageWidth: 1280,
    ogImageHeight: 720,
    ogImageType: "image/jpeg",
    ogImageAlt: "LP Studio — the AI revenue workspace",
    siteName: "LP Studio",
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
