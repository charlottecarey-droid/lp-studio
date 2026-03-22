import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useGetPageConfig, useTrackEvent } from "@workspace/api-client-react";
import { useVisitorSession } from "@/hooks/use-visitor-session";
import { 
  Loader2, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  ScanLine, 
  RefreshCcw, 
  HeadphonesIcon, 
  BarChart2, 
  DollarSign, 
  XCircle, 
  AlertTriangle, 
  Quote,
  CheckCircle2,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtendedVariantConfig } from "@/lib/page-types";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";
import { fetchBrandConfig, DEFAULT_BRAND, getButtonClasses, SECTION_PY, type BrandConfig } from "@/lib/brand-config";

const DANDY_VIDEO_URL = window.location.origin + "/dandy-lab-video-2/";

const ICON_MAP: Record<string, React.FC<any>> = {
  Zap,
  ScanLine,
  RefreshCcw,
  HeadphonesIcon,
  BarChart2,
  DollarSign,
};

export default function LandingPageViewer() {
  const [match, params] = useRoute("/lp/:slug");
  const slug = params?.slug || "";

  // Preview mode: ?previewVariantId=123 forces a specific variant, no tracking
  const searchParams = new URLSearchParams(window.location.search);
  const previewVariantId = searchParams.get("previewVariantId")
    ? parseInt(searchParams.get("previewVariantId")!, 10)
    : undefined;
  const isPreviewMode = !!previewVariantId;
  
  const sessionId = useVisitorSession(slug);
  const trackEvent = useTrackEvent();
  
  const apiParams = isPreviewMode
    ? { previewVariantId }
    : { sessionId };

  const { data: config, isLoading, error } = useGetPageConfig(
    slug, 
    apiParams,
    { query: { enabled: !!slug && (isPreviewMode || !!sessionId), retry: false } }
  );

  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);

  useEffect(() => {
    fetchBrandConfig().then(setBrand);
  }, []);

  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 40) setScrolled(true); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Never track impressions in preview mode
    if (isPreviewMode) return;
    if (config?.assignedVariant && sessionId && !hasTrackedImpression) {
      trackEvent.mutate({
        data: {
          sessionId,
          testId: config.testId,
          variantId: config.assignedVariant.id,
          eventType: "impression"
        }
      });
      setHasTrackedImpression(true);
    }
  }, [config, sessionId, hasTrackedImpression, trackEvent, isPreviewMode]);

  if (isLoading || (!isPreviewMode && !sessionId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#003A30]" />
      </div>
    );
  }

  if (error || !config || !config.assignedVariant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-100 max-w-md">
          <h1 className="text-2xl font-bold mb-2 text-[#003A30] font-display">Page Not Found</h1>
          <p className="text-slate-500">The landing page you're looking for doesn't exist or the test has ended.</p>
        </div>
      </div>
    );
  }

  const variantConf = config.assignedVariant.config as unknown as ExtendedVariantConfig;
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;
  const ctaColor = variantConf.ctaColor || LIME;

  const handleCtaClick = () => {
    trackEvent.mutate({
      data: {
        sessionId,
        testId: config.testId,
        variantId: config.assignedVariant.id,
        eventType: "conversion",
        conversionType: "cta_click"
      }
    });

    const dest = variantConf.ctaUrl && variantConf.ctaUrl !== "#"
      ? variantConf.ctaUrl
      : brand.defaultCtaUrl;
    if (dest) {
      window.location.href = dest;
    } else {
      alert("Conversion Tracked! (No URL configured)");
    }
  };

  const isDark = variantConf.backgroundStyle === "dark";
  const isMinimal = variantConf.layout === "minimal";
  const isSplit = variantConf.layout === "split";
  const sectionPy = SECTION_PY[brand.sectionPadding];

  return (
    <div className={cn(
      "min-h-screen w-full font-sans selection:bg-[#C7E738] selection:text-[#003A30]",
      isDark ? "bg-[#003A30] text-white" : "bg-white text-slate-900"
    )}>
      
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Above-fold wrapper — 80vh so the video peeks below */}
      <div className="min-h-[80vh] flex flex-col">

      {/* 1. Banner — preview stripe or running stripe */}
      {isPreviewMode ? (
        <div className="bg-[#C7E738] text-[#003A30] py-2 px-4 flex items-center justify-between z-50 relative">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#003A30] opacity-70" />
              Preview Mode
            </span>
            <span className="font-mono font-normal normal-case tracking-normal opacity-70">— {config.assignedVariant.name}</span>
          </div>
          <button
            onClick={() => window.close()}
            className="text-xs font-semibold underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            Close Preview
          </button>
        </div>
      ) : (
        <div className="bg-black text-white text-[10px] md:text-xs py-1.5 text-center font-mono tracking-[0.2em] uppercase opacity-80 hover:opacity-100 transition-opacity z-50 relative">
          RUNNING • VARIANT: {config.assignedVariant.name}
        </div>
      )}

      {/* 2. Nav */}
      <nav className="w-full px-6 pt-1 pb-[7px] flex items-center justify-between z-40 relative" style={{ backgroundColor: brand.navBgColor }}>
        <img
          src={dandyLogoUrl}
          alt="Dandy"
          className="h-8 w-auto"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <a
          href={brand.navCtaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={getButtonClasses(brand)}
          style={{ backgroundColor: LIME, color: FOREST }}
        >
          {brand.navCtaText}
        </a>
      </nav>

      {/* 3. Hero Section (text + CTA only, plus video in split mode) */}
      <section className={cn(
        "relative w-full px-6 flex flex-col items-center justify-center flex-1",
        isDark ? "bg-[#003A30]" : "bg-white"
      )}>
        <div className={cn(
          "max-w-7xl mx-auto w-full",
          isSplit ? "grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center" : "flex flex-col items-center text-center"
        )}>
          
          <div className={cn("space-y-8 z-10", !isSplit && "max-w-4xl mx-auto flex flex-col items-center")}>
            <h1 className={cn(
              "font-display font-bold tracking-tight leading-[1.05]",
              isMinimal ? "text-5xl md:text-6xl lg:text-7xl" : "text-4xl md:text-6xl lg:text-7xl",
              isDark ? "text-white" : "text-[#003A30]"
            )}>
              {variantConf.headline}
            </h1>
            
            {variantConf.subheadline && (
              <p className={cn(
                "text-lg md:text-xl leading-relaxed font-sans",
                isDark ? "text-white/80" : "text-[#003A30]/70",
                !isSplit && "max-w-2xl"
              )}>
                {variantConf.subheadline}
              </p>
            )}

            <div className={cn("flex flex-col gap-4 w-full sm:w-auto pt-2", !isSplit && "items-center")}>
              <button
                onClick={handleCtaClick}
                className={getButtonClasses(brand, "inline-flex items-center justify-center")}
                style={{ backgroundColor: ctaColor, color: FOREST }}
              >
                {variantConf.ctaText}
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>

              {variantConf.showSocialProof && (
                <div className={cn(
                  "flex items-center gap-2 text-sm font-medium opacity-80",
                  !isSplit && "justify-center"
                )}>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{variantConf.socialProofText}</span>
                </div>
              )}
            </div>
          </div>

          {/* 4. Full-bleed Video (Split Mode) */}
          {isSplit && variantConf.heroType !== "none" && (
            <div className="relative w-full aspect-[16/9] z-10 bg-black">
              {variantConf.heroType === "dandy-video" ? (
                <iframe 
                  src={DANDY_VIDEO_URL} 
                  className="w-full h-full border-0"
                  title="Demo Video"
                />
              ) : (
                <img 
                  src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1600" 
                  alt="Dental Office" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          )}
        </div>

        {/* Scroll indicator */}
        <div className={cn(
          "absolute bottom-[10px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none select-none transition-opacity duration-500",
          scrolled ? "opacity-0" : "opacity-100"
        )}>
          <div className={cn("w-px h-6 rounded-full", isDark ? "bg-white/20" : "bg-[#003A30]/15")} />
          <div className="animate-bounce">
            <ChevronDown className={cn("w-5 h-5", isDark ? "text-white/30" : "text-[#003A30]/30")} />
          </div>
        </div>
      </section>

      </div>{/* end min-h-screen above-fold wrapper */}

      {/* 4. Video (Centered Mode — contained with white padding) */}
      {!isSplit && variantConf.heroType !== "none" && (
        <section className="w-full bg-white py-8 px-6 md:px-10">
          <div className="max-w-5xl mx-auto">
            <div className="relative w-full aspect-video rounded-xl overflow-hidden">
              {variantConf.heroType === "dandy-video" ? (
                <iframe 
                  src={DANDY_VIDEO_URL} 
                  className="w-full h-full border-0"
                  title="Demo Video"
                />
              ) : (
                <img 
                  src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1600" 
                  alt="Dental Office" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* 5. Trust Bar */}
      {variantConf.trustBar?.enabled && (
        <section className="w-full bg-[#F8FAF9] py-12 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-x-0 md:divide-x divide-slate-200">
            {variantConf.trustBar.items.map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center px-4">
                <span className="text-3xl md:text-4xl font-display font-bold text-[#003A30] mb-1">{item.value}</span>
                <span className="text-sm text-[#4A6358] font-medium uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Photo Strip */}
      {variantConf.photoStrip?.enabled && (
        <section className="w-full h-64 md:h-80 overflow-hidden relative bg-white">
          <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />
          
          <div className="flex h-full animate-marquee w-max">
            {/* Render array twice for seamless loop */}
            {[...variantConf.photoStrip.images, ...variantConf.photoStrip.images].map((img, i) => (
              <img
                key={i}
                src={img.src}
                alt={img.alt}
                loading="lazy"
                className="h-full aspect-square md:w-[280px] shrink-0 object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {/* 7. Pain Section (PAS) */}
      {variantConf.painSection?.enabled && (
        <section className={cn("w-full bg-[#003A30] text-white px-6", sectionPy)}>
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12">
            <div className="md:w-1/2 space-y-6">
              <h2 className="text-3xl md:text-5xl font-display font-bold leading-tight">
                {variantConf.painSection.headline}
              </h2>
              <p className="text-lg text-white/80 leading-relaxed">
                {variantConf.painSection.body}
              </p>
            </div>
            <div className="md:w-1/2">
              <ul className="space-y-4">
                {variantConf.painSection.bullets?.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                    <AlertTriangle className="w-6 h-6 text-[#C7E738] shrink-0 mt-0.5" />
                    <span className="text-white/90 font-medium leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* 8. Comparison Section */}
      {variantConf.comparisonSection?.enabled && (
        <section className={cn("w-full bg-slate-50 px-6", sectionPy)}>
          <div className="max-w-6xl mx-auto">
            {variantConf.comparisonSection.headline && (
              <h2 className="text-4xl md:text-5xl font-display font-bold text-center text-[#003A30] mb-16">
                {variantConf.comparisonSection.headline}
              </h2>
            )}
            
            <div className="grid md:grid-cols-2 gap-8 items-stretch mb-16">
              {/* Old Way */}
              <div className="bg-slate-100 rounded-3xl p-8 md:p-12 opacity-80 flex flex-col">
                <div className="mb-8">
                  <span className="text-sm font-bold tracking-widest text-slate-500 uppercase mb-2 block">
                    {variantConf.comparisonSection.oldWay.sublabel || "OLD WAY"}
                  </span>
                  <h3 className="text-2xl font-bold text-[#003A30]">
                    {variantConf.comparisonSection.oldWay.label}
                  </h3>
                </div>
                <ul className="space-y-6 flex-1">
                  {variantConf.comparisonSection.oldWay.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-[#4A6358] font-medium leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* New Way */}
              <div className="bg-[#003A30] rounded-3xl p-8 md:p-12 flex flex-col ring-2 ring-[#C7E738]/20 shadow-xl relative overflow-hidden">
                {/* Subtle highlight */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#C7E738] opacity-[0.03] blur-3xl rounded-full" />
                
                <div className="mb-8 relative z-10">
                  <span className="text-sm font-bold tracking-widest text-[#C7E738] uppercase mb-2 block">
                    {variantConf.comparisonSection.newWay.sublabel || "NEW WAY"}
                  </span>
                  <h3 className="text-2xl font-bold text-white">
                    {variantConf.comparisonSection.newWay.label}
                  </h3>
                </div>
                <ul className="space-y-6 flex-1 relative z-10">
                  {variantConf.comparisonSection.newWay.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <CheckCircle2 className="w-6 h-6 text-[#C7E738] shrink-0 mt-0.5" />
                      <span className="text-white/90 font-medium leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleCtaClick}
                className={getButtonClasses(brand, "inline-flex items-center")}
                style={{ backgroundColor: ctaColor, color: FOREST }}
              >
                {variantConf.comparisonSection.ctaText || variantConf.ctaText}
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 9. Stat Callout */}
      {variantConf.statCallout?.enabled && (
        <section className={cn("w-full bg-[#003A30] px-6 text-center", sectionPy)}>
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            <div className="text-8xl md:text-[10rem] font-display font-bold leading-none mb-6" style={{ color: LIME }}>
              {variantConf.statCallout.stat}
            </div>
            <p className="text-xl md:text-2xl text-white font-medium max-w-xl mx-auto mb-8 leading-relaxed">
              {variantConf.statCallout.description}
            </p>
            {variantConf.statCallout.footnote && (
              <p className="text-sm text-white/50 max-w-lg mx-auto">
                {variantConf.statCallout.footnote}
              </p>
            )}
          </div>
        </section>
      )}

      {/* 10. Benefits Grid */}
      {variantConf.benefits?.enabled && (
        <section className={cn("w-full bg-white px-6", sectionPy)}>
          <div className="max-w-7xl mx-auto">
            {variantConf.benefits.headline && (
              <h2 className="text-3xl md:text-5xl font-display font-bold text-center text-[#003A30] mb-16 max-w-3xl mx-auto leading-tight">
                {variantConf.benefits.headline}
              </h2>
            )}
            <div className={cn(
              "grid gap-8",
              variantConf.benefits.columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
            )}>
              {variantConf.benefits.items.map((benefit, i) => {
                const Icon = ICON_MAP[benefit.icon] || Zap;
                return (
                  <div key={i} className="flex flex-col p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-full bg-[#E8F5F2] flex items-center justify-center mb-6">
                      <Icon className="w-7 h-7 text-[#003A30]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#003A30] mb-3">{benefit.title}</h3>
                    <p className="text-[#4A6358] leading-relaxed">{benefit.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 11. Testimonial */}
      {variantConf.testimonial?.enabled && (
        <section className={cn("w-full bg-[#F0F7F4] px-6 relative overflow-hidden", sectionPy)}>
          <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center text-center">
            <Quote className="w-16 h-16 text-[#C7E738] mb-8 opacity-50" />
            <blockquote className="text-2xl md:text-4xl font-display font-medium text-[#003A30] leading-snug mb-10">
              "{variantConf.testimonial.quote}"
            </blockquote>
            <div className="flex flex-col items-center">
              <strong className="text-lg text-[#003A30]">{variantConf.testimonial.author}</strong>
              <span className="text-[#4A6358]">{variantConf.testimonial.role}</span>
              {variantConf.testimonial.practiceName && (
                <span className="text-sm text-[#4A6358] mt-1 opacity-80">{variantConf.testimonial.practiceName}</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 12. How It Works */}
      {variantConf.howItWorks?.enabled && (
        <section className={cn("w-full bg-white px-6", sectionPy)}>
          <div className="max-w-6xl mx-auto">
            {variantConf.howItWorks.headline && (
              <h2 className="text-3xl md:text-5xl font-display font-bold text-center text-[#003A30] mb-20">
                {variantConf.howItWorks.headline}
              </h2>
            )}
            <div className="grid md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-[2px] bg-slate-100 z-0" />
              {variantConf.howItWorks.steps.map((step, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#003A30] text-[#C7E738] font-display font-bold text-2xl flex items-center justify-center mb-6 shadow-xl border-4 border-white">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold text-[#003A30] mb-4">{step.title}</h3>
                  <p className="text-[#4A6358] leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 13. Product Grid */}
      {variantConf.productGrid?.enabled && (
        <section className={cn("w-full bg-white px-6", sectionPy)}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
              {variantConf.productGrid.headline && (
                <h2 className="text-3xl md:text-5xl font-display font-bold text-[#003A30] mb-6">
                  {variantConf.productGrid.headline}
                </h2>
              )}
              {variantConf.productGrid.subheadline && (
                <p className="text-lg md:text-xl text-[#4A6358] leading-relaxed">
                  {variantConf.productGrid.subheadline}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {variantConf.productGrid.items.map((item, i) => (
                <div key={i} className="group rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 bg-white flex flex-col">
                  <div className="w-full h-52 overflow-hidden bg-slate-50">
                    <img 
                      src={item.image} 
                      alt={item.title} 
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-[#003A30] mb-2">{item.title}</h3>
                    <p className="text-[#4A6358] text-sm leading-relaxed flex-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 14. Bottom CTA Band */}
      {variantConf.bottomCta?.enabled && (
        <section className={cn("w-full bg-[#003A30] text-white px-6 text-center", sectionPy)}>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">
              {variantConf.bottomCta.headline}
            </h2>
            {variantConf.bottomCta.subheadline && (
              <p className="text-xl text-white/80 mb-10">
                {variantConf.bottomCta.subheadline}
              </p>
            )}
            <button
              onClick={handleCtaClick}
              className={getButtonClasses(brand, "inline-flex items-center")}
              style={{ backgroundColor: ctaColor, color: FOREST }}
            >
              {variantConf.bottomCta.ctaText || variantConf.ctaText}
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </section>
      )}

      {/* 15. Guarantee Bar */}
      {variantConf.guaranteeBar?.enabled && (
        <div className="w-full py-4 px-6 text-center text-sm font-bold tracking-wide" style={{ backgroundColor: LIME, color: FOREST }}>
          {variantConf.guaranteeBar.text}
        </div>
      )}

      {/* 16. Footer */}
      <footer className="w-full bg-[#003A30] text-white">
        <div className="max-w-6xl mx-auto px-8 pt-16 pb-10">
          {/* Top row: logo + nav columns */}
          <div className="flex flex-col md:flex-row gap-12 md:gap-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <img
                src={dandyLogoUrl}
                alt="Dandy"
                className="w-40 h-auto"
                style={{ filter: "brightness(0) invert(1)", opacity: 0.9 }}
              />
            </div>

            {/* Nav columns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 flex-1">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: LIME }}>Dandy</p>
                <ul className="space-y-2.5">
                  {[
                    ["Home", "https://www.meetdandy.com/"],
                    ["Pricing", "https://www.meetdandy.com/pricing/"],
                    ["Get in touch", "https://www.meetdandy.com/get-in-touch/"],
                    ["Dandy Reviews", "https://www.meetdandy.com/reviews/"],
                    ["Careers", "https://www.meetdandy.com/careers/"],
                    ["Privacy Policy", "https://www.meetdandy.com/privacy-policy/"],
                    ["Terms of Use", "https://www.meetdandy.com/terms-of-use/"],
                    ["Privacy Requests", "https://www.meetdandy.com/privacy-requests/"],
                    ["Your Privacy Rights", "https://www.meetdandy.com/privacy-rights/"],
                  ].map(([label, href]) => (
                    <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="text-white/50 text-sm hover:text-white/80 transition-colors">{label}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: LIME }}>Products & Technology</p>
                <ul className="space-y-2.5">
                  {[
                    ["Vision Scanner & Cart", "https://www.meetdandy.com/vision-scanner/"],
                    ["Chairside", "https://www.meetdandy.com/chairside/"],
                    ["Lab Services", "https://www.meetdandy.com/lab-services/"],
                    ["Posterior Crown and Bridge", "https://www.meetdandy.com/posterior-crown-and-bridge/"],
                    ["Partial Dentures", "https://www.meetdandy.com/partial-dentures/"],
                    ["Digital Dentures", "https://www.meetdandy.com/digital-dentures/"],
                    ["Implant Solutions", "https://www.meetdandy.com/implant-solutions/"],
                    ["Splints and Guards", "https://www.meetdandy.com/splints-and-guards/"],
                    ["Dandy Clear Aligners", "https://www.meetdandy.com/clear-aligners/"],
                    ["Sleep Apnea", "https://www.meetdandy.com/sleep-apnea/"],
                  ].map(([label, href]) => (
                    <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="text-white/50 text-sm hover:text-white/80 transition-colors">{label}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: LIME }}>Practices</p>
                <ul className="space-y-2.5">
                  {[
                    ["Private Practice", "https://www.meetdandy.com/solutions/private-practice/"],
                    ["Group Practice", "https://www.meetdandy.com/solutions/group-practice/"],
                    ["DSO", "https://www.meetdandy.com/solutions/dso/"],
                    ["Refer a Practice", "https://www.meetdandy.com/refer/"],
                    ["Login", "https://app.meetdandy.com/"],
                  ].map(([label, href]) => (
                    <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="text-white/50 text-sm hover:text-white/80 transition-colors">{label}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: LIME }}>Resources</p>
                <ul className="space-y-2.5">
                  {[
                    ["Learning Center", "https://www.meetdandy.com/learning-center/"],
                    ["Articles", "https://www.meetdandy.com/articles/"],
                    ["Webinars", "https://www.meetdandy.com/webinars/"],
                    ["eBooks", "https://www.meetdandy.com/ebooks/"],
                    ["Lab Product Catalog", "https://www.meetdandy.com/lab-product-catalog/"],
                    ["Newsroom", "https://www.meetdandy.com/newsroom/"],
                  ].map(([label, href]) => (
                    <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="text-white/50 text-sm hover:text-white/80 transition-colors">{label}</a></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-14 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-xs">© {new Date().getFullYear()} {brand.copyrightName}. All rights reserved.</p>
            {/* Social icons */}
            <div className="flex items-center gap-5">
              {brand.socialUrls.facebook && (
                <a href={brand.socialUrls.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-white/40 hover:text-white/70 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
              )}
              {brand.socialUrls.instagram && (
                <a href={brand.socialUrls.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-white/40 hover:text-white/70 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
              )}
              {brand.socialUrls.linkedin && (
                <a href={brand.socialUrls.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-white/40 hover:text-white/70 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
