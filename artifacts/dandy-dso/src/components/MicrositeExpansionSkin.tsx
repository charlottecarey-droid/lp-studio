import { useRef, useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Calendar, CheckCircle2, Gift, Mail,
  FileText, Video, BookOpen, Headphones, Users, Star,
  Zap, Shield, TrendingUp, Award, Phone, ExternalLink,
  Sparkles, ChevronRight, ChevronLeft, Loader2, Play, X, ChevronDown,
  Crown, Stethoscope, Scan, Moon, SmilePlus, Target, Quote, Ban, RotateCcw, ShieldCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMicrositeTracking } from "@/hooks/use-microsite-tracking";
import dandyLogo from "@/assets/dandy-logo.svg";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import crownBridgeHero from "@/assets/crown-bridge-hero.webp";
import dandyScannerWelcome from "@/assets/dandy-scanner-welcome.jpg";
import dandySmileSimulation from "@/assets/dandy-smile-simulation.jpg";
import dandyScannerPractice from "@/assets/dandy-scanner-practice.jpg";
import dandyPracticeDentist from "@/assets/dandy-practice-dentist.png";
import aiScanReview from "@/assets/ai-scan-review.jpg";
import dandyLabMachines from "@/assets/dandy-lab-crown-machine.webp";
import productDentures from "@/assets/dandy-product-dentures.webp";
import productPosteriorCrowns from "@/assets/dandy-product-posterior-crowns.webp";
import productAnteriorCrowns from "@/assets/dandy-product-anterior-crowns.webp";
import productImplants from "@/assets/dandy-product-implants.webp";
import productGuidedSurgery from "@/assets/dandy-product-guided-surgery.webp";
import productAligners from "@/assets/dandy-product-aligners.webp";
import productGuards from "@/assets/dandy-product-guards.webp";
import productSleep from "@/assets/dandy-product-sleep.webp";
import { ExpansionSkinConfig } from "@/lib/microsite-skin-config";

/* ── CTA helper ── */
const isVideoUrl = (url: string) => /youtube\.com|youtu\.be|vimeo\.com|loom\.com|wistia\.com/i.test(url);
const isAnchorUrl = (url: string) => url.startsWith("#");
const toEmbedUrl = (url: string) =>
  url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/").replace("vimeo.com/", "player.vimeo.com/video/");

