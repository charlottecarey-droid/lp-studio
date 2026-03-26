import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Building2, TrendingUp, Zap, Shield,
  BarChart3, Clock, Users, Eye, Activity, Target, Layers,
  FlaskConical, Factory, Award, Play, X, ChevronRight, MapPin, Wrench
} from "lucide-react";
import dandyLogo from "@/assets/dandy-logo.svg";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import heroBoardroom from "@/assets/hero-boardroom.jpg";
import heroDashboard from "@/assets/hero-dashboard.jpg";
import aiScanReview from "@/assets/ai-scan-review.jpg";
import dentalCrowns from "@/assets/dental-crowns.jpg";
import dandyDoctor from "@/assets/dandy-doctor.jpg";
import scannerSpeed from "@/assets/scanner-speed.webp";
import dandyLabMachines from "@/assets/dandy-lab-crown-machine.webp";
import dandyInsightsDashboard from "@/assets/dandy-insights-dashboard.png";
import dandyVisionScanner from "@/assets/dandy-vision-scanner.png";
import MicrositeInteractiveDashboard from "@/components/MicrositeInteractiveDashboard";
import { MicrositeSkinConfig, filterByPracticeCount, getHeadlineSizeClasses } from "@/lib/microsite-skin-config";

type BriefingData = {
  companyName: string;
  overview: string;
  tier: string;
  tierRationale?: string;
  organizationalModel?: string;
  dandyFitAnalysis: {
    primaryValueProp: string;
    keyPainPoints: string[];
    relevantProofPoints: string[];
    potentialObjections?: string[];
    recommendedPilotApproach: string;
  };
  micrositeRecommendations: {
    headline: string;
    keyMetrics: string[];
    contentFocus: string;
  };
  sizeAndLocations?: {
    practiceCount: string;
    states: string[];
    headquarters: string;
    estimatedRevenue?: string | null;
  };
};

interface FlagshipSkinProps {
  data: BriefingData;
  skinConfig: MicrositeSkinConfig | null;
  onOpenDemo: (buttonUrl?: string, ctaLabel?: string) => void;
  onTrackCTA: (label: string) => void;
  variant?: "light" | "dark";
}

/* ── Grain texture overlay — used sparingly ── */
const GrainOverlay = ({ opacity = 0.03 }: { opacity?: number }) => (
  <div className="absolute inset-0 pointer-events-none z-[1]" style={{ opacity }}>
    <svg className="w-full h-full"><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#grain)" /></svg>
  </div>
);

/* ── Fade section with stagger support ── */
const FadeSection = ({ children, className = "", delay = 0, direction = "up" }: { children: React.ReactNode; className?: string; delay?: number; direction?: "up" | "left" | "right" }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const initial = direction === "up" ? { opacity: 0, y: 30 } : direction === "left" ? { opacity: 0, x: -30 } : { opacity: 0, x: 30 };
  const animate = direction === "up" ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 };
  return (
    <motion.div ref={ref} initial={initial} animate={inView ? animate : {}} transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }} className={className}>
      {children}
    </motion.div>
  );
};

/* ── Counter animation ── */
const AnimatedCounter = ({ target, suffix = "", prefix = "" }: { target: string; suffix?: string; prefix?: string }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState("0");
  const numericPart = target.replace(/[^0-9.]/g, "");
  const num = parseFloat(numericPart) || 0;
  
  useEffect(() => {
    if (!inView || !num) { setDisplay(target); return; }
    const duration = 1800;
    const startTime = performance.now();
    const isDecimal = target.includes(".");
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = num * eased;
      setDisplay(isDecimal ? current.toFixed(1) : Math.round(current).toLocaleString());
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, num, target]);

  return <span ref={ref}>{prefix}{display}{suffix}</span>;
};

