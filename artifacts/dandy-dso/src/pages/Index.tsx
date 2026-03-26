import { useState, useRef, useEffect, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Calculator,
  SlidersHorizontal,
  Search,
  Globe,
  Palette,
  BarChart3,
  ArrowRight,
  ChevronLeft,
  Users,
  FlaskConical,
  Mail,
  LogOut,
} from "lucide-react";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import { logoutAdmin } from "@/components/PasswordGate";
import DSOInvisibleWasteCalculator from "@/components/DSOInvisibleWasteCalculator";
import DSOOnePagerGenerator from "@/components/DSOOnePagerGenerator";
import DSOPilotEditor from "@/components/DSOPilotEditor";
import DSOAccountBriefing from "@/components/DSOAccountBriefing";
import DSOSiteManager from "@/components/DSOSiteManager";
import DSOAnalytics from "@/components/DSOAnalytics";
import DSOContacts from "@/components/DSOContacts";
import DSOABTesting from "@/components/DSOABTesting";
import DSOCampaigns from "@/components/DSOCampaigns";

type Tab =
  | "home"
  | "calculator"
  | "one-pager"
  | "pilot-editor"
  | "account-briefing"
  | "microsites"
  | "analytics"
  | "contacts"
  | "ab-testing"
  | "campaigns";

const NAV_TOOLS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "calculator", label: "ROI Calculator", icon: <Calculator className="w-3.5 h-3.5" /> },
  { id: "one-pager", label: "Content Generator", icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "account-briefing", label: "Account View", icon: <Search className="w-3.5 h-3.5" /> },
  { id: "microsites", label: "Microsites", icon: <Globe className="w-3.5 h-3.5" /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: "contacts", label: "Contacts", icon: <Users className="w-3.5 h-3.5" /> },
];