/* ── Video Modal ── */
const VideoModal = ({ url, onClose }: { url: string; onClose: () => void }) => (
  <AnimatePresence>
    {url && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute -top-10 right-0 z-10 text-white hover:text-white/80" aria-label="Close video">
            <X className="w-6 h-6" />
          </button>
          <iframe src={toEmbedUrl(url) + (url.includes("?") ? "&" : "?") + "autoplay=1&rel=0"} title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ── Booking Iframe Modal ── */
const BookingModal = ({ url, onClose }: { url: string; onClose: () => void }) => (
  <AnimatePresence>
    {url && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl" style={{ height: "85vh" }} onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors" aria-label="Close booking">
            <X className="w-5 h-5 text-gray-600" />
          </button>
          <iframe src={url} title="Book a Meeting" className="w-full h-full border-0" allow="camera; microphone" />
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

type BriefingData = {
  companyName: string;
  overview: string;
  tier: string;
  dandyFitAnalysis: {
    primaryValueProp: string;
    keyPainPoints: string[];
    relevantProofPoints: string[];
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
  };
};

interface Props {
  data: BriefingData;
  skinConfig: ExpansionSkinConfig | null;
  trackingCtx?: { micrositeId: string; slug: string } | null;
}

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

const CONTENT_TYPE_ICONS: Record<string, typeof Video> = { video: Video, pdf: FileText, article: BookOpen, webinar: Headphones };
const PERK_ICONS: Record<string, typeof Star> = { star: Star, zap: Zap, shield: Shield, trending: TrendingUp, award: Award, gift: Gift, users: Users, sparkles: Sparkles };

/* ── Brand Colors (matching meetdandy.com) ── */
const BRAND = "#0a3d2d";
const BRAND_LIGHT = "#f5f0eb";
const LIME = "#c2e53a"; /* Dandy's chartreuse accent */

/* ── Practice Signup Form (email-only → opens booking iframe) ── */
const PracticeSignupForm = ({ companyName, accentColor, bookingUrl, onOpenBooking, cfg }: { companyName: string; accentColor: string; bookingUrl: string; onOpenBooking: (url: string) => void; cfg?: ExpansionSkinConfig }) => {
  const { slug } = useParams<{ slug: string }>();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const hlRecipient = sessionStorage.getItem("hl_recipient") || "";
      await supabase.from("practice_signups" as any).insert({
        microsite_slug: slug || "", company_name: companyName,
        practice_name: "", contact_name: hlRecipient, contact_email: email,
        notes: hlRecipient ? `Hotlink recipient: ${hlRecipient}` : null,
      } as any);
    } catch (err: any) { console.error("Signup error:", err); }
    finally {
      setSubmitting(false);
      const separator = bookingUrl.includes("?") ? "&" : "?";
      onOpenBooking(`${bookingUrl}${separator}email=${encodeURIComponent(email)}`);
    }
  };

  const inputCls = "w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-600/40 focus:ring-2 focus:ring-emerald-600/10 transition-all";
  const bullets = cfg?.signupBullets?.length ? cfg.signupBullets : ["Scanner delivered and installed within 2 weeks", "Hands-on training for your entire team", "96% first-time fit rate — backed by guarantee"];
  const bulletIcons = [Zap, Users, Shield];

  return (
    <section id="signup" style={{ backgroundColor: BRAND }}>
      <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeSection>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: LIME }}>{cfg?.signupLabel || "ACTIVATE YOUR PRACTICE"}</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{cfg?.signupHeadline || "Get Started With Dandy"}</h2>
            <p className="text-lg text-white/60 leading-relaxed mb-8">
              {cfg?.signupSubheadline || "Behind every great dentist, is a great lab. Enter your email and book a time with your dedicated team."}
            </p>
            <div className="space-y-4">
              {bullets.map((text, i) => {
                const Icon = bulletIcons[i % bulletIcons.length];
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                      <Icon className="w-4 h-4" style={{ color: LIME }} />
                    </div>
                    <span className="text-sm text-white/70">{text}</span>
                  </div>
                );
              })}
            </div>
          </FadeSection>

          <FadeSection delay={0.15}>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-2xl space-y-5">
              <div className="text-center mb-2">
                <h3 className="text-xl font-bold mb-1" style={{ color: BRAND }}>{cfg?.signupFormTitle || "Book a Meeting"}</h3>
                <p className="text-sm text-gray-500">{cfg?.signupFormSubtitle || "Enter your email to get started"}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Work Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@practice.com" className={inputCls} />
              </div>
              <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-full text-base font-bold text-white transition-all hover:brightness-110 disabled:opacity-60" style={{ backgroundColor: BRAND }}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {submitting ? "Loading..." : (cfg?.signupButtonText || "Book a Time")}
              </button>
            </form>
          </FadeSection>
        </div>
      </div>
    </section>
  );
};
const MicrositeExpansionSkin = ({ data, skinConfig, trackingCtx }: Props) => {
  const cfg = skinConfig;
  const accentColor = cfg?.colors?.accent || LIME;
  const companyName = data.companyName;
  const { trackCTA } = useMicrositeTracking(trackingCtx || null);

  // Per-microsite headline/subheadline overrides (from MicrositeEditor)
  const ho = (data as any).sectionHeadlineOverrides || {};
  const so = (data as any).sectionSubheadlines || {};
  const rep = (s: string) => s.replace(/\{company\}/g, companyName);

  const allTeamMembers = (data as any).teamOverrides?.length ? (data as any).teamOverrides : cfg?.teamMembers || [
    { name: "Sarah Johnson", role: "Enterprise Account Executive", email: "sarah@meetdandy.com" },
    { name: "Mike Chen", role: "Implementation Manager", email: "mike@meetdandy.com" },
    { name: "Dr. Emily Rodriguez", role: "Clinical Success Lead", email: "emily@meetdandy.com" },
  ];
  const teamMembers = allTeamMembers.slice(0, 3);
  const allPerks = (data as any).perksOverrides?.length ? (data as any).perksOverrides : cfg?.perks || [
    { icon: "gift", title: "$100 UberEats Gift Card", desc: "Book a lunch-and-learn for your team — we'll bring the food and walk you through going digital with Dandy." },
    { icon: "star", title: "Dedicated DSO Support", desc: "Your own account team that knows your group's workflow, not a generic help desk. Direct line, same-day response." },
    { icon: "shield", title: "Free CE Credits", desc: "Accredited courses on digital dentistry, scan technique, and restorative workflows — earn credits while you level up." },
    { icon: "sparkles", title: "$1,500 Lab Credit", desc: "New practices get $1,500 toward their first cases — enough to experience Dandy quality risk-free from day one." },
    { icon: "zap", title: "AI Scan Review", desc: "Real-time AI flags margin issues and prep problems while your patient is still in the chair — fewer remakes, faster seats." },
    { icon: "users", title: "Live Clinical Collaboration", desc: "Chat directly with Dandy lab technicians in real time to dial in your preps and get cases right the first time." },
  ];
  const perks = allPerks.slice(0, 3);
  const allPromos = (data as any).promosOverrides?.length ? (data as any).promosOverrides : cfg?.promos || [
    { title: "$1,500 Lab Credit", desc: "Activate your practice and get $1,500 toward your first cases — experience our 96% fit rate with zero risk.", badge: "CREDIT", ctaText: "Claim my credit" },
    { title: "$1,000 Lab Credit", desc: "Sign up within 90 days and put $1,000 toward crowns, bridges, or dentures — on us.", badge: "CREDIT", ctaText: "Get started" },
    { title: "Free Scanner + Cart", desc: "Your practice gets a premium intraoral scanner and all-in-one operatory cart at zero cost — included with your DSO partnership.", badge: "FREE", ctaText: "Reserve yours" },
    { title: "Free Laptop + Cart", desc: "Full digital setup for your operatory — scanner, laptop, and cart delivered and installed at no charge.", badge: "FREE", ctaText: "Reserve yours" },
  ];
  const promos = allPromos.slice(0, 2);
  const contentLinks = (data as any).resourcesOverrides?.length ? (data as any).resourcesOverrides : cfg?.contentLinks || [
    { title: "Getting Started with Dandy", desc: "Complete guide to setting up your practice", url: "#", type: "pdf" as const },
    { title: "Digital Scanning Best Practices", desc: "Tips for capturing the perfect scan every time", url: "#", type: "video" as const },
    { title: "Case Study: Multi-Location Rollout", desc: "How a 200+ practice DSO activated in 90 days", url: "#", type: "article" as const },
    { title: "Upcoming Training Webinar", desc: "Live Q&A with our clinical team", url: "#", type: "webinar" as const },
  ];
  const featureBlocks = cfg?.featureBlocks || [
    { label: "CASE ACCEPTANCE", title: "Boost case acceptance", desc: "Scan and show your patients their future smile while they're still in the chair with Dandy Cart and Smile Simulation." },
    { label: "QUALITY ASSURANCE", title: "Reduce remakes and rework", desc: "AI Scan Review and computer vision QC spots and fixes issues the human eye can't see — before they cost you." },
    { label: "ZERO CAPEX", title: "Go digital without the cost", desc: "Get a premium intraoral scanner at no cost as part of your DSO's partnership with Dandy." },
  ];
  const expansionStats = (data as any).expansionStatsBarOverrides?.length ? (data as any).expansionStatsBarOverrides : cfg?.expansionStatsBar || [
    { value: "6,000+", label: "dental practices" },
    { value: "96%", label: "first-time fit rate" },
    { value: "5 Days", label: "crown turnaround" },
  ];
  const activationSteps = cfg?.activationSteps || [
    { step: "1", title: "Schedule Your Kickoff", desc: "Meet your dedicated team and align on rollout timeline." },
    { step: "2", title: "Equipment Setup", desc: "We ship and install scanners — fully configured." },
    { step: "3", title: "Team Training", desc: "Hands-on training for doctors and staff." },
    { step: "4", title: "Go Live", desc: "Submit your first cases and experience the difference." },
  ];

  // Paradigm Shift config
  const paradigmShiftHeadline = cfg?.paradigmShiftHeadline || "Traditional labs weren't built for today's dentistry.";
  const paradigmShiftSubheadline = cfg?.paradigmShiftSubheadline || "Dandy replaces fragmented, analog workflows with a single integrated digital platform.";
  const oldWayItems = cfg?.oldWayItems || ["Remake-prone analog workflows", "Annoying calls saying your scan is bad", "Cross your fingers the case looks right", "Limited to 1–2 products per lab", "4–6 appointments for dentures", "2+ weeks for zirconia crowns"];
  const newWayItems = cfg?.newWayItems || ["Scan for everything with fewer remakes", "AI reviews your scans with patient still in chair", "3D design approval — no surprises", "One lab for all your restorative needs", "2-appointment dentures", "5-day zirconia crowns"];

  // Products config — map by imageKey AND by product name for fallback
  const PRODUCT_IMAGES: Record<string, string> = {
    "posterior-crowns": productPosteriorCrowns,
    "anterior-crowns": productAnteriorCrowns,
    dentures: productDentures,
    implants: productImplants,
    "guided-surgery": productGuidedSurgery,
    aligners: productAligners,
    guards: productGuards,
    sleep: productSleep,
    // Name-based fallbacks
    "Posterior Crowns": productPosteriorCrowns,
    "Anterior Crowns": productAnteriorCrowns,
    "Dentures": productDentures,
    "Implant Restorations": productImplants,
    "Guided Surgery": productGuidedSurgery,
    "Clear Aligners": productAligners,
    "Night Guards & TMJ": productGuards,
    "Sleep Appliances": productSleep,
  };
  const PRODUCT_ICONS: Record<string, typeof Crown> = { crown: Crown, smile: SmilePlus, stethoscope: Stethoscope, target: Target, scan: Scan, sparkles: Sparkles, moon: Moon, shield: Shield };
  const productsHeadline = cfg?.productsHeadline || "One lab for everything your practice needs.";
  const productsSubheadline = cfg?.productsSubheadline || "Perfect fit. Fast turnarounds. One connected system that simplifies your entire restorative workflow.";
  const products = cfg?.products || [
    { icon: "crown", imageKey: "posterior-crowns", name: "Posterior Crowns", detail: "AI-perfected, 5-day turnaround", price: "From $99/unit" },
    { icon: "smile", imageKey: "anterior-crowns", name: "Anterior Crowns", detail: "Stunning aesthetics, free 3D approvals", price: "Premium materials" },
    { icon: "stethoscope", imageKey: "dentures", name: "Dentures", detail: "2-appointment digital workflow", price: "From $199/arch" },
    { icon: "target", imageKey: "implants", name: "Implant Restorations", detail: "FDA-approved, custom abutments", price: "All systems supported" },
    { icon: "scan", imageKey: "guided-surgery", name: "Guided Surgery", detail: "3D-printed surgical guides", price: "$109/site" },
    { icon: "sparkles", imageKey: "aligners", name: "Clear Aligners", detail: "Doctor-directed, 3D simulations", price: "Flexible plans" },
    { icon: "moon", imageKey: "guards", name: "Night Guards & TMJ", detail: "Digital heatmaps, 3D-printed", price: "From $59 bundled" },
    { icon: "shield", imageKey: "sleep", name: "Sleep Appliances", detail: "MAD devices for OSA patients", price: "Medical billing support" },
  ];

  // Promises config
  const PROMISE_ICONS: Record<string, typeof Ban> = { ban: Ban, rotate: RotateCcw, shieldCheck: ShieldCheck };
  const promisesHeadline = cfg?.promisesHeadline || "Built on trust. Backed by guarantees.";
  const promisesSubheadline = cfg?.promisesSubheadline || "We stand behind every case — because your reputation depends on it.";
  const promises = cfg?.promises || [
    { icon: "ban", title: "Zero Long-Term Contracts", desc: "Simple, transparent pricing. No lock-ins, no hidden fees." },
    { icon: "rotate", title: "Free No-Hassle Remakes", desc: "If it doesn't fit, we'll make it right — no questions asked." },
    { icon: "shieldCheck", title: "10-Year Warranty", desc: "Every restoration is backed by a 10-year warranty." },
  ];

  // Testimonials config
  const testimonialsHeadline = cfg?.testimonialsHeadline || "Don't just take our word for it.";
  const testimonialsSubheadline = cfg?.testimonialsSubheadline || "Hear from dentists who've transformed their practices with Dandy.";
  const testimonials = cfg?.testimonials || [
    { quote: "Dandy's customer service is outstanding!", author: "Brightwhites PC", location: "Virginia" },
    { quote: "Dandy has way more training than any other lab I've worked with.", author: "Dr. Charlie Lucero", location: "Smiles Dental Services, WA" },
    { quote: "I love the ability to chat and message the lab.", author: "Dr. Sarah Mitchell", location: "Little Big Smiles, TX" },
  ];
  const repName = cfg?.repName || "Your Dandy Representative";
  const repTitle = cfg?.repTitle || "Enterprise Account Executive";
  const repCalendlyUrl = cfg?.repCalendlyUrl || "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call";
  const defaultCtaUrl = cfg?.ctaUrl || "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call";

  const heroCTAText = cfg?.heroCTAText || "Get Started";
  const secondaryCTAText = cfg?.secondaryCTAText || "Watch Video Overview";
  const navCTAText = cfg?.navCTAText || "LET'S GET STARTED";
  const heroCTAUrl = cfg?.heroCTAUrl || "#signup";
  const secondaryCTAUrl = cfg?.secondaryCTAUrl || "#team";
  const navCTAUrl = cfg?.navCTAUrl || defaultCtaUrl;
  const heroCTAVideoUrl = cfg?.heroCTAVideoUrl || "";
  const secondaryCTAVideoUrl = cfg?.secondaryCTAVideoUrl || "";
  const navCTAVideoUrl = cfg?.navCTAVideoUrl || "";
  const finalCTAVideoUrl = cfg?.finalCTAVideoUrl || "";
  const finalCTAUrl = cfg?.finalCTAUrl || repCalendlyUrl;
  const finalCTAImage = cfg?.sectionImages?.finalCTAImage || null;
  const ctaHeadlineCenter = cfg?.ctaHeadlineCenter ?? true;
  const ctaOverlayColor = cfg?.ctaOverlayColor || "rgba(0,0,0,0.5)";

  const [videoModalUrl, setVideoModalUrl] = useState("");
  const [bookingModalUrl, setBookingModalUrl] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [resourcePage, setResourcePage] = useState(0);
  const resourceDir = useRef(1);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isBookingUrl = (url: string) => /chilipiper|calendly|hubspot.*meetings|acuity/i.test(url);

  const handleCTA = (url: string, videoUrl?: string) => {
    trackCTA("CTA Click");
    if (videoUrl) {
      setVideoModalUrl(videoUrl);
    } else if (isAnchorUrl(url)) {
      document.getElementById(url.slice(1))?.scrollIntoView({ behavior: "smooth" });
    } else if (isVideoUrl(url)) {
      setVideoModalUrl(url);
    } else if (isBookingUrl(url)) {
      setBookingModalUrl(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ═══ NAVBAR — matches meetdandy.com ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
          : "bg-white"
      }`}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 flex items-center justify-between h-[72px]">
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-10">
            <a href="https://www.meetdandy.com" className="hover:opacity-80 transition-opacity">
              <img src={dandyLogo} alt="Dandy" className="h-[22px] w-auto" />
            </a>
            <div className="hidden md:flex items-center gap-8">
              {[
                { label: "Lab Services", href: "#features" },
                { label: "Solutions", href: "#perks" },
                { label: "Pricing", href: "#signup" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(link.href.replace("#", ""))?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-[15px] font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Right: Phone + Buttons */}
          <div className="flex items-center gap-4">
            <a href="tel:+13158590703" className="hidden lg:flex items-center gap-1.5 text-[13px] text-gray-500 font-medium">
              SALES: (315)-859-0703
            </a>
            <button
              onClick={() => handleCTA("#signup")}
              className="hidden md:inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-semibold tracking-wide border-2 transition-all hover:bg-gray-50"
              style={{ borderColor: BRAND, color: BRAND }}
            >
              GET PRICING
            </button>
            <button
              onClick={() => handleCTA(navCTAUrl, navCTAVideoUrl || undefined)}
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-semibold tracking-wide text-white transition-all hover:brightness-110"
              style={{ backgroundColor: BRAND }}
            >
              {navCTAVideoUrl && <Play className="w-3.5 h-3.5 mr-1" />}{navCTAText}
            </button>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div className="h-[72px]" />

      {/* ═══ HERO — full-width dark green, centered text like meetdandy.com ═══ */}
      <section className="relative overflow-hidden" style={{ backgroundColor: BRAND }}>
        {/* Subtle background image overlay */}
        <div className="absolute inset-0 opacity-20">
          <img src={crownBridgeHero} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a3d2d]/40 via-transparent to-[#0a3d2d]/60" />

        <div className="relative z-10 max-w-[960px] mx-auto px-6 pt-28 pb-20 md:pt-36 md:pb-28 text-center">
          <FadeSection>
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold text-white leading-[1.08] tracking-[-0.02em]">
              {rep(ho.hero || cfg?.welcomeHeadline || "Your partner portal with Dandy")}
            </h1>
            <p className="text-lg md:text-xl text-white/55 mt-6 max-w-[640px] mx-auto leading-relaxed">
              {rep(so.hero || cfg?.welcomeSubtext ||
                `Get best-in-class clinical results with dentistry's most powerful digital workflows — exclusively for {company} practices.`)}
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-10">
              <button onClick={() => handleCTA(heroCTAUrl, heroCTAVideoUrl || undefined)}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-bold text-[#0a3d2d] transition-all hover:brightness-110 shadow-lg"
                style={{ backgroundColor: LIME }}>
                {heroCTAVideoUrl ? <Play className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />} {heroCTAText}
              </button>
              <button onClick={() => handleCTA(secondaryCTAUrl, secondaryCTAVideoUrl || undefined)}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-medium border border-white/20 text-white hover:bg-white/5 transition-colors">
                {secondaryCTAVideoUrl ? <Play className="w-4 h-4" /> : null} {secondaryCTAText}
              </button>
            </div>
          </FadeSection>
        </div>

        {/* Hero video player */}
        <div className={`relative z-10 mx-auto px-6 pb-16 ${
          (cfg as any)?.heroVideoSize === "small" ? "max-w-[700px]" : (cfg as any)?.heroVideoSize === "large" ? "max-w-[1100px]" : "max-w-[900px]"
        }`}>
          <FadeSection delay={0.2}>
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-black aspect-video">
              <iframe
                src="https://www.youtube.com/embed/SjXFjvWW9o0?rel=0&modestbranding=1&color=white"
                title="Dandy Overview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ═══ STATS BAR — instant credibility ═══ */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className={`max-w-[1100px] mx-auto px-6 py-14 grid grid-cols-1 ${expansionStats.length <= 3 ? "md:grid-cols-3" : "md:grid-cols-4"} gap-10 text-center`}>
          {expansionStats.map((stat: { value: string; label: string }, i: number) => (
            <FadeSection key={i} delay={i * 0.1}>
              <p className="text-4xl md:text-5xl font-bold" style={{ color: BRAND }}>{stat.value}</p>
              <p className="text-sm text-gray-500 mt-2 uppercase tracking-wider font-medium">{stat.label}</p>
            </FadeSection>
          ))}
        </div>
      </section>

      {/* ═══ OLD WAY vs NEW WAY — Paradigm Shift ═══ */}
      <section className="py-24 md:py-32" style={{ backgroundColor: "#f8f7f4" }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: BRAND }}>A PARADIGM SHIFT</p>
              <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight whitespace-pre-wrap" style={{ color: BRAND }}>
                {paradigmShiftHeadline}
              </h2>
              <p className="text-lg text-gray-500 mt-4 max-w-2xl mx-auto whitespace-pre-wrap">{paradigmShiftSubheadline}</p>
            </div>
          </FadeSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FadeSection>
              <div className="p-8 rounded-2xl bg-white border border-gray-200 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-3 py-1 rounded-full bg-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Old Way</div>
                  <span className="text-sm text-gray-400">Traditional Lab</span>
                </div>
                <ul className="space-y-4">
                  {oldWayItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <X className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeSection>
            <FadeSection delay={0.1}>
              <div className="p-8 rounded-2xl border-2 h-full" style={{ backgroundColor: `${BRAND}08`, borderColor: `${BRAND}30` }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: BRAND }}>New Way</div>
                  <span className="text-sm font-semibold" style={{ color: BRAND }}>Dandy</span>
                </div>
                <ul className="space-y-4">
                  {newWayItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: BRAND }} />
                      <span className="text-sm" style={{ color: BRAND }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeSection>
          </div>
        </div>
      </section>

      {/* ═══ WHY DANDY — deeper value props ═══ */}
      <section id="features" className="py-24 md:py-32 bg-white">
        <div className="max-w-[1100px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-20">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: BRAND }}>WHY DANDY</p>
              <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight" style={{ color: BRAND }}>
                {rep(ho.features || cfg?.whyDandyHeadline || "Better outcomes. Less chair time.")}
              </h2>
              <p className="text-lg text-gray-500 mt-4 max-w-2xl mx-auto leading-relaxed">
                {rep(so.features || cfg?.whyDandySubheadline || "The first and only full-service dental lab to unite scanning technology, on-demand clinical expertise, and advanced manufacturing into one integrated system.")}
              </p>
            </div>
          </FadeSection>
          <div className="space-y-28">
            {featureBlocks.map((block, i) => {
              const defaultImages = [dandySmileSimulation, aiScanReview, dandyScannerPractice];
              const imgSrc = block.imageUrl || defaultImages[i % defaultImages.length];
              return (
              <FadeSection key={i}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                  {i % 2 === 0 ? (
                    <>
                      <div className="lg:col-span-5">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-3" style={{ color: BRAND }}>{block.label}</p>
                        <h3 className="text-3xl font-bold mb-4" style={{ color: BRAND }}>{block.title}</h3>
                        <p className="text-lg text-gray-500 leading-relaxed mb-6">{block.desc}</p>
                        <button onClick={() => handleCTA(heroCTAUrl)} className="inline-flex items-center gap-2 text-sm font-bold transition-colors hover:opacity-80" style={{ color: BRAND }}>
                          Learn more <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="lg:col-span-7">
                        <div className="rounded-2xl overflow-hidden">
                          <img src={imgSrc} alt={block.title} className="w-full h-auto object-cover" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="lg:col-span-7 order-2 lg:order-1">
                        <div className="rounded-2xl overflow-hidden">
                          <img src={imgSrc} alt={block.title} className="w-full h-auto object-cover" />
                        </div>
                      </div>
                      <div className="lg:col-span-5 order-1 lg:order-2">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-3" style={{ color: BRAND }}>{block.label}</p>
                        <h3 className="text-3xl font-bold mb-4" style={{ color: BRAND }}>{block.title}</h3>
                        <p className="text-lg text-gray-500 leading-relaxed mb-6">{block.desc}</p>
                        <button onClick={() => handleCTA(heroCTAUrl)} className="inline-flex items-center gap-2 text-sm font-bold transition-colors hover:opacity-80" style={{ color: BRAND }}>
                          Learn more <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </FadeSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FULL-SERVICE PRODUCTS ═══ */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-[1100px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: BRAND }}>PRODUCTS</p>
              <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight" style={{ color: BRAND }}>
                {productsHeadline}
              </h2>
              <p className="text-lg text-gray-500 mt-4 max-w-2xl mx-auto">{productsSubheadline}</p>
            </div>
          </FadeSection>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((product, i) => {
              const imgSrc = PRODUCT_IMAGES[(product as any).imageKey] || PRODUCT_IMAGES[product.name] || null;
              return (
              <FadeSection key={i} delay={i * 0.05}>
                <div className="rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-lg transition-all h-full group overflow-hidden">
                  {imgSrc ? (
                    <div className="w-full aspect-[4/3] overflow-hidden bg-white">
                      <img src={imgSrc} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="p-5 pb-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${BRAND}10` }}>
                        {(() => { const ProductIcon = PRODUCT_ICONS[product.icon] || Crown; return <ProductIcon className="w-5 h-5" style={{ color: BRAND }} />; })()}
                      </div>
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-sm font-bold mb-1" style={{ color: BRAND }}>{product.name}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-2">{product.detail}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: `${BRAND}99` }}>{product.price}</p>
                  </div>
                </div>
              </FadeSection>
              );
            })}
          </div>
          <FadeSection delay={0.3} className="text-center mt-12">
            <button onClick={() => handleCTA(heroCTAUrl)} className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-bold text-white transition-all hover:brightness-110" style={{ backgroundColor: BRAND }}>
              <ArrowRight className="w-5 h-5" /> See Full Product Catalog
            </button>
          </FadeSection>
        </div>
      </section>

      {/* ═══ PROMISES / GUARANTEES — remove risk ═══ */}
      <section className="py-24 md:py-32 border-t border-gray-100" style={{ backgroundColor: "#f8f7f4" }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: BRAND }}>OUR PROMISES</p>
              <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight" style={{ color: BRAND }}>
                {promisesHeadline}
              </h2>
              <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">{promisesSubheadline}</p>
            </div>
          </FadeSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {promises.map((promise, i) => {
              const PromiseIcon = PROMISE_ICONS[promise.icon] || Ban;
              return (
              <FadeSection key={i} delay={i * 0.1}>
                <div className="text-center p-8 rounded-2xl bg-white border border-gray-100 h-full">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: `${BRAND}10` }}>
                    <PromiseIcon className="w-7 h-7" style={{ color: BRAND }} />
                  </div>
                  <h3 className="text-lg font-bold mb-3" style={{ color: BRAND }}>{promise.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{promise.desc}</p>
                </div>
              </FadeSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS — social proof ═══ */}
      <section className="py-24 md:py-32" style={{ backgroundColor: BRAND }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: LIME }}>TESTIMONIALS</p>
              <h2 className="text-3xl md:text-[3.2rem] font-bold text-white leading-tight">{testimonialsHeadline}</h2>
              <p className="text-lg text-white/50 mt-4 max-w-xl mx-auto">{testimonialsSubheadline}</p>
            </div>
          </FadeSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, i) => (
              <FadeSection key={i} delay={i * 0.1}>
                <div className="p-8 rounded-2xl bg-white/[0.05] border border-white/[0.08] h-full flex flex-col">
                  <Quote className="w-8 h-8 mb-5 opacity-30" style={{ color: LIME }} />
                  <p className="text-sm text-white/70 leading-relaxed flex-1 italic">"{testimonial.quote}"</p>
                  <div className="mt-6 pt-5 border-t border-white/[0.08]">
                    <p className="text-sm font-bold text-white">{testimonial.author}</p>
                    <p className="text-xs text-white/40 mt-0.5">{testimonial.location}</p>
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MEET YOUR TEAM ═══ */}
      <section id="team" className="py-24 md:py-32 bg-white">
        <div className="max-w-[1100px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: BRAND }}>YOUR DEDICATED TEAM</p>
              <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight" style={{ color: BRAND }}>{rep(ho.team || "Meet the team behind your partnership")}</h2>
              <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">{rep(so.team || `Here to ensure every practice in {company} has an exceptional experience.`)}</p>
            </div>
          </FadeSection>
          <div className="flex flex-wrap justify-center gap-8">
            {teamMembers.map((member, i) => (
              <FadeSection key={i} delay={i * 0.1}>
                <div className="w-[280px] p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-lg transition-all text-center">
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-28 h-28 rounded-full mx-auto mb-6 object-cover ring-2 ring-gray-200" />
                  ) : (
                    <div className="w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl font-bold text-white ring-2 ring-gray-200" style={{ backgroundColor: BRAND }}>
                      {member.name.split(" ").map(n => n[0]).join("")}
                    </div>
                  )}
                  <h3 className="text-lg font-bold mb-1" style={{ color: BRAND }}>{member.name}</h3>
                  <p className="text-sm text-gray-500 mb-5">{member.role}</p>
                  <div className="flex items-center justify-center gap-3">
                    {member.email && <a href={`mailto:${member.email}`} className="p-3 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors" style={{ color: BRAND }}><Mail className="w-4.5 h-4.5" /></a>}
                    {member.calendlyUrl && <a href={member.calendlyUrl} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors" style={{ color: BRAND }}><Calendar className="w-4.5 h-4.5" /></a>}
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>
          <FadeSection delay={0.3} className="mt-12">
            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold mb-1" style={{ color: BRAND }}>Need to reach {repName}?</h3>
                <p className="text-sm text-gray-500">{repTitle} — Available for calls, questions, or anything you need.</p>
              </div>
              <button onClick={() => handleCTA(repCalendlyUrl)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold shrink-0 text-white transition-all hover:brightness-110"
                style={{ backgroundColor: BRAND }}>
                <Phone className="w-4 h-4" /> Book a Call
              </button>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ═══ PARTNERSHIP PERKS ═══ */}
      <section id="perks" className="py-24 md:py-32" style={{ backgroundColor: "#f8f7f4" }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: BRAND }}>PARTNERSHIP PERKS</p>
              <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight" style={{ color: BRAND }}>{rep(ho.perks || "What's included")}</h2>
              <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">{rep(so.perks || `As an official Dandy partner, {company} practices unlock these exclusive benefits.`)}</p>
            </div>
          </FadeSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
            {perks.map((perk, i) => {
              const Icon = PERK_ICONS[perk.icon] || Star;
              return (
                <FadeSection key={i} delay={i * 0.08}>
                  <div className="p-7 rounded-2xl bg-white hover:shadow-lg transition-all h-full border border-gray-100">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: `${BRAND}12` }}>
                      <Icon className="w-5 h-5" style={{ color: BRAND }} />
                    </div>
                    <h3 className="text-base font-bold mb-2" style={{ color: BRAND }}>{perk.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{perk.desc}</p>
                  </div>
                </FadeSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ PROMOS ═══ */}
      <section id="promos" className="py-24 md:py-32 bg-white">
        <div className="max-w-[1100px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: BRAND }}>EXCLUSIVE OFFERS</p>
              <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight" style={{ color: BRAND }}>{rep(ho.promos || `Promotions for {company}`)}</h2>
              <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">{rep(so.promos || "Take advantage of these limited-time offers available exclusively to your partnership.")}</p>
            </div>
          </FadeSection>
          <div className="flex flex-wrap justify-center gap-6">
            {promos.map((promo, i) => (
              <FadeSection key={i} delay={i * 0.1}>
                <div className="relative w-[320px] p-8 rounded-2xl bg-gray-50 hover:shadow-lg transition-all h-full flex flex-col border border-gray-100">
                  {promo.badge && (
                    <span className="absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: BRAND }}>
                      {promo.badge}
                    </span>
                  )}
                  <Gift className="w-8 h-8 mb-4" style={{ color: BRAND }} />
                  <h3 className="text-lg font-bold mb-2" style={{ color: BRAND }}>{promo.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed flex-1">{promo.desc}</p>
                  {(promo.ctaText || promo.ctaUrl) && (
                    <button onClick={() => handleCTA(promo.ctaUrl || "#signup")} className="inline-flex items-center gap-1.5 text-sm font-semibold mt-5" style={{ color: BRAND }}>
                      {promo.ctaText || "Learn More"} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ACTIVATION STEPS ═══ */}
      <section id="activate" className="py-24 md:py-32" style={{ backgroundColor: "#f8f7f4" }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: BRAND }}>GET STARTED</p>
              <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight" style={{ color: BRAND }}>
                {rep(ho.activate || `${activationSteps.length} steps to go live`)}
              </h2>
              <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">
                {rep(so.activate || "From kickoff to first case — we handle the heavy lifting.")}
              </p>
            </div>
          </FadeSection>
          <div className="flex flex-wrap justify-center gap-6">
            {activationSteps.map((step, i) => (
              <FadeSection key={i} delay={i * 0.1}>
                <div className="w-[250px] p-7 rounded-2xl bg-white hover:shadow-lg transition-all h-full border border-gray-100">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mb-5 text-white" style={{ backgroundColor: BRAND }}>
                    {step.step}
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: BRAND }}>{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ RESOURCES ═══ */}
      <section id="resources" className="py-24 md:py-32 bg-white">
        <div className="max-w-[1300px] mx-auto px-6">
          <FadeSection>
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: BRAND }}>RESOURCES</p>
              <h2 className="text-4xl md:text-[3.2rem] font-bold leading-tight" style={{ color: BRAND }}>{rep(ho.resources || "Everything your team needs")}</h2>
              <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">{rep(so.resources || "Training materials, guides, and resources to help your practices get the most out of Dandy.")}</p>
            </div>
          </FadeSection>

          {/* Carousel */}
          {(() => {
            const visible = typeof window !== "undefined" && window.innerWidth < 768 ? 1 : window.innerWidth < 1024 ? 2 : 4;
            const maxIndex = Math.max(0, contentLinks.length - visible);
            const totalPages = maxIndex + 1;
            let touchStartX = 0;
            const goTo = (page: number) => {
              resourceDir.current = page > resourcePage ? 1 : -1;
              setResourcePage(page);
            };
            return (
              <div
                className="relative"
                onTouchStart={(e) => { touchStartX = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  const diff = touchStartX - e.changedTouches[0].clientX;
                  if (Math.abs(diff) > 50) {
                    if (diff > 0 && resourcePage < totalPages - 1) goTo(resourcePage + 1);
                    if (diff < 0 && resourcePage > 0) goTo(resourcePage - 1);
                  }
                }}
              >
                {/* Navigation arrows */}
                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() => goTo(Math.max(0, resourcePage - 1))}
                      disabled={resourcePage === 0}
                      className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center disabled:opacity-30 hover:shadow-lg transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" style={{ color: BRAND }} />
                    </button>
                    <button
                      onClick={() => goTo(Math.min(totalPages - 1, resourcePage + 1))}
                      disabled={resourcePage === totalPages - 1}
                      className="absolute -right-4 md:-right-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center disabled:opacity-30 hover:shadow-lg transition-all"
                    >
                      <ChevronRight className="w-5 h-5" style={{ color: BRAND }} />
                    </button>
                  </>
                )}

                <div className="overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false} custom={resourceDir.current}>
                    <motion.div
                      className="grid gap-6"
                      style={{ gridTemplateColumns: `repeat(${visible}, minmax(0, 1fr))` }}
                      key={resourcePage}
                      initial={{ x: `${resourceDir.current * 100}%`, opacity: 0 }}
                      animate={{ x: "0%", opacity: 1 }}
                      exit={{ x: `${resourceDir.current * -100}%`, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
                    >
                      {contentLinks.slice(resourcePage, resourcePage + visible).map((link, i) => {
                        const Icon = CONTENT_TYPE_ICONS[link.type] || FileText;
                        return (
                          <motion.a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-lg transition-all group overflow-hidden"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          >
                            {link.imageUrl ? (
                              <div className="aspect-[4/3] w-full overflow-hidden">
                                <img src={link.imageUrl} alt={link.title} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                              </div>
                            ) : (
                              <div className="aspect-[4/3] w-full flex items-center justify-center" style={{ backgroundColor: `${BRAND}08` }}>
                                <Icon className="w-12 h-12 opacity-20" style={{ color: BRAND }} />
                              </div>
                            )}
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND}10`, color: BRAND }}>
                                      {link.type}
                                    </span>
                                  </div>
                                  <h3 className="text-base font-bold mb-1" style={{ color: BRAND }}>{link.title}</h3>
                                  <p className="text-sm text-gray-500 leading-relaxed">{link.desc}</p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" />
                              </div>
                            </div>
                          </motion.a>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Dot indicators */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => goTo(i)}
                        className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                        style={{ backgroundColor: i === resourcePage ? BRAND : `${BRAND}20` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ═══ PRACTICE SIGNUP FORM ═══ */}
      <PracticeSignupForm companyName={companyName} accentColor={accentColor} bookingUrl={repCalendlyUrl} onOpenBooking={(url) => setBookingModalUrl(url)} cfg={cfg as ExpansionSkinConfig} />




      {/* ═══ FINAL CTA — full-width dark hero matching top hero ═══ */}
      <section className="relative overflow-hidden" style={{ backgroundColor: BRAND }}>
        {/* Background image — custom upload or default dentist photo */}
        {finalCTAImage ? (
          <img src={finalCTAImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <img src={dandyPracticeDentist} alt="" className="w-[70%] h-auto object-contain" />
          </div>
        )}
        {/* Color overlay */}
        <div className="absolute inset-0" style={{ backgroundColor: ctaOverlayColor }} />

        <div className={`relative z-10 max-w-[960px] mx-auto px-6 pt-28 pb-28 md:pt-36 md:pb-36 ${ctaHeadlineCenter ? "text-center" : "text-left"}`}>
          <FadeSection>
            <h2 className="text-4xl md:text-[3.5rem] font-bold text-white leading-[1.08] tracking-[-0.02em] mb-6">
              {rep(ho.finalCTA || "A better way to do lab work.")}
            </h2>
            <p className={`text-lg md:text-xl text-white/55 mb-10 leading-relaxed ${ctaHeadlineCenter ? "max-w-lg mx-auto" : "max-w-2xl"}`}>
              {rep(so.finalCTA || "Join the thousands of dental practices across North America who have transformed their practices with Dandy.")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button onClick={() => handleCTA(finalCTAUrl, finalCTAVideoUrl || undefined)}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-bold text-[#0a3d2d] transition-all hover:brightness-110 shadow-lg"
                style={{ backgroundColor: LIME }}>
                {finalCTAVideoUrl ? <Play className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />} GET STARTED TODAY
              </button>
              <a href="tel:+13158590703" className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-medium border border-white/20 text-white hover:bg-white/5 transition-colors">
                <Phone className="w-4 h-4" /> Call us now
              </a>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ═══ FOOTER — clean like meetdandy.com ═══ */}
      <footer className="border-t border-gray-100 py-10 bg-white">
        <div className="max-w-[1100px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={dandyLogo} alt="Dandy" className="h-4 opacity-40" />
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-400">{companyName} Partner Portal</span>
          </div>
          <p className="text-xs text-gray-400">
            {cfg?.footerText || "© Dandy · Trusted by 6,000+ dental offices · U.S.-based manufacturing"}
          </p>
        </div>
      </footer>
    </div>
    <VideoModal url={videoModalUrl} onClose={() => setVideoModalUrl("")} />
    <BookingModal url={bookingModalUrl} onClose={() => setBookingModalUrl("")} />
    </>
  );
};

export default MicrositeExpansionSkin;
