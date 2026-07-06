import Navbar from "../components/Navbar";
import Pricing from "../components/Pricing";
import FAQ from "../components/FAQ";
import FinalCta from "../components/FinalCta";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { useShareCard } from "../hooks/useShareCard";

// /pricing — standalone pricing route. Wraps the existing Pricing component
// (which already includes the 4-tier cards + Enterprise strip + collapsible
// feature map) as Charlotte requested, plus FAQ + FinalCta + Footer.

export default function PricingPage() {
  const og = useShareCard("pricing", {
    title: "Pricing — LP Studio · Free to start, no card required",
    description:
      "Free to start. No card. Every paid tier comes with a 14-day Growth trial — see the full plan matrix and find the right tier for your team.",
    imageUrl: "https://lpstudio.ai/opengraph.jpg",
  });
  usePageMeta({
    title: og.title,
    description: og.description,
    canonical: "https://lpstudio.ai/pricing",
    ogImage: og.imageUrl,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: "image/jpeg",
    ogImageAlt: "LP Studio pricing",
    siteName: "LP Studio",
  });

  return (
    <div
      style={{
        background: "var(--cream)",
        color: "var(--ink)",
        minHeight: "100vh",
      }}
    >
      <Navbar />
      <main>
        {/* Pricing component already carries the "Pricing" eyebrow + headline
            + subhead + billing toggle — no page-wrapper header needed. The
            component's own py-28 md:py-36 section padding provides the
            navbar clearance. */}
        <Pricing defaultCompareOpen asPageHeading />
        <FAQ />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
