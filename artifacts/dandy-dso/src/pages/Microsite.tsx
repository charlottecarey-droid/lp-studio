import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, ArrowRight, Building2, TrendingUp, Zap, Shield,
  BarChart3, Clock, MapPin, Users, ChevronRight, Eye, Activity,
  Target, Layers, Wrench, FlaskConical, Factory, Award, Play, X, Minus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMicrositeTracking } from "@/hooks/use-microsite-tracking";
import { useABTest } from "@/hooks/use-ab-test";
import { loadSkinConfig, MicrositeSkinConfig, filterByPracticeCount, getHeadlineSizeClasses, ExpansionSkinConfig, SkinId } from "@/lib/microsite-skin-config";
import MicrositeFlagshipSkin from "@/components/MicrositeFlagshipSkin";
import AnimatedTimeline from "@/components/AnimatedTimeline";
import CustomSectionBlock from "@/components/CustomSectionBlock";
import { Skeleton } from "@/components/ui/skeleton";
import DemoModal, { CHILIPIPER_URL } from "@/components/DemoModal";
import MicrositeSolutionsSkin from "@/components/MicrositeSolutionsSkin";
import MicrositeExpansionSkin from "@/components/MicrositeExpansionSkin";
import MicrositeInteractiveDashboard from "@/components/MicrositeInteractiveDashboard";
import MicrositeHeartlandSkin from "@/components/MicrositeHeartlandSkin";
import MicrositeDandySkin from "@/components/MicrositeDandySkin";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import heroBoardroom from "@/assets/hero-boardroom.jpg";
import heroDashboard from "@/assets/hero-dashboard.jpg";
import aiScanReview from "@/assets/ai-scan-review.jpg";
import dentalCrowns from "@/assets/dental-crowns.jpg";
import dandyDoctor from "@/assets/dandy-doctor.jpg";
import scannerSpeed from "@/assets/scanner-speed.webp";
import dandyLabMachines from "@/assets/dandy-lab-crown-machine.webp";
import ctaOperations from "@/assets/cta-operations.jpg";
import heroBoardroomPremium from "@/assets/hero-boardroom-premium.jpg";
import dandyInsightsDashboard from "@/assets/dandy-insights-dashboard.png";

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

/* ── Animated section wrapper ── */
const FadeSection = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ── Hidden Cost cards — concise ── */
const HIDDEN_COST_CARDS = [
  { icon: TrendingUp, title: "Same-Store Growth Stalls", desc: "Small improvements in case acceptance only compound with the right lab partner." },
  { icon: BarChart3, title: "Fragmented Lab Data", desc: "Data silos across states hide optimization opportunities and cost savings." },
  { icon: Users, title: "Standardization vs. Autonomy", desc: "Providers resist lab changes that restrict clinical freedom." },
  { icon: Layers, title: "Unproven Technology ROI", desc: "Enterprise scanner rollouts require zero-CAPEX models to prove ROI fast." },
];

/* ── Problem cards — concise ── */
const PROBLEM_CARDS = [
  { icon: Building2, title: "Fragmented Networks", desc: "No centralized visibility or control across your lab relationships." },
  { icon: BarChart3, title: "Scattered Data", desc: "Performance tracking impossible across disconnected systems." },
  { icon: Users, title: "Provider Resistance", desc: "When quality doesn't match expectations, adoption stalls." },
  { icon: TrendingUp, title: "Revenue Leakage", desc: "High remake rates and inefficient workflows drain profitability." },
];

/* ── Comparison data ── */
const COMPARISON_ROWS = [
  { need: "Patient Volume Growth", dandy: "30% higher case acceptance, expanded services like Aligners", traditional: "No growth enablement" },
  { need: "Multi-Brand Consistency", dandy: "One standard across all brands and locations", traditional: "Varies by location and vendor" },
  { need: "Waste Prevention", dandy: "AI Scan Review catches issues before they cost you", traditional: "Remakes discovered after the fact" },
  { need: "Executive Visibility", dandy: "Real-time, actionable data across all offices", traditional: "Fragmented, non-actionable reports" },
  { need: "Capital Efficiency", dandy: "Premium scanners included — no CAPEX required", traditional: "Heavy CAPEX, scanner bottlenecks" },
  { need: "Change Management", dandy: "Hands-on training that respects clinical autonomy", traditional: "Minimal onboarding, slow rollout" },
];

/* ── Case studies ── */
const CASE_STUDIES = [
  {
    name: "APEX Dental Partners",
    stat: "12.5%",
    label: "annualized revenue potential increase",
    quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.",
    author: "Dr. Layla Lohmann, Founder",
    img: dentalCrowns,
  },
  {
    name: "Open & Affordable Dental",
    stat: "96%",
    label: "reduction in remakes",
    quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.",
    author: "Clinical Director",
    img: dandyDoctor,
  },
  {
    name: "DENTAL CARE ALLIANCE",
    stat: "99%",
    label: "practices still using Dandy after one year",
    quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.",
    author: "Dr. Trey Mueller, Chief Clinical Officer",
    img: scannerSpeed,
  },
];

/* ── Interactive ROI Calculator ── */
const CALC_CONSTANTS = {
  casesPerPracticePerMonth: 120,
  avgCaseValue: 350,
  industryRemakeRate: 0.08,
  dandyRemakeRate: 0.032,
  remakeCost: 280,
  chairTimeMinutesPerRemake: 45,
  chairTimeValuePerMinute: 8,
  scanTimeSavedMinutesPerCase: 2.5,
};

