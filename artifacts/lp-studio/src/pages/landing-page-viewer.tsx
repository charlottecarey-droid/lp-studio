import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useGetPageConfig, useTrackEvent } from "@workspace/api-client-react";
import { useVisitorSession } from "@/hooks/use-visitor-session";
import { Loader2, ArrowRight, ShieldCheck, Zap, ScanLine, RefreshCcw, HeadphonesIcon, BarChart2, DollarSign, XCircle, AlertTriangle, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtendedVariantConfig } from "@/lib/page-types";

const DANDY_VIDEO_URL = window.location.origin + "/dandy-lab-video-2/";

const LIME = "#C7E738";
const FOREST = "#003A30";

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
  
  const sessionId = useVisitorSession(slug);
  const trackEvent = useTrackEvent();
  
  const { data: config, isLoading, error } = useGetPageConfig(
    slug, 
    { sessionId }, 
    { query: { enabled: !!slug && !!sessionId, retry: false } }
  );

  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  useEffect(() => {
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
  }, [config, sessionId, hasTrackedImpression, trackEvent]);

  if (isLoading || !sessionId) {
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

    if (variantConf.ctaUrl && variantConf.ctaUrl !== "#") {
      window.location.href = variantConf.ctaUrl;
    } else {
      alert("Conversion Tracked! (No URL configured)");
    }
  };

  const isDark = variantConf.backgroundStyle === "dark";
  const isMinimal = variantConf.layout === "minimal";
  const isSplit = variantConf.layout === "split";

  return (
    <div className={cn(
      "min-h-screen w-full font-sans selection:bg-[#C7E738] selection:text-[#003A30]",
      isDark ? "bg-[#003A30] text-white" : "bg-white text-slate-900"
    )}>
      
      {/* 1. Test Banner */}
      <div className="bg-black text-white text-[10px] md:text-xs py-1.5 text-center font-mono tracking-[0.2em] uppercase opacity-80 hover:opacity-100 transition-opacity z-50 relative">
        RUNNING • VARIANT: {config.assignedVariant.name}
      </div>

      {/* 2. Nav */}
      <nav className="w-full px-6 py-4 flex items-center justify-between z-40 relative">
        <div className="font-display font-black text-2xl tracking-tighter" style={{ color: isDark ? 'white' : FOREST }}>
          dandy
        </div>
        <button
          onClick={handleCtaClick}
          className="px-5 py-2.5 rounded-full font-bold text-sm transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: ctaColor, color: FOREST }}
        >
          {variantConf.ctaText}
        </button>
      </nav>

      {/* 3. Hero Section & 4. Video */}
      <section className={cn(
        "relative w-full px-6 flex flex-col items-center",
        isMinimal ? "py-24 md:py-40" : "py-12 md:py-20",
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
                "text-lg md:text-xl leading-relaxed",
                isDark ? "text-white/80" : "text-[#4A6358]",
                !isSplit && "max-w-2xl"
              )}>
                {variantConf.subheadline}
              </p>
            )}

            <div className={cn("flex flex-col gap-4 w-full sm:w-auto pt-2", !isSplit && "items-center")}>
              <button
                onClick={handleCtaClick}
                className="group relative inline-flex items-center justify-center px-10 py-5 font-bold text-lg rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-lg w-full sm:w-auto"
                style={{ backgroundColor: ctaColor, color: FOREST }}
              >
                <span className="relative z-10 flex items-center">
                  {variantConf.ctaText}
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </span>
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

          {variantConf.heroType !== "none" && (
            <div className={cn(
              "relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl z-10",
              !isSplit && "mt-16 max-w-5xl mx-auto"
            )}>
              {variantConf.heroType === "dandy-video" ? (
                <iframe 
                  src={DANDY_VIDEO_URL} 
                  className="w-full h-full border-0 bg-black"
                  title="Demo Video"
                />
              ) : (
                <img 
                  src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1600" 
                  alt="Dental Office" 
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}
        </div>
      </section>

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

      {/* 6. Pain Section (PAS) */}
      {variantConf.painSection?.enabled && (
        <section className="w-full bg-[#003A30] text-white py-20 md:py-32 px-6">
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

      {/* 7. Benefits Grid */}
      {variantConf.benefits?.enabled && (
        <section className="w-full bg-white py-20 md:py-32 px-6">
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

      {/* 8. Testimonial */}
      {variantConf.testimonial?.enabled && (
        <section className="w-full bg-[#F0F7F4] py-24 px-6 relative overflow-hidden">
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

      {/* 9. How It Works */}
      {variantConf.howItWorks?.enabled && (
        <section className="w-full bg-white py-20 md:py-32 px-6">
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

      {/* 10. Bottom CTA Band */}
      {variantConf.bottomCta?.enabled && (
        <section className="w-full bg-[#003A30] text-white py-24 px-6 text-center">
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
              className="px-10 py-5 rounded-full font-bold text-lg transition-transform hover:scale-105 active:scale-95 shadow-xl"
              style={{ backgroundColor: ctaColor, color: FOREST }}
            >
              {variantConf.bottomCta.ctaText || variantConf.ctaText}
            </button>
          </div>
        </section>
      )}

      {/* 11. Guarantee Bar */}
      {variantConf.guaranteeBar?.enabled && (
        <div className="w-full py-4 px-6 text-center text-sm font-bold tracking-wide" style={{ backgroundColor: LIME, color: FOREST }}>
          {variantConf.guaranteeBar.text}
        </div>
      )}

      {/* 12. Footer */}
      <footer className="w-full bg-[#003A30] text-white/50 py-12 px-6 text-center text-sm border-t border-white/10">
        <p>© {new Date().getFullYear()} Dandy. All rights reserved.</p>
      </footer>

    </div>
  );
}
