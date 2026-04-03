import { useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  ArrowRight, TrendingDown, BarChart3, Scale, Wallet,
  AlertTriangle, Users2, TrendingUp, Check, Minus,
  ScanLine, ShieldCheck, BrainCircuit, Play, X,
  Rocket, CheckCircle2, MapPin, Microscope, Cpu, Users, Phone, Menu
} from "lucide-react";
import DSOInvisibleWasteCalculator from "@/components/DSOInvisibleWasteCalculator";
import MicrositeInteractiveDashboard from "@/components/MicrositeInteractiveDashboard";
import CustomSectionBlock from "@/components/CustomSectionBlock";
import { MicrositeSkinConfig, filterByPracticeCount, getHeadlineSizeClasses, SectionStyleOverrides } from "@/lib/microsite-skin-config";
import { useIsMobile } from "@/hooks/use-mobile";
import InlineEditableSection from "@/components/InlineEditableSection";

import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import heroBoardroom from "@/assets/hero-boardroom.jpg";
import aiScanReview from "@/assets/ai-scan-review.jpg";
import dandyLabMachines from "@/assets/dandy-lab-machines.jpg";
import financialChartBg from "@/assets/financial-chart-bg.png";


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

/* ── Default data ── */
const DEFAULT_CHALLENGES = [
  { icon: TrendingDown, title: "Same-Store Growth Pressure", desc: "Acquisition pipelines have slowed. With rising costs and tighter financing, DSOs must unlock more revenue from existing practices to protect EBITDA — and the dental lab is one of the most overlooked levers." },
  { icon: BarChart3, title: "Fragmented Lab Relationships", desc: "If every dentist chooses their own lab, you never get a volume advantage. Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage." },
  { icon: Scale, title: "Standards That Don't Survive Growth", desc: "Most DSOs don't fail because they grow too fast — they fail because their standards don't scale. Variability creeps in, outcomes drift, and operational discipline erodes with every new location." },
  { icon: Wallet, title: "Capital Constraints", desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast. DSOs need a partner that eliminates CAPEX, includes premium hardware, and proves ROI within months." },
];

const DEFAULT_PROBLEMS = [
  { icon: AlertTriangle, title: "Fragmented Networks", desc: "Lab vendors vary by region, creating blind spots in quality, cost, and turnaround — with no centralized visibility across your network." },
  { icon: BarChart3, title: "Scattered Data", desc: "Disconnected systems across brands and locations make performance tracking nearly impossible. You can't improve what you can't measure." },
  { icon: Users2, title: "Provider Resistance", desc: "When lab quality is inconsistent, providers lose confidence in the workflow — slowing adoption and undermining digital transformation." },
  { icon: TrendingUp, title: "Revenue Leakage", desc: "High remake rates, wasted chair time, and inefficient workflows silently drain profitability at every location — compounding across your entire network." },
];

const DEFAULT_COMPARISON_ROWS = [
  { need: "Patient Volume Growth", dandy: "30% higher case acceptance, expanded services like Aligners", traditional: "No growth enablement" },
  { need: "Multi-Brand Consistency", dandy: "One standard across all your brands and locations", traditional: "Varies by location and vendor" },
  { need: "Waste Prevention", dandy: "AI Scan Review catches issues before they cost you", traditional: "Remakes discovered after the fact" },
  { need: "Executive Visibility", dandy: "Real-time, actionable data across your entire network", traditional: "Fragmented, non-actionable reports" },
  { need: "Capital Efficiency", dandy: "Premium scanners included — no CAPEX required", traditional: "Heavy CAPEX, scanner bottlenecks" },
  { need: "Change Management", dandy: "Hands-on training that respects provider autonomy", traditional: "Minimal onboarding, slow rollout" },
];

const DEFAULT_CASE_STUDIES = [
  { name: "APEX Dental Partners", stat: "12.5%", label: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Layla Lohmann, Founder" },
  { name: "Open & Affordable Dental", stat: "96%", label: "reduction in remakes", quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.", author: "Clinical Director" },
  { name: "DENTAL CARE ALLIANCE", stat: "99%", label: "practices still using Dandy after one year", quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.", author: "Dr. Trey Mueller, Chief Clinical Officer" },
];

const DEFAULT_STATS = [
  { value: "30%", label: "Avg case acceptance lift" },
  { value: "96%", label: "First-time right rate" },
  { value: "50%", label: "Denture appointments saved" },
  { value: "$0", label: "CAPEX to get started" },
];

/* ── Financial Impact Calculator Tab ── */
/* ═══════ MAIN COMPONENT ═══════ */
const MicrositeDandySkin = ({ data, onOpenDemo: _rawOnOpenDemo, skinConfig, onTrackCTA, editorMode, sectionStyles, onUpdateSectionStyle }: {
  data: BriefingData;
  onOpenDemo: (buttonUrl?: string, ctaLabel?: string) => void;
  skinConfig?: MicrositeSkinConfig | null;
  onTrackCTA?: (label: string) => void;
  editorMode?: boolean;
  sectionStyles?: Record<string, SectionStyleOverrides>;
  onUpdateSectionStyle?: (sectionId: string, patch: Partial<SectionStyleOverrides>) => void;
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [labVideoOpen, setLabVideoOpen] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  
  const isMobile = useIsMobile();

  const fit = data.dandyFitAnalysis;
  const size = data.sizeAndLocations;
  const practiceCount = size?.practiceCount || "100+";

  const onOpenDemo = (buttonUrl?: string) => {
    onTrackCTA?.("CTA Click");
    _rawOnOpenDemo(buttonUrl);
  };

  const cfg = skinConfig;
  const supportedSectionOrder = [
    "hero", "statsBar", "challenges", "problem", "comparison", "dashboard", "aiScanReview", "successStories", "pilotApproach", "labTour", "calculator", "finalCTA",
  ];
  const supportedSectionIds = new Set(supportedSectionOrder);
  const configuredSectionOrder = (cfg?.sections || [])
    .filter((s) => s.visible && supportedSectionIds.has(s.id))
    .map((s) => s.id);
  const sectionOrder = configuredSectionOrder.length > 0 ? configuredSectionOrder : supportedSectionOrder;

  const sectionHeadline = (id: string, fallback: string, defaultBr?: string) => {
    const sec = cfg?.sections?.find(s => s.id === id);
    const override = (data as any).sectionHeadlineOverrides?.[id];
    const raw = (override || sec?.headline || fallback).replace(/\{company\}/g, data.companyName);
    // If using fallback (no override, no skin config) and we have a defaultBr pattern, use it
    if (!override && !sec?.headline && defaultBr) {
      const parts = raw.split(defaultBr);
      if (parts.length === 2) return <>{parts[0]}{defaultBr}<br />{parts[1]}</>;
    }
    return raw;
  };

  const heroOverride = (data as any).sectionHeadlineOverrides?.["hero"];
  const heroPattern = (heroOverride || cfg?.heroHeadlinePattern || "The lab partner built for {company}").replace(/\{company\}/g, data.companyName);
  const heroCTAText = cfg?.heroCTAText || "GET PRICING";
  const secondaryCTAText = cfg?.secondaryCTAText || "CALCULATE ROI";
  const navCTAText = cfg?.navCTAText || "GET PRICING";
  const parsedPracticeCount = parseInt(String(practiceCount).replace(/\D/g, ""), 10) || null;
  const rawCaseStudies = (data as any).caseStudyOverrides || cfg?.caseStudies || DEFAULT_CASE_STUDIES;
  const displayCaseStudies = (filterByPracticeCount(rawCaseStudies, parsedPracticeCount, 3) as typeof DEFAULT_CASE_STUDIES).slice(0, 3);
  const displayComparison = cfg?.comparisonRows || DEFAULT_COMPARISON_ROWS;
  const rawStats = (data as any).statsBarOverrides || cfg?.statsBar || DEFAULT_STATS;
  const displayStats = (filterByPracticeCount(rawStats, parsedPracticeCount) as typeof rawStats).slice(0, 4);
  const footerText = cfg?.footerText || "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing";
  const heroImage = cfg?.sectionImages?.heroImage || heroBoardroom;
  const aiImage = cfg?.sectionImages?.aiScanReviewImage || aiScanReview;
  const labImage = cfg?.sectionImages?.labTourImage || dandyLabMachines;
  const labVideoUrl = cfg?.sectionImages?.labTourVideoUrl || "";
  const heroCTAVideoUrl = cfg?.heroCTAVideoUrl || "";
  const secondaryCTAVideoUrl = cfg?.secondaryCTAVideoUrl || "";
  const navCTAVideoUrl = cfg?.navCTAVideoUrl || "";
  const finalCTAVideoUrl = cfg?.finalCTAVideoUrl || "";

  const navLinks = [
    { label: "Lab Services", href: "#solutions" },
    { label: "Solutions", href: "#dashboard" },
    { label: "Pricing", href: "#contact" },
    { label: "Results", href: "#results" },
  ];

  // Scroll handler for navbar
  const handleScroll = () => setScrolled(window.scrollY > 40);
  useState(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  });

  /* ── HERO with parallax ── */
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroImageY = useTransform(heroProgress, [0, 1], ["0%", "30%"]);
  const heroOverlayOpacity = useTransform(heroProgress, [0, 1], [0.85, 1]);

  const displayChallenges = cfg?.challenges || DEFAULT_CHALLENGES.map(c => ({ title: c.title, desc: c.desc }));
  const challengeIcons = [TrendingDown, BarChart3, Scale, Wallet];

  const sectionLabels: Record<string, string> = {
    hero: "Hero", statsBar: "Stats Bar", challenges: "Challenges", problem: "Problem",
    comparison: "Comparison", dashboard: "Dashboard", aiScanReview: "AI Scan Review",
    successStories: "Success Stories", pilotApproach: "Pilot Approach", labTour: "Lab Tour",
    calculator: "Calculator", finalCTA: "Final CTA",
  };

  const wrapSection = (sectionId: string, content: React.ReactNode) => {
    if (!editorMode || !content) return content;
    return (
      <InlineEditableSection
        sectionId={sectionId}
        sectionLabel={sectionLabels[sectionId] || sectionId}
        styles={sectionStyles?.[sectionId]}
        onUpdate={(patch) => onUpdateSectionStyle?.(sectionId, patch)}
        onReset={() => onUpdateSectionStyle?.(sectionId, {} as any)}
      >
        {content}
      </InlineEditableSection>
    );
  };

  const renderSection = (sectionId: string) => {
    let content: React.ReactNode = null;
    switch (sectionId) {
      case "hero": content = renderHero(); break;
      case "statsBar": content = renderStatsBar(); break;
      case "challenges": content = renderChallenges(); break;
      case "problem": content = renderProblem(); break;
      case "comparison": content = renderComparison(); break;
      case "dashboard": content = renderDashboard(); break;
      case "aiScanReview": content = renderAIScanReview(); break;
      case "successStories": content = renderSuccessStories(); break;
      case "pilotApproach": content = renderPilotApproach(); break;
      case "labTour": content = renderLabTour(); break;
      case "calculator": content = renderCalculator(); break;
      case "finalCTA": content = renderFinalCTA(); break;
      default: return null;
    }
    return wrapSection(sectionId, content);
  };

  const renderHero = () => (
    <section key="hero" ref={heroRef} className="relative overflow-hidden">
      <div className="relative">
        <div className="absolute inset-0">
          <motion.img src={heroImage} alt="" className="w-full h-[130%] object-cover will-change-transform" style={{ y: heroImageY }} />
          <motion.div className="absolute inset-0 bg-gradient-to-r from-[hsla(152,45%,5%,1)] via-[hsla(152,42%,8%,0.95)] to-[hsla(152,40%,6%,0.80)]" style={{ opacity: heroOverlayOpacity }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsla(152,45%,5%,0.6)]" />
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none hero-shimmer" />
        </div>

        <div className="relative max-w-[1280px] mx-auto px-6 md:px-10 pt-36 md:pt-44 lg:pt-56 pb-24 md:pb-32 lg:pb-44">
          <div className="max-w-2xl">
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-warm mb-8">
              DANDY FOR {data.companyName.toUpperCase()}
            </motion.p>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(2.75rem,6vw,5rem)] leading-[1.05] tracking-[-0.035em] font-medium text-primary-foreground">
              {heroPattern}
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 text-lg md:text-xl text-primary-foreground/75 leading-relaxed md:max-w-xl">
              {cfg?.heroSubtext || fit.primaryValueProp}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}
              className="mt-10 flex flex-col sm:flex-row gap-4">
              {heroCTAVideoUrl ? (
                <button onClick={() => setVideoModalUrl(heroCTAVideoUrl)}
                  className="inline-flex items-center justify-center gap-2.5 rounded-full bg-accent-warm px-8 py-4 text-[14px] font-semibold uppercase tracking-wider text-accent-warm-foreground hover:brightness-110 transition-all duration-300">
                  <Play className="w-4 h-4" /> {heroCTAText}
                </button>
              ) : (
                <button onClick={() => onOpenDemo(cfg?.heroCTAUrl)}
                  className="inline-flex items-center justify-center gap-2.5 rounded-full bg-accent-warm px-8 py-4 text-[14px] font-semibold uppercase tracking-wider text-accent-warm-foreground hover:brightness-110 transition-all duration-300">
                  {heroCTAText} <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {secondaryCTAVideoUrl ? (
                <button onClick={() => setVideoModalUrl(secondaryCTAVideoUrl)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-foreground/15 px-8 py-4 text-[14px] font-semibold uppercase tracking-wider text-primary-foreground/50 hover:text-primary-foreground/80 hover:border-primary-foreground/25 transition-all duration-300">
                  <Play className="w-4 h-4" /> {secondaryCTAText}
                </button>
              ) : (
                <button onClick={() => document.getElementById("waste-calculator")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-foreground/15 px-8 py-4 text-[14px] font-semibold uppercase tracking-wider text-primary-foreground/50 hover:text-primary-foreground/80 hover:border-primary-foreground/25 transition-all duration-300">
                  {secondaryCTAText}
                </button>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderStatsBar = () => (
    <section key="statsBar" className="bg-background">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-10 md:py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {displayStats.map((m: any, i: number) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }} className="text-center">
              <p className="text-3xl md:text-4xl font-medium text-foreground tracking-tight">{m.value}</p>
              <p className="text-sm text-muted-foreground mt-1.5">{m.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );

  const renderChallenges = () => {
    if (isMobile) {
      return (
        <section key="challenges" className="section-padding bg-secondary">
          <div className="max-w-[1280px] mx-auto px-6">
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-[11px] font-semibold text-primary mb-4 tracking-[0.15em] uppercase">The Hidden Cost</motion.p>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
              className="text-display text-foreground mb-10">
              {sectionHeadline("challenges", "At scale — even small inefficiencies compound fast.")}
            </motion.h2>
            <div className="flex flex-col gap-5">
              {displayChallenges.map((c, i) => {
                const Icon = challengeIcons[i % 4];
                return (
                  <motion.div key={c.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.6 }} className="premium-card p-7">
                    <div className="w-11 h-11 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-5">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground tracking-tight">{c.title}</h3>
                    <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">{c.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    return (
      <section key="challenges" className="section-padding bg-secondary">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          <div className="max-w-3xl mb-14">
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-[11px] font-semibold text-primary mb-4 tracking-[0.15em] uppercase">The Hidden Cost</motion.p>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
              className="text-display text-foreground">
              {sectionHeadline("challenges", "At scale — even small inefficiencies compound fast.")}
            </motion.h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {displayChallenges.map((c, i) => {
              const Icon = challengeIcons[i % 4];
              return (
                <motion.div key={c.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.6 }}
                  className="rounded-2xl flex flex-col px-7 py-10"
                  style={{
                    background: "linear-gradient(150deg, #ffffff 50%, hsl(152, 42%, 96%) 100%)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.07)",
                    borderTop: "2px solid hsl(152, 42%, 12%)",
                  }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-6" style={{ background: "hsl(152, 42%, 12%, 0.09)" }}>
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">{c.title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{c.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  const renderProblem = () => (
    <section key="problem" className="section-padding relative z-10 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 relative z-10">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">The Problem</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="text-display text-foreground">
            {sectionHeadline("problem", "Lab consolidation shouldn't mean compromise.", "shouldn't ")}
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {"Growing DSOs face a critical tension: executives need standardization and cost control, while providers demand clinical autonomy and quality they trust. Without alignment, both sides lose."}
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {DEFAULT_PROBLEMS.map((p, i) => (
            <motion.div key={p.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl flex flex-col px-8 py-10"
              style={{
                background: "linear-gradient(150deg, #ffffff 50%, hsl(152, 42%, 96%) 100%)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.07)",
                borderBottom: "2px solid hsl(152, 42%, 12%)",
              }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-6" style={{ background: "hsl(152, 42%, 12%, 0.09)" }}>
                <p.icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-3">{p.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );

  const renderComparison = () => (
    <section key="comparison" id="solutions" className="section-padding bg-secondary">
      <div className="max-w-[1100px] mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">The Dandy Difference</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="text-display text-foreground">
            Built for DSO scale.<br />Designed for provider trust.
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Dandy combines the lab providers choose with advanced manufacturing, AI-driven quality control, and network-wide insights — a model traditional labs simply can't match.
          </motion.p>
          <motion.blockquote initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
            className="mt-8 max-w-2xl mx-auto border-l-2 border-primary/30 pl-5 text-left">
            <p className="text-sm text-foreground/70 italic leading-relaxed">"Dandy is the easiest pathway to lab consolidation without forcing doctors to switch."</p>
            <p className="text-xs text-muted-foreground mt-3">— Dr. Michael Fooshée, Chief Clinical Operations Officer, APEX Dental Partners</p>
          </motion.blockquote>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.7 }}
          className="rounded-2xl overflow-hidden bg-background" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <div className="grid grid-cols-3 bg-primary">
            <div className="p-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/60">What {data.companyName} Needs</div>
            <div className="p-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-warm">Dandy</div>
            <div className="p-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/60">Traditional Labs</div>
          </div>
          {displayComparison.map((row, i) => (
            <motion.div key={row.need} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              className="grid grid-cols-3 border-t border-border/50 hover:bg-secondary/40 transition-colors duration-200">
              <div className="p-5 text-sm font-medium text-foreground">{row.need}</div>
              <div className="p-5 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-foreground/80 leading-relaxed">{row.dandy}</span>
              </div>
              <div className="p-5 flex items-start gap-2.5">
                <Minus className="w-4 h-4 text-muted-foreground/30 mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground/50 leading-relaxed">{row.traditional}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
          className="mt-12 text-center">
          <button onClick={() => onOpenDemo()}
            className="inline-flex items-center justify-center gap-2.5 rounded-full bg-primary px-8 py-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-300">
            Request a Demo <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </section>
  );

  const renderDashboard = () => (
    <section key="dashboard" id="dashboard" className="section-padding bg-secondary">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="text-center mb-12">
          <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-[11px] font-semibold text-primary mb-5 tracking-[0.15em] uppercase">Executive Visibility</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
           className="text-display text-foreground">
             Dashboards don't change outcomes. <br />Decisions do.
           </motion.h2>
          <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Dandy Insights gives {data.companyName} leaders actionable data — not just reports. Know where to intervene before problems scale, manage by exception, and maintain control as complexity increases.
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}>
          <MicrositeInteractiveDashboard variant="light" practiceCount={practiceCount} />
        </motion.div>
      </div>
    </section>
  );

  const renderAIScanReview = () => {
    const aiRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress: aiProgress } = useScroll({ target: aiRef, offset: ["start end", "end start"] });
    const aiImageY = useTransform(aiProgress, [0, 1], ["40px", "-40px"]);
    const aiTextY = useTransform(aiProgress, [0, 1], ["20px", "-20px"]);

    return (
      <section key="aiScanReview" ref={aiRef} className="section-padding">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10">
          <div className="grid md:grid-cols-2 gap-14 lg:gap-24 items-center">
            <motion.div style={{ y: aiTextY }}>
              <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">Waste Prevention</motion.p>
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
                className="text-display text-foreground">
                {sectionHeadline("aiScanReview", "Remakes are a tax. AI eliminates them.", "tax. ")}
              </motion.h2>
              <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                className="mt-6 text-lg text-muted-foreground leading-relaxed">
                AI Scan Review catches issues in real time — avoiding costly rework and maximizing revenue potential before a case ever reaches the bench.
              </motion.p>
              <motion.blockquote initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.12 }}
                className="mt-6 border-l-2 border-primary/30 pl-4">
                <p className="text-sm text-foreground/70 italic leading-relaxed">"I don't even double-check the AI margins anymore — it's gained me time."</p>
                <p className="text-xs text-muted-foreground mt-2">— DSO Clinical Director</p>
              </motion.blockquote>

              <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
                className="mt-10 space-y-4">
                {[
                  { icon: BrainCircuit, text: "AI reviews every scan for clinical accuracy" },
                  { icon: ScanLine, text: "Real-time feedback before case submission" },
                  { icon: ShieldCheck, text: "Eliminates remakes at the source" },
                ].map((item, i) => (
                  <motion.div key={item.text} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.08 }} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[15px] text-foreground/80">{item.text}</span>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                className="mt-12 flex gap-10">
                {[{ value: "96%", label: "First-Time Right" }, { value: "<30s", label: "Scan Review" }, { value: "100%", label: "AI-Screened" }].map((s) => (
                  <div key={s.label}>
                    <p className="text-3xl font-medium text-foreground tracking-tight">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div style={{ y: aiImageY }} className="relative order-first md:order-last">
              <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl overflow-hidden relative" style={{ boxShadow: 'var(--shadow-elevated)' }}>
                <img src={aiImage} alt="AI-powered dental scan quality review" className="w-full h-auto aspect-[4/3] object-cover object-[35%_center] scale-110" loading="lazy" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    );
  };

  const renderSuccessStories = () => (
    <section key="successStories" id="results" className="section-padding bg-primary">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-[11px] font-semibold tracking-[0.15em] text-accent-warm mb-5 uppercase">Proven Results</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="text-display text-primary-foreground">
            {sectionHeadline("successStories", "DSOs that switched and never looked back.", "switched ")}
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {displayCaseStudies.map((s: any, i: number) => (
            <motion.div key={s.name} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.7 }}
              className="rounded-2xl bg-primary-foreground/[0.06] backdrop-blur-sm border border-primary-foreground/10 overflow-hidden flex flex-col hover:bg-primary-foreground/[0.1] transition-colors duration-300">
              <div className="p-8 md:p-9 flex flex-col flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50 mb-6">{s.name.toUpperCase()}</p>
                <p className="text-5xl font-medium text-primary-foreground tracking-tight">{s.stat}</p>
                <p className="mt-2 text-sm text-primary-foreground/60 mb-8">{s.label}</p>
                <div className="w-8 h-px bg-accent-warm/40 mb-6" />
                <blockquote className="text-sm text-primary-foreground/70 leading-relaxed italic flex-1">"{s.quote}"</blockquote>
                <p className="mt-8 text-sm font-medium text-accent-warm">— {s.author}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );

  const renderPilotApproach = () => {
    const pilotRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress: pilotProgress } = useScroll({ target: pilotRef, offset: ["start 80%", "end 60%"] });
    const pilotLineHeight = useTransform(pilotProgress, [0, 1], ["0%", "100%"]);

    const pilotSteps = [
      { icon: Rocket, title: "Launch a Pilot", subtitle: "Start with 5–10 offices", desc: "Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows — no CAPEX, no disruption.", details: ["Premium hardware included for every operatory", "Dedicated field team manages change management", "Doctors trained and scanning within days"] },
      { icon: BarChart3, title: "Validate Impact", subtitle: "Measure results in 60–90 days", desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time — proving ROI before you scale.", details: ["Live dashboard tracks pilot KPIs", "Compare pilot offices vs. control group", "Executive-ready reporting for leadership review"] },
      { icon: TrendingUp, title: "Scale With Confidence", subtitle: "Roll out across the network", desc: `Expand across ${data.companyName}'s entire network with the same standard, same playbook, and same results — predictable execution at enterprise scale.`, details: ["Consistent onboarding across all locations", "One standard across every office and brand", "MSA ensures network-wide alignment at scale"] },
    ];

    return (
      <section key="pilotApproach" className="section-padding bg-secondary">
        <div className="max-w-[800px] mx-auto px-6 md:px-10">
          <div className="text-center mb-16">
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">How It Works</motion.p>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
              className="text-display text-foreground">
              Start small. Prove it out.<br />Then scale.
            </motion.h2>
            <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Growth should be proven before it's scaled. Dandy helps {data.companyName} validate impact with a small number of locations and scale with confidence after — no enterprise risk required.
            </motion.p>
          </div>

          <div className="relative" ref={pilotRef}>
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border/60" />
            <motion.div className="absolute left-6 top-0 w-px bg-primary origin-top" style={{ height: pilotLineHeight }} />

            <div className="space-y-14">
              {pilotSteps.map((step, i) => (
                <motion.div key={step.title} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.6 }} className="relative flex gap-6 md:gap-8">
                  <div className="relative z-10 shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                      <step.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="pb-2 -mt-0.5">
                    <p className="text-[10px] font-semibold text-accent-warm uppercase tracking-[0.2em] mb-1">Step 0{i + 1}</p>
                    <h3 className="text-xl font-medium text-foreground tracking-tight">{step.title}</h3>
                    <p className="text-sm font-medium text-primary/70 mt-1">{step.subtitle}</p>
                    <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">{step.desc}</p>
                    <ul className="mt-4 space-y-2">
                      {step.details.map((d) => (
                        <li key={d} className="flex items-start gap-2.5 text-[15px] text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderLabTour = () => {
    const labRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress: labProgress } = useScroll({ target: labRef, offset: ["start end", "end start"] });
    const labImageY = useTransform(labProgress, [0, 1], ["40px", "-40px"]);
    const labTextY = useTransform(labProgress, [0, 1], ["20px", "-20px"]);

    return (
      <>
        <section key="labTour" ref={labRef} className="section-padding">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10">
            <div className="grid md:grid-cols-2 gap-14 lg:gap-24 items-center">
              <motion.div style={{ y: labImageY, boxShadow: 'var(--shadow-elevated)' }}
                initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.8 }} className="relative rounded-3xl overflow-hidden group cursor-pointer"
                onClick={() => setLabVideoOpen(true)}>
                <div className="relative aspect-[4/3]">
                  <img src={labImage} alt="Dandy lab manufacturing floor" className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-foreground/20 group-hover:bg-foreground/10 transition-colors duration-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-xl">
                      <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-foreground/70 to-transparent">
                    <p className="text-[10px] font-semibold text-primary-foreground/70 uppercase tracking-[0.2em]">Lab Tour</p>
                    <p className="mt-1 text-base font-medium text-white">Inside Dandy's U.S. Manufacturing Facility</p>
                  </div>
                </div>
              </motion.div>

              <motion.div style={{ y: labTextY }}>
                <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">Built in the USA</motion.p>
                <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
                  className="text-display text-foreground">
                  {sectionHeadline("labTour", "See vertical integration in action.")}
                </motion.h2>
                <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                  className="mt-6 text-lg text-muted-foreground leading-relaxed">
                  Unlike traditional labs, Dandy owns the entire manufacturing process — from scan to delivery. U.S.-based facilities, AI quality control, and expert technicians deliver a 96% first-time right rate at enterprise scale.
                </motion.p>

                <motion.blockquote initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.12 }}
                  className="mt-6 border-l-2 border-primary/30 pl-4">
                  <p className="text-sm text-foreground/70 italic leading-relaxed">"Dandy is a true partner, not just a vendor. They value education, technology, and people — that's what makes the difference."</p>
                  <p className="text-xs text-muted-foreground mt-2">— DSO Clinical Operations Officer</p>
                </motion.blockquote>

                <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
                  className="mt-10 grid grid-cols-2 gap-4">
                  {[
                    { icon: Microscope, label: "Advanced Materials Lab" },
                    { icon: Cpu, label: "AI Quality Control" },
                    { icon: Users, label: "U.S.-Based Technicians" },
                    { icon: MapPin, label: "Multiple Locations" },
                  ].map((h) => (
                    <div key={h.label} className="flex items-center gap-3 p-4 rounded-xl bg-secondary">
                      <h.icon className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground/80">{h.label}</span>
                    </div>
                  ))}
                </motion.div>

                <motion.button initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                  onClick={() => onOpenDemo()}
                  className="inline-flex items-center gap-2.5 mt-10 rounded-full bg-primary px-8 py-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-300">
                  <MapPin className="w-4 h-4" /> Request a Lab Tour
                </motion.button>
              </motion.div>
            </div>
          </div>
        </section>

        <AnimatePresence>
          {labVideoOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-md p-4"
              onClick={() => setLabVideoOpen(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }} className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setLabVideoOpen(false)} className="absolute -top-10 right-0 z-10 text-white hover:text-white/80 transition-colors" aria-label="Close video">
                  <X className="w-6 h-6" />
                </button>
                <iframe src="https://www.youtube.com/embed/SjXFjvWW9o0?autoplay=1&mute=1&rel=0" title="Inside Dandy's 100% Digital Dental Lab"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  };

  const renderCalculator = () => (
    <section key="calculator" id="waste-calculator">
      <DSOInvisibleWasteCalculator />
    </section>
  );

  const renderFinalCTA = () => {
    const ctaRef = useRef<HTMLElement>(null);
    const { scrollYProgress: ctaProgress } = useScroll({ target: ctaRef, offset: ["start end", "end start"] });
    const orb1Y = useTransform(ctaProgress, [0, 1], ["60px", "-60px"]);
    const orb2Y = useTransform(ctaProgress, [0, 1], ["-40px", "40px"]);
    const contentY = useTransform(ctaProgress, [0, 1], ["30px", "-15px"]);
    const finalHeadline = (cfg?.finalCTAHeadline || "Prove ROI. Then scale.").replace(/\{company\}/g, data.companyName);
    const finalSub = (cfg?.finalCTASubheadline || "Validate impact with a focused pilot at 5–10 offices. Measure remake reduction, chair time recovered, and same-store revenue lift in real time — then scale across your network with confidence.").replace(/\{company\}/g, data.companyName);

    return (
      <section key="finalCTA" ref={ctaRef} id="contact" className="relative overflow-hidden bg-primary">
        <div className="absolute inset-0 z-0">
          <img src={financialChartBg} alt="" className="w-full h-full object-cover opacity-10" />
          <div className="absolute inset-0 bg-primary/80" />
        </div>

        <div className="relative section-padding z-[1]">
          <motion.div style={{ y: orb1Y }} className="absolute top-0 left-1/4 w-96 h-96 bg-accent-warm/10 rounded-full blur-3xl" />
          <motion.div style={{ y: orb2Y }} className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary-light/20 rounded-full blur-3xl" />

          <motion.div style={{ y: contentY }} className="max-w-[720px] mx-auto px-6 md:px-10 text-center relative z-10">
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-[11px] font-semibold tracking-[0.2em] text-accent-warm mb-6 uppercase">Next Steps</motion.p>

            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
              className="text-display text-primary-foreground">
              {finalHeadline.includes(". ") ? <>{finalHeadline.split(". ")[0]}.<br />{finalHeadline.split(". ").slice(1).join(". ")}</> : finalHeadline}
            </motion.h2>
            <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="mt-6 text-lg text-primary-foreground/65 leading-relaxed">
              {finalSub}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
              className="mt-10 flex flex-col sm:flex-row gap-3 max-w-md mx-auto justify-center">
              {finalCTAVideoUrl ? (
                <button onClick={() => setVideoModalUrl(finalCTAVideoUrl)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-warm px-7 py-4 text-[14px] font-semibold uppercase tracking-wider text-accent-warm-foreground hover:brightness-110 transition-all duration-300">
                  <Play className="w-4 h-4" /> {heroCTAText}
                </button>
              ) : (
                <button onClick={() => onOpenDemo(cfg?.finalCTAUrl)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-warm px-7 py-4 text-[14px] font-semibold uppercase tracking-wider text-accent-warm-foreground hover:brightness-110 transition-all duration-300">
                  Get Started <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </motion.div>

            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
              className="mt-12 text-[11px] text-primary-foreground/35 tracking-wide">
              {footerText}
            </motion.p>
          </motion.div>
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ═══════ NAV ═══════ */}
      <motion.nav initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-[hsla(152,45%,5%,0.95)] backdrop-blur-lg shadow-lg shadow-black/20" : "bg-transparent"
        }`}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 flex items-center justify-between h-[56px]">
          <div className="flex items-center gap-12">
            <a href="https://www.meetdandy.com" className="hover:opacity-80 transition-opacity">
              <img src={dandyLogoWhite} alt="Dandy" className="h-[18px] w-auto" />
            </a>
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a key={link.label} href={link.href}
                  onClick={(e) => { e.preventDefault(); document.getElementById(link.href.replace("#", ""))?.scrollIntoView({ behavior: "smooth" }); }}
                  className="text-[14px] font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors duration-200">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-5">
            <a href="tel:3158599362" className="flex items-center gap-1.5 text-[13px] text-primary-foreground/60 hover:text-primary-foreground/90 transition-colors">
              <Phone className="w-3.5 h-3.5" /> (315)-859-9362
            </a>
            <button onClick={() => document.getElementById("waste-calculator")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center justify-center rounded-full px-5 py-2 text-[13px] font-semibold tracking-wider uppercase transition-all duration-300 border border-primary-foreground/15 text-primary-foreground/50 hover:text-primary-foreground/80 hover:border-primary-foreground/25">
              CALCULATE ROI
            </button>
            {navCTAVideoUrl ? (
              <button onClick={() => setVideoModalUrl(navCTAVideoUrl)}
                className="inline-flex items-center justify-center rounded-full px-5 py-2 text-[13px] font-semibold tracking-wider uppercase transition-all duration-300 bg-accent-warm text-accent-warm-foreground hover:brightness-110">
                <Play className="w-3.5 h-3.5 mr-1" /> {navCTAText}
              </button>
            ) : (
              <button onClick={() => onOpenDemo(cfg?.navCTAUrl)}
                className="inline-flex items-center justify-center rounded-full px-5 py-2 text-[13px] font-semibold tracking-wider uppercase transition-all duration-300 bg-accent-warm text-accent-warm-foreground hover:brightness-110">
                {navCTAText}
              </button>
            )}
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-primary-foreground" aria-label="Toggle menu">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-primary pt-14">
            <div className="flex flex-col items-center gap-8 p-10">
              {navLinks.map((link) => (
                <a key={link.label} href={link.href}
                  onClick={(e) => { e.preventDefault(); setMobileOpen(false); setTimeout(() => document.getElementById(link.href.replace("#", ""))?.scrollIntoView({ behavior: "smooth" }), 300); }}
                  className="text-xl font-medium text-primary-foreground">{link.label}</a>
              ))}
              <a href="tel:3158599362" className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <Phone className="w-4 h-4" /> (315)-859-9362
              </a>
              <button onClick={() => { setMobileOpen(false); setTimeout(() => document.getElementById("waste-calculator")?.scrollIntoView({ behavior: "smooth" }), 300); }}
                className="inline-flex items-center justify-center rounded-full border border-primary-foreground/15 px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50 hover:text-primary-foreground/80">
                CALCULATE ROI
              </button>
              <button onClick={() => { onOpenDemo(); setMobileOpen(false); }}
                className="inline-flex items-center justify-center rounded-full bg-accent-warm px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-accent-warm-foreground">
                {navCTAText}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render sections in configured order */}
      {sectionOrder.map((id) => renderSection(id))}

      {/* Custom sections */}
      {(cfg?.customSections || []).map((sec, i) => (
        <CustomSectionBlock key={sec.id} sec={sec} index={i} primaryColor="hsl(152, 42%, 12%)" accentColor="hsl(68, 60%, 52%)"
          headlineWeight="font-medium" headlineSizeCls="text-display" fontFamily="'Inter', sans-serif" theme="light" />
      ))}

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-[hsla(152,45%,8%,1)] text-primary-foreground py-20">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-12">
            <div className="col-span-2 md:col-span-1">
              <img src={dandyLogoWhite} alt="Dandy" className="h-7 w-auto mb-8" />
              <p className="text-xs text-primary-foreground/40 leading-relaxed max-w-[180px]">
                The modern dental lab, built for scale.
              </p>
            </div>
            {[
              { title: "DANDY", links: [
                { label: "Home", href: "https://www.meetdandy.com" },
                { label: "Pricing", href: "https://www.meetdandy.com/pricing" },
                { label: "Get in touch", href: "https://www.meetdandy.com/get-started" },
              ]},
              { title: "PRODUCTS", links: [
                { label: "Vision Scanner", href: "https://www.meetdandy.com/technology/intraoral-scanner" },
                { label: "Lab Services", href: "https://www.meetdandy.com/labs" },
                { label: "Digital Dentures", href: "https://www.meetdandy.com/labs/dentures" },
              ]},
              { title: "PRACTICES", links: [
                { label: "Private Practice", href: "https://www.meetdandy.com/solutions/private-practice" },
                { label: "DSO", href: "https://www.meetdandy.com/solutions/dso" },
              ]},
              { title: "RESOURCES", links: [
                { label: "Learning Center", href: "https://www.meetdandy.com/learning-center" },
                { label: "Articles", href: "https://www.meetdandy.com/articles" },
              ]},
            ].map((col) => (
              <div key={col.title}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/40 mb-5">{col.title}</p>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-[14px] text-primary-foreground/60 hover:text-primary-foreground transition-colors duration-200">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-16 pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-primary-foreground/35">© {new Date().getFullYear()} Dandy</p>
            <p className="text-xs text-primary-foreground/25">Prepared for {data.companyName} leadership.</p>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      <AnimatePresence>
        {videoModalUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setVideoModalUrl(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl aspect-video mx-4" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setVideoModalUrl(null)} className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
              <iframe src={videoModalUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                className="w-full h-full rounded-xl" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen title="Video" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MicrositeDandySkin;