const MicrositeCalculator = ({ companyName, defaultPractices, onCTA }: { companyName: string; defaultPractices: number; onCTA: () => void }) => {
  const [practices, setPractices] = useState(Math.min(defaultPractices, 2000));
  const [avgCases, setAvgCases] = useState(CALC_CONSTANTS.casesPerPracticePerMonth);

  const c = CALC_CONSTANTS;
  const monthlyCases = practices * avgCases;
  const yearlyCases = monthlyCases * 12;

  const currentRemakes = yearlyCases * c.industryRemakeRate;
  const dandyRemakes = yearlyCases * c.dandyRemakeRate;
  const remakesSaved = currentRemakes - dandyRemakes;
  const remakeReduction = Math.round((1 - c.dandyRemakeRate / c.industryRemakeRate) * 100);

  const remakeCostSaved = remakesSaved * c.remakeCost;
  const chairTimeSaved = remakesSaved * c.chairTimeMinutesPerRemake;
  const chairTimeValue = chairTimeSaved * c.chairTimeValuePerMinute;
  const scanTimeSaved = yearlyCases * c.scanTimeSavedMinutesPerCase;
  const revenueFromAcceptance = yearlyCases * 0.08 * c.avgCaseValue; // 8% case acceptance lift

  const totalAnnualValue = remakeCostSaved + chairTimeValue + revenueFromAcceptance;
  const hoursSaved = Math.round((chairTimeSaved + scanTimeSaved) / 60);

  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`;

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Left — inputs */}
        <div className="p-9 md:p-12 border-b lg:border-b-0 lg:border-r border-white/[0.05]">
          <h3 className="text-xl font-semibold text-white mb-1.5 tracking-[-0.01em]">Interactive ROI Calculator</h3>
          <p className="text-sm text-white/35 mb-10">Adjust the sliders to match {companyName}'s profile.</p>

          {/* Practice count slider */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-medium text-white/60">Number of Practices</label>
              <span className="text-lg font-semibold text-[#2ecc71] tabular-nums">{practices.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={5}
              max={2000}
              step={5}
              value={practices}
              onChange={(e) => setPractices(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/[0.08] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2ecc71] [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(46,204,113,0.35)] [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#2ecc71] [&::-moz-range-thumb]:border-0"
            />
            <div className="flex justify-between text-[11px] text-white/15 mt-1.5">
              <span>5</span>
              <span>2,000</span>
            </div>
          </div>

          {/* Cases per practice slider */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-medium text-white/60">Cases / Practice / Month</label>
              <span className="text-lg font-semibold text-[#2ecc71] tabular-nums">{avgCases}</span>
            </div>
            <input
              type="range"
              min={30}
              max={300}
              step={5}
              value={avgCases}
              onChange={(e) => setAvgCases(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/[0.08] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2ecc71] [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(46,204,113,0.35)] [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#2ecc71] [&::-moz-range-thumb]:border-0"
            />
            <div className="flex justify-between text-[11px] text-white/15 mt-1.5">
              <span>30</span>
              <span>300</span>
            </div>
          </div>

          {/* Summary inputs */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-6">
            <p className="text-[11px] text-white/25 uppercase tracking-[0.15em] mb-4 font-semibold">Your Profile</p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/35">Monthly cases across network</span>
                <span className="text-white/90 font-semibold tabular-nums">{monthlyCases.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/35">Annual cases</span>
                <span className="text-white/90 font-semibold tabular-nums">{yearlyCases.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/35">Current est. remakes / year</span>
                <span className="text-white/50 tabular-nums">{Math.round(currentRemakes).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — results */}
        <div className="p-9 md:p-12 bg-white/[0.01]">
          <p className="text-[11px] text-white/25 uppercase tracking-[0.15em] mb-8 font-semibold">Estimated Annual Impact</p>

          {/* Big number */}
          <div className="mb-10">
            <p className="text-5xl md:text-6xl font-bold text-[#2ecc71] tabular-nums leading-none tracking-tight">{fmt(totalAnnualValue)}</p>
            <p className="text-sm text-white/35 mt-2.5">total annual value recovered</p>
          </div>

          {/* Breakdown */}
          <div className="space-y-1 mb-10">
            {[
              { label: "Remake cost savings", value: fmt(remakeCostSaved), sub: `${Math.round(remakesSaved).toLocaleString()} fewer remakes/yr` },
              { label: "Chair time recovered", value: `${hoursSaved.toLocaleString()} hrs`, sub: `Worth ${fmt(chairTimeValue)} in productivity` },
              { label: "Revenue from case acceptance lift", value: fmt(revenueFromAcceptance), sub: "8% increase in accepted cases" },
            ].map((row, i) => (
              <div key={i} className="flex items-start justify-between py-4 border-b border-white/[0.03] last:border-0">
                <div>
                  <p className="text-[13px] font-medium text-white/60">{row.label}</p>
                  <p className="text-xs text-white/25 mt-1">{row.sub}</p>
                </div>
                <p className="text-lg font-semibold text-white/90 tabular-nums shrink-0 ml-4">{row.value}</p>
              </div>
            ))}
          </div>

          {/* Bottom stats */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { value: `${remakeReduction}%`, label: "Fewer remakes" },
              { value: fmt(totalAnnualValue), label: "Annual upside" },
              { value: `${hoursSaved}+`, label: "Hours recovered" },
            ].map((s, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <p className="text-xl font-bold text-[#2ecc71]">{s.value}</p>
                <p className="text-[10px] text-white/25 mt-1.5 uppercase tracking-[0.12em]">{s.label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={onCTA}
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-[#2ecc71] text-[#0a0f0d] font-semibold hover:bg-[#27ae60] transition-all duration-300 hover:shadow-lg hover:shadow-[rgba(46,204,113,0.15)] text-[15px]"
          >
            Get Your Custom Analysis <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const Microsite = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<BriefingData | null>(null);
  const [micrositeId, setMicrositeId] = useState<string | null>(null);
  const [skin, setSkin] = useState<string>("executive");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("");
  const [skinConfig, setSkinConfig] = useState<MicrositeSkinConfig | null>(null);
  const [labVideoOpen, setLabVideoOpen] = useState(false);

  const trackingCtx = useMemo(() => micrositeId && slug ? { micrositeId, slug } : null, [micrositeId, slug]);
  const { trackCTA } = useMicrositeTracking(trackingCtx);

  // A/B testing — assign variant and patch skinConfig transparently
  const { applyVariant, logCTAClick } = useABTest(skin || null, micrositeId);
  const effectiveSkinConfig = useMemo(
    () => (skinConfig ? applyVariant(skinConfig) : null),
    [skinConfig, applyVariant]
  );

  const isVideoUrl = (url: string) => /youtube\.com|youtu\.be|vimeo\.com|loom\.com|wistia\.com/i.test(url);
  const isAnchorUrl = (url: string) => url.startsWith("#");

  const resolveButtonAction = (buttonUrl?: string, ctaLabel?: string) => {
    if (ctaLabel) trackCTA(ctaLabel);
    logCTAClick();
    const mode = (data as any)?.ctaOpenMode || "iframe";
    const url = buttonUrl || (data as any)?.ctaUrlOverride || effectiveSkinConfig?.ctaUrl || CHILIPIPER_URL;
    if (isVideoUrl(url)) {
      setVideoModalUrl(url);
    } else if (isAnchorUrl(url)) {
      document.getElementById(url.slice(1))?.scrollIntoView({ behavior: "smooth" });
    } else if (mode === "redirect") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      setDemoUrl(url);
      setDemoOpen(true);
    }
  };
  const handleCTA = () => { trackCTA("CTA Click"); resolveButtonAction(); };

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: row, error: err } = await supabase
        .from("microsites" as any)
        .select("id, briefing_data, skin")
        .eq("slug", slug)
        .single();
      if (err || !row) {
        setError("This page doesn't exist or the link has expired.");
      } else {
        const s = (row as any).skin || "executive";
        setData((row as any).briefing_data as BriefingData);
        setMicrositeId((row as any).id);
        setSkin(s);
        const cfg = await loadSkinConfig(s as SkinId);
        setSkinConfig(cfg);

        // Track view (deduplicate per session)
        const viewKey = `viewed_${slug}`;
        if (!sessionStorage.getItem(viewKey)) {
          sessionStorage.setItem(viewKey, "1");
          // Look up hotlink token if present
          const hlToken = new URLSearchParams(window.location.search).get("hl");
          let hotlinkId: string | null = null;
          if (hlToken) {
            const { data: hlRow } = await supabase.from("microsite_hotlinks" as any).select("id, recipient_name").eq("token", hlToken).single();
            if (hlRow) {
              hotlinkId = (hlRow as any).id;
              sessionStorage.setItem("hl_recipient", (hlRow as any).recipient_name || "");
            }
          }
          supabase.from("microsite_views" as any).insert({
            microsite_id: (row as any).id,
            slug,
            referrer: document.referrer || null,
            user_agent: navigator.userAgent || null,
            ...(hotlinkId ? { hotlink_id: hotlinkId } : {}),
          }).then(() => {});
        }
      }
      setLoading(false);
    })();
  }, [slug]);

  /* Scroll spy */
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["platform", "solutions", "results", "calculator"];
      for (const id of sections.reverse()) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveNav(id);
          return;
        }
      }
      setActiveNav("");
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="w-full max-w-2xl px-6 space-y-6">
          <Skeleton className="h-10 w-3/4 bg-white/10" />
          <Skeleton className="h-4 w-full bg-white/10" />
          <Skeleton className="h-4 w-5/6 bg-white/10" />
          <Skeleton className="h-48 w-full bg-white/10" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
          <p className="text-white/50">{error}</p>
        </div>
      </div>
    );
  }

  /* ── Solutions skin ── */
  if (skin === "solutions") {
    return (
      <>
        <MicrositeSolutionsSkin data={data} onOpenDemo={resolveButtonAction} skinConfig={effectiveSkinConfig} onTrackCTA={trackCTA} />
        <DemoModal open={demoOpen} onOpenChange={setDemoOpen} ctaUrl={demoUrl || (data as any).ctaUrlOverride || effectiveSkinConfig?.ctaUrl} />
      </>
    );
  }

  /* ── Dandy skin ── */
  if (skin === "dandy") {
    return (
      <>
        <MicrositeDandySkin data={data} onOpenDemo={resolveButtonAction} skinConfig={effectiveSkinConfig} onTrackCTA={trackCTA} />
        <DemoModal open={demoOpen} onOpenChange={setDemoOpen} ctaUrl={demoUrl || (data as any).ctaUrlOverride || effectiveSkinConfig?.ctaUrl} />
      </>
    );
  }

  /* ── Expansion skin ── */
  if (skin === "expansion") {
    return <MicrositeExpansionSkin data={data} skinConfig={effectiveSkinConfig as ExpansionSkinConfig | null} trackingCtx={trackingCtx} />;
  }

  /* ── Heartland (Tier 1) skin ── */
  if (skin === "heartland") {
    return (
      <>
        <MicrositeHeartlandSkin data={data} skinConfig={effectiveSkinConfig} onOpenDemo={resolveButtonAction} onTrackCTA={trackCTA} />
        <DemoModal open={demoOpen} onOpenChange={setDemoOpen} ctaUrl={demoUrl || (data as any).ctaUrlOverride || effectiveSkinConfig?.ctaUrl} />
      </>
    );
  }

  /* ── Flagship skin (light & dark) ── */
  if (skin === "flagship" || skin === "flagship-dark") {
    return (
      <>
        <MicrositeFlagshipSkin data={data} skinConfig={effectiveSkinConfig} onOpenDemo={resolveButtonAction} onTrackCTA={trackCTA} variant={skin === "flagship-dark" ? "dark" : "light"} />
        <DemoModal open={demoOpen} onOpenChange={setDemoOpen} ctaUrl={demoUrl || (data as any).ctaUrlOverride || effectiveSkinConfig?.ctaUrl} />
      </>
    );
  }

  const fit = data.dandyFitAnalysis;
  const micro = data.micrositeRecommendations;
  const size = data.sizeAndLocations;
  const practiceCount = size?.practiceCount || "100+";
  const statesCount = size?.states?.length || "";

  // Skin config overrides
  const cfg = effectiveSkinConfig;
  const defaultVisibleSections = ["hero", "hiddenCost", "comparison", "dashboard", "aiScanReview", "successStories", "pilotApproach", "labTour", "calculator", "finalCTA"];
  const configuredVisibleSections = cfg?.sections?.filter(s => s.visible).map(s => s.id) || [];
  const visibleSections = new Set(configuredVisibleSections.length > 0 ? configuredVisibleSections : defaultVisibleSections);
  const sectionHeadline = (id: string, fallback: string) => {
    const sec = cfg?.sections?.find(s => s.id === id);
    const override = (data as any).sectionHeadlineOverrides?.[id];
    return (override || sec?.headline || fallback).replace(/\{company\}/g, data.companyName);
  };
  const sectionSubheadline = (id: string, fallback: string) => {
    const override = (data as any).sectionSubheadlines?.[id];
    return (override || fallback).replace(/\{company\}/g, data.companyName);
  };
  const accentColor = cfg?.colors?.accent || "#2ecc71";
  const primaryColor = cfg?.colors?.primary || "#0a0f0d";
  const heroCTAText = cfg?.heroCTAText || "Get Started";
  const secondaryCTAText = cfg?.secondaryCTAText || "Calculate ROI";
  const secondaryCTAVideoUrl = cfg?.secondaryCTAVideoUrl || "";
  const heroCTAVideoUrl = cfg?.heroCTAVideoUrl || "";
  const navCTAVideoUrl = cfg?.navCTAVideoUrl || "";
  const finalCTAVideoUrl = cfg?.finalCTAVideoUrl || "";
  const navCTAText = cfg?.navCTAText || "Get Started";
  const heroPattern = (cfg?.heroHeadlinePattern || "Built for {company}.").replace(/\{company\}/g, data.companyName);
  const parsedPracticeCount = parseInt(String(practiceCount).replace(/\D/g, ""), 10) || null;
  const rawCaseStudies = (data as any).caseStudyOverrides || cfg?.caseStudies || CASE_STUDIES;
  const displayComparison = cfg?.comparisonRows || COMPARISON_ROWS;
  const displayCaseStudies = (filterByPracticeCount(rawCaseStudies, parsedPracticeCount, 3) as (typeof CASE_STUDIES[number] & { url?: string })[]).slice(0, 3);
  const footerText = cfg?.footerText || "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing";
  const fontFamily = (data as any).fontOverride
    ? `'${(data as any).fontOverride}', sans-serif`
    : cfg?.typography?.headingFont || "'Arimo', sans-serif";
  const bodyFontFamily = (data as any).bodyFontOverride
    ? `'${(data as any).bodyFontOverride}', sans-serif`
    : "'Inter', sans-serif";
  const headlineWeight = cfg?.typography?.headlineBold ? "font-bold" : "font-normal";
  const headlineSizeCls = getHeadlineSizeClasses(cfg?.typography?.headlineSize);
  const heroImage = cfg?.sectionImages?.heroImage || heroBoardroom;
  const aiImage = cfg?.sectionImages?.aiScanReviewImage || aiScanReview;
  const labImage = cfg?.sectionImages?.labTourImage || dandyLabMachines;
  const labVideoUrl = cfg?.sectionImages?.labTourVideoUrl || "";
  const finalCTAImage = cfg?.sectionImages?.finalCTAImage || heroBoardroomPremium;
  const caseStudyImgs = cfg?.sectionImages?.caseStudyImages || [];
  const customButtons: { id: string; sectionId: string; label: string; url: string; style: "primary" | "outline" | "ghost" }[] = (data as any).customButtons || [];

  const renderCustomButtons = (sectionId: string) => {
    const sectionBtns = customButtons.filter(b => b.sectionId === sectionId);
    if (!sectionBtns.length) return null;
    return (
      <div className="flex items-center justify-center gap-3 flex-wrap mt-4">
        {sectionBtns.map(btn => {
          const baseClasses = "inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors text-sm";
          const styleClasses = btn.style === "primary"
            ? "hover:opacity-90"
            : btn.style === "outline"
            ? "border border-white/20 text-white/80 hover:bg-white/5"
            : "text-white/60 hover:text-white hover:bg-white/5";
          const primaryStyle = btn.style === "primary" ? { backgroundColor: accentColor, color: primaryColor } : {};
          return (
            <button
              key={btn.id}
              onClick={() => resolveButtonAction(btn.url || undefined)}
              style={primaryStyle}
              className={`${baseClasses} ${styleClasses}`}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    );
  };

  const heroStats = [
    { value: "96%", label: "First-time fit rate" },
    { value: "60%", label: "Fewer remakes" },
    { value: "2,000+", label: "Offices served" },
    { value: "<2 min", label: "AI scan review" },
  ];

  const navLinks = [
    { id: "platform", label: "Platform" },
    { id: "solutions", label: "Solutions" },
    { id: "results", label: "Results" },
    { id: "calculator", label: "See ROI" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: primaryColor, color: cfg?.colors?.textPrimary || "#ffffff", fontFamily: bodyFontFamily }}>
      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/[0.04]" style={{ backgroundColor: `${primaryColor}cc` }}>
        <div className="max-w-7xl mx-auto px-8 h-[72px] flex items-center justify-between">
          <img src={dandyLogoWhite} alt="Dandy" className="h-5 opacity-90" />
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <a key={link.id} href={`#${link.id}`} className={`text-[13px] font-medium tracking-wide transition-all duration-300 ${activeNav === link.id ? "text-white" : "text-white/40 hover:text-white/70"}`}>
                {link.label}
              </a>
            ))}
          </div>
          <button onClick={() => navCTAVideoUrl ? setVideoModalUrl(navCTAVideoUrl) : resolveButtonAction(cfg?.navCTAUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="px-6 py-2.5 rounded-lg text-[13px] font-semibold hover:opacity-90 transition-all duration-300 hover:shadow-lg hover:shadow-[rgba(46,204,113,0.15)]">
            {navCTAVideoUrl && <Play className="w-3.5 h-3.5 inline mr-1" />}{navCTAText}
          </button>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      {visibleSections.has("hero") && (
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-[72px]">
        <div className="absolute inset-0">
          <img src={heroImage} alt="" className="w-full h-full object-cover scale-105" />
          <div className="absolute inset-0" style={{ backgroundColor: `${primaryColor}c4` }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${primaryColor}40 0%, transparent 40%, transparent 60%, ${primaryColor} 100%)` }} />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-normal leading-[0.92] tracking-[-0.03em] mb-8" style={{ fontFamily }}>
              {heroPattern.includes(data.companyName) ? (
                <>{heroPattern.split(data.companyName)[0]}<span style={{ color: accentColor }}>{data.companyName}</span>{heroPattern.split(data.companyName)[1]}</>
              ) : heroPattern}
            </h1>
            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-12 font-light">
              {sectionSubheadline("hero", fit.primaryValueProp)}
            </p>
            <div className="flex items-center justify-center gap-5 flex-wrap">
              {heroCTAVideoUrl ? (
                <button onClick={() => setVideoModalUrl(heroCTAVideoUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl font-semibold hover:opacity-90 transition-all duration-300 hover:shadow-lg text-[15px]">
                  <Play className="w-4 h-4" /> {heroCTAText}
                </button>
              ) : (
                <button onClick={() => resolveButtonAction(cfg?.heroCTAUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl font-semibold hover:opacity-90 transition-all duration-300 hover:shadow-lg text-[15px]">
                  {heroCTAText} <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {secondaryCTAVideoUrl ? (
                <button onClick={() => setVideoModalUrl(secondaryCTAVideoUrl)} className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl border border-white/15 text-white/70 font-semibold hover:bg-white/[0.06] hover:border-white/25 transition-all duration-300 text-[15px]">
                  <Play className="w-4 h-4" /> {secondaryCTAText}
                </button>
              ) : cfg?.secondaryCTAUrl ? (
                <button onClick={() => resolveButtonAction(cfg.secondaryCTAUrl)} className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl border border-white/15 text-white/70 font-semibold hover:bg-white/[0.06] hover:border-white/25 transition-all duration-300 text-[15px]">
                  {secondaryCTAText}
                </button>
              ) : (
                <a href="#calculator" className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl border border-white/15 text-white/70 font-semibold hover:bg-white/[0.06] hover:border-white/25 transition-all duration-300 text-[15px]">
                  {secondaryCTAText}
                </a>
              )}
            </div>
            {renderCustomButtons("hero")}
          </motion.div>
        </div>

        {/* Stats bar at bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/[0.04] backdrop-blur-sm" style={{ backgroundColor: `${primaryColor}80` }}>
          <div className="max-w-5xl mx-auto px-8 py-8">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {heroStats.map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 + i * 0.1 }} className="text-center">
                  <p className="text-2xl md:text-3xl font-semibold text-white tracking-tight">{stat.value}</p>
                  <p className="text-[11px] text-white/35 mt-1.5 uppercase tracking-[0.15em] font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
      )}

      {/* ═══════ HIDDEN COST ═══════ */}
      {visibleSections.has("hiddenCost") && (() => {
        // Build a vague, public-safe scale descriptor
        const count = parseInt(practiceCount) || 0;
        const stateCount = size?.states?.length || 0;
        const scaleWord = count >= 200 ? "hundreds of practices" : count >= 50 ? "dozens of practices" : "a growing network of practices";
        const regionPhrase = stateCount >= 20 ? "nationwide" : stateCount >= 10 ? "across multiple states" : stateCount >= 2 ? `across ${stateCount} states` : size?.headquarters ? `in ${size.headquarters}` : "";
        const scaleDesc = regionPhrase ? `${scaleWord} ${regionPhrase}` : scaleWord;

        return (
      <section className="py-28 md:py-36 lg:py-44 relative overflow-hidden border-t border-white/[0.04]" id="platform" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto px-8 relative z-10">
          <FadeSection className="text-center max-w-3xl mx-auto mb-20">
            <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight tracking-[-0.02em]`} style={{ fontFamily }}>
              {sectionHeadline("hiddenCost", `At ${data.companyName}'s scale — even small inefficiencies compound fast.`)}
            </h2>
          </FadeSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {HIDDEN_COST_CARDS.map((card, i) => (
              <FadeSection key={i} delay={0.1 * i}>
                <div className="group p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-500 h-full">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] group-hover:bg-white/[0.08] flex items-center justify-center mb-6 transition-colors duration-500">
                    <card.icon className="w-5 h-5 transition-transform duration-500 group-hover:scale-110" style={{ color: accentColor }} />
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-2.5 tracking-[-0.01em]">{card.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{card.desc}</p>
                </div>
              </FadeSection>
            ))}
          </div>
          {renderCustomButtons("hiddenCost")}
        </div>
      </section>
        );
      })()}

      {/* ═══════ COMPARISON TABLE ═══════ */}
      {visibleSections.has("comparison") && (
      <section className="py-28 md:py-36 lg:py-44 border-t border-white/[0.04]" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto px-8">
          <FadeSection className="text-center max-w-3xl mx-auto">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: accentColor }}>The Dandy Difference</span>
            <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mt-5 mb-20 tracking-[-0.02em]`} style={{ fontFamily }}>
              {sectionHeadline("comparison", "Your lab should be a competitive advantage.")}
            </h2>
          </FadeSection>
          <FadeSection delay={0.15}>
            <div className="rounded-2xl overflow-hidden border border-white/[0.06]" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
              <div className="grid grid-cols-3 border-b border-white/[0.06]">
                <div className="px-7 py-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/35">What DSOs Need</div>
                <div className="px-7 py-5 text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: accentColor }}>Dandy</div>
                <div className="px-7 py-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/35">Traditional Labs</div>
              </div>
              {displayComparison.map((row, i) => (
                <div key={i} className="grid grid-cols-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.015] transition-colors duration-300">
                  <div className="px-7 py-6 text-sm font-semibold text-white/90">{row.need}</div>
                  <div className="px-7 py-6 text-sm text-white/60 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accentColor }} />
                    <span>{row.dandy}</span>
                  </div>
                  <div className="px-7 py-6 text-sm text-white/25 flex items-start gap-2.5">
                    <Minus className="w-4 h-4 shrink-0 mt-0.5 text-white/15" />
                    <span>{row.traditional}</span>
                  </div>
                </div>
              ))}
            </div>
          </FadeSection>
          {renderCustomButtons("comparison")}
        </div>
      </section>
      )}
      

      {/* ═══════ DASHBOARD ═══════ */}
      {visibleSections.has("dashboard") && (
      <section className="py-28 md:py-36 lg:py-44 border-t border-white/[0.04]" style={{ backgroundColor: primaryColor }} id="solutions">
        <div className="max-w-6xl mx-auto px-8">
          <FadeSection className="text-center max-w-3xl mx-auto">
            <span className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.2em]">Executive Visibility</span>
            <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mt-5 mb-5 tracking-[-0.02em]`} style={{ fontFamily }}>
              {sectionHeadline("dashboard", "Visibility isn't reporting. It's control.")}
            </h2>
            <p className="text-white/40 text-lg mb-14 font-light leading-relaxed">
              {sectionSubheadline("dashboard", `Here's what ${data.companyName}'s dashboard could look like — real-time visibility across ${practiceCount} offices, empowering leadership to manage by exception.`)}
            </p>
          </FadeSection>
          <FadeSection delay={0.15}>
            <MicrositeInteractiveDashboard variant="dark" practiceCount={practiceCount} />
          </FadeSection>
          {renderCustomButtons("dashboard")}
        </div>
      </section>
      )}

      {/* ═══════ AI SCAN REVIEW ═══════ */}
      {visibleSections.has("aiScanReview") && (
      <section className="py-28 md:py-36 lg:py-44 border-t border-white/[0.04]" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto px-8">
          <FadeSection className="text-center max-w-3xl mx-auto">
            <span className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.2em]">Waste Prevention</span>
            <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mt-5 mb-5 tracking-[-0.02em]`} style={{ fontFamily }}>
              {sectionHeadline("aiScanReview", "Remakes are a tax. AI eliminates them.")}
            </h2>
            <p className="text-white/40 text-lg mb-14 font-light leading-relaxed">{sectionSubheadline("aiScanReview", "AI Scan Review catches issues in real time — avoiding costly rework and maximizing revenue potential before a case ever reaches the bench.")}</p>
          </FadeSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <FadeSection delay={0.1}>
              <div className="space-y-5">
                {["AI reviews every scan for clinical accuracy", "Real-time feedback before case submission", "Eliminates remakes at the source"].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
                    <p className="text-white/70">{item}</p>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-5 mt-12">
                  {[{ value: "96%", label: "First-Time Right" }, { value: "<30s", label: "Scan Review" }, { value: "100%", label: "AI-Screened" }].map((stat, i) => (
                    <div key={i} className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-2xl font-bold" style={{ color: accentColor }}>{stat.value}</p>
                      <p className="text-xs text-white/40 mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeSection>
            <FadeSection delay={0.2}>
              <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
                <img src={aiImage} alt="AI-powered dental scan quality review" className="w-full h-auto" />
              </div>
            </FadeSection>
          </div>
          {renderCustomButtons("aiScanReview")}
        </div>
      </section>
      )}

      {/* ═══════ SUCCESS STORIES ═══════ */}
      {visibleSections.has("successStories") && (
      <section className="py-28 md:py-36 lg:py-44 border-t border-white/[0.04]" style={{ backgroundColor: primaryColor }} id="results">
        <div className="max-w-6xl mx-auto px-8">
          <FadeSection className="text-center max-w-3xl mx-auto">
            <span className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.2em]">Proven Results</span>
            <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mt-5 mb-20 tracking-[-0.02em]`} style={{ fontFamily }}>
              {sectionHeadline("successStories", "DSOs that switched and never looked back.")}
            </h2>
          </FadeSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {displayCaseStudies.map((study, i) => {
              const defaultImg = [dentalCrowns, dandyDoctor, scannerSpeed][i % 3];
              const img = caseStudyImgs[i] || defaultImg;
              return (
                <FadeSection key={i} delay={0.12 * i}>
                  <div className="group rounded-2xl border border-white/[0.05] overflow-hidden bg-white/[0.015] h-full flex flex-col hover:border-white/[0.1] transition-all duration-500">
                    <div className="relative h-52 overflow-hidden">
                      <img src={img} alt={`${study.name} case study`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${primaryColor}, ${primaryColor}40 60%, transparent)` }} />
                      <div className="absolute bottom-4 left-5">
                        <p className="text-[11px] font-semibold text-white/50 uppercase tracking-[0.15em]">{study.name}</p>
                      </div>
                    </div>
                    <div className="p-7 flex-1 flex flex-col">
                      <div className="mb-5">
                        <p className="text-4xl font-bold tracking-tight" style={{ color: accentColor }}>{study.stat}</p>
                        <p className="text-sm text-white/35 mt-1.5">{study.label}</p>
                      </div>
                      <blockquote className="text-sm text-white/45 italic leading-relaxed flex-1">"{study.quote}"</blockquote>
                      <p className="text-xs text-white/25 mt-5">— {study.author}</p>
                      {study.url && (
                        <a href={study.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold mt-3 hover:opacity-80 transition-opacity" style={{ color: accentColor }}>
                          Read Case Study <ArrowRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </FadeSection>
              );
            })}
          </div>
          {renderCustomButtons("successStories")}
        </div>
      </section>
      )}

      {/* ═══════ PILOT APPROACH ═══════ */}
      {visibleSections.has("pilotApproach") && (
      <>
      <section className="py-28 md:py-36 lg:py-44 border-t border-white/[0.04]" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto px-8">
          <FadeSection className="text-center max-w-3xl mx-auto">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: accentColor }}>How It Works</span>
            <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mt-5 mb-5 text-white tracking-[-0.02em]`} style={{ fontFamily }}>
              {sectionHeadline("pilotApproach", "Start small. Prove it out. Then scale.")}
            </h2>
            <p className="text-white/40 text-lg mb-20 font-light leading-relaxed">
              {sectionSubheadline("pilotApproach", `Validate impact with a focused pilot — then scale with confidence across the ${data.companyName} portfolio.`)}
            </p>
          </FadeSection>
          <AnimatedTimeline
            accentColor={accentColor}
            bgColor={primaryColor}
            theme="dark"
            steps={[
              { step: "01", title: "Launch a Pilot", subtitle: "Start with 5–10 offices", desc: "Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows — no CAPEX, no disruption.", bullets: ["Premium hardware included for every operatory", "Dedicated field team manages change management", "Doctors trained and scanning within days"] },
              { step: "02", title: "Validate Impact", subtitle: "Measure results in 60–90 days", desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time — proving ROI before you scale.", bullets: ["Live dashboard tracks pilot KPIs", "Compare pilot offices vs. control group", "Executive-ready reporting for leadership review"] },
              { step: "03", title: "Scale With Confidence", subtitle: "Roll out across the network", desc: `Expand across ${practiceCount} offices with the same standard, same playbook, and same results — predictable execution at enterprise scale.`, bullets: ["Consistent onboarding across all locations", "One standard across every office and brand", "MSA ensures network-wide alignment at scale"] },
            ]}
          />
        </div>
        {renderCustomButtons("pilotApproach")}
      </section>
      
      </>
      )}

      {/* ═══════ LAB TOUR ═══════ */}
      {visibleSections.has("labTour") && (
      <>
      <section className="py-28 md:py-36 lg:py-44 relative overflow-hidden border-t border-white/[0.04]" style={{ backgroundColor: primaryColor }}>
        <div className="relative z-10 max-w-6xl mx-auto px-8">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Image side — always shows image with play button */}
            <FadeSection>
              <div className="relative rounded-2xl overflow-hidden group cursor-pointer" onClick={() => setLabVideoOpen(true)}>
                <div className="aspect-[4/5] overflow-hidden">
                  <img src={labImage} alt="Dandy lab manufacturing floor" className="w-full h-full object-cover object-[center_25%] transition-transform duration-1000 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/20 group-hover:from-black/60 group-hover:via-black/20 transition-all duration-500" />
                </div>
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:bg-white/25 group-hover:scale-110 transition-all duration-500 shadow-2xl">
                    <Play className="w-8 h-8 text-white ml-1" fill="white" fillOpacity={0.9} />
                  </div>
                </div>
                <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70 bg-black/30 backdrop-blur-sm px-4 py-1.5 rounded-full inline-block">Inside Dandy's U.S. Facility</p>
                  <p className="text-[10px] font-medium text-white/50 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">Watch Tour</p>
                </div>
              </div>
            </FadeSection>

            {/* Content side */}
            <div>
              <FadeSection>
                <span className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.2em]">Built in the USA</span>
                <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight text-white mt-5 mb-6 tracking-[-0.02em]`} style={{ fontFamily }}>
                  {sectionHeadline("labTour", "See vertical integration in action.")}
                </h2>
                <p className="text-white/40 text-lg mb-10 font-light leading-relaxed">
                  {sectionSubheadline("labTour", "U.S.-based manufacturing, AI quality control, and expert technicians — delivering a 96% first-time right rate at enterprise scale.")}
                </p>
              </FadeSection>

              <FadeSection delay={0.15}>
                <div className="grid grid-cols-2 gap-4 mb-10">
                  {[
                    { icon: FlaskConical, label: "Advanced Materials Lab", desc: "Cutting-edge ceramics & zirconia" },
                    { icon: Eye, label: "AI Quality Control", desc: "Every case inspected by AI" },
                    { icon: Users, label: "U.S.-Based Technicians", desc: "Expert craftspeople on every order" },
                    { icon: MapPin, label: "Multiple Locations", desc: "Redundancy & fast turnaround" },
                  ].map((item, i) => (
                    <div key={i} className="group p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-400">
                      <item.icon className="w-5 h-5 mb-2.5 transition-transform duration-400 group-hover:scale-110" style={{ color: accentColor }} />
                      <p className="text-sm text-white/80 font-medium leading-snug">{item.label}</p>
                      <p className="text-xs text-white/35 mt-1 leading-snug">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <button onClick={handleCTA} className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl border border-white/15 text-white/80 font-semibold hover:bg-white/[0.06] hover:border-white/25 transition-all duration-300 text-sm">
                  Request a Lab Tour
                </button>
                {renderCustomButtons("labTour")}
              </FadeSection>
            </div>
          </div>
        </div>
      </section>

      {/* Lab Tour Video Modal */}
      <AnimatePresence>
        {labVideoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setLabVideoOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setLabVideoOpen(false)} className="absolute -top-10 right-0 z-10 text-white hover:text-white/80 transition-colors" aria-label="Close video">
                <X className="w-6 h-6" />
              </button>
              <iframe
                src={`${(labVideoUrl || "https://www.youtube.com/watch?v=SjXFjvWW9o0").replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/").replace("vimeo.com/", "player.vimeo.com/video/")}${(labVideoUrl || "").includes("embed") ? "?" : "&"}autoplay=1&rel=0`}
                title="Inside Dandy's 100% Digital Dental Lab"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}

      {/* ═══════ ROI CALCULATOR ═══════ */}
      {visibleSections.has("calculator") && (
      <section className="py-28 md:py-36 lg:py-44 border-t border-white/[0.04]" style={{ backgroundColor: primaryColor }} id="calculator">
        <div className="max-w-6xl mx-auto px-8">
          <FadeSection className="text-center max-w-3xl mx-auto">
            <span className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.2em]">See the Numbers</span>
            <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mt-5 mb-5 tracking-[-0.02em]`} style={{ fontFamily }}>
              {sectionHeadline("calculator", "Calculate the cost of inaction.")}
            </h2>
            <p className="text-white/40 text-lg mb-14 font-light leading-relaxed">
              {sectionSubheadline("calculator", `Enter ${data.companyName}'s network size and see exactly how much remakes and inefficiencies are draining — and what Dandy recovers.`)}
            </p>
          </FadeSection>
          <FadeSection delay={0.1}>
            <MicrositeCalculator companyName={data.companyName} defaultPractices={parseInt(String(practiceCount), 10) || 100} onCTA={handleCTA} />
          </FadeSection>
          {renderCustomButtons("calculator")}
        </div>
      </section>
      )}

      {/* ═══════ FINAL CTA ═══════ */}
      {visibleSections.has("finalCTA") && (
      <section className="py-32 md:py-40 lg:py-48 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={finalCTAImage} alt="" className="w-full h-full object-cover scale-105" />
          <div className="absolute inset-0" style={{ backgroundColor: `${primaryColor}f0` }} />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-8 text-center">
          <FadeSection>
            <span className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.2em]">Next Steps</span>
            <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mt-5 mb-8 tracking-[-0.02em]`} style={{ fontFamily }}>
              {(cfg?.finalCTAHeadline || "Start with a few locations. Then scale with confidence.").replace(/\{company\}/g, data.companyName)}
            </h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto mb-10">
              {(cfg?.finalCTASubheadline || `We'll pilot at 5–10 offices, validate the impact on remakes, chair time, and revenue — then roll out with confidence across the ${data.companyName} portfolio.`).replace(/\{company\}/g, data.companyName)}
            </p>
            {finalCTAVideoUrl ? (
              <button onClick={() => setVideoModalUrl(finalCTAVideoUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold hover:opacity-90 transition-colors text-base">
                <Play className="w-4 h-4" /> {heroCTAText}
              </button>
            ) : (
              <button onClick={() => resolveButtonAction(cfg?.finalCTAUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold hover:opacity-90 transition-colors text-base">
                {heroCTAText} <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center justify-center gap-8 mt-12 flex-wrap">
              {[
                { icon: Factory, label: "Lab Tour", desc: "See our facilities firsthand" },
                { icon: BarChart3, label: "Executive Briefing", desc: "Custom EBITDA impact analysis" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-white/[0.06]">
                    <item.icon className="w-4 h-4" style={{ color: accentColor }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-white/40">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeSection>
          {renderCustomButtons("finalCTA")}
        </div>
      </section>
      )}

      {/* ═══════ CUSTOM SECTIONS ═══════ */}
      {(cfg?.customSections || []).map((sec, i) => (
        <CustomSectionBlock key={sec.id} sec={sec} index={i} primaryColor={primaryColor} accentColor={accentColor} headlineWeight={headlineWeight} headlineSizeCls={headlineSizeCls} fontFamily={fontFamily} theme="dark" />
      ))}

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/[0.04] py-10" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between">
          <img src={dandyLogoWhite} alt="Dandy" className="h-4 opacity-30" />
          <p className="text-[11px] text-white/15 tracking-wide">{footerText}</p>
        </div>
      </footer>

      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} ctaUrl={demoUrl || (data as any).ctaUrlOverride || effectiveSkinConfig?.ctaUrl} />

      {/* Video Modal */}
      <AnimatePresence>
        {videoModalUrl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setVideoModalUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl aspect-video mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setVideoModalUrl(null)} className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
              <iframe
                src={videoModalUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/").replace("vimeo.com/", "player.vimeo.com/video/")}
                className="w-full h-full rounded-xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Video"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Microsite;
