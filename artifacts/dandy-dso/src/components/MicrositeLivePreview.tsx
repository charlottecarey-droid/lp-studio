import { useRef, useState, useCallback } from "react";
import {
  Link2, Play, X, Phone, Mail, Calendar, Gift, Star, Zap, Shield, TrendingUp, Award, Sparkles,
  CheckCircle2, ArrowRight, Building2,
  BarChart3, Users, Layers, Target, Minus, FlaskConical, Eye, MapPin,
  Factory, FileText, Video, BookOpen, Headphones, ExternalLink, Quote, Ban, RotateCcw, ShieldCheck, Crown
} from "lucide-react";
import { MicrositeSkinConfig, getHeadlineSizeClasses, ExpansionPerk, ExpansionPromo, ExpansionContentLink, ExpansionTeamMember, ExpansionProduct, ExpansionPromise, ExpansionTestimonial } from "@/lib/microsite-skin-config";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import dandyLogo from "@/assets/dandy-logo.svg";
import heroBoardroom from "@/assets/hero-boardroom.jpg";
import aiScanReview from "@/assets/ai-scan-review.jpg";
import dentalCrowns from "@/assets/dental-crowns.jpg";
import dandyDoctor from "@/assets/dandy-doctor.jpg";
import scannerSpeed from "@/assets/scanner-speed.webp";
import dandyLabMachines from "@/assets/dandy-lab-crown-machine.webp";
import heroBoardroomPremium from "@/assets/hero-boardroom-premium.jpg";
import crownBridgeHero from "@/assets/crown-bridge-hero.webp";
import dandySmileSimulation from "@/assets/dandy-smile-simulation.jpg";
import dandyScannerPractice from "@/assets/dandy-scanner-practice.jpg";

type SkinType = "executive" | "solutions" | "expansion" | "flagship" | "flagship-dark" | "dandy" | "heartland";

interface Props {
  config: MicrositeSkinConfig;
  skin: SkinType;
  onUpdateHeadline: (sectionId: string, value: string) => void;
  onUpdateSubheadline: (sectionId: string, value: string) => void;
  onUpdateHeroPattern: (value: string) => void;
  onUpdateHeroSubtext: (value: string) => void;
  onUpdateFinalCTAHeadline: (value: string) => void;
  onUpdateFinalCTASubheadline: (value: string) => void;
  onUpdateButtonText: (key: "heroCTAText" | "secondaryCTAText" | "navCTAText", value: string) => void;
  onUpdateCtaUrl: (value: string) => void;
  onUpdateButtonUrl: (key: "heroCTAUrl" | "secondaryCTAUrl" | "navCTAUrl" | "finalCTAUrl", value: string) => void;
  onUpdateVideoUrl: (key: "secondaryCTAVideoUrl" | "heroCTAVideoUrl" | "navCTAVideoUrl" | "finalCTAVideoUrl", value: string) => void;
  onUpdateCustomSections: (sections: import("@/lib/microsite-skin-config").SkinCustomSection[]) => void;
}

const MOCK_COMPANY = "Acme Dental Group";

