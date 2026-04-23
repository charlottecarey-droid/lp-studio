import Navbar from "@/components/Navbar";
import AssembleScene from "@/components/AssembleScene";
import StatsBand from "@/components/StatsBand";
import UseCases from "@/components/UseCases";
import DeepFeatures from "@/components/DeepFeatures";
import Integrations from "@/components/Integrations";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import Waitlist from "@/components/Waitlist";
import Footer from "@/components/Footer";

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
