import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useGetPageConfig, useTrackEvent } from "@workspace/api-client-react";
import { useVisitorSession } from "@/hooks/use-visitor-session";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// This simulates the external video component path defined in requirements
const DANDY_VIDEO_URL = window.location.origin + "/dandy-lab-video-2/";

export default function LandingPageViewer() {
  const [match, params] = useRoute("/lp/:slug");
  const slug = params?.slug || "";
  
  const sessionId = useVisitorSession(slug);
  const trackEvent = useTrackEvent();
  
  // Only fetch config when we have a sessionId
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !config || !config.assignedVariant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground">The landing page you're looking for doesn't exist or the test has ended.</p>
        </div>
      </div>
    );
  }

  const variantConf = config.assignedVariant.config;

  const handleCtaClick = () => {
    // Fire and forget tracking
    trackEvent.mutate({
      data: {
        sessionId,
        testId: config.testId,
        variantId: config.assignedVariant.id,
        eventType: "conversion",
        conversionType: "cta_click"
      }
    });

    if (variantConf.ctaUrl) {
      window.location.href = variantConf.ctaUrl;
    } else {
      alert("Conversion Tracked! (No URL configured)");
    }
  };

  // --- Apply dynamic styles based on config ---
  const isDark = variantConf.backgroundStyle === "dark";
  const isGradient = variantConf.backgroundStyle === "gradient";
  const isSplit = variantConf.layout === "split";
  const isMinimal = variantConf.layout === "minimal";

  return (
    <div className={cn(
      "min-h-screen w-full font-sans transition-colors duration-500",
      isDark ? "bg-slate-950 text-white" : isGradient ? "bg-gradient-to-br from-indigo-50 via-white to-sky-50 text-slate-900" : "bg-white text-slate-900"
    )}>
      
      {/* Top Banner indicating Test Status (Optional, good for previewing) */}
      <div className="bg-black/80 text-white/80 text-xs py-1.5 text-center font-mono tracking-widest backdrop-blur-md">
        TEST RUNNING • VARIANT: {config.assignedVariant.name}
      </div>

      <div className={cn(
        "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24",
        isSplit ? "grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center" : "flex flex-col items-center text-center"
      )}>
        
        {/* Content Section */}
        <div className={cn(
          "space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 fill-mode-both",
          !isSplit && "max-w-3xl mx-auto"
        )}>
          <h1 className={cn(
            "font-display font-bold tracking-tight leading-[1.1]",
            isMinimal ? "text-4xl md:text-5xl" : "text-5xl md:text-6xl lg:text-7xl"
          )}>
            {variantConf.headline}
          </h1>
          
          {variantConf.subheadline && (
            <p className={cn(
              "text-lg md:text-xl leading-relaxed",
              isDark ? "text-slate-300" : "text-slate-600",
              !isSplit && "max-w-2xl mx-auto"
            )}>
              {variantConf.subheadline}
            </p>
          )}

          <div className={cn(
            "pt-4 flex flex-col sm:flex-row gap-4",
            !isSplit && "justify-center"
          )}>
            <button
              onClick={handleCtaClick}
              className={cn(
                "group relative inline-flex items-center justify-center px-8 py-4 font-bold text-lg rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-xl hover:shadow-2xl",
                variantConf.ctaColor ? `bg-[${variantConf.ctaColor}]` : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/25 hover:shadow-primary/40"
              )}
            >
              <span className="relative z-10 flex items-center">
                {variantConf.ctaText}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>

          {variantConf.showSocialProof && (
            <div className={cn(
              "pt-6 flex items-center gap-3 text-sm font-medium animate-in fade-in delay-500 duration-1000",
              isDark ? "text-slate-400" : "text-slate-500",
              !isSplit && "justify-center"
            )}>
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span>{variantConf.socialProofText || "Trusted by industry leaders"}</span>
            </div>
          )}
        </div>

        {/* Media Section */}
        {variantConf.heroType !== "none" && (
          <div className={cn(
            "relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right-8 duration-700 delay-300 fill-mode-both",
            !isSplit && "mt-16 max-w-4xl mx-auto",
            isDark ? "shadow-black/50 ring-1 ring-white/10" : "shadow-slate-200/50 ring-1 ring-slate-900/5"
          )}>
            {variantConf.heroType === "dandy-video" ? (
              <iframe 
                src={DANDY_VIDEO_URL} 
                className="w-full h-full border-0 bg-black"
                title="Hero Video"
                allow="autoplay; fullscreen"
              />
            ) : (
              // Static image fallback
              <img 
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&q=80" 
                alt="Data Visualization" 
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Glossy reflection overlay */}
            <div className="absolute inset-0 pointer-events-none rounded-3xl ring-1 ring-inset ring-white/10" />
          </div>
        )}

      </div>
    </div>
  );
}