/* ── Inline editable text ── */
const EditableText = ({
  value,
  onChange,
  className = "",
  style = {},
  tag: Tag = "h2",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  tag?: "h1" | "h2" | "h3" | "p" | "span";
}) => {
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (ref.current) {
      const newVal = ref.current.innerText.trim();
      if (newVal !== value) onChange(newVal);
    }
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setEditing(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${className} outline-none cursor-text transition-all duration-200 ${
        editing
          ? "ring-2 ring-[#2ecc71]/50 rounded-lg px-2 -mx-2"
          : "hover:ring-1 hover:ring-white/20 hover:rounded-lg hover:px-2 hover:-mx-2"
      }`}
      style={style}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
};
/* ── Video modal ── */
const VideoModal = ({ url, onClose }: { url: string; onClose: () => void }) => {
  const embedUrl = url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/").replace("vimeo.com/", "player.vimeo.com/video/");
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-3xl aspect-video mx-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-8 right-0 text-white/60 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        <iframe src={embedUrl} className="w-full h-full rounded-xl" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video" />
      </div>
    </div>
  );
};

/* ── Editable button with link/video popover ── */
const EditableButton = ({
  text,
  onTextChange,
  linkUrl,
  onLinkChange,
  videoUrl,
  onVideoChange,
  className = "",
  style = {},
}: {
  text: string;
  onTextChange: (v: string) => void;
  linkUrl: string;
  onLinkChange: (v: string) => void;
  videoUrl?: string;
  onVideoChange?: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const [showLink, setShowLink] = useState(false);
  const textRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (textRef.current) {
      const v = textRef.current.innerText.trim();
      if (v !== text) onTextChange(v);
    }
  }, [text, onTextChange]);

  return (
    <span className="relative inline-flex items-center group/btn">
      {videoUrl && (
        <Play className="w-2.5 h-2.5 mr-0.5 opacity-60" />
      )}
      <span
        ref={textRef as any}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => setEditing(true)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); textRef.current?.blur(); } }}
        className={`${className} outline-none cursor-text transition-all duration-200 ${
          editing
            ? "ring-2 ring-[#2ecc71]/50 rounded-lg"
            : "hover:ring-1 hover:ring-white/20 hover:rounded-lg"
        }`}
        style={style}
        dangerouslySetInnerHTML={{ __html: text }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); setShowLink(!showLink); }}
        className="absolute -right-5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#2ecc71]/80 text-white flex items-center justify-center opacity-0 group-hover/btn:opacity-100 transition-opacity"
        title="Edit link / video"
      >
        <Link2 className="w-2.5 h-2.5" />
      </button>
      {showLink && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-[#1a1f1c] border border-white/10 rounded-lg p-2 shadow-xl space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider font-medium">Button Link URL</label>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => onLinkChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setShowLink(false); }}
              placeholder="https://..."
              className="mt-1 w-56 h-6 px-2 text-[10px] rounded bg-card/5 border border-white/10 text-white outline-none focus:ring-1 focus:ring-[#2ecc71]/50"
              autoFocus
            />
          </div>
          {onVideoChange && (
            <div>
              <label className="text-[9px] text-white/40 uppercase tracking-wider font-medium">Video URL (opens modal)</label>
              <input
                type="text"
                value={videoUrl || ""}
                onChange={(e) => onVideoChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setShowLink(false); }}
                placeholder="https://youtube.com/watch?v=..."
                className="mt-1 w-56 h-6 px-2 text-[10px] rounded bg-card/5 border border-white/10 text-white outline-none focus:ring-1 focus:ring-[#2ecc71]/50"
              />
              <p className="text-[8px] text-white/30 mt-0.5">If set, button opens a video modal instead of linking.</p>
            </div>
          )}
        </div>
      )}
    </span>
  );
};

const MicrositeLivePreview = ({ config, skin, onUpdateHeadline, onUpdateSubheadline, onUpdateHeroPattern, onUpdateHeroSubtext, onUpdateFinalCTAHeadline, onUpdateFinalCTASubheadline, onUpdateButtonText, onUpdateCtaUrl, onUpdateButtonUrl, onUpdateVideoUrl, onUpdateCustomSections }: Props) => {
  const cfg = config;
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const accentColor = cfg.colors.accent;
  const primaryColor = cfg.colors.primary;
  const fontFamily = cfg.typography.headingFont || "system-ui";
  const headlineWeight = cfg.typography.headlineBold ? "font-bold" : "font-normal";
  const headlineSizeCls = getHeadlineSizeClasses(cfg.typography.headlineSize);
  const visibleSections = new Set(cfg.sections.filter(s => s.visible).map(s => s.id));

  const sectionHeadline = (id: string, fallback: string) => {
    const sec = cfg.sections.find(s => s.id === id);
    return (sec?.headline || fallback).replace(/\{company\}/g, MOCK_COMPANY);
  };

  const sectionSubheadline = (id: string, fallback: string) => {
    const sec = cfg.sections.find(s => s.id === id);
    return (sec?.subheadline || fallback).replace(/\{company\}/g, MOCK_COMPANY);
  };

  const heroPattern = (cfg.heroHeadlinePattern || "Built for {company}.").replace(/\{company\}/g, MOCK_COMPANY);
  const heroSubtext = (cfg.heroSubtext || "A vertically integrated lab partner built to drive same-store growth, reduce waste, and scale with confidence.").replace(/\{company\}/g, MOCK_COMPANY);
  const heroImage = cfg.sectionImages?.heroImage || heroBoardroom;
  const aiImage = cfg.sectionImages?.aiScanReviewImage || aiScanReview;
  const labImage = cfg.sectionImages?.labTourImage || dandyLabMachines;
  const labVideoUrl = cfg.sectionImages?.labTourVideoUrl || "";
  const finalImage = cfg.sectionImages?.finalCTAImage || heroBoardroomPremium;
  const caseImages = cfg.sectionImages?.caseStudyImages || [];

  const displayCaseStudies = cfg.caseStudies.slice(0, 3);
  const displayComparison = cfg.comparisonRows.slice(0, 4);
  const displayChallenges = cfg.challenges.slice(0, 4);

  const isExecutive = skin === "executive";
  const isExpansion = skin === "expansion";
  const bg = isExecutive ? primaryColor : isExpansion ? "#ffffff" : "#ffffff";
  const textColor = isExecutive ? "#ffffff" : isExpansion ? "#0a3d2d" : primaryColor;
  const subtextColor = isExecutive ? "rgba(255,255,255,0.5)" : isExpansion ? "#5a6b62" : "#6b7280";
  const sectionBorder = isExecutive ? "border-white/[0.06]" : isExpansion ? "border-[#e8e0d8]" : "border-border";
  const cardBg = isExecutive ? "bg-card/[0.03]" : "bg-card";
  const cardBorder = isExecutive ? "border-white/[0.06]" : isExpansion ? "border-[#e8e0d8]" : "border-border";

  return (
    <div
      className="min-h-[600px] rounded-xl overflow-hidden border border-white/10 text-sm"
      style={{ backgroundColor: bg, color: textColor, fontFamily: cfg.typography.bodyFont || "system-ui" }}
    >
      {/* NAV */}
      <nav
        className="sticky top-0 z-10 backdrop-blur-md border-b px-4 h-10 flex items-center justify-between"
        style={{
          backgroundColor: isExecutive ? `${primaryColor}e6` : "rgba(255,255,255,0.95)",
          borderColor: isExecutive ? "rgba(255,255,255,0.06)" : "#f3f4f6",
        }}
      >
        <img src={isExecutive ? dandyLogoWhite : dandyLogo} alt="Dandy" className="h-3" />
        <div className="flex items-center gap-2">
          {isExpansion && (
            <span className="px-2 py-0.5 rounded text-[9px] font-medium border text-muted-foreground border-border">GET PRICING</span>
          )}
          <EditableButton
            text={cfg.navCTAText}
            onTextChange={(v) => onUpdateButtonText("navCTAText", v)}
            linkUrl={cfg.navCTAUrl || cfg.ctaUrl}
            onLinkChange={(v) => onUpdateButtonUrl("navCTAUrl", v)}
            videoUrl={cfg.navCTAVideoUrl}
            onVideoChange={(v) => onUpdateVideoUrl("navCTAVideoUrl", v)}
            style={{ backgroundColor: isExpansion ? "#0a3d2d" : accentColor, color: isExpansion ? "#ffffff" : primaryColor }}
            className={`px-3 py-1 ${isExpansion ? "rounded-full" : "rounded"} text-[10px] font-semibold inline-block`}
          />
        </div>
      </nav>

      {/* HERO */}
      {visibleSections.has("hero") && !isExpansion && (
        <section className="relative min-h-[280px] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
            <img src={heroImage} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ backgroundColor: `${primaryColor}bf` }} />
          </div>
          <div className="relative z-10 text-center px-6 py-12 max-w-2xl mx-auto">
            <EditableText
              tag="h1"
              value={heroPattern}
              onChange={(v) => {
                onUpdateHeroPattern(v.replace(MOCK_COMPANY, "{company}"));
              }}
              className="text-2xl md:text-3xl font-normal leading-tight mb-3 text-white"
              style={{ fontFamily }}
            />
            <EditableText
              tag="p"
              value={heroSubtext}
              onChange={(v) => onUpdateHeroSubtext(v.replace(MOCK_COMPANY, "{company}"))}
              className="text-xs text-white/60 mb-4 max-w-md mx-auto"
            />
            <div className="flex gap-2 justify-center">
              <EditableButton
                text={cfg.heroCTAText}
                onTextChange={(v) => onUpdateButtonText("heroCTAText", v)}
                linkUrl={cfg.heroCTAUrl || cfg.ctaUrl}
                onLinkChange={(v) => onUpdateButtonUrl("heroCTAUrl", v)}
                videoUrl={cfg.heroCTAVideoUrl}
                onVideoChange={(v) => onUpdateVideoUrl("heroCTAVideoUrl", v)}
                style={{ backgroundColor: accentColor, color: primaryColor }}
                className="px-4 py-1.5 rounded text-[10px] font-semibold inline-block"
              />
              <EditableButton
                text={cfg.secondaryCTAText}
                onTextChange={(v) => onUpdateButtonText("secondaryCTAText", v)}
                linkUrl={cfg.secondaryCTAUrl || cfg.ctaUrl}
                onLinkChange={(v) => onUpdateButtonUrl("secondaryCTAUrl", v)}
                videoUrl={cfg.secondaryCTAVideoUrl}
                onVideoChange={(v) => onUpdateVideoUrl("secondaryCTAVideoUrl", v)}
                className="px-4 py-1.5 rounded text-[10px] font-semibold border border-white/20 text-white/80 inline-block"
              />
            </div>
          </div>
        </section>
      )}

      {/* EXPANSION HERO — centered dark green like meetdandy.com */}
      {visibleSections.has("hero") && isExpansion && (() => {
        const BRAND = "#0a3d2d";
        const LIME = "#c2e53a";
        const expCfg = cfg as any;
        const teamMembers: ExpansionTeamMember[] = (expCfg.teamMembers || []).slice(0, 3);
        const perks: ExpansionPerk[] = expCfg.perks || [];
        const promos: ExpansionPromo[] = expCfg.promos || [];
        const contentLinks: ExpansionContentLink[] = expCfg.contentLinks || [];
        const activationSteps = expCfg.activationSteps || [];
        const PERK_ICONS_MAP: Record<string, typeof Star> = { star: Star, zap: Zap, shield: Shield, trending: TrendingUp, award: Award, gift: Gift, users: Users, sparkles: Sparkles };
        const CONTENT_ICONS: Record<string, typeof Video> = { video: Video, pdf: FileText, article: BookOpen, webinar: Headphones };
        const PROMISE_ICONS: Record<string, typeof Ban> = { ban: Ban, rotate: RotateCcw, shieldCheck: ShieldCheck };
        const expansionStats = expCfg.expansionStatsBar || [
          { value: "6,000+", label: "dental practices" },
          { value: "96%", label: "first-time fit rate" },
          { value: "5 Days", label: "crown turnaround" },
        ];
        const featureBlocks = expCfg.featureBlocks || [
          { label: "CASE ACCEPTANCE", title: "Boost case acceptance", desc: "Scan and show patients their future smile in the chair." },
          { label: "QUALITY ASSURANCE", title: "Reduce remakes and rework", desc: "AI Scan Review catches issues the human eye can't see." },
          { label: "ZERO CAPEX", title: "Go digital without the cost", desc: "Premium scanner included as part of your partnership." },
        ];
        const oldWayItems = expCfg.oldWayItems || ["Remake-prone analog workflows", "Annoying calls saying your scan is bad", "Cross your fingers the case looks right"];
        const newWayItems = expCfg.newWayItems || ["Scan for everything with fewer remakes", "AI reviews your scans with patient still in chair", "3D design approval — no surprises"];
        const products: ExpansionProduct[] = expCfg.products || [
          { icon: "crown", imageKey: "posterior-crowns", name: "Posterior Crowns", detail: "AI-perfected, 5-day turnaround", price: "From $99/unit" },
          { icon: "crown", imageKey: "anterior-crowns", name: "Anterior Crowns", detail: "Stunning aesthetics", price: "Premium materials" },
          { icon: "crown", imageKey: "dentures", name: "Dentures", detail: "2-appointment digital workflow", price: "From $199/arch" },
          { icon: "crown", imageKey: "implants", name: "Implant Restorations", detail: "FDA-approved", price: "All systems" },
        ];
        const promises: ExpansionPromise[] = expCfg.promises || [
          { icon: "ban", title: "Zero Long-Term Contracts", desc: "Simple, transparent pricing." },
          { icon: "rotate", title: "Free No-Hassle Remakes", desc: "If it doesn't fit, we'll make it right." },
          { icon: "shieldCheck", title: "10-Year Warranty", desc: "Every restoration is backed." },
        ];
        const testimonials: ExpansionTestimonial[] = expCfg.testimonials || [
          { quote: "Dandy's customer service is outstanding!", author: "Brightwhites PC", location: "Virginia" },
          { quote: "Dandy has way more training than any other lab.", author: "Dr. Charlie Lucero", location: "WA" },
          { quote: "I love the ability to chat and message the lab.", author: "Dr. Sarah Mitchell", location: "TX" },
        ];
        const defaultFeatureImages = [dandySmileSimulation, aiScanReview, dandyScannerPractice];

        return (
          <>
            {/* 1. Hero */}
            <section className="relative overflow-hidden" style={{ backgroundColor: BRAND }}>
              <div className="absolute inset-0 opacity-20">
                <img src={crownBridgeHero} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-[#0a3d2d]/40 via-transparent to-[#0a3d2d]/60" />
              <div className="relative z-10 text-center px-6 pt-12 pb-8 max-w-xl mx-auto">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/10 text-[8px] font-semibold text-white/80 mb-4 border border-white/10 uppercase tracking-wider">
                  <Sparkles className="w-2.5 h-2.5" style={{ color: LIME }} /> {MOCK_COMPANY.toUpperCase()} PARTNER PORTAL
                </div>
                <EditableText
                  tag="h1"
                  value={heroPattern}
                  onChange={(v) => onUpdateHeroPattern(v.replace(MOCK_COMPANY, "{company}"))}
                  className="text-xl md:text-2xl font-bold leading-tight mb-2 text-white"
                  style={{ fontFamily }}
                />
                <EditableText
                  tag="p"
                  value={heroSubtext}
                  onChange={(v) => onUpdateHeroSubtext(v.replace(MOCK_COMPANY, "{company}"))}
                  className="text-[10px] text-white/50 mb-4 max-w-md mx-auto"
                />
                <div className="flex gap-2 justify-center">
                  <EditableButton
                    text={cfg.heroCTAText}
                    onTextChange={(v) => onUpdateButtonText("heroCTAText", v)}
                    linkUrl={cfg.heroCTAUrl || cfg.ctaUrl}
                    onLinkChange={(v) => onUpdateButtonUrl("heroCTAUrl", v)}
                    videoUrl={cfg.heroCTAVideoUrl}
                    onVideoChange={(v) => onUpdateVideoUrl("heroCTAVideoUrl", v)}
                    style={{ backgroundColor: LIME, color: BRAND }}
                    className="px-4 py-1.5 rounded-full text-[10px] font-bold inline-block"
                  />
                  <EditableButton
                    text={cfg.secondaryCTAText}
                    onTextChange={(v) => onUpdateButtonText("secondaryCTAText", v)}
                    linkUrl={cfg.secondaryCTAUrl || cfg.ctaUrl}
                    onLinkChange={(v) => onUpdateButtonUrl("secondaryCTAUrl", v)}
                    videoUrl={cfg.secondaryCTAVideoUrl}
                    onVideoChange={(v) => onUpdateVideoUrl("secondaryCTAVideoUrl", v)}
                    className="px-4 py-1.5 rounded-full text-[10px] font-medium border border-white/20 text-white/80 inline-block"
                  />
                </div>
              </div>
              {/* Video embed placeholder */}
              <div className={`relative z-10 mx-auto px-6 pb-6 ${
                expCfg.heroVideoSize === "small" ? "max-w-xs" : expCfg.heroVideoSize === "large" ? "max-w-lg" : "max-w-sm"
              }`}>
                <div className="rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                  <Play className="w-8 h-8 text-white/30" />
                </div>
              </div>
            </section>

            {/* 2. Stats Bar */}
            {visibleSections.has("statsBar") && (
              <section className="border-y border-border bg-muted/40 py-4">
                <div className="max-w-xl mx-auto px-6 grid grid-cols-3 gap-4 text-center">
                  {expansionStats.map((s: { value: string; label: string }, i: number) => (
                    <div key={i}>
                      <p className="text-sm font-bold" style={{ color: BRAND }}>{s.value}</p>
                      <p className="text-[7px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Old Way vs New Way (Paradigm Shift) */}
            {visibleSections.has("paradigmShift") && (
              <section className="py-8" style={{ backgroundColor: "#f8f7f4" }}>
                <div className="max-w-xl mx-auto px-6">
                  <div className="text-center mb-4">
                    <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>A PARADIGM SHIFT</p>
                    <h2 className="text-base font-bold" style={{ color: BRAND }}>{expCfg.paradigmShiftHeadline || "Traditional labs weren't built for today's dentistry."}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-card border border-border">
                      <div className="px-1.5 py-0.5 rounded-full bg-muted/50 text-[7px] font-bold text-muted-foreground uppercase tracking-wider inline-block mb-2">Old Way</div>
                      <ul className="space-y-1.5">
                        {oldWayItems.slice(0, 3).map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <X className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                            <span className="text-[8px] text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-lg border-2" style={{ backgroundColor: `${BRAND}08`, borderColor: `${BRAND}30` }}>
                      <div className="px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider text-white inline-block mb-2" style={{ backgroundColor: BRAND }}>New Way</div>
                      <ul className="space-y-1.5">
                        {newWayItems.slice(0, 3).map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" style={{ color: BRAND }} />
                            <span className="text-[8px]" style={{ color: BRAND }}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 4. Why Dandy feature blocks */}
            {visibleSections.has("features") && (
              <section className="py-8 bg-card">
                <div className="max-w-xl mx-auto px-6 text-center mb-6">
                  <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>WHY DANDY</p>
                  <h2 className="text-base font-bold" style={{ color: BRAND }}>{expCfg.whyDandyHeadline || "Better outcomes. Less chair time."}</h2>
                  <p className="text-[8px] text-muted-foreground mt-1">{expCfg.whyDandySubheadline || ""}</p>
                </div>
                <div className="max-w-xl mx-auto px-6 space-y-4">
                  {featureBlocks.map((block: any, i: number) => {
                    const imgSrc = block.imageUrl || defaultFeatureImages[i % defaultFeatureImages.length];
                    return (
                      <div key={i} className="grid grid-cols-2 gap-3 items-center">
                        {i % 2 === 0 ? (
                          <>
                            <div>
                              <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: BRAND }}>{block.label}</p>
                              <h3 className="text-xs font-bold mb-0.5" style={{ color: BRAND }}>{block.title}</h3>
                              <p className="text-[9px] text-muted-foreground">{block.desc}</p>
                            </div>
                            <img src={imgSrc} alt={block.title} className="rounded-lg h-16 w-full object-cover" />
                          </>
                        ) : (
                          <>
                            <img src={imgSrc} alt={block.title} className="rounded-lg h-16 w-full object-cover" />
                            <div>
                              <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: BRAND }}>{block.label}</p>
                              <h3 className="text-xs font-bold mb-0.5" style={{ color: BRAND }}>{block.title}</h3>
                              <p className="text-[9px] text-muted-foreground">{block.desc}</p>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 5. Products */}
            {visibleSections.has("products") && (
              <section className="py-8 bg-card">
                <div className="max-w-xl mx-auto px-6 text-center mb-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>PRODUCTS</p>
                  <h2 className="text-base font-bold" style={{ color: BRAND }}>{expCfg.productsHeadline || "One lab for everything your practice needs."}</h2>
                </div>
                <div className="max-w-xl mx-auto px-6 grid grid-cols-4 gap-2">
                  {products.slice(0, 4).map((product: ExpansionProduct, i: number) => (
                    <div key={i} className="rounded-lg bg-muted/30 border border-border overflow-hidden">
                      <div className="aspect-[4/3] w-full flex items-center justify-center bg-muted/50">
                        <Crown className="w-4 h-4 text-gray-300" />
                      </div>
                      <div className="p-2">
                        <h3 className="text-[8px] font-bold" style={{ color: BRAND }}>{product.name}</h3>
                        <p className="text-[7px] text-muted-foreground">{product.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 6. Promises & Guarantees */}
            {visibleSections.has("promises") && (
              <section className="py-8" style={{ backgroundColor: "#f8f7f4" }}>
                <div className="max-w-xl mx-auto px-6 text-center mb-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>OUR PROMISES</p>
                  <h2 className="text-base font-bold" style={{ color: BRAND }}>{expCfg.promisesHeadline || "Built on trust. Backed by guarantees."}</h2>
                </div>
                <div className="max-w-xl mx-auto px-6 grid grid-cols-3 gap-2">
                  {promises.map((promise: ExpansionPromise, i: number) => {
                    const PromiseIcon = PROMISE_ICONS[promise.icon] || Ban;
                    return (
                      <div key={i} className="text-center p-3 rounded-lg bg-card border border-border">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center mx-auto mb-1.5" style={{ backgroundColor: `${BRAND}10` }}>
                          <PromiseIcon className="w-3 h-3" style={{ color: BRAND }} />
                        </div>
                        <h3 className="text-[9px] font-bold mb-0.5" style={{ color: BRAND }}>{promise.title}</h3>
                        <p className="text-[7px] text-muted-foreground">{promise.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 7. Testimonials */}
            {visibleSections.has("testimonials") && (
              <section className="py-8" style={{ backgroundColor: BRAND }}>
                <div className="max-w-xl mx-auto px-6 text-center mb-4">
                  <p className="text-[8px] font-semibold uppercase tracking-wider mb-1" style={{ color: LIME }}>TESTIMONIALS</p>
                  <h2 className="text-base font-bold text-white">{expCfg.testimonialsHeadline || "Don't just take our word for it."}</h2>
                </div>
                <div className="max-w-xl mx-auto px-6 grid grid-cols-3 gap-2">
                  {testimonials.map((t: ExpansionTestimonial, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-card/[0.05] border border-white/[0.08]">
                      <Quote className="w-3 h-3 mb-1.5 opacity-30" style={{ color: LIME }} />
                      <p className="text-[8px] text-white/70 leading-relaxed italic">"{t.quote}"</p>
                      <div className="mt-2 pt-1.5 border-t border-white/[0.08]">
                        <p className="text-[8px] font-bold text-white">{t.author}</p>
                        <p className="text-[7px] text-white/40">{t.location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 8. Team */}
            {visibleSections.has("team") && teamMembers.length > 0 && (
              <section className="py-8 bg-card">
                <div className="max-w-xl mx-auto px-6 text-center mb-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>YOUR DEDICATED TEAM</p>
                  <h2 className="text-base font-bold" style={{ color: BRAND }}>Meet the team behind your partnership</h2>
                  <p className="text-[8px] text-muted-foreground mt-1">Here to ensure every practice in {MOCK_COMPANY} has an exceptional experience.</p>
                </div>
                <div className="max-w-xl mx-auto px-6 flex flex-wrap justify-center gap-3">
                  {teamMembers.map((m, i) => (
                    <div key={i} className="w-[140px] p-3 rounded-lg bg-muted/30 border border-border text-center">
                      {m.photo ? (
                        <img src={m.photo} alt={m.name} className="w-10 h-10 rounded-full mx-auto mb-2 object-cover ring-1 ring-gray-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-gray-200" style={{ backgroundColor: BRAND }}>
                          {m.name.split(" ").map(n => n[0]).join("")}
                        </div>
                      )}
                      <h3 className="text-[10px] font-bold" style={{ color: BRAND }}>{m.name}</h3>
                      <p className="text-[8px] text-muted-foreground">{m.role}</p>
                      <div className="flex items-center justify-center gap-1 mt-1.5">
                        {m.email && <div className="p-1 rounded bg-muted/50 border border-border"><Mail className="w-2.5 h-2.5 text-muted-foreground/70" /></div>}
                        {m.calendlyUrl && <div className="p-1 rounded bg-muted/50 border border-border"><Calendar className="w-2.5 h-2.5 text-muted-foreground/70" /></div>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Rep contact banner */}
                <div className="max-w-xl mx-auto px-6 mt-4">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[10px] font-bold" style={{ color: BRAND }}>Need to reach {expCfg.repName || "Your Rep"}?</h3>
                      <p className="text-[8px] text-muted-foreground">{expCfg.repTitle || "Enterprise Account Executive"}</p>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[8px] font-bold shrink-0 text-white" style={{ backgroundColor: BRAND }}>
                      <Phone className="w-2.5 h-2.5" /> Book a Call
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 9. Perks */}
            {visibleSections.has("perks") && perks.length > 0 && (
              <section className="py-8" style={{ backgroundColor: "#f8f7f4" }}>
                <div className="max-w-xl mx-auto px-6 text-center mb-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>PARTNERSHIP PERKS</p>
                  <h2 className="text-base font-bold" style={{ color: BRAND }}>What's included</h2>
                </div>
                <div className="max-w-xl mx-auto px-6 flex flex-wrap justify-center gap-2">
                  {perks.slice(0, 3).map((perk, i) => {
                    const Icon = PERK_ICONS_MAP[perk.icon] || Star;
                    return (
                      <div key={i} className="w-[140px] p-3 rounded-lg bg-card border border-border">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center mb-1.5" style={{ backgroundColor: `${BRAND}10` }}>
                          <Icon className="w-3 h-3" style={{ color: BRAND }} />
                        </div>
                        <h3 className="text-[10px] font-bold mb-0.5" style={{ color: BRAND }}>{perk.title}</h3>
                        <p className="text-[8px] text-muted-foreground leading-relaxed">{perk.desc.slice(0, 60)}…</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 10. Promos */}
            {visibleSections.has("promos") && promos.length > 0 && (
              <section className="py-8 bg-card">
                <div className="max-w-xl mx-auto px-6 text-center mb-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>EXCLUSIVE OFFERS</p>
                  <h2 className="text-base font-bold" style={{ color: BRAND }}>Promotions for {MOCK_COMPANY}</h2>
                </div>
                <div className="max-w-xl mx-auto px-6 flex flex-wrap justify-center gap-2">
                  {promos.slice(0, 2).map((promo, i) => (
                    <div key={i} className="relative w-[180px] p-3 rounded-lg bg-muted/30 border border-border">
                      {promo.badge && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[6px] font-bold uppercase text-white" style={{ backgroundColor: BRAND }}>{promo.badge}</span>
                      )}
                      <Gift className="w-3.5 h-3.5 mb-1.5" style={{ color: BRAND }} />
                      <h3 className="text-[10px] font-bold mb-0.5" style={{ color: BRAND }}>{promo.title}</h3>
                      <p className="text-[8px] text-muted-foreground">{promo.desc.slice(0, 60)}…</p>
                      {promo.ctaText && (
                        <p className="text-[8px] font-semibold mt-1.5 flex items-center gap-0.5" style={{ color: BRAND }}>
                          {promo.ctaText} <ArrowRight className="w-2.5 h-2.5" />
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 11. Activation Steps */}
            {visibleSections.has("activation") && activationSteps.length > 0 && (
              <section className="py-8" style={{ backgroundColor: "#f8f7f4" }}>
                <div className="max-w-xl mx-auto px-6 text-center mb-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>GET STARTED</p>
                  <h2 className="text-base font-bold" style={{ color: BRAND }}>{activationSteps.length} steps to go live</h2>
                </div>
                <div className="max-w-xl mx-auto px-6 flex flex-wrap justify-center gap-2">
                  {activationSteps.map((step: any, i: number) => (
                    <div key={i} className="w-[100px] p-3 rounded-lg bg-card border border-border">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white mb-2" style={{ backgroundColor: BRAND }}>{step.step}</div>
                      <h3 className="text-[10px] font-bold mb-0.5" style={{ color: BRAND }}>{step.title}</h3>
                      <p className="text-[8px] text-muted-foreground">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 12. Resources */}
            {visibleSections.has("resources") && contentLinks.length > 0 && (
              <section className="py-8 bg-card">
                <div className="max-w-xl mx-auto px-6 text-center mb-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND }}>RESOURCES</p>
                  <h2 className="text-base font-bold" style={{ color: BRAND }}>Everything your team needs</h2>
                </div>
                <div className="max-w-xl mx-auto px-6 grid grid-cols-4 gap-2">
                  {contentLinks.slice(0, 4).map((link, i) => {
                    const Icon = CONTENT_ICONS[link.type] || FileText;
                    return (
                      <div key={i} className="rounded-lg bg-muted/30 border border-border overflow-hidden">
                        {link.imageUrl ? (
                          <div className="aspect-[4/3] w-full overflow-hidden">
                            <img src={link.imageUrl} alt={link.title} className="w-full h-full object-cover object-center" />
                          </div>
                        ) : (
                          <div className="aspect-[4/3] w-full flex items-center justify-center bg-muted/50">
                            <Icon className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        <div className="p-2">
                          <span className="text-[6px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND}10`, color: BRAND }}>{link.type}</span>
                          <h3 className="text-[9px] font-bold mt-0.5" style={{ color: BRAND }}>{link.title}</h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 13. Practice Signup */}
            {visibleSections.has("signup") && (
              <section className="py-8" style={{ backgroundColor: BRAND }}>
                <div className="max-w-xl mx-auto px-5 grid grid-cols-2 gap-5 items-center">
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-wider mb-2" style={{ color: LIME }}>{expCfg.signupLabel || "ACTIVATE YOUR PRACTICE"}</p>
                    <h2 className="text-sm font-bold text-white mb-2">{expCfg.signupHeadline || "Get Started With Dandy"}</h2>
                    <p className="text-[9px] text-white/50">{expCfg.signupSubheadline || "Enter your email and book a time with your dedicated team."}</p>
                  </div>
                  <div className="bg-card rounded-xl p-3 shadow-xl space-y-1.5">
                    <div className="text-center mb-1">
                      <h3 className="text-[10px] font-bold" style={{ color: BRAND }}>{expCfg.signupFormTitle || "Book a Meeting"}</h3>
                      <p className="text-[7px] text-muted-foreground">{expCfg.signupFormSubtitle || "Enter your email to get started"}</p>
                    </div>
                    <div>
                      <label className="text-[8px] font-medium text-muted-foreground block mb-0.5">Work Email</label>
                      <div className="h-5 rounded border border-border bg-muted/30" />
                    </div>
                    <button className="w-full mt-1 px-3 py-1.5 rounded-full text-[9px] font-semibold text-white flex items-center justify-center gap-1" style={{ backgroundColor: BRAND }}>
                      <ArrowRight className="w-2.5 h-2.5" /> {expCfg.signupButtonText || "Activate My Practice"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* 14. Final CTA */}
            {visibleSections.has("finalCTA") && (
              <section className="py-8" style={{ backgroundColor: BRAND }}>
                <div className="max-w-xl mx-auto px-6 text-center">
                  <EditableText
                    value={(cfg.finalCTAHeadline || "A better way to do lab work.").replace(/\{company\}/g, MOCK_COMPANY)}
                    onChange={(v) => onUpdateFinalCTAHeadline(v.replace(MOCK_COMPANY, "{company}"))}
                    className="text-base font-bold leading-tight mb-2 text-white"
                    style={{ fontFamily }}
                  />
                  <EditableText
                    tag="p"
                    value={(cfg.finalCTASubheadline || "Join thousands of dental practices.").replace(/\{company\}/g, MOCK_COMPANY)}
                    onChange={(v) => onUpdateFinalCTASubheadline(v.replace(MOCK_COMPANY, "{company}"))}
                    className="text-[10px] text-white/50 mb-4 max-w-sm mx-auto"
                  />
                  <div className="flex gap-2 justify-center">
                    <EditableButton
                      text="GET STARTED TODAY"
                      onTextChange={(v) => onUpdateButtonText("heroCTAText", v)}
                      linkUrl={cfg.finalCTAUrl || cfg.ctaUrl}
                      onLinkChange={(v) => onUpdateButtonUrl("finalCTAUrl", v)}
                      videoUrl={cfg.finalCTAVideoUrl}
                      onVideoChange={(v) => onUpdateVideoUrl("finalCTAVideoUrl", v)}
                      style={{ backgroundColor: LIME, color: BRAND }}
                      className="px-4 py-1.5 rounded-full text-[10px] font-bold inline-block"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Footer */}
            <footer className="border-t border-border py-4 bg-card">
              <div className="max-w-xl mx-auto px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={dandyLogo} alt="Dandy" className="h-2.5 opacity-40" />
                  <span className="text-[7px] text-muted-foreground/70">{MOCK_COMPANY} Partner Portal</span>
                </div>
                <p className="text-[7px] text-muted-foreground/70">{cfg.footerText}</p>
              </div>
            </footer>
          </>
        );
      })()}

      {/* STATS BAR (solutions only) */}
      {visibleSections.has("statsBar") && !isExecutive && !isExpansion && (
        <section className="bg-card border-b border-border py-6">
          <div className="max-w-2xl mx-auto px-4 grid grid-cols-4 gap-4">
            {cfg.statsBar.slice(0, 4).map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-lg font-bold" style={{ color: primaryColor }}>{stat.value}</p>
                <p className="text-[9px] text-muted-foreground/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HIDDEN COST / CHALLENGES */}
      {(visibleSections.has("hiddenCost") || visibleSections.has("challenges")) && !isExpansion && (
        <section className={`py-12 border-t ${sectionBorder}`} style={{ backgroundColor: isExecutive ? primaryColor : "#f9fafb" }}>
          <div className="max-w-2xl mx-auto px-6 text-center">
            <EditableText
              value={sectionHeadline(isExecutive ? "hiddenCost" : "challenges", "At scale — even small inefficiencies compound fast.")}
              onChange={(v) => onUpdateHeadline(isExecutive ? "hiddenCost" : "challenges", v.replace(MOCK_COMPANY, "{company}"))}
              className={`${headlineSizeCls} ${headlineWeight} leading-tight mb-2`}
              style={{ fontFamily, color: textColor, fontSize: "1.25rem" }}
            />
            <EditableText
              tag="p"
              value={sectionSubheadline(isExecutive ? "hiddenCost" : "challenges", "Hidden inefficiencies erode margins across every location.")}
              onChange={(v) => onUpdateSubheadline(isExecutive ? "hiddenCost" : "challenges", v.replace(MOCK_COMPANY, "{company}"))}
              className="text-[10px] leading-relaxed mb-8 max-w-lg mx-auto"
              style={{ color: subtextColor }}
            />
          </div>
          <div className="max-w-2xl mx-auto px-6 grid grid-cols-2 gap-3">
            {displayChallenges.map((c, i) => {
              const Icon = [TrendingUp, BarChart3, Users, Layers][i % 4];
              return (
                <div key={i} className={`p-4 rounded-xl ${cardBg} border ${cardBorder}`}>
                  <Icon className="w-4 h-4 mb-2" style={{ color: accentColor }} />
                  <h3 className="text-xs font-bold mb-1" style={{ color: textColor }}>{c.title}</h3>
                  <p className="text-[10px] leading-relaxed" style={{ color: subtextColor }}>{c.desc.slice(0, 80)}…</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* COMPARISON */}
      {visibleSections.has("comparison") && !isExpansion && (
        <section className={`py-12 border-t ${sectionBorder}`} style={{ backgroundColor: isExecutive ? primaryColor : "#ffffff" }}>
          <div className="max-w-2xl mx-auto px-6 text-center mb-6">
            <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: accentColor }}>The Dandy Difference</span>
            <EditableText
              value={sectionHeadline("comparison", "Lab consolidation shouldn't mean compromise")}
              onChange={(v) => onUpdateHeadline("comparison", v.replace(MOCK_COMPANY, "{company}"))}
              className={`${headlineWeight} leading-tight mt-2`}
              style={{ fontFamily, color: textColor, fontSize: "1.125rem" }}
            />
            <EditableText
              tag="p"
              value={sectionSubheadline("comparison", "See how Dandy compares to traditional lab networks across the metrics that matter.")}
              onChange={(v) => onUpdateSubheadline("comparison", v.replace(MOCK_COMPANY, "{company}"))}
              className="text-[10px] leading-relaxed mt-2 max-w-lg mx-auto"
              style={{ color: subtextColor }}
            />
          </div>
          <div className="max-w-2xl mx-auto px-6">
            <div className={`rounded-xl overflow-hidden border ${cardBorder}`} style={{ backgroundColor: isExecutive ? "rgba(255,255,255,0.03)" : "#fff" }}>
              <div className="grid grid-cols-3" style={{ backgroundColor: isExecutive ? "rgba(255,255,255,0.05)" : primaryColor }}>
                <div className="px-3 py-2 text-[9px] font-semibold" style={{ color: isExecutive ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.6)" }}>Need</div>
                <div className="px-3 py-2 text-[9px] font-semibold" style={{ color: accentColor }}>Dandy</div>
                <div className="px-3 py-2 text-[9px] font-semibold" style={{ color: isExecutive ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.4)" }}>Traditional</div>
              </div>
              {displayComparison.map((row, i) => (
                <div key={i} className={`grid grid-cols-3 border-t ${isExecutive ? "border-white/[0.06]" : "border-border"}`}>
                  <div className="px-3 py-2 text-[10px] font-medium">{row.need}</div>
                  <div className="px-3 py-2 text-[10px]" style={{ color: subtextColor }}>{row.dandy}</div>
                  <div className="px-3 py-2 text-[10px]" style={{ color: isExecutive ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>{row.traditional}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AI SCAN REVIEW */}
      {visibleSections.has("aiScanReview") && !isExpansion && (
        <section className={`py-12 border-t ${sectionBorder}`} style={{ backgroundColor: isExecutive ? primaryColor : "#f9fafb" }}>
          <div className="max-w-2xl mx-auto px-6 text-center mb-6">
            <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: isExecutive ? "rgba(255,255,255,0.4)" : accentColor }}>Waste Prevention</span>
            <EditableText
              value={sectionHeadline("aiScanReview", "Remakes are a tax. AI eliminates them.")}
              onChange={(v) => onUpdateHeadline("aiScanReview", v.replace(MOCK_COMPANY, "{company}"))}
              className={`${headlineWeight} leading-tight mt-2 mb-2`}
              style={{ fontFamily, color: textColor, fontSize: "1.125rem" }}
            />
            <EditableText
              tag="p"
              value={sectionSubheadline("aiScanReview", "AI-powered scan review catches issues before they become remakes.")}
              onChange={(v) => onUpdateSubheadline("aiScanReview", v.replace(MOCK_COMPANY, "{company}"))}
              className="text-[10px] leading-relaxed mb-6 max-w-lg mx-auto"
              style={{ color: subtextColor }}
            />
          </div>
          <div className="max-w-2xl mx-auto px-6 grid grid-cols-2 gap-6 items-center">
            <div className="space-y-2">
              {["AI reviews every scan", "Real-time feedback", "Eliminates remakes at source"].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
                  <p className="text-[10px]" style={{ color: subtextColor }}>{item}</p>
                </div>
              ))}
            </div>
            <div className={`rounded-xl overflow-hidden border ${cardBorder}`}>
              <img src={aiImage} alt="AI Scan Review" className="w-full h-auto" />
            </div>
          </div>
        </section>
      )}

      {/* SUCCESS STORIES */}
      {visibleSections.has("successStories") && !isExpansion && (
        <section className={`py-12 border-t ${sectionBorder}`} style={{ backgroundColor: isExecutive ? primaryColor : "#ffffff" }}>
          <div className="max-w-2xl mx-auto px-6 text-center mb-6">
            <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: isExecutive ? "rgba(255,255,255,0.4)" : accentColor }}>Proven Results</span>
            <EditableText
              value={sectionHeadline("successStories", "DSOs that switched and never looked back.")}
              onChange={(v) => onUpdateHeadline("successStories", v.replace(MOCK_COMPANY, "{company}"))}
              className={`${headlineWeight} leading-tight mt-2`}
              style={{ fontFamily, color: textColor, fontSize: "1.125rem" }}
            />
            <EditableText
              tag="p"
              value={sectionSubheadline("successStories", "Real results from dental groups using Dandy at scale.")}
              onChange={(v) => onUpdateSubheadline("successStories", v.replace(MOCK_COMPANY, "{company}"))}
              className="text-[10px] leading-relaxed mt-2 max-w-lg mx-auto"
              style={{ color: subtextColor }}
            />
          </div>
          <div className="max-w-2xl mx-auto px-6 grid grid-cols-3 gap-3">
            {displayCaseStudies.map((study, i) => {
              const defaultImg = [dentalCrowns, dandyDoctor, scannerSpeed][i % 3];
              const img = caseImages[i] || defaultImg;
              return (
                <div key={i} className={`rounded-xl border ${cardBorder} overflow-hidden ${isExecutive ? "bg-card/[0.02]" : "bg-card"}`}>
                  <div className="relative h-20 overflow-hidden">
                    <img src={img} alt={study.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${primaryColor}, transparent)` }} />
                    <p className="absolute bottom-1 left-2 text-[8px] font-semibold text-white/80 uppercase tracking-wider">{study.name}</p>
                  </div>
                  <div className="p-3">
                    <p className="text-lg font-bold" style={{ color: isExecutive ? accentColor : primaryColor }}>{study.stat}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: subtextColor }}>{study.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* PILOT APPROACH */}
      {visibleSections.has("pilotApproach") && !isExpansion && (
        <section className={`py-12 border-t ${sectionBorder}`} style={{ backgroundColor: isExecutive ? primaryColor : "#f9fafb" }}>
          <div className="max-w-2xl mx-auto px-6 text-center mb-6">
            <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: accentColor }}>How It Works</span>
            <EditableText
              value={sectionHeadline("pilotApproach", "Start small. Prove it out. Then scale.")}
              onChange={(v) => onUpdateHeadline("pilotApproach", v.replace(MOCK_COMPANY, "{company}"))}
              className={`${headlineWeight} leading-tight mt-2`}
              style={{ fontFamily, color: textColor, fontSize: "1.125rem" }}
            />
            <EditableText
              tag="p"
              value={sectionSubheadline("pilotApproach", "A proven rollout framework that minimizes risk and maximizes impact.")}
              onChange={(v) => onUpdateSubheadline("pilotApproach", v.replace(MOCK_COMPANY, "{company}"))}
              className="text-[10px] leading-relaxed mt-2 max-w-lg mx-auto"
              style={{ color: subtextColor }}
            />
          </div>
          <div className="max-w-2xl mx-auto px-6 grid grid-cols-3 gap-3">
            {["Launch a Pilot", "Validate Impact", "Scale With Confidence"].map((title, i) => (
              <div key={i} className={`p-4 rounded-xl ${cardBg} border ${cardBorder}`}>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>Step 0{i + 1}</span>
                <h3 className="text-xs font-bold mt-2" style={{ color: textColor }}>{title}</h3>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LAB TOUR */}
      {visibleSections.has("labTour") && !isExpansion && (
        <section className="relative">
          {labVideoUrl ? (
            <div className="w-full aspect-video">
              <iframe
                src={labVideoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/").replace("vimeo.com/", "player.vimeo.com/video/")}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Lab Tour Video"
              />
            </div>
          ) : (
            <div className="h-24 overflow-hidden">
              <img src={labImage} alt="Lab" className="w-full h-full object-cover object-[center_25%]" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30" />
            </div>
          )}
          <div className={`py-12 border-t ${sectionBorder}`} style={{ backgroundColor: primaryColor }}>
            <div className="max-w-2xl mx-auto px-6 text-center">
              <EditableText
                value={sectionHeadline("labTour", "See vertical integration in action.")}
                onChange={(v) => onUpdateHeadline("labTour", v.replace(MOCK_COMPANY, "{company}"))}
                className={`${headlineWeight} leading-tight text-white mb-4`}
                style={{ fontFamily, fontSize: "1.125rem" }}
              />
              <div className="grid grid-cols-4 gap-2 mt-6">
                {[
                  { icon: FlaskConical, label: "Materials Lab" },
                  { icon: Eye, label: "AI QC" },
                  { icon: Users, label: "U.S. Techs" },
                  { icon: MapPin, label: "Multi-site" },
                ].map((item, i) => (
                  <div key={i} className="p-2 rounded-lg bg-card/[0.05] border border-white/[0.08] text-center">
                    <item.icon className="w-3 h-3 mx-auto mb-1" style={{ color: accentColor }} />
                    <p className="text-[8px] text-white/60">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CALCULATOR placeholder */}
      {visibleSections.has("calculator") && !isExpansion && (
        <section className={`py-12 border-t ${sectionBorder}`} style={{ backgroundColor: isExecutive ? primaryColor : "#ffffff" }}>
          <div className="max-w-2xl mx-auto px-6 text-center">
            <EditableText
              value={sectionHeadline("calculator", "Calculate the cost of inaction.")}
              onChange={(v) => onUpdateHeadline("calculator", v.replace(MOCK_COMPANY, "{company}"))}
              className={`${headlineWeight} leading-tight mb-4`}
              style={{ fontFamily, color: textColor, fontSize: "1.125rem" }}
            />
            <div className={`rounded-xl border ${cardBorder} ${cardBg} p-6`}>
              <p className="text-[10px]" style={{ color: subtextColor }}>Interactive ROI Calculator preview</p>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {["$2.1M", "60%", "4,200 hrs"].map((v, i) => (
                  <div key={i} className={`p-3 rounded-lg ${isExecutive ? "bg-card/[0.03]" : "bg-muted/30"} border ${cardBorder} text-center`}>
                    <p className="text-sm font-bold" style={{ color: accentColor }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Old practice signup removed — expansion has its own above */}
      {false && isExpansion && (
        <section className="py-8" style={{ backgroundColor: "#0a3d2d" }}>
          <div className="max-w-2xl mx-auto px-5 grid grid-cols-2 gap-5 items-start">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-400 mb-2">ACTIVATE YOUR PRACTICE</p>
              <h2 className="text-sm font-bold text-white mb-2">Get Started With Dandy</h2>
              <p className="text-[9px] text-white/50">Behind every great dentist, is a great lab.</p>
            </div>
            <div className="bg-card rounded-xl p-3 shadow-xl space-y-1.5">
              {["Practice Name", "Your Name", "Email"].map((label) => (
                <div key={label}>
                  <label className="text-[8px] font-medium text-muted-foreground block mb-0.5">{label}</label>
                  <div className="h-5 rounded border border-border bg-muted/30" />
                </div>
              ))}
              <button className="w-full mt-1 px-3 py-1.5 rounded-lg text-[9px] font-semibold text-white" style={{ backgroundColor: accentColor }}>
                Let's Talk →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      {visibleSections.has("finalCTA") && !isExpansion && (
          <section className="py-12 relative overflow-hidden">
            <div className="absolute inset-0">
              <img src={finalImage} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ backgroundColor: `${primaryColor}f2` }} />
            </div>
            <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
              <EditableText
                value={(cfg.finalCTAHeadline || "Start with a few locations.").replace(/\{company\}/g, MOCK_COMPANY)}
                onChange={(v) => onUpdateFinalCTAHeadline(v.replace(MOCK_COMPANY, "{company}"))}
                className={`${headlineWeight} leading-tight text-white mb-3`}
                style={{ fontFamily, fontSize: "1.125rem" }}
              />
              <EditableText
                tag="p"
                value={(cfg.finalCTASubheadline || "We'll pilot at 5–10 offices…").replace(/\{company\}/g, MOCK_COMPANY)}
                onChange={(v) => onUpdateFinalCTASubheadline(v.replace(MOCK_COMPANY, "{company}"))}
                className="text-[10px] text-white/40 mb-4 max-w-md mx-auto"
              />
              <EditableButton
                text={`${cfg.heroCTAText} →`}
                onTextChange={(v) => onUpdateButtonText("heroCTAText", v.replace(/\s*→\s*$/, ""))}
                linkUrl={cfg.finalCTAUrl || cfg.ctaUrl}
                onLinkChange={(v) => onUpdateButtonUrl("finalCTAUrl", v)}
                videoUrl={cfg.finalCTAVideoUrl}
                onVideoChange={(v) => onUpdateVideoUrl("finalCTAVideoUrl", v)}
                style={{ backgroundColor: accentColor, color: primaryColor }}
                className="px-4 py-1.5 rounded text-[10px] font-semibold inline-block"
              />
            </div>
          </section>
      )}

      {/* CUSTOM SECTIONS */}
      {(cfg.customSections || []).map((sec, i) => {
        const altBg = i % 2 === 0;
        return (
          <section
            key={sec.id}
            className={`py-12 border-t ${sectionBorder}`}
            style={{ backgroundColor: isExecutive ? primaryColor : (altBg ? "#f9fafb" : "#ffffff") }}
          >
            <div className="max-w-2xl mx-auto px-6">
              {sec.layout === "centered" ? (
                <div className="text-center">
                  <EditableText
                    value={sec.headline}
                    onChange={(v) => {
                      const arr = [...(cfg.customSections || [])];
                      arr[i] = { ...arr[i], headline: v };
                      onUpdateCustomSections(arr);
                    }}
                    className={`${headlineWeight} leading-tight mb-3`}
                    style={{ fontFamily, color: textColor, fontSize: "1.125rem" }}
                  />
                  <EditableText
                    tag="p"
                    value={sec.body}
                    onChange={(v) => {
                      const arr = [...(cfg.customSections || [])];
                      arr[i] = { ...arr[i], body: v };
                      onUpdateCustomSections(arr);
                    }}
                    className="text-[10px] leading-relaxed max-w-lg mx-auto mb-4"
                    style={{ color: subtextColor }}
                  />
                  {sec.imageUrl && <img src={sec.imageUrl} alt="" className={`mx-auto rounded-xl border ${cardBorder} max-h-40 object-cover mb-4`} />}
                  {sec.buttonText && (
                    <button
                      style={{ backgroundColor: accentColor, color: primaryColor }}
                      className="px-4 py-1.5 rounded text-[10px] font-semibold"
                    >
                      {sec.buttonVideoUrl && <span className="mr-1">▶</span>}
                      {sec.buttonText}
                    </button>
                  )}
                </div>
              ) : (
                <div className={`grid grid-cols-2 gap-6 items-center ${sec.layout === "right-image" ? "" : ""}`}>
                  {sec.layout === "left-image" && sec.imageUrl && (
                    <img src={sec.imageUrl} alt="" className={`rounded-xl border ${cardBorder} w-full h-auto object-cover`} />
                  )}
                  <div className={sec.layout === "right-image" ? "order-1" : ""}>
                    <EditableText
                      tag="h3"
                      value={sec.headline}
                      onChange={(v) => {
                        const arr = [...(cfg.customSections || [])];
                        arr[i] = { ...arr[i], headline: v };
                        onUpdateCustomSections(arr);
                      }}
                      className={`${headlineWeight} leading-tight mb-2`}
                      style={{ fontFamily, color: textColor, fontSize: "1rem" }}
                    />
                    <EditableText
                      tag="p"
                      value={sec.body}
                      onChange={(v) => {
                        const arr = [...(cfg.customSections || [])];
                        arr[i] = { ...arr[i], body: v };
                        onUpdateCustomSections(arr);
                      }}
                      className="text-[10px] leading-relaxed mb-3"
                      style={{ color: subtextColor }}
                    />
                    {sec.buttonText && (
                      <button
                        style={{ backgroundColor: accentColor, color: primaryColor }}
                        className="px-4 py-1.5 rounded text-[10px] font-semibold"
                      >
                        {sec.buttonVideoUrl && <span className="mr-1">▶</span>}
                        {sec.buttonText}
                      </button>
                    )}
                  </div>
                  {sec.layout === "right-image" && sec.imageUrl && (
                    <img src={sec.imageUrl} alt="" className={`rounded-xl border ${cardBorder} w-full h-auto object-cover order-2`} />
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* FOOTER */}
      <footer className={`border-t ${sectionBorder} py-4`} style={{ backgroundColor: isExecutive ? primaryColor : "#ffffff" }}>
        <div className="max-w-2xl mx-auto px-6 flex items-center justify-between">
          <img src={isExecutive ? dandyLogoWhite : dandyLogo} alt="Dandy" className="h-2.5 opacity-40" />
          <p className="text-[9px]" style={{ color: isExecutive ? "rgba(255,255,255,0.2)" : "#d1d5db" }}>{cfg.footerText}</p>
        </div>
      </footer>

      {/* Video Modal */}
      {videoModalUrl && <VideoModal url={videoModalUrl} onClose={() => setVideoModalUrl(null)} />}
    </div>
  );
};

export default MicrositeLivePreview;