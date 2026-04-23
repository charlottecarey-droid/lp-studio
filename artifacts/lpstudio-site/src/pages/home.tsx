import Navbar from "@/components/Navbar";
import AssembleScene from "@/components/AssembleScene";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Waitlist from "@/components/Waitlist";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "#000", color: "#F5F5F5" }}>
      <Navbar />
      <main>
        <AssembleScene />
        <Pricing />
        <Testimonials />
        <Waitlist />
      </main>
      <Footer />
    </div>
  );
}