const FEATURE_CARDS = [
  {
    id: "calculator" as Tab,
    icon: Calculator,
    title: "ROI Calculator",
    description:
      "Quantify the hidden costs of lab inefficiency for any DSO. Input practice count and case mix to generate a custom savings breakdown — exportable as a PDF.",
    cta: "Open Calculator",
    accent: "#c8e84e",
  },
  {
    id: "one-pager" as Tab,
    icon: FileText,
    title: "Content Generator",
    description:
      "Generate polished, audience-specific one-pagers for executives, clinical leads, or practice managers. Includes QR codes and branded PDF export.",
    cta: "Generate Content",
    accent: "#c8e84e",
  },
  {
    id: "account-briefing" as Tab,
    icon: Search,
    title: "Account View",
    description:
      "Your deal workspace — engagement signals, stakeholder activity, active experiences, AI-generated briefings, and next-best-action recommendations all in one place.",
    cta: "Open Account View",
    accent: "#c8e84e",
  },
  {
    id: "microsites" as Tab,
    icon: Globe,
    title: "Microsites",
    description:
      "Create personalized landing pages for DSO prospects. Customize sections, toggle content blocks, track views, and generate hotlinks for individual recipients.",
    cta: "Manage Microsites",
    accent: "#c8e84e",
  },
  {
    id: "analytics" as Tab,
    icon: BarChart3,
    title: "Analytics",
    description:
      "Track engagement across all microsites — views, CTA clicks, referrers, and daily trends. Set up email alerts to get notified when a prospect visits.",
    cta: "View Analytics",
    accent: "#c8e84e",
  },
  {
    id: "contacts" as Tab,
    icon: Users,
    title: "Contacts",
    description:
      "Browse all imported DSO contacts in one place. Search by name, company, or title, see which companies have active microsites, and draft personalized outreach emails in one click.",
    cta: "View Contacts",
    accent: "#c8e84e",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeNavTool = NAV_TOOLS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-primary shadow-lg">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 flex items-center h-[56px] gap-6">

          {/* Logo — clicking goes home */}
          <button
            onClick={() => setActiveTab("home")}
            className="flex items-center gap-3 shrink-0 group"
          >
            <img src={dandyLogoWhite} alt="Dandy" className="h-[18px] w-auto" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/40 group-hover:text-primary-foreground/60 transition-colors">
              Enterprise Sales
            </span>
          </button>

          {/* Visible nav links */}
          <div className="flex items-center gap-1 flex-1">
            {NAV_TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTab(tool.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all ${
                  activeTab === tool.id
                    ? "bg-accent-warm text-accent-warm-foreground"
                    : "text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/8"
                }`}
              >
                {tool.icon}
                <span className="hidden lg:inline">{tool.label}</span>
              </button>
            ))}
          </div>

          {/* Secret menu trigger — only Template Editor + Skin Editor */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center justify-center w-6 h-6 cursor-default"
              aria-label="Admin menu"
            >
              <span className="block w-[5px] h-[5px] rounded-full bg-primary-foreground/10 transition-all duration-300 hover:bg-primary-foreground/30 hover:shadow-[0_0_6px_2px_hsl(var(--primary-foreground)/0.15)]" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-lg bg-primary border border-primary-foreground/15 shadow-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-primary-foreground/10">
                  <p className="text-[10px] uppercase tracking-widest text-primary-foreground/30 font-semibold">
                    Admin Tools
                  </p>
                </div>
                <button
                  onClick={() => { setActiveTab("pilot-editor"); setMenuOpen(false); }}
                  className={`flex items-center gap-2 w-full px-4 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all ${
                    activeTab === "pilot-editor"
                      ? "bg-accent-warm text-accent-warm-foreground"
                      : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/5"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Template Editor
                </button>
                <button
                  onClick={() => { navigate("/skin-editor"); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-4 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/5"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Skin Editor
                </button>
                <button
                  onClick={() => { setActiveTab("ab-testing"); setMenuOpen(false); }}
                  className={`flex items-center gap-2 w-full px-4 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all ${
                    activeTab === "ab-testing"
                      ? "bg-accent-warm text-accent-warm-foreground"
                      : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/5"
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  A/B Testing
                </button>
                <button
                  onClick={() => { setActiveTab("campaigns"); setMenuOpen(false); }}
                  className={`flex items-center gap-2 w-full px-4 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all ${
                    activeTab === "campaigns"
                      ? "bg-accent-warm text-accent-warm-foreground"
                      : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/5"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Campaigns
                </button>
                <div className="border-t border-primary-foreground/10">
                  <button
                    onClick={() => { logoutAdmin(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-4 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all text-destructive/70 hover:text-destructive hover:bg-destructive/5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main>
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {/* Hero */}
              <div className="bg-primary text-primary-foreground">
                <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-16 md:py-24">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/40 mb-4">
                    Dandy Enterprise Sales Hub
                  </p>
                  <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-5 max-w-2xl">
                    Everything you need to{" "}
                    <span className="text-accent-warm">win DSO accounts.</span>
                  </h1>
                  <p className="text-primary-foreground/60 text-lg max-w-xl leading-relaxed">
                    A suite of tools built for Dandy's enterprise sales team — from ROI calculators
                    and branded microsites to account briefings and engagement analytics.
                  </p>
                </div>
              </div>

              {/* Feature cards */}
              <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-12 md:py-16">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-8">
                  Your tools
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {FEATURE_CARDS.map((card, i) => {
                    const Icon = card.icon;
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.06 }}
                        onClick={() => setActiveTab(card.id)}
                        className="group relative bg-white border border-border rounded-2xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                      >
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mb-5">
                          <Icon className="w-5 h-5 text-accent-warm" />
                        </div>

                        <h2 className="text-[15px] font-bold text-foreground mb-2">
                          {card.title}
                        </h2>
                        <p className="text-[13px] text-muted-foreground leading-relaxed mb-6">
                          {card.description}
                        </p>

                        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-primary group-hover:gap-2.5 transition-all">
                          {card.cta}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>

                        {/* Hover accent bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-accent-warm rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.div>
                    );
                  })}
                </div>

                {/* Footer note */}
                <p className="mt-10 text-[12px] text-muted-foreground/60 text-center">
                  Looking for the template or skin editors? They're accessible via the admin menu in the top-right corner.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab !== "home" && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* Breadcrumb bar */}
              <div className="border-b border-border bg-white">
                <div className="max-w-[1280px] mx-auto px-6 md:px-10 h-10 flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("home")}
                    className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Home
                  </button>
                  {activeNavTool && (
                    <>
                      <span className="text-muted-foreground/40 text-[12px]">/</span>
                      <span className="text-[12px] font-semibold text-foreground">
                        {activeNavTool.label}
                      </span>
                    </>
                  )}
                  {activeTab === "pilot-editor" && (
                    <>
                      <span className="text-muted-foreground/40 text-[12px]">/</span>
                      <span className="text-[12px] font-semibold text-foreground">
                        Template Editor
                      </span>
                    </>
                  )}
                </div>
              </div>

              <ErrorBoundary fallbackLabel={`Failed to load ${activeTab}`} key={activeTab + "-eb"}>
                {activeTab === "calculator" && <DSOInvisibleWasteCalculator />}
                {activeTab === "one-pager" && <DSOOnePagerGenerator />}
                {activeTab === "pilot-editor" && <DSOPilotEditor />}
                {activeTab === "account-briefing" && <DSOAccountBriefing />}
                {activeTab === "microsites" && <DSOSiteManager />}
                {activeTab === "analytics" && <DSOAnalytics />}
                {activeTab === "contacts" && <DSOContacts />}
                {activeTab === "ab-testing" && <DSOABTesting />}
                {activeTab === "campaigns" && <DSOCampaigns />}
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
