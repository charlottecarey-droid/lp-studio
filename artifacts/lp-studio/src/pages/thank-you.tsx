import { useEffect, useState } from "react";
import { fetchBrandConfig, DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";

/**
 * Public-facing thank-you page at /thank-you.
 *
 * Displayed after a form submission when the form's redirectUrl points here.
 * Loads the tenant's brand config so colors, logo, and CTA match the landing pages.
 *
 * Optional query params:
 *   ?name=...   — personalizes the heading ("Thanks, {name}!")
 *   ?next=...   — overrides the CTA URL
 */
export default function ThankYouPage() {
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchBrandConfig().then(b => { setBrand(b); setLoaded(true); });
  }, []);

  // Read optional query params
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name");
  const nextUrl = params.get("next") || brand.defaultCtaUrl || "https://www.meetdandy.com";

  const primaryColor = brand.primaryColor || "#003A30";
  const accentColor = brand.accentColor || "#C7E738";
  const ctaBg = brand.ctaBackground || accentColor;
  const ctaText = brand.ctaText || primaryColor;
  const logoUrl = brand.logoUrl || dandyLogoUrl;

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: primaryColor }}>
        <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: brand.pageBackground || "#ffffff" }}>
      {/* Nav bar */}
      <nav
        className="w-full px-6 py-4 flex items-center justify-between"
        style={{ background: brand.navBgColor || primaryColor }}
      >
        <img
          src={logoUrl}
          alt={brand.copyrightName || "Logo"}
          className="h-7 object-contain"
        />
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center py-20">
          {/* Checkmark */}
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-8"
            style={{ background: `${accentColor}22` }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10">
              <circle cx="12" cy="12" r="11" stroke={accentColor} strokeWidth="2" opacity="0.3" />
              <polyline points="7 12.5 10.5 16 17 9" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Heading */}
          <h1
            className="text-4xl md:text-5xl font-bold mb-4 leading-tight"
            style={{ color: brand.textColor || "#1a1a1a", fontFamily: brand.displayFont ? `'${brand.displayFont}', sans-serif` : undefined }}
          >
            {name ? `Thanks, ${name}!` : "Thank you!"}
          </h1>

          {/* Subtext */}
          <p
            className="text-lg mb-10 leading-relaxed max-w-md mx-auto"
            style={{ color: `${brand.textColor || "#1a1a1a"}99` }}
          >
            Your submission has been received. A member of our team will be in touch shortly.
          </p>

          {/* CTA */}
          <a
            href={nextUrl}
            className="inline-flex items-center gap-2 px-8 py-3.5 font-semibold text-sm tracking-wide transition-all hover:opacity-90"
            style={{
              background: ctaBg,
              color: ctaText,
              borderRadius: brand.buttonRadius === "pill" ? "9999px" : brand.buttonRadius === "rounded" ? "0.75rem" : brand.buttonRadius === "slight" ? "0.375rem" : "0",
              textTransform: brand.buttonTextCase === "uppercase" ? "uppercase" : brand.buttonTextCase === "capitalize" ? "capitalize" : undefined,
              letterSpacing: brand.buttonLetterSpacing === "wider" ? "0.1em" : brand.buttonLetterSpacing === "wide" ? "0.05em" : undefined,
            }}
          >
            Back to {brand.copyrightName || "Home"}
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-6 text-center text-xs" style={{ color: `${brand.textColor || "#1a1a1a"}66` }}>
        &copy; {new Date().getFullYear()} {brand.copyrightName || "Dandy"}. All rights reserved.
      </footer>
    </div>
  );
}
