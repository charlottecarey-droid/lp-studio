import Navbar from "@/marketing/components/Navbar";
import AssembleScene from "@/marketing/components/AssembleScene";
import StatsBand from "@/marketing/components/StatsBand";
import UseCases from "@/marketing/components/UseCases";
import DeepFeatures from "@/marketing/components/DeepFeatures";
import Integrations from "@/marketing/components/Integrations";
import Pricing from "@/marketing/components/Pricing";
import Testimonials from "@/marketing/components/Testimonials";
import FAQ from "@/marketing/components/FAQ";
import Waitlist from "@/marketing/components/Waitlist";
import Footer from "@/marketing/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "#000", color: "#F5F5F5" }}>
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
