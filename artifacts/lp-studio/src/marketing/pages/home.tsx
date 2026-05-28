import Navbar from "../components/Navbar";
import AssembleScene from "../components/AssembleScene";
import UseCases from "../components/UseCases";
import DeepFeatures from "../components/DeepFeatures";
import Integrations from "../components/Integrations";
import Pricing from "../components/Pricing";
import FAQ from "../components/FAQ";
import Waitlist from "../components/Waitlist";
import Footer from "../components/Footer";
// import { usePageMeta } from "../hooks/usePageMeta"; // re-enable after CNAME flip

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
  // Temporarily disabled until the lpstudio.ai CNAME flip lands — until
  // then, social shares from this host should fall through to whatever
  // static <title>/<meta> the index.html shell ships with, instead of us
  // overwriting them with LP Studio copy on a domain that still resolves
  // to the old destination. Re-enable after CNAME is verified.
  // usePageMeta({
  //   title: "LP Studio — Skip the 14-step process. Ship the page.",
  //   description:
  //     "Marketing takes forever. Sales ships with ChatGPT. LP Studio is the AI revenue workspace where pages, microsites, and outreach get built on-brand in minutes — not weeks.",
  //   canonical: "https://lpstudio.ai/",
  //   ogImage: "https://lpstudio.ai/lpstudio-og.png",
  // });
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
