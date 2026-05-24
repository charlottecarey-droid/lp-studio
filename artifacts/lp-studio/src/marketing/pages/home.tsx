import Navbar from "../components/Navbar";
import AssembleScene from "../components/AssembleScene";
import StatsBand from "../components/StatsBand";
import UseCases from "../components/UseCases";
import DeepFeatures from "../components/DeepFeatures";
import Integrations from "../components/Integrations";
import Pricing from "../components/Pricing";
import Testimonials from "../components/Testimonials";
import FAQ from "../components/FAQ";
import Waitlist from "../components/Waitlist";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";

export default function Home() {
  usePageMeta({
    title: "LP Studio — Build landing pages your revenue team will actually use",
    description:
      "LP Studio is the AI-native landing page builder for revenue teams. Compose pages from on-brand blocks, A/B test, and ship faster than your designer can open Figma.",
    canonical: "https://lpstudio.ai/",
    ogImage: "https://lpstudio.ai/lpstudio-og.png",
  });
  return (
    <div className="min-h-screen paper-grain" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <Navbar />
      <main>
        <AssembleScene />
        <StatsBand />
        <UseCases />
        <DeepFeatures />
        <Integrations />
        <Pricing />
        <Testimonials />
        <FAQ />
        <Waitlist />
      </main>
      <Footer />
    </div>
  );
}