/* ── Video modal ── */
const VideoModal = ({ url, onClose }: { url: string; onClose: () => void }) => {
  const toEmbed = (u: string) => u.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/").replace("vimeo.com/", "player.vimeo.com/video/");
  return (
    <AnimatePresence>
      {url && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={onClose} className="absolute -top-10 right-0 z-10 text-white hover:text-white/80"><X className="w-6 h-6" /></button>
            <iframe src={toEmbed(url) + (url.includes("?") ? "&" : "?") + "autoplay=1&rel=0"} title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ── Default data ── */
const DEFAULT_CASE_STUDIES = [
  { name: "APEX Dental Partners", stat: "12.5%", label: "revenue increase", quote: "Dandy values education, technology, and people.", author: "Dr. Layla Lohmann", img: dentalCrowns },
  { name: "Open & Affordable Dental", stat: "96%", label: "reduction in remakes", quote: "Our remake headaches are gone.", author: "Clinical Director", img: dandyDoctor },
  { name: "Dental Care Alliance", stat: "99%", label: "retention after 1 year", quote: "The whole experience has been incredible.", author: "Dr. Trey Mueller, CCO", img: scannerSpeed },
];

const DEFAULT_COMPARISON = [
  { need: "Patient Volume Growth", dandy: "30% higher case acceptance", traditional: "No growth enablement" },
  { need: "Multi-Brand Consistency", dandy: "One standard across all locations", traditional: "Varies by location" },
  { need: "Waste Prevention", dandy: "AI catches issues before they cost you", traditional: "Remakes after the fact" },
  { need: "Executive Visibility", dandy: "Real-time data across all offices", traditional: "Fragmented reports" },
  { need: "Capital Efficiency", dandy: "Scanners included — no CAPEX", traditional: "Heavy CAPEX" },
  { need: "Change Management", dandy: "Hands-on training", traditional: "Minimal onboarding" },
];

const HIDDEN_COST_CARDS = [
  { icon: TrendingUp, title: "Same-Store Growth Stalls", desc: "Small improvements in case acceptance only compound with the right lab partner.", large: true },
  { icon: BarChart3, title: "Fragmented Lab Data", desc: "Data silos across states hide optimization opportunities." },
  { icon: Users, title: "Standardization vs. Autonomy", desc: "Providers resist lab changes that restrict clinical freedom." },
  { icon: Layers, title: "Unproven Technology ROI", desc: "Enterprise scanner rollouts need zero-CAPEX models to prove ROI.", large: true },
];

const TICKER_LOGOS = [
  "Aspen Dental", "Heartland Dental", "DENTAL CARE ALLIANCE", "Smile Brands", 
  "Pacific Dental Services", "Affordable Care", "Tend", "APEX Dental Partners",
  "Mortenson Dental", "Dental365", "MB2 Dental", "Great Expressions",
];

const CALC = {
  casesPerPractice: 120, avgCaseValue: 350, industryRemake: 0.08, dandyRemake: 0.032,
  remakeCost: 280, chairMinutes: 45, chairValue: 8, scanSaved: 2.5,
};

const MicrositeFlagshipSkin = ({ data, skinConfig, onOpenDemo, onTrackCTA, variant = "light" }: FlagshipSkinProps) => {
  const [labVideoOpen, setLabVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [activeCaseStudy, setActiveCaseStudy] = useState(0);
  const [practices, setPractices] = useState(100);
  const [avgCases, setAvgCases] = useState(120);
  const [navScrolled, setNavScrolled] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroImageY = useTransform(heroProgress, [0, 1], [0, 60]);

  const labRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: labProgress } = useScroll({ target: labRef, offset: ["start end", "end start"] });
  const labImageY = useTransform(labProgress, [0, 1], [-20, 20]);

  const cfg = skinConfig;
  const fit = data.dandyFitAnalysis;
  const size = data.sizeAndLocations;
  const practiceCount = size?.practiceCount || "100+";
  const parsedPractices = parseInt(String(practiceCount).replace(/\D/g, ""), 10) || 100;

  useEffect(() => { setPractices(Math.min(parsedPractices, 2000)); }, [parsedPractices]);
  
  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const visibleSections = new Set(cfg?.sections?.filter(s => s.visible).map(s => s.id) || [
    "hero", "hiddenCost", "comparison", "dashboard", "aiScanReview", "successStories", "pilotApproach", "labTour", "calculator", "finalCTA"
  ]);

  const sectionHeadline = (id: string, fallback: string) => {
    const sec = cfg?.sections?.find(s => s.id === id);
    return (sec?.headline || fallback).replace(/\{company\}/g, data.companyName);
  };

  const isDark = variant === "dark";

  // ── Color palette with improved dark-mode contrast ──
  const accentColor = cfg?.colors?.accent || "#2ecc71";
  const brandGreen = isDark ? "#0a1a10" : "#0a2e1a";
  const pageBg = isDark ? "#0a0f0d" : "#ffffff";
  const pageText = isDark ? "#f0f4f2" : "#0f2b1c";
  const subtleBg = isDark ? "rgba(255,255,255,0.04)" : "#f9fafb";
  const subtleBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  const bodyText = isDark ? "rgba(255,255,255,0.7)" : "#6b7280";
  const mutedText = isDark ? "rgba(255,255,255,0.5)" : "#9ca3af";
  const labelText = isDark ? "rgba(255,255,255,0.55)" : "#9ca3af";
  const statCounterBg = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const statCounterBorder = isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6";
  const inputBg = isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6";
  const tickerBg = isDark ? "rgba(255,255,255,0.02)" : "rgba(249,250,251,0.3)";
  const tickerFade = isDark ? "rgba(10,15,13,0.9)" : "rgba(249,250,251,0.8)";
  const tickerText = isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb";
  const logoSrc = isDark ? dandyLogoWhite : dandyLogo;
  const navBgScrolled = isDark ? "rgba(10,15,13,0.95)" : "rgba(255,255,255,0.95)";
  const navBorderScrolled = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const heroGradient = isDark
    ? `linear-gradient(135deg, #0a0f0d, #0d1a14, #0a0f0d)`
    : `linear-gradient(135deg, #ffffff, #ffffff, #ecfdf5)`;
  const pilotCircleBg = isDark ? "rgba(255,255,255,0.05)" : "#ffffff";
  const pilotLineBg = isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb";
  const calcResultBg = isDark ? `${accentColor}0a` : `${accentColor}06`;
  const calcInputBg = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const calcSummaryBg = isDark ? "rgba(255,255,255,0.04)" : "#f9fafb";
  const calcSummaryBorder = isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6";
  const calcDivider = isDark ? "rgba(255,255,255,0.08)" : "rgba(229,231,235,0.6)";
  const testimonialBg = isDark ? "rgba(255,255,255,0.04)" : "#f9fafb";
  const chipBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(236,253,245,1)";
  const chipBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(167,243,208,1)";
  const chipText = isDark ? accentColor : "#047857";

  const heroPattern = (cfg?.heroHeadlinePattern || "Built for {company}.").replace(/\{company\}/g, data.companyName);
  const heroCTA = cfg?.heroCTAText || "Schedule a Conversation";
  const navCTA = cfg?.navCTAText || "Get Started";
  const heroImage = cfg?.sectionImages?.heroImage || dandyVisionScanner;
  const aiImage = cfg?.sectionImages?.aiScanReviewImage || aiScanReview;
  const labImage = cfg?.sectionImages?.labTourImage || dandyLabMachines;
  const labVideoSrc = cfg?.sectionImages?.labTourVideoUrl || "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  const rawCaseStudies = cfg?.caseStudies || DEFAULT_CASE_STUDIES;
  const displayCaseStudies = (filterByPracticeCount(rawCaseStudies as any[], parsedPractices, 3) as any[]).slice(0, 3);
  const displayComparison = cfg?.comparisonRows || DEFAULT_COMPARISON;

  const handleCTA = () => { onTrackCTA("CTA Click"); onOpenDemo(); };

  // Calculator
  const monthlyCases = practices * avgCases;
  const yearlyCases = monthlyCases * 12;
  const remakesSaved = yearlyCases * (CALC.industryRemake - CALC.dandyRemake);
  const remakeCostSaved = remakesSaved * CALC.remakeCost;
  const chairTimeValue = remakesSaved * CALC.chairMinutes * CALC.chairValue;
  const revLift = yearlyCases * 0.08 * CALC.avgCaseValue;
  const totalValue = remakeCostSaved + chairTimeValue + revLift;
  const hoursSaved = Math.round((remakesSaved * CALC.chairMinutes + yearlyCases * CALC.scanSaved) / 60);
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`;

  // Auto-rotate case studies
  useEffect(() => {
    const timer = setInterval(() => setActiveCaseStudy(prev => (prev + 1) % displayCaseStudies.length), 6000);
    return () => clearInterval(timer);
  }, [displayCaseStudies.length]);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: pageBg, color: pageText, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ═══════════════════ NAV ═══════════════════ */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        animate={{
          backgroundColor: navScrolled ? navBgScrolled : "rgba(0,0,0,0)",
          borderBottomColor: navScrolled ? navBorderScrolled : "rgba(0,0,0,0)",
          backdropFilter: navScrolled ? "blur(20px)" : "blur(0px)",
        }}
        style={{ borderBottomWidth: 1, borderBottomStyle: "solid" }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <img src={logoSrc} alt="Dandy" className="h-7" />
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium" style={{ color: bodyText }}>
            {visibleSections.has("dashboard") && <a href="#platform" className="hover:opacity-100 opacity-70 transition-opacity relative group">Platform<span className="absolute -bottom-1 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-300" style={{ backgroundColor: accentColor }} /></a>}
            {visibleSections.has("comparison") && <a href="#solutions" className="hover:opacity-100 opacity-70 transition-opacity relative group">Solutions<span className="absolute -bottom-1 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-300" style={{ backgroundColor: accentColor }} /></a>}
            {visibleSections.has("successStories") && <a href="#results" className="hover:opacity-100 opacity-70 transition-opacity relative group">Results<span className="absolute -bottom-1 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-300" style={{ backgroundColor: accentColor }} /></a>}
            {visibleSections.has("calculator") && <a href="#calculator" className="hover:opacity-100 opacity-70 transition-opacity relative group">ROI<span className="absolute -bottom-1 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-300" style={{ backgroundColor: accentColor }} /></a>}
          </div>
          <button onClick={handleCTA} className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-white transition-all hover:shadow-lg" style={{ backgroundColor: accentColor }}>
            {navCTA}
          </button>
        </div>
      </motion.nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      {visibleSections.has("hero") && (
        <section ref={heroRef} className="pt-32 pb-20 md:pt-44 md:pb-32 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: heroGradient }} />
          <GrainOverlay opacity={0.025} />
          
          <div className="relative z-[2] max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <FadeSection>
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: chipBg, border: `1px solid ${chipBorder}`, color: chipText }}>
                  <Zap className="w-3.5 h-3.5" /> Enterprise Lab Partner
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-medium tracking-[-0.04em] leading-[1.5]" style={{ color: pageText }}>
                  {heroPattern.split(" ").map((word, i) => (
                    <motion.span key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="inline-block mr-[0.3em]">
                      {word}
                    </motion.span>
                  ))}
                </h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-lg leading-relaxed max-w-lg" style={{ color: bodyText }}>
                  {cfg?.heroSubtext || fit.primaryValueProp}
                </motion.p>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="flex items-center gap-4 pt-2">
                  <button onClick={handleCTA}
                    className="inline-flex items-center gap-2.5 px-7 py-4 rounded-full text-[15px] font-semibold text-white transition-all hover:shadow-lg hover:brightness-110" style={{ backgroundColor: accentColor }}>
                    {heroCTA} <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" })}
                    className="inline-flex items-center gap-2 px-6 py-4 rounded-full text-[15px] font-medium transition-all hover:bg-white/5"
                    style={{ color: bodyText, border: `1px solid ${cardBorder}` }}>
                    {cfg?.secondaryCTAText || "Calculate ROI"}
                  </button>
                </motion.div>
              </div>
            </FadeSection>

            <FadeSection delay={0.15} direction="right">
              <motion.div className="relative" style={{ y: heroImageY }}>
                <div className="relative rounded-2xl overflow-hidden" style={{ border: `1px solid ${cardBorder}`, boxShadow: `0 25px 60px -20px rgba(0,0,0,${isDark ? '0.4' : '0.1'})` }}>
                  <img src={heroImage} alt="Dandy Platform" className="w-full h-auto" />
                </div>
                {/* Static stat pills */}
                <div className="absolute -left-6 top-1/4 rounded-xl px-5 py-3.5 hidden lg:block" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: `0 8px 24px -8px rgba(0,0,0,${isDark ? '0.4' : '0.08'})` }}>
                  <p className="text-2xl font-bold" style={{ color: accentColor }}>96%</p>
                  <p className="text-[11px] font-medium" style={{ color: mutedText }}>First-time fit</p>
                </div>
                <div className="absolute -right-4 bottom-1/4 rounded-xl px-5 py-3.5 hidden lg:block" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: `0 8px 24px -8px rgba(0,0,0,${isDark ? '0.4' : '0.08'})` }}>
                  <p className="text-2xl font-bold" style={{ color: accentColor }}>60%</p>
                  <p className="text-[11px] font-medium" style={{ color: mutedText }}>Fewer remakes</p>
                </div>
              </motion.div>
            </FadeSection>
          </div>
        </section>
      )}

      {/* ═══════════════════ LOGO TICKER ═══════════════════ */}
      <section className="py-12 overflow-hidden relative" style={{ backgroundColor: tickerBg, borderTop: `1px solid ${subtleBorder}`, borderBottom: `1px solid ${subtleBorder}` }}>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] mb-8 relative z-[2]" style={{ color: mutedText }}>
          Trusted by 2,000+ dental practices nationwide
        </p>
        <div className="relative z-[2] space-y-4">
          <div className="flex gap-20 whitespace-nowrap" style={{ animation: "scroll 35s linear infinite" }}>
            {[...TICKER_LOGOS, ...TICKER_LOGOS].map((name, i) => (
              <span key={i} className="text-xl font-bold tracking-tight shrink-0" style={{ color: tickerText }}>{name}</span>
            ))}
          </div>
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-32 z-[3] pointer-events-none" style={{ background: `linear-gradient(to right, ${tickerFade}, transparent)` }} />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-[3] pointer-events-none" style={{ background: `linear-gradient(to left, ${tickerFade}, transparent)` }} />
        <style>{`@keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
      </section>

      {/* ═══════════════════ HIDDEN COST — Bento Grid ═══════════════════ */}
      {visibleSections.has("hiddenCost") && (
        <section className="py-24 md:py-32 relative">
          <div className="relative z-[2] max-w-7xl mx-auto px-6">
            <FadeSection>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: mutedText }}>The challenge</p>
              <h2 className="text-3xl md:text-4xl lg:text-[3.2rem] font-medium tracking-[-0.03em] leading-[1.6] max-w-3xl">
                {sectionHeadline("hiddenCost", "At {company}'s scale — even small inefficiencies compound fast.")}
              </h2>
            </FadeSection>
            <div className="mt-14 grid md:grid-cols-2 gap-5">
              {HIDDEN_COST_CARDS.map((card, i) => (
                <FadeSection key={i} delay={i * 0.1}>
                  <div className="group relative p-8 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                    style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
                    <div className="absolute bottom-0 left-0 w-0 group-hover:w-full h-[2px] transition-all duration-500" style={{ backgroundColor: accentColor }} />
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: `${accentColor}12` }}>
                      <card.icon className="w-5 h-5" style={{ color: accentColor }} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 tracking-tight">{card.title}</h3>
                    <p className="text-[15px] leading-relaxed" style={{ color: bodyText }}>{card.desc}</p>
                  </div>
                </FadeSection>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ PLATFORM — Dashboard ═══════════════════ */}
      {visibleSections.has("dashboard") && (
        <section id="platform" className="py-24 md:py-32 relative overflow-hidden" style={{ backgroundColor: subtleBg }}>
          <div className="relative z-[2] max-w-7xl mx-auto px-6">
            <FadeSection>
              <div className="text-center max-w-2xl mx-auto mb-14">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>The Platform</p>
                <h2 className="text-3xl md:text-4xl lg:text-[3.2rem] font-medium tracking-[-0.03em] leading-[1.6]">
                  {sectionHeadline("dashboard", "Visibility isn't reporting. It's control.")}
                </h2>
              </div>
            </FadeSection>
            <FadeSection delay={0.1}>
              <MicrositeInteractiveDashboard variant={isDark ? "dark" : "light"} practiceCount={practiceCount} />
            </FadeSection>
          </div>
        </section>
      )}

      {/* ═══════════════════ AI SCAN REVIEW ═══════════════════ */}
      {visibleSections.has("aiScanReview") && (
        <section className="py-24 md:py-32 relative overflow-hidden">
          <div className="relative z-[2] max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <FadeSection direction="left">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>AI-Powered Quality</p>
                  <h2 className="text-3xl md:text-4xl lg:text-[3.2rem] font-medium tracking-[-0.03em] leading-[1.6] mb-6">
                    {sectionHeadline("aiScanReview", "Remakes are a tax. AI eliminates them.")}
                  </h2>
                  <p className="text-[15px] leading-relaxed mb-8" style={{ color: bodyText }}>
                    Our AI analyzes every scan in real-time — flagging margin discrepancies, prep issues, and occlusal problems while the patient is still in the chair.
                  </p>
                  <div className="space-y-4">
                    {["Real-time scan analysis before submission", "96% first-time fit rate across all cases", "Instant feedback loop with lab technicians"].map((item, i) => (
                      <FadeSection key={i} delay={0.2 + i * 0.08}>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: accentColor }} />
                          <span className="text-[15px]" style={{ color: bodyText }}>{item}</span>
                        </div>
                      </FadeSection>
                    ))}
                  </div>
                </div>
              </FadeSection>
              <FadeSection delay={0.1} direction="right">
                <div className="relative">
                  <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${cardBorder}`, boxShadow: `0 20px 50px -15px rgba(0,0,0,${isDark ? '0.3' : '0.08'})` }}>
                    <img src={aiImage} alt="AI Scan Review" className="w-full" />
                  </div>
                  <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-2xl shadow-xl flex items-center justify-center hidden md:flex" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
                    <svg className="w-18 h-18 -rotate-90" viewBox="0 0 36 36" style={{ width: 72, height: 72 }}>
                      <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb"} strokeWidth="2" />
                      <motion.path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" initial={{ strokeDasharray: "0, 100" }} whileInView={{ strokeDasharray: "96, 100" }} transition={{ duration: 2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }} viewport={{ once: true }} />
                    </svg>
                    <span className="absolute text-base font-bold" style={{ color: accentColor }}>96%</span>
                  </div>
                </div>
              </FadeSection>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ COMPARISON ═══════════════════ */}
      {visibleSections.has("comparison") && (() => {
        const ComparisonSection = () => {
          const [activeCard, setActiveCard] = useState(0);
          const [paused, setPaused] = useState(false);
          const compRef = useRef<HTMLDivElement>(null);
          const compInView = useInView(compRef, { once: false, margin: "-100px" });

          useEffect(() => {
            if (!compInView || paused) return;
            const timer = setInterval(() => setActiveCard(prev => (prev + 1) % displayComparison.length), 3000);
            return () => clearInterval(timer);
          }, [compInView, paused]);

          return (
            <section ref={compRef} id="solutions" className="py-24 md:py-32 overflow-hidden relative" style={{ backgroundColor: isDark ? "#080c0a" : "#0a0f0d", color: "#ffffff" }}>
              <GrainOverlay opacity={0.04} />
              <div className="relative z-[2] max-w-7xl mx-auto px-6">
                <FadeSection>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>The Dandy Difference</p>
                  <h2 className="text-3xl md:text-4xl lg:text-[3.2rem] font-medium tracking-[-0.03em] leading-[1.6] max-w-3xl mb-14">
                    {sectionHeadline("comparison", "Lab consolidation shouldn't mean compromise.")}
                  </h2>
                </FadeSection>
                <div
                  className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory -mx-6 px-6"
                  onMouseEnter={() => setPaused(true)}
                  onMouseLeave={() => setPaused(false)}
                >
                  {displayComparison.map((row, i) => {
                    const isActive = i === activeCard;
                    return (
                      <FadeSection key={i} delay={i * 0.06} className="snap-start">
                        <div
                          onClick={() => { setActiveCard(i); setPaused(true); }}
                          className="w-[320px] shrink-0 rounded-2xl p-7 relative overflow-hidden cursor-pointer transition-all duration-700 ease-out"
                          style={{
                            backgroundColor: isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                            border: `1px solid ${isActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                            transform: isActive ? "translateY(-4px)" : "translateY(0)",
                            boxShadow: isActive ? `0 12px 40px -10px ${accentColor}15` : "none",
                          }}
                        >
                          <div className="relative z-[1]" style={{ opacity: isActive ? 1 : 0.4, transition: "opacity 0.7s ease" }}>
                            <h3 className="text-lg font-semibold mb-5 tracking-tight">{row.need}</h3>
                            <div className="space-y-4">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-1.5" style={{ color: accentColor }}>Dandy</p>
                                <p className="text-sm text-white/75">{row.dandy}</p>
                              </div>
                              <div className="border-t border-white/[0.08] pt-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30 mb-1.5">Traditional Labs</p>
                                <p className="text-sm text-white/40">{row.traditional}</p>
                              </div>
                            </div>
                          </div>
                          <div
                            className="absolute bottom-0 left-0 h-[2px] transition-all duration-700 ease-out"
                            style={{ width: isActive ? "100%" : "0%", backgroundColor: accentColor }}
                          />
                        </div>
                      </FadeSection>
                    );
                  })}
                </div>
                <div className="flex justify-center gap-2 mt-8">
                  {displayComparison.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveCard(i); setPaused(true); }}
                      className="relative w-8 h-1 rounded-full overflow-hidden transition-all duration-300"
                      style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                    >
                      <div
                        className="absolute inset-0 rounded-full transition-all duration-700 ease-out"
                        style={{
                          backgroundColor: accentColor,
                          transform: i === activeCard ? "scaleX(1)" : "scaleX(0)",
                          transformOrigin: "left",
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          );
        };
        return <ComparisonSection />;
      })()}

      {/* ═══════════════════ SUCCESS STORIES ═══════════════════ */}
      {visibleSections.has("successStories") && (
        <section id="results" className="py-24 md:py-32 relative overflow-hidden">
          <div className="relative z-[2] max-w-7xl mx-auto px-6">
            <FadeSection>
              <div className="text-center max-w-2xl mx-auto mb-16">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>Results</p>
                <h2 className="text-3xl md:text-4xl lg:text-[3.2rem] font-medium tracking-[-0.03em] leading-[1.6]">
                  {sectionHeadline("successStories", "DSOs that switched and never looked back.")}
                </h2>
              </div>
            </FadeSection>

            <div className="grid grid-cols-3 gap-6 mb-16">
              {[
                { target: "2000", suffix: "+", label: "Dental practices" },
                { target: "96", suffix: "%", label: "First-time fit rate" },
                { target: "60", suffix: "%", label: "Fewer remakes" },
              ].map((s, i) => (
                <FadeSection key={i} delay={i * 0.08}>
                  <div className="text-center py-10 rounded-2xl" style={{ backgroundColor: statCounterBg, border: `1px solid ${statCounterBorder}` }}>
                    <p className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight" style={{ color: accentColor }}>
                      <AnimatedCounter target={s.target} suffix={s.suffix} />
                    </p>
                    <p className="text-sm mt-3 font-medium" style={{ color: mutedText }}>{s.label}</p>
                  </div>
                </FadeSection>
              ))}
            </div>

            <FadeSection>
              <div className="relative rounded-3xl overflow-hidden" style={{ border: `1px solid ${cardBorder}`, boxShadow: `0 16px 48px -12px rgba(0,0,0,${isDark ? '0.3' : '0.08'})` }}>
                <AnimatePresence mode="wait">
                  <motion.div key={activeCaseStudy} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                    className="grid md:grid-cols-5 min-h-[380px]">
                    <div className="md:col-span-2 relative overflow-hidden">
                      <img src={displayCaseStudies[activeCaseStudy]?.img || dentalCrowns} alt="" className="w-full h-full object-cover min-h-[260px]" />
                      <div className="absolute inset-0 hidden md:block" style={{ background: isDark ? `linear-gradient(to right, transparent, ${pageBg}ee)` : `linear-gradient(to right, transparent, ${testimonialBg}ee)` }} />
                    </div>
                    <div className="md:col-span-3 p-10 md:p-14 flex flex-col justify-center" style={{ backgroundColor: testimonialBg }}>
                      <div className="mb-6">
                        <p className="text-5xl md:text-6xl font-bold tracking-tight" style={{ color: accentColor }}>
                          {displayCaseStudies[activeCaseStudy]?.stat}
                        </p>
                        <p className="text-sm mt-1 font-medium" style={{ color: mutedText }}>{displayCaseStudies[activeCaseStudy]?.label}</p>
                      </div>
                      <blockquote className="text-xl md:text-2xl font-medium leading-relaxed mb-6 tracking-[-0.01em]" style={{ color: pageText }}>
                        "{displayCaseStudies[activeCaseStudy]?.quote}"
                      </blockquote>
                      <div>
                        <p className="font-semibold" style={{ color: pageText }}>{displayCaseStudies[activeCaseStudy]?.author}</p>
                        <p className="text-sm" style={{ color: mutedText }}>{displayCaseStudies[activeCaseStudy]?.name}</p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2.5">
                  {displayCaseStudies.map((_, i) => (
                    <button key={i} onClick={() => setActiveCaseStudy(i)} className="relative w-2.5 h-2.5 rounded-full transition-all overflow-hidden" style={{ backgroundColor: i === activeCaseStudy ? `${accentColor}30` : (isDark ? "rgba(255,255,255,0.25)" : "#d1d5db") }}>
                      {i === activeCaseStudy && <motion.div className="absolute inset-0 rounded-full" style={{ backgroundColor: accentColor }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 6, ease: "linear" }} />}
                    </button>
                  ))}
                </div>
              </div>
            </FadeSection>
          </div>
        </section>
      )}

      {/* ═══════════════════ PILOT APPROACH ═══════════════════ */}
      {visibleSections.has("pilotApproach") && (
        <section className="py-24 md:py-32 relative overflow-hidden" style={{ backgroundColor: subtleBg }}>
          <div className="relative z-[2] max-w-7xl mx-auto px-6">
            <FadeSection>
              <div className="text-center max-w-2xl mx-auto mb-16">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>How It Works</p>
                <h2 className="text-3xl md:text-4xl lg:text-[3.2rem] font-medium tracking-[-0.03em] leading-[1.6]">
                  {sectionHeadline("pilotApproach", "Start small. Prove it out. Then scale.")}
                </h2>
              </div>
            </FadeSection>
            <div className="relative">
              <div className="hidden md:block absolute top-[60px] left-[16.5%] right-[16.5%] h-[2px] overflow-hidden" style={{ backgroundColor: pilotLineBg }}>
                <motion.div className="h-full" style={{ backgroundColor: accentColor }} initial={{ width: "0%" }} whileInView={{ width: "100%" }} transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }} viewport={{ once: true }} />
              </div>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { step: "01", title: "Pilot Launch", desc: `Start with 5–10 ${data.companyName} locations. Install scanners, onboard teams, and start sending cases.` },
                  { step: "02", title: "Measure Impact", desc: "Track remake rates, chair time savings, case acceptance lift, and provider satisfaction over 90 days." },
                  { step: "03", title: "Scale with Confidence", desc: `Roll out across all ${data.companyName} locations with a proven playbook and dedicated support.` },
                ].map((s, i) => (
                  <FadeSection key={i} delay={0.2 + i * 0.15}>
                    <div className="text-center relative">
                      <div className="w-[120px] h-[120px] mx-auto rounded-full border-2 flex items-center justify-center mb-8 relative z-10 transition-colors duration-300"
                        style={{ borderColor: pilotLineBg, backgroundColor: pilotCircleBg, boxShadow: `0 8px 24px -8px rgba(0,0,0,${isDark ? '0.3' : '0.06'})` }}>
                        <span className="text-3xl font-bold tracking-tight" style={{ color: accentColor }}>{s.step}</span>
                      </div>
                      <h3 className="text-xl font-semibold mb-3 tracking-tight">{s.title}</h3>
                      <p className="text-[15px] leading-relaxed max-w-xs mx-auto" style={{ color: bodyText }}>{s.desc}</p>
                    </div>
                  </FadeSection>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ LAB TOUR ═══════════════════ */}
      {visibleSections.has("labTour") && (
        <section ref={labRef} className="relative">
          <div className="relative h-[75vh] min-h-[550px] overflow-hidden cursor-pointer group" onClick={() => { setVideoUrl(labVideoSrc); setLabVideoOpen(true); }}>
            <motion.img src={labImage} alt="Dandy Lab" className="w-full h-full object-cover object-[center_25%]" style={{ y: labImageY, scale: 1.1 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/15" />
            <GrainOverlay opacity={0.04} />

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-[2]">
              <div className="w-24 h-24 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Play className="w-10 h-10 text-white ml-1" fill="white" fillOpacity={0.9} />
              </div>
              <p className="text-white/60 text-sm font-medium tracking-wide">Watch the Lab Tour</p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-14 z-[2]">
              <FadeSection>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400 mb-3">Vertical Integration</p>
                <h2 className="text-3xl md:text-4xl lg:text-[3.2rem] font-medium text-white tracking-[-0.03em] leading-[1.6] mb-8 max-w-xl">
                  {sectionHeadline("labTour", "See vertical integration in action.")}
                </h2>
                <div className="flex gap-8 flex-wrap">
                  {[
                    { value: "600K+", label: "Cases / year" },
                    { value: "100%", label: "U.S. manufactured" },
                    { value: "5 days", label: "Avg turnaround" },
                  ].map((s, i) => (
                    <FadeSection key={i} delay={0.2 + i * 0.1}>
                      <div className="text-white">
                        <p className="text-3xl font-bold tracking-tight">{s.value}</p>
                        <p className="text-xs text-white/50 font-medium mt-1">{s.label}</p>
                      </div>
                    </FadeSection>
                  ))}
                </div>
              </FadeSection>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ ROI CALCULATOR ═══════════════════ */}
      {visibleSections.has("calculator") && (
        <section id="calculator" className="py-24 md:py-32 relative">
          <div className="relative z-[2] max-w-7xl mx-auto px-6">
            <FadeSection>
              <div className="text-center max-w-2xl mx-auto mb-14">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>ROI Calculator</p>
                <h2 className="text-3xl md:text-4xl lg:text-[3.2rem] font-medium tracking-[-0.03em] leading-[1.6]">
                  {sectionHeadline("calculator", "Calculate the cost of inaction.")}
                </h2>
              </div>
            </FadeSection>
            <FadeSection delay={0.1}>
              <div className="rounded-3xl overflow-hidden" style={{ border: `1px solid ${cardBorder}`, boxShadow: `0 20px 50px -15px rgba(0,0,0,${isDark ? '0.3' : '0.08'})` }}>
                <div className="grid lg:grid-cols-2">
                  <div className="p-10 md:p-14" style={{ backgroundColor: calcInputBg }}>
                    <h3 className="text-xl font-semibold mb-1.5 tracking-tight">Adjust your numbers</h3>
                    <p className="text-sm mb-10" style={{ color: mutedText }}>See how Dandy impacts {data.companyName}'s bottom line.</p>

                    <div className="mb-10">
                      <div className="flex justify-between mb-3">
                        <label className="text-[13px] font-medium" style={{ color: bodyText }}>Number of Practices</label>
                        <span className="text-lg font-semibold tabular-nums" style={{ color: accentColor }}>{practices.toLocaleString()}</span>
                      </div>
                      <input type="range" min={5} max={2000} step={5} value={practices} onChange={e => setPractices(Number(e.target.value))}
                        className={`w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0`} style={{ backgroundColor: inputBg }}
                      />
                      <div className="flex justify-between text-[11px] mt-1.5" style={{ color: mutedText }}><span>5</span><span>2,000</span></div>
                    </div>

                    <div className="mb-10">
                      <div className="flex justify-between mb-3">
                        <label className="text-[13px] font-medium" style={{ color: bodyText }}>Cases / Practice / Month</label>
                        <span className="text-lg font-semibold tabular-nums" style={{ color: accentColor }}>{avgCases}</span>
                      </div>
                      <input type="range" min={30} max={300} step={5} value={avgCases} onChange={e => setAvgCases(Number(e.target.value))}
                        className={`w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0`} style={{ backgroundColor: inputBg }}
                      />
                      <div className="flex justify-between text-[11px] mt-1.5" style={{ color: mutedText }}><span>30</span><span>300</span></div>
                    </div>

                    <div className="rounded-xl p-6" style={{ backgroundColor: calcSummaryBg, border: `1px solid ${calcSummaryBorder}` }}>
                      <p className="text-[11px] uppercase tracking-[0.15em] mb-4 font-semibold" style={{ color: mutedText }}>Your Profile</p>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span style={{ color: mutedText }}>Monthly cases</span><span className="font-semibold tabular-nums">{monthlyCases.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span style={{ color: mutedText }}>Annual cases</span><span className="font-semibold tabular-nums">{yearlyCases.toLocaleString()}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="p-10 md:p-14 relative overflow-hidden" style={{ backgroundColor: calcResultBg }}>
                    <div className="relative z-[1]">
                      <p className="text-[11px] uppercase tracking-[0.15em] mb-8 font-semibold" style={{ color: mutedText }}>Estimated Annual Impact</p>
                      <div className="mb-10">
                        <p className="text-5xl md:text-6xl font-bold tabular-nums leading-none tracking-tight" style={{ color: accentColor }}>{fmt(totalValue)}</p>
                        <p className="text-sm mt-2.5" style={{ color: mutedText }}>total annual value recovered</p>
                      </div>
                      <div className="space-y-1 mb-10">
                        {[
                          { label: "Remake cost savings", value: fmt(remakeCostSaved), sub: `${Math.round(remakesSaved).toLocaleString()} fewer remakes/yr` },
                          { label: "Chair time recovered", value: `${hoursSaved.toLocaleString()} hrs`, sub: `Worth ${fmt(chairTimeValue)} in productivity` },
                          { label: "Revenue from case acceptance", value: fmt(revLift), sub: "8% increase in accepted cases" },
                        ].map((row, i) => (
                          <div key={i} className="flex items-start justify-between py-4 last:border-0" style={{ borderBottom: `1px solid ${calcDivider}` }}>
                            <div><p className="text-[13px] font-medium" style={{ color: bodyText }}>{row.label}</p><p className="text-xs mt-1" style={{ color: mutedText }}>{row.sub}</p></div>
                            <p className="text-lg font-semibold tabular-nums shrink-0 ml-4">{row.value}</p>
                          </div>
                        ))}
                      </div>
                      <button onClick={handleCTA}
                        className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl font-semibold text-[15px] text-white transition-all hover:shadow-lg hover:brightness-110" style={{ backgroundColor: accentColor }}>
                        Get Your Custom Analysis <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </FadeSection>
          </div>
        </section>
      )}

      {/* ═══════════════════ FINAL CTA ═══════════════════ */}
      {visibleSections.has("finalCTA") && (
        <section className="py-24 md:py-32 relative overflow-hidden" style={{ backgroundColor: brandGreen }}>
          <GrainOverlay opacity={0.04} />
          <div className="relative z-[2] max-w-3xl mx-auto px-6 text-center">
            <FadeSection>
              <h2 className="text-3xl md:text-4xl lg:text-[3.2rem] font-medium text-white tracking-[-0.03em] leading-[1.6] mb-6">
                {(cfg?.finalCTAHeadline || "Start with a few locations. Then scale with confidence.").replace(/\{company\}/g, data.companyName)}
              </h2>
              <p className="text-lg text-white/60 leading-relaxed mb-12 max-w-xl mx-auto">
                {(cfg?.finalCTASubheadline || "We'll pilot at 5–10 offices, validate the impact, then roll out across {company}.").replace(/\{company\}/g, data.companyName)}
              </p>
              <button onClick={handleCTA}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-[15px] font-semibold transition-all text-[#0a0f0d] hover:shadow-lg hover:brightness-110" style={{ backgroundColor: accentColor }}>
                {heroCTA} <ArrowRight className="w-4 h-4" />
              </button>
            </FadeSection>
          </div>
        </section>
      )}

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="py-12" style={{ borderTop: `1px solid ${subtleBorder}` }}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={logoSrc} alt="Dandy" className="h-6 opacity-40" />
          <p className="text-xs" style={{ color: mutedText }}>{cfg?.footerText || "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing"}</p>
        </div>
      </footer>

      {labVideoOpen && videoUrl && <VideoModal url={videoUrl} onClose={() => { setLabVideoOpen(false); setVideoUrl(null); }} />}
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
};

export default MicrositeFlagshipSkin;
