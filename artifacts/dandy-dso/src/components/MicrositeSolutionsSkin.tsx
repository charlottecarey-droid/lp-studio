import { useRef, useState } from "react";
import AnimatedTimeline from "@/components/AnimatedTimeline";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, ArrowRight, Building2, TrendingUp, Zap, Shield,
  BarChart3, Clock, MapPin, Users, ChevronRight, Eye, Activity,
  Target, Layers, Wrench, FlaskConical, Factory, Award, Phone, Play, X
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
import ctaOperations from "@/assets/cta-operations.jpg";
import dandyInsightsDashboard from "@/assets/dandy-insights-dashboard.png";
import financialChartBg from "@/assets/financial-chart-bg.png";
import MicrositeInteractiveDashboard from "@/components/MicrositeInteractiveDashboard";

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
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ── Pain cards ── */
const CHALLENGES = [
  { icon: Building2, title: "Same-Store Growth Pressure", desc: "Acquisition pipelines have slowed. With rising costs and tighter financing, DSOs must unlock more revenue from existing practices to protect EBITDA — and the dental lab is one of the most overlooked levers." },
  { icon: Layers, title: "Fragmented Lab Relationships", desc: "If every dentist chooses their own lab, you never get a volume advantage. Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage." },
  { icon: Target, title: "Standards That Don't Survive Growth", desc: "Most DSOs don't fail because they grow too fast — they fail because their standards don't scale. Variability creeps in, outcomes drift, and operational discipline erodes with every new location." },
  { icon: TrendingUp, title: "Capital Constraints", desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast. DSOs need a partner that eliminates CAPEX, includes premium hardware, and proves ROI within months." },
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

/* ── ROI Calculator (light skin version) ── */
const SolutionsCalculator = ({ companyName, defaultPractices, onCTA }: { companyName: string; defaultPractices: number; onCTA: () => void }) => {
  const [practices, setPractices] = useState(Math.min(defaultPractices, 2000));
  const [avgCaseValue, setAvgCaseValue] = useState(250);
  const [remakeRate, setRemakeRate] = useState(8);
  const [improvedRate, setImprovedRate] = useState(3.2);
  const [casesPerMonth, setCasesPerMonth] = useState(100);
  const [chairTimePerCase, setChairTimePerCase] = useState(0.5);
  const [labHardCostPerCase, setLabHardCostPerCase] = useState(50);
  const [prodPerHour, setProdPerHour] = useState(500);
  const [dentBenchmark, setDentBenchmark] = useState<"low" | "medium" | "high">("medium");
  const [dentureCasesMonth, setDentureCasesMonth] = useState(Math.round(defaultPractices * 1.5));
  const [dentProdPerHour, setDentProdPerHour] = useState(500);

  const dentAppointmentsSaved = { low: 1, medium: 1.5, high: 2 }[dentBenchmark];

  // Remake impact
  const monthlyRemakes = practices * casesPerMonth * (remakeRate / 100);
  const improvedRemakes = practices * casesPerMonth * (improvedRate / 100);
  const remakesAvoided = monthlyRemakes - improvedRemakes;
  const recoveredProdYear = Math.round(remakesAvoided * avgCaseValue * 12);
  const labCostsAvoidedYear = Math.round(remakesAvoided * labHardCostPerCase * 12);
  const opportunityProdYear = Math.round(remakesAvoided * chairTimePerCase * prodPerHour * 12);

  // Denture impact
  const dentApptsFreedMonth = Math.round(dentureCasesMonth * dentAppointsSaved);
  const dentChairHoursMonth = Math.round(dentApptsFreedMonth * 0.5 * 10) / 10;
  const dentIncrementalMonth = Math.round(dentChairHoursMonth * dentProdPerHour);
  const dentIncrementalYear = dentIncrementalMonth * 12;

  const totalUpside = recoveredProdYear + labCostsAvoidedYear + opportunityProdYear + dentIncrementalYear;
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="p-8 md:p-10 border-b border-gray-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-1">Prove the Impact</h3>
        <p className="text-gray-500 mb-6">Estimate the cost of remakes and lost chair time across {companyName}.</p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Number of practices:</label>
          <input
            type="range"
            min={5} max={2000} step={5} value={practices}
            onChange={(e) => { setPractices(Number(e.target.value)); setDentureCasesMonth(Math.round(Number(e.target.value) * 1.5)); }}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#c8e84e] [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#c8e84e] [&::-moz-range-thumb]:border-0"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>5</span>
            <span className="text-lg font-bold text-gray-900">{practices.toLocaleString()}</span>
            <span>2,000</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Fixed Restoration */}
        <div className="p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-gray-100">
          <h4 className="text-lg font-bold text-gray-900 mb-1">Fixed Restoration Remake Impact</h4>
          <p className="text-xs text-gray-400 mb-6">Production recovered and costs avoided by reducing remakes.</p>

          <div className="space-y-4">
            {[
              { label: "Cases per Month", value: casesPerMonth, set: setCasesPerMonth, min: 10, max: 500 },
              { label: "Average Case Value ($)", value: avgCaseValue, set: setAvgCaseValue, min: 50, max: 1000, prefix: "$" },
              { label: "Current Remake Rate (%)", value: remakeRate, set: (v: number) => setRemakeRate(v / 10), min: 10, max: 200, step: 1, displayValue: `${remakeRate}%`, rawToVal: (v: number) => v * 10 },
              { label: "Improved Remake Rate (%)", value: improvedRate, set: (v: number) => setImprovedRate(v / 10), min: 5, max: 80, step: 1, displayValue: `${improvedRate}%`, rawToVal: (v: number) => v * 10 },
            ].map((field) => (
              <div key={field.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{field.label}</span>
                  <span className="font-semibold text-gray-900">{field.displayValue || (field.prefix ? `${field.prefix}${field.value}` : field.value)}</span>
                </div>
                <input
                  type="range"
                  min={field.min} max={field.max} step={field.step || 5}
                  value={field.rawToVal ? field.rawToVal(field.value) : field.value}
                  onChange={(e) => field.set(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#1b3a2d] [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#1b3a2d] [&::-moz-range-thumb]:border-0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Denture Workflow */}
        <div className="p-8 md:p-10">
          <h4 className="text-lg font-bold text-gray-900 mb-1">Denture Workflow Impact</h4>
          <p className="text-xs text-gray-400 mb-6">Chair time freed by reducing intermediate appointments.</p>

          <div className="mb-6">
            <label className="block text-sm text-gray-600 mb-2">Benchmark Scenario:</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["low", "medium", "high"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setDentBenchmark(b)}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${dentBenchmark === b ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {b}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{dentAppointmentsSaved} appointments saved per case</p>
          </div>

          <div className="space-y-4">
            {[
              { label: "Denture Cases / Month", value: dentureCasesMonth, set: setDentureCasesMonth, min: 10, max: 5000 },
              { label: "Avg Production per Hour ($)", value: dentProdPerHour, set: setDentProdPerHour, min: 100, max: 1500, prefix: "$" },
            ].map((field) => (
              <div key={field.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{field.label}</span>
                  <span className="font-semibold text-gray-900">{field.prefix || ""}{field.value.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min={field.min} max={field.max} step={5}
                  value={field.value}
                  onChange={(e) => field.set(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#1b3a2d] [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#1b3a2d] [&::-moz-range-thumb]:border-0"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="border-t border-gray-100 bg-gray-50 p-8 md:p-10">
        <h4 className="text-lg font-bold text-gray-900 mb-6">Your Results</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Denture Workflow</p>
            <div className="space-y-2">
              {[
                { label: "Appointments Freed / Month", value: dentApptsFreedMonth.toLocaleString() },
                { label: "Chair Hours Freed / Month", value: String(dentChairHoursMonth) },
                { label: "Incremental Production / Month ($)", value: fmt(dentIncrementalMonth) },
                { label: "Incremental Production / Year ($)", value: fmt(dentIncrementalYear) },
              ].map((r) => (
                <div key={r.label} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{r.label}</span>
                  <span className="text-sm font-bold text-gray-900">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Remake Impact</p>
            <div className="space-y-2">
              {[
                { label: "Remakes Avoided / Month", value: Math.round(remakesAvoided).toLocaleString() },
                { label: "Recovered Production / Year ($)", value: fmt(recoveredProdYear) },
                { label: "Lab Costs Avoided / Year ($)", value: fmt(labCostsAvoidedYear) },
                { label: "Opportunity Production / Year ($)", value: fmt(opportunityProdYear) },
              ].map((r) => (
                <div key={r.label} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{r.label}</span>
                  <span className="text-sm font-bold text-gray-900">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 rounded-xl bg-[#1b3a2d] text-center">
          <p className="text-sm text-white/50 uppercase tracking-wider mb-1">Total Financial Upside / Year</p>
          <p className="text-4xl md:text-5xl font-bold text-[#c8e84e]">{fmt(totalUpside)}</p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onCTA}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg bg-[#c8e84e] text-[#1b3a2d] font-semibold hover:bg-[#b8d83e] transition-colors"
          >
            Get Full Analysis <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Calculations based on per-practice estimates. Actual results may vary based on case mix, clinical workflow, and lab partner quality.
        </p>
      </div>
    </div>
  );
};

const dentAppointsSaved = 1.5;

import { MicrositeSkinConfig, filterByPracticeCount, getHeadlineSizeClasses } from "@/lib/microsite-skin-config";
import CustomSectionBlock from "@/components/CustomSectionBlock";

/** Build an embed URL with autoplay + mute + optional loop */
function toAutoEmbedUrl(url: string, loop = false): string {
  const ytId = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([^&?/]+)/)?.[1];
  if (ytId) {
    const loopParams = loop ? `&loop=1&playlist=${ytId}` : "";
    return `https://www.youtube.com/embed/${ytId}?rel=0&autoplay=1&mute=1${loopParams}`;
  }
  const vimeoId = url.match(/(?:vimeo\.com\/(?:video\/)?)(\d+)/)?.[1];
  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1${loop ? "&loop=1" : ""}`;
  }
  return url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/") + (url.includes("?") ? "&" : "?") + "autoplay=1&mute=1";
}

/* ═══════ MAIN COMPONENT ═══════ */
const MicrositeSolutionsSkin = ({ data, onOpenDemo: _rawOnOpenDemo, skinConfig, onTrackCTA }: { data: BriefingData; onOpenDemo: (buttonUrl?: string, ctaLabel?: string) => void; skinConfig?: MicrositeSkinConfig | null; onTrackCTA?: (label: string) => void }) => {
  const [activeNav, setActiveNav] = useState("");
  const [labVideoOpen, setLabVideoOpen] = useState(false);
  const fit = data.dandyFitAnalysis;
  const size = data.sizeAndLocations;
  const practiceCount = size?.practiceCount || "100+";
  const statesCount = size?.states?.length || "";

  // Auto-track all CTA clicks by wrapping onOpenDemo
  const onOpenDemo = (buttonUrl?: string) => {
    onTrackCTA?.("CTA Click");
    _rawOnOpenDemo(buttonUrl);
  };

  // Use skinConfig overrides where available
  const cfg = skinConfig;
  const visibleSections = new Set(cfg?.sections?.filter(s => s.visible).map(s => s.id) || [
    "hero", "statsBar", "challenges", "comparison", "dashboard", "aiScanReview", "successStories", "pilotApproach", "labTour", "calculator", "finalCTA"
  ]);
  const sectionHeadline = (id: string, fallback: string) => {
    const sec = cfg?.sections?.find(s => s.id === id);
    return (sec?.headline || fallback).replace(/\{company\}/g, data.companyName);
  };
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const accentColor = cfg?.colors?.accent || "#c8e84e";
  const primaryColor = cfg?.colors?.primary || "#1b3a2d";
  const heroCTAText = cfg?.heroCTAText || "GET PRICING";
  const secondaryCTAText = cfg?.secondaryCTAText || "CALCULATE ROI";
  const secondaryCTAVideoUrl = cfg?.secondaryCTAVideoUrl || "";
  const heroCTAVideoUrl = cfg?.heroCTAVideoUrl || "";
  const navCTAVideoUrl = cfg?.navCTAVideoUrl || "";
  const finalCTAVideoUrl = cfg?.finalCTAVideoUrl || "";
  const navCTAText = cfg?.navCTAText || "GET PRICING";
  const heroPattern = (cfg?.heroHeadlinePattern || "The lab partner built for {company}").replace(/\{company\}/g, data.companyName);
  const parsedPracticeCount = parseInt(String(practiceCount).replace(/\D/g, ""), 10) || null;
  const displayChallenges = cfg?.challenges || CHALLENGES;
  const displayComparison = cfg?.comparisonRows || COMPARISON_ROWS;
  const rawCaseStudies = (data as any).caseStudyOverrides || cfg?.caseStudies || CASE_STUDIES;
  const displayCaseStudies = (filterByPracticeCount(rawCaseStudies, parsedPracticeCount, 3) as (typeof CASE_STUDIES[number] & { url?: string })[]).slice(0, 3);
  const rawStats = (data as any).statsBarOverrides || cfg?.statsBar || [
    { value: "30%", label: "Avg case acceptance lift" },
    { value: "96%", label: "First-time right rate" },
    { value: "50%", label: "Denture appointments saved" },
    { value: "$0", label: "CAPEX to get started" },
  ];
  const displayStats = (filterByPracticeCount(rawStats, parsedPracticeCount) as typeof rawStats).slice(0, 4);
  const footerText = cfg?.footerText || "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing";
  const resolveFontFamily = (name?: string) => {
    if (!name || name === "system-ui") return "'Bagoss Standard', system-ui, sans-serif";
    return `'${name}', sans-serif`;
  };
  const fontFamily = (data as any).fontOverride
    ? resolveFontFamily((data as any).fontOverride)
    : resolveFontFamily(cfg?.typography?.headingFont);
  const bodyFontFamily = (data as any).bodyFontOverride
    ? `'${(data as any).bodyFontOverride}', sans-serif`
    : "'Inter', sans-serif";
  const headlineWeight = cfg?.typography?.headlineBold ? "font-bold" : "font-normal";
  const headlineSizeCls = getHeadlineSizeClasses(cfg?.typography?.headlineSize);
  const heroImage = cfg?.sectionImages?.heroImage || heroBoardroom;
  const aiImage = cfg?.sectionImages?.aiScanReviewImage || aiScanReview;
  const labImage = cfg?.sectionImages?.labTourImage || dandyLabMachines;
  const labVideoUrl = cfg?.sectionImages?.labTourVideoUrl || "";
  const finalCTABgImage = cfg?.sectionImages?.finalCTAImage;
  const caseStudyImgs = cfg?.sectionImages?.caseStudyImages || [];

  // Build section order from config
  const sectionOrder = cfg?.sections?.filter(s => s.visible).map(s => s.id) || [
    "hero", "statsBar", "challenges", "comparison", "dashboard", "aiScanReview", "successStories", "pilotApproach", "labTour", "calculator", "finalCTA"
  ];

  const navLinks = [
    { id: "challenges", label: "Challenges" },
    { id: "solutions", label: "Solutions" },
    { id: "results", label: "Results" },
    { id: "calculator", label: "Calculate ROI" },
  ];

  /* ── Section renderers ── */
  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case "hero": return renderHero();
      case "statsBar": return renderStatsBar();
      case "challenges": return renderChallenges();
      case "comparison": return renderComparison();
      case "dashboard": return renderDashboard();
      case "aiScanReview": return renderAIScanReview();
      case "successStories": return renderSuccessStories();
      case "pilotApproach": return renderPilotApproach();
      case "labTour": return renderLabTour();
      case "calculator": return renderCalculator();
      case "finalCTA": return renderFinalCTA();
      default: return null;
    }
  };

  const renderHero = () => (
    <section key="hero" className="relative min-h-[85vh] flex items-center overflow-hidden pt-16">
      <div className="absolute inset-0">
        <img src={heroImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ backgroundColor: `${primaryColor}cc` }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${primaryColor}, transparent, ${primaryColor}66)` }} />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          <p style={{ color: accentColor }} className="text-xs font-bold uppercase tracking-[0.2em] mb-6">Dandy for {data.companyName}</p>
          <h1 className="text-5xl md:text-7xl font-normal leading-[0.95] tracking-tight text-white mb-6 max-w-3xl" style={{ fontFamily }}>
            {heroPattern.includes(data.companyName) ? (
              <>
                {heroPattern.split(data.companyName)[0]}
                <span style={{ color: accentColor }}>{data.companyName}</span>
                {heroPattern.split(data.companyName)[1]}
              </>
            ) : heroPattern}
          </h1>
          <p className="text-lg text-white/60 max-w-2xl leading-relaxed mb-10">{cfg?.heroSubtext || fit.primaryValueProp}</p>
          <div className="flex items-center gap-4 flex-wrap">
            {heroCTAVideoUrl ? (
              <button onClick={() => setVideoModalUrl(heroCTAVideoUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-semibold hover:opacity-90 transition-colors">
                <Play className="w-4 h-4" /> {heroCTAText}
              </button>
            ) : (
              <button onClick={() => onOpenDemo(cfg?.heroCTAUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-semibold hover:opacity-90 transition-colors">
                {heroCTAText} <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {secondaryCTAVideoUrl ? (
              <button onClick={() => setVideoModalUrl(secondaryCTAVideoUrl)} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-white/30 text-white font-semibold hover:bg-white/10 transition-colors">
                <Play className="w-4 h-4" /> {secondaryCTAText}
              </button>
            ) : cfg?.secondaryCTAUrl ? (
              <button onClick={() => onOpenDemo(cfg.secondaryCTAUrl)} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-white/30 text-white font-semibold hover:bg-white/10 transition-colors">
                {secondaryCTAText}
              </button>
            ) : (
              <a href="#calculator" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-white/30 text-white font-semibold hover:bg-white/10 transition-colors">
                {secondaryCTAText}
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );

  const renderStatsBar = () => (
    <section key="statsBar" className="bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {displayStats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-4xl md:text-5xl font-bold" style={{ color: primaryColor }}>{stat.value}</p>
              <p className="text-sm text-gray-400 mt-2">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );

  const renderChallenges = () => (
    <section key="challenges" className="py-28 md:py-36 bg-gray-50" id="challenges">
      <div className="max-w-6xl mx-auto px-6">
        <FadeSection className="text-center max-w-3xl mx-auto">
          <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight`} style={{ color: primaryColor, fontFamily }}>
            {sectionHeadline("challenges", `At ${data.companyName}'s scale — even small inefficiencies compound fast.`)}
          </h2>
        </FadeSection>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
          {displayChallenges.map((c, i) => {
            const Icon = [Building2, Layers, Target, TrendingUp][i % 4];
            return (
              <FadeSection key={i} delay={0.1 * i}>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 h-full">
                  <h3 className="text-lg font-bold mb-3" style={{ color: primaryColor }}>{c.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{c.desc}</p>
                </div>
              </FadeSection>
            );
          })}
        </div>
      </div>
    </section>
  );

  const renderComparison = () => (
    <>
    {/* The Problem */}
    <section key="comparison-problem" className="py-28 md:py-36 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <FadeSection className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: accentColor }}>The Problem</p>
          <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mb-6`} style={{ color: primaryColor, fontFamily }}>
            {sectionHeadline("comparison", "Lab consolidation shouldn't\u00A0\u00A0mean compromise.")}
          </h2>
          <p className="text-gray-500 text-lg mb-0">{"Growing DSOs face a critical tension: executives need standardization and cost control, while providers demand clinical autonomy and quality they trust."}</p>
        </FadeSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-16">
          {[
            { icon: Layers, title: "Fragmented Networks", desc: "Lab vendors vary by region, creating blind spots in quality, cost, and turnaround — with no centralized visibility across your network." },
            { icon: BarChart3, title: "Scattered Data", desc: "Disconnected systems across brands and locations make performance tracking nearly impossible. You can't improve what you can't measure." },
            { icon: Users, title: "Provider Resistance", desc: "When lab quality is inconsistent, providers lose confidence in the workflow — slowing adoption and undermining digital transformation." },
            { icon: TrendingUp, title: "Revenue Leakage", desc: "High remake rates, wasted chair time, and inefficient workflows silently drain profitability at every location — compounding across your entire network." },
          ].map((card, i) => (
            <FadeSection key={i} delay={0.08 * i}>
              <div className="bg-gray-50 p-7 rounded-2xl border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 h-full">
                <h3 className="text-base font-bold mb-2" style={{ color: primaryColor }}>{card.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
              </div>
            </FadeSection>
          ))}
        </div>
      </div>
    </section>

    {/* The Dandy Difference */}
    <section key="comparison" className="py-28 md:py-36 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <FadeSection className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: accentColor }}>The Dandy Difference</p>
          <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mb-6`} style={{ color: primaryColor, fontFamily }}>
            Built for DSO scale.{"\u00A0\u00A0"}Designed for provider trust.
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-4">
            Dandy combines the lab providers choose with advanced manufacturing, AI-driven quality control, and network-wide insights — a model traditional labs simply can't match.
          </p>
        </FadeSection>

        {/* Quote */}
        <FadeSection delay={0.1} className="max-w-3xl mx-auto mt-8 mb-14">
          <blockquote className="text-center">
            <p className="text-lg md:text-xl italic text-gray-600 leading-relaxed">"Dandy is the easiest pathway to lab consolidation without forcing doctors to switch."</p>
            <cite className="block mt-4 text-sm text-gray-400 not-italic">— Dr. Michael Fooshée, Chief Clinical Operations Officer, APEX Dental Partners</cite>
          </blockquote>
        </FadeSection>

        <FadeSection delay={0.15}>
          <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-white">
            <div className="grid grid-cols-3" style={{ backgroundColor: primaryColor }}>
              <div className="px-6 py-4 text-sm font-semibold text-white/60">What {data.companyName} Needs</div>
              <div className="px-6 py-4 text-sm font-semibold" style={{ color: accentColor }}>Dandy</div>
              <div className="px-6 py-4 text-sm font-semibold text-white/40">Traditional Labs</div>
            </div>
            {displayComparison.map((row, i) => (
              <div key={i} className="grid grid-cols-3 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                <div className="px-6 py-4 text-sm font-medium text-gray-800">{row.need}</div>
                <div className="px-6 py-4 text-sm text-gray-600">{row.dandy}</div>
                <div className="px-6 py-4 text-sm text-gray-400">{row.traditional}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <button onClick={() => onOpenDemo()} style={{ backgroundColor: accentColor, color: primaryColor }} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm">
              Request a Demo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </FadeSection>
      </div>
    </section>
    </>
  );

  const renderDashboard = () => (
    <section key="dashboard" className="py-28 md:py-36 bg-white" id="solutions">
      <div className="max-w-6xl mx-auto px-6">
        <FadeSection className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: accentColor }}>Executive Visibility</p>
          <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mb-6`} style={{ color: primaryColor, fontFamily }}>
            {sectionHeadline("dashboard", "Dashboards don't change outcomes.\u00A0\u00A0Decisions do.")}
          </h2>
          <p className="text-gray-500 text-lg mb-14">
            Dandy Insights gives {data.companyName} leaders actionable data — not just reports. Know where to intervene before problems scale, manage by exception, and maintain control as complexity increases.
          </p>
        </FadeSection>
        <FadeSection delay={0.15}>
          <MicrositeInteractiveDashboard variant="light" practiceCount={practiceCount} />
        </FadeSection>
      </div>
    </section>
  );

  const renderAIScanReview = () => (
    <section key="aiScanReview" className="py-28 md:py-36 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <FadeSection className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: accentColor }}>Waste Prevention</p>
          <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mb-6`} style={{ color: primaryColor, fontFamily }}>
            {sectionHeadline("aiScanReview", "Remakes are a tax.\u00A0\u00A0AI eliminates them.")}
          </h2>
          <p className="text-gray-500 text-lg mb-4">AI Scan Review catches issues in real time — avoiding costly rework and maximizing revenue potential before a case ever reaches the bench.</p>
          <blockquote className="mt-6 mb-0">
            <p className="text-base italic text-gray-500">"I don't even double-check the AI margins anymore — it's gained me time."</p>
            <cite className="block mt-2 text-sm text-gray-400 not-italic">— DSO Clinical Director</cite>
          </blockquote>
        </FadeSection>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <FadeSection delay={0.1}>
            <div className="space-y-4 mb-8">
              {["AI reviews every scan for clinical accuracy", "Real-time feedback before case submission", "Eliminates remakes at the source"].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
                  <p className="text-gray-600">{item}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[{ value: "96%", label: "First-Time Right" }, { value: "<30s", label: "Scan Review" }, { value: "100%", label: "AI-Screened" }].map((stat, i) => (
                <div key={i} className="text-center p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-2xl font-bold" style={{ color: primaryColor }}>{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </FadeSection>
          <FadeSection delay={0.2}>
            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-lg">
              <img src={aiImage} alt="AI-powered dental scan quality review" className="w-full h-auto" />
            </div>
          </FadeSection>
        </div>
      </div>
    </section>
  );

  const renderSuccessStories = () => (
    <section key="successStories" className="py-28 md:py-36 bg-white" id="results">
      <div className="max-w-6xl mx-auto px-6">
        <FadeSection className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: accentColor }}>Proven Results</p>
          <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mb-16`} style={{ color: primaryColor, fontFamily }}>
            {sectionHeadline("successStories", "DSOs that switched\u00A0\u00A0and never looked back.")}
          </h2>
        </FadeSection>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayCaseStudies.map((study, i) => {
            const defaultImg = [dentalCrowns, dandyDoctor, scannerSpeed][i % 3];
            const img = caseStudyImgs[i] || defaultImg;
            return (
              <FadeSection key={i} delay={0.1 * i}>
                <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                  <div className="relative h-48 overflow-hidden">
                    <img src={img} alt={`${study.name} case study`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${primaryColor}, transparent)` }} />
                    <div className="absolute bottom-4 left-4">
                      <p className="text-xs font-bold text-white/80 uppercase tracking-wider">{study.name}</p>
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="mb-4">
                      <p className="text-4xl font-bold" style={{ color: primaryColor }}>{study.stat}</p>
                      <p className="text-sm text-gray-400 mt-1">{study.label}</p>
                    </div>
                    <blockquote className="text-sm text-gray-500 italic leading-relaxed flex-1">"{study.quote}"</blockquote>
                    <p className="text-xs text-gray-400 mt-4">— {study.author}</p>
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
      </div>
    </section>
  );

  const renderPilotApproach = () => (
    <section key="pilotApproach" className="py-28 md:py-36 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <FadeSection className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: accentColor }}>How It Works</p>
          <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mb-6`} style={{ color: primaryColor, fontFamily }}>
            {sectionHeadline("pilotApproach", "Start small. Prove it out.\u00A0\u00A0Then scale.")}
          </h2>
          <p className="text-gray-500 text-lg mb-16">
            Growth should be proven before it's scaled. Dandy helps {data.companyName} validate impact with a small number of locations and scale with confidence after — no enterprise risk required.
          </p>
        </FadeSection>
        <AnimatedTimeline
          accentColor={accentColor}
          bgColor="#f9fafb"
          theme="light"
          steps={[
            { step: "01", title: "Launch a Pilot", subtitle: "Start with 5–10 offices", desc: "Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows.", bullets: ["Premium hardware included", "Dedicated field team", "Scanning within days"] },
            { step: "02", title: "Validate Impact", subtitle: "Measure in 60–90 days", desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time.", bullets: ["Live dashboard tracks pilot KPIs", "Compare pilot vs. control group", "Executive-ready reporting"] },
            { step: "03", title: "Scale With Confidence", subtitle: "Roll out across the network", desc: `Expand across ${practiceCount} offices with the same standard.`, bullets: ["Consistent onboarding", "One standard everywhere", "MSA ensures alignment"] },
          ]}
        />
      </div>
    </section>
  );

  const renderLabTour = () => (
    <>
    {/* Lab image divider */}
    <section key="labTour-image" className="relative">
      {labVideoUrl ? (
        <div className="w-full aspect-video max-w-4xl mx-auto">
          <iframe
            src={toAutoEmbedUrl(labVideoUrl, true)}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Lab Tour Video"
          />
        </div>
      ) : (
        <div className="aspect-[3/1] md:aspect-[4/1] overflow-hidden">
          <img src={labImage} alt="Dandy lab manufacturing floor" className="w-full h-full object-cover object-[center_25%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-transparent to-transparent opacity-40" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/80 bg-black/30 backdrop-blur-sm px-6 py-2 rounded-full">Inside Dandy's U.S. Manufacturing Facility</p>
      </div>
    </section>

    {/* Lab Tour content */}
    <section key="labTour" className="py-28 md:py-36 relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <FadeSection className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: accentColor }}>Built in the USA</p>
          <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight text-white mb-6`} style={{ fontFamily }}>
            {sectionHeadline("labTour", "See vertical integration in action.")}
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto mb-8">
            Unlike traditional labs, Dandy owns the entire manufacturing process — from scan to delivery. U.S.-based facilities, AI quality control, and expert technicians deliver a 96% first-time right rate at enterprise scale.
          </p>
          <blockquote className="max-w-2xl mx-auto mb-12">
            <p className="text-base italic text-white/60 leading-relaxed">"Dandy is a true partner, not just a vendor. They value education, technology, and people — that's what makes the difference."</p>
            <cite className="block mt-3 text-sm text-white/30 not-italic">— DSO Clinical Operations Officer</cite>
          </blockquote>
        </FadeSection>

        {/* Video Player */}
        <FadeSection delay={0.1}>
          <div
            className="relative rounded-2xl overflow-hidden border border-white/10 cursor-pointer group max-w-3xl mx-auto"
            onClick={() => setLabVideoOpen(true)}
          >
            <div className="aspect-video">
              <img src={dandyLabMachines} alt="Inside Dandy's U.S. Manufacturing Facility" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/25 transition-colors duration-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-white/20">
                  <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.2em]">Watch Video</p>
                <p className="mt-1 text-base font-medium text-white">Inside Dandy's 100% Digital Dental Lab</p>
              </div>
            </div>
          </div>
        </FadeSection>

        <FadeSection delay={0.15}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 mb-12">
            {[
              { icon: FlaskConical, label: "Advanced Materials Lab" },
              { icon: Eye, label: "AI Quality Control" },
              { icon: Users, label: "U.S.-Based Technicians" },
              { icon: MapPin, label: "Multiple Locations" },
            ].map((item, i) => (
              <div key={i} className="p-5 rounded-xl bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors">
                <item.icon className="w-5 h-5 mx-auto mb-2" style={{ color: accentColor }} />
                <p className="text-xs text-white/70 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <button onClick={() => onOpenDemo()} className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg border border-white/20 text-white font-semibold hover:bg-white/10 transition-colors text-sm">
              Request a Lab Tour <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </FadeSection>
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
              src={toAutoEmbedUrl("https://www.youtube.com/watch?v=SjXFjvWW9o0")}
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
  );

  const renderCalculator = () => (
    <section key="calculator" className="py-28 md:py-36 bg-white relative" id="calculator">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <FadeSection className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: accentColor }}>Prove the Impact</p>
          <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight mb-6`} style={{ color: primaryColor, fontFamily }}>
            {sectionHeadline("calculator", "Calculate the cost of inaction.")}
          </h2>
          <p className="text-gray-500 text-lg mb-14">
            Estimate the cost of remakes and lost chair time across {data.companyName}.
          </p>
        </FadeSection>
        <FadeSection delay={0.1}>
          <SolutionsCalculator companyName={data.companyName} defaultPractices={parseInt(String(practiceCount).replace(/[^0-9]/g, "")) || 50} onCTA={() => onOpenDemo()} />
        </FadeSection>
      </div>
    </section>
  );

  const renderFinalCTA = () => {
    const finalHeadline = (cfg?.finalCTAHeadline || "Prove ROI.\u00A0\u00A0Then scale.").replace(/\{company\}/g, data.companyName);
    const finalSub = (cfg?.finalCTASubheadline || "Validate impact with a focused pilot at 5–10 offices. Measure remake reduction, chair time recovered, and same-store revenue lift in real time — then scale across your network with confidence.").replace(/\{company\}/g, data.companyName);
    return (
      <>
      {/* Bottom hero image strip */}
      <section key="finalCTA-image" className="relative">
        <div className="aspect-[3/1] md:aspect-[4/1] overflow-hidden">
          <img src={financialChartBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent, ${primaryColor})` }} />
        </div>
      </section>

      <section key="finalCTA" className="py-28 md:py-36 relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <FadeSection>
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: accentColor }}>Next Steps</p>
            <h2 className={`${headlineSizeCls} ${headlineWeight} leading-tight text-white mb-6`} style={{ fontFamily }}>{finalHeadline}</h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto mb-12">{finalSub}</p>
            {finalCTAVideoUrl ? (
              <button onClick={() => setVideoModalUrl(finalCTAVideoUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="inline-flex items-center gap-2 px-10 py-4 rounded-lg font-semibold hover:opacity-90 transition-colors text-base">
                <Play className="w-4 h-4" /> {heroCTAText}
              </button>
            ) : (
              <button onClick={() => onOpenDemo(cfg?.finalCTAUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="inline-flex items-center gap-2 px-10 py-4 rounded-lg font-semibold hover:opacity-90 transition-colors text-base">
                {heroCTAText} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </FadeSection>
        </div>
      </section>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: bodyFontFamily }}>
      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <img src={dandyLogo} alt="Dandy" className="h-5" />
            <div className="h-5 w-px bg-gray-200 hidden md:block" />
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <a key={link.id} href={`#${link.id}`} className={`text-sm font-medium transition-colors ${activeNav === link.id ? "text-[#1b3a2d]" : "text-gray-400 hover:text-gray-700"}`}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:+13158599362" className="hidden md:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <Phone className="w-3.5 h-3.5" /> (315)-859-9362
            </a>
            <button onClick={() => navCTAVideoUrl ? setVideoModalUrl(navCTAVideoUrl) : onOpenDemo(cfg?.navCTAUrl)} style={{ backgroundColor: accentColor, color: primaryColor }} className="px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors">
              {navCTAVideoUrl && <Play className="w-3.5 h-3.5 inline mr-1" />}{navCTAText}
            </button>
          </div>
        </div>
      </nav>

      {/* Render sections in configured order */}
      {sectionOrder.map((id) => renderSection(id))}

      {/* ═══════ CUSTOM SECTIONS ═══════ */}
      {(cfg?.customSections || []).map((sec, i) => (
        <CustomSectionBlock key={sec.id} sec={sec} index={i} primaryColor={primaryColor} accentColor={accentColor} headlineWeight={headlineWeight} headlineSizeCls={headlineSizeCls} fontFamily={fontFamily} theme="light" />
      ))}

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-gray-100 py-8 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <img src={dandyLogo} alt="Dandy" className="h-4 opacity-30" />
          <p className="text-xs text-gray-300">{footerText}</p>
        </div>
      </footer>

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

export default MicrositeSolutionsSkin;
