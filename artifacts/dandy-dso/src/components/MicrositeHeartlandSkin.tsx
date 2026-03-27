import { motion, useScroll, useTransform, AnimatePresence, useInView } from "framer-motion";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowRight, ArrowLeft, Menu, X, MapPin, Calendar, Play,
  TrendingDown, TrendingUp, BarChart3, Scale, Wallet,
  AlertTriangle, Users2, ScanLine, ShieldCheck, BrainCircuit,
  Rocket, CheckCircle2, Check, Minus, Calculator, DollarSign, Clock,
  ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight, CalendarIcon,
  Activity, Microscope, Cpu, Users, Eye, Layers, Shield, Quote,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Area, AreaChart, PieChart, Pie, Cell,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MicrositeSkinConfig, filterByPracticeCount, SkinCaseStudy, SectionStyleOverrides } from "@/lib/microsite-skin-config";
import DemoModal, { CHILIPIPER_URL } from "@/components/DemoModal";
import InlineEditableSection from "@/components/InlineEditableSection";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import heroBoardroom from "@/assets/hero-boardroom.jpg";
import heroBusiness from "@/assets/hero-business.jpg";
import aiScanReview from "@/assets/ai-scan-review.jpg";
import dentalCrowns from "@/assets/dental-crowns.jpg";
import dandyDoctor from "@/assets/dandy-doctor.jpg";
import scannerSpeed from "@/assets/scanner-speed.webp";
import dandyLabMachines from "@/assets/dandy-lab-machines.jpg";
import ctaOperations from "@/assets/cta-operations.jpg";
import digitalScanning from "@/assets/digital-scanning.jpg";
import dandyInsightsDashboard from "@/assets/dandy-insights-dashboard.png";

// ─── Types ──────────────────────────────────────────────────────────
type BriefingData = {
  companyName: string;
  overview: string;
  tier: string;
  dandyFitAnalysis: { primaryValueProp: string; keyPainPoints: string[]; relevantProofPoints: string[]; recommendedPilotApproach: string };
  micrositeRecommendations: { headline: string; keyMetrics: string[]; contentFocus: string };
  sizeAndLocations?: { practiceCount: string; states: string[]; headquarters: string };
};

interface HeartlandSkinProps {
  data: BriefingData;
  skinConfig: MicrositeSkinConfig | null;
  onOpenDemo: (buttonUrl?: string, ctaLabel?: string) => void;
  onTrackCTA: (label: string) => void;
  editorMode?: boolean;
  sectionStyles?: Record<string, SectionStyleOverrides>;
  onUpdateSectionStyle?: (sectionId: string, patch: Partial<SectionStyleOverrides>) => void;
}

// ─── CSS vars for dark theme (scoped) ───────────────────────────────
const DARK_VARS: React.CSSProperties & Record<string, string> = {
  "--background": "192 30% 5%",
  "--foreground": "0 0% 98%",
  "--card": "192 25% 8%",
  "--card-foreground": "0 0% 98%",
  "--popover": "192 25% 8%",
  "--popover-foreground": "0 0% 98%",
  "--primary": "72 55% 48%",
  "--primary-foreground": "192 30% 6%",
  "--primary-deep": "160 35% 18%",
  "--primary-light": "192 20% 14%",
  "--light-bg": "0 0% 98%",
  "--light-foreground": "192 30% 10%",
  "--light-muted-foreground": "192 10% 40%",
  "--light-card": "0 0% 95%",
  "--light-border": "192 10% 88%",
  "--secondary": "192 20% 10%",
  "--secondary-foreground": "0 0% 75%",
  "--muted": "192 18% 11%",
  "--muted-foreground": "192 10% 55%",
  "--accent": "72 55% 48%",
  "--accent-foreground": "192 30% 6%",
  "--destructive": "0 70% 55%",
  "--destructive-foreground": "210 40% 98%",
  "--border": "192 15% 13%",
  "--input": "192 15% 13%",
  "--ring": "72 55% 48%",
  "--radius": "0.75rem",
  "--nav-bg": "192 30% 4%",
  "--nav-foreground": "0 0% 98%",
  "--surface-elevated": "192 25% 9%",
  "--shadow-card": "0 2px 16px rgba(0, 0, 0, 0.3)",
  "--shadow-card-hover": "0 8px 32px rgba(0, 0, 0, 0.4)",
} as any;

const CASE_IMAGES = [dentalCrowns, dandyDoctor, scannerSpeed];

// ─── Helpers ────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtDec = (n: number, d = 1) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtDollar = (n: number) => `$${fmt(n)}`;

const rep = (str: string, company: string) => str.replace(/\{company\}/g, company);

const PIE_COLORS = ["hsl(72, 70%, 55%)", "hsl(72, 55%, 40%)", "hsl(192, 20%, 30%)", "hsl(192, 15%, 20%)"];

// ─── Animated counter hook ───────────────────────────────────────────
const useCountUp = (end: number, duration = 1200, decimals = 0, started = false) => {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>();
  useEffect(() => {
    if (!started) { setCount(0); return; }
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(parseFloat((eased * end).toFixed(decimals)));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [end, duration, decimals, started]);
  return count;
};

// ─── Dashboard data ─────────────────────────────────────────────────
const locationData = [
  { name: "Location A — Downtown", remakes: 2.1, cases: 312, trend: "down" as const, score: 97, monthly: [{ month: "Aug", cases: 38, remakes: 3 }, { month: "Sep", cases: 42, remakes: 2 }, { month: "Oct", cases: 48, remakes: 1 }, { month: "Nov", cases: 52, remakes: 1 }, { month: "Dec", cases: 55, remakes: 1 }, { month: "Jan", cases: 77, remakes: 2 }], products: [{ name: "Crowns", value: 45 }, { name: "Bridges", value: 20 }, { name: "Implants", value: 25 }, { name: "Other", value: 10 }] },
  { name: "Location B — East Side", remakes: 3.8, cases: 287, trend: "up" as const, score: 94, monthly: [{ month: "Aug", cases: 35, remakes: 5 }, { month: "Sep", cases: 40, remakes: 4 }, { month: "Oct", cases: 44, remakes: 4 }, { month: "Nov", cases: 48, remakes: 3 }, { month: "Dec", cases: 55, remakes: 3 }, { month: "Jan", cases: 65, remakes: 2 }], products: [{ name: "Crowns", value: 50 }, { name: "Bridges", value: 15 }, { name: "Implants", value: 20 }, { name: "Other", value: 15 }] },
  { name: "Location C — Suburbs", remakes: 1.9, cases: 401, trend: "down" as const, score: 98, monthly: [{ month: "Aug", cases: 50, remakes: 2 }, { month: "Sep", cases: 56, remakes: 1 }, { month: "Oct", cases: 62, remakes: 1 }, { month: "Nov", cases: 68, remakes: 1 }, { month: "Dec", cases: 75, remakes: 1 }, { month: "Jan", cases: 90, remakes: 1 }], products: [{ name: "Crowns", value: 40 }, { name: "Bridges", value: 25 }, { name: "Implants", value: 30 }, { name: "Other", value: 5 }] },
  { name: "Location D — West End", remakes: 4.2, cases: 198, trend: "up" as const, score: 91, monthly: [{ month: "Aug", cases: 22, remakes: 4 }, { month: "Sep", cases: 26, remakes: 3 }, { month: "Oct", cases: 30, remakes: 3 }, { month: "Nov", cases: 34, remakes: 2 }, { month: "Dec", cases: 38, remakes: 2 }, { month: "Jan", cases: 48, remakes: 2 }], products: [{ name: "Crowns", value: 55 }, { name: "Bridges", value: 10 }, { name: "Implants", value: 15 }, { name: "Other", value: 20 }] },
  { name: "Location E — North Park", remakes: 2.7, cases: 256, trend: "down" as const, score: 95, monthly: [{ month: "Aug", cases: 30, remakes: 3 }, { month: "Sep", cases: 36, remakes: 2 }, { month: "Oct", cases: 40, remakes: 2 }, { month: "Nov", cases: 44, remakes: 2 }, { month: "Dec", cases: 50, remakes: 1 }, { month: "Jan", cases: 56, remakes: 1 }], products: [{ name: "Crowns", value: 42 }, { name: "Bridges", value: 22 }, { name: "Implants", value: 28 }, { name: "Other", value: 8 }] },
];

const providerData = [
  { name: "Dr. Sarah Chen", location: "Location C — Suburbs", cases: 142, accuracy: 99.1, trend: "up", monthly: [{ month: "Aug", cases: 18, accuracy: 98.2 }, { month: "Sep", cases: 20, accuracy: 98.6 }, { month: "Oct", cases: 22, accuracy: 99.0 }, { month: "Nov", cases: 24, accuracy: 99.2 }, { month: "Dec", cases: 28, accuracy: 99.4 }, { month: "Jan", cases: 30, accuracy: 99.1 }], types: [{ name: "Crowns", value: 60 }, { name: "Bridges", value: 22 }, { name: "Implants", value: 18 }] },
  { name: "Dr. James Park", location: "Location A — Downtown", cases: 118, accuracy: 97.8, trend: "up", monthly: [{ month: "Aug", cases: 14, accuracy: 96.5 }, { month: "Sep", cases: 16, accuracy: 97.0 }, { month: "Oct", cases: 18, accuracy: 97.4 }, { month: "Nov", cases: 20, accuracy: 97.8 }, { month: "Dec", cases: 24, accuracy: 98.0 }, { month: "Jan", cases: 26, accuracy: 97.8 }], types: [{ name: "Crowns", value: 50 }, { name: "Bridges", value: 30 }, { name: "Implants", value: 20 }] },
  { name: "Dr. Maria Lopez", location: "Location E — North Park", cases: 97, accuracy: 96.4, trend: "down", monthly: [{ month: "Aug", cases: 12, accuracy: 97.0 }, { month: "Sep", cases: 14, accuracy: 96.8 }, { month: "Oct", cases: 15, accuracy: 96.5 }, { month: "Nov", cases: 16, accuracy: 96.2 }, { month: "Dec", cases: 18, accuracy: 96.0 }, { month: "Jan", cases: 22, accuracy: 96.4 }], types: [{ name: "Crowns", value: 45 }, { name: "Bridges", value: 25 }, { name: "Implants", value: 30 }] },
  { name: "Dr. Kevin Wright", location: "Location D — West End", cases: 88, accuracy: 94.2, trend: "up", monthly: [{ month: "Aug", cases: 10, accuracy: 92.0 }, { month: "Sep", cases: 12, accuracy: 93.0 }, { month: "Oct", cases: 14, accuracy: 93.5 }, { month: "Nov", cases: 15, accuracy: 94.0 }, { month: "Dec", cases: 17, accuracy: 94.5 }, { month: "Jan", cases: 20, accuracy: 94.2 }], types: [{ name: "Crowns", value: 55 }, { name: "Bridges", value: 15 }, { name: "Implants", value: 30 }] },
  { name: "Dr. Amy Foster", location: "Location B — East Side", cases: 134, accuracy: 95.7, trend: "down", monthly: [{ month: "Aug", cases: 16, accuracy: 96.5 }, { month: "Sep", cases: 18, accuracy: 96.2 }, { month: "Oct", cases: 20, accuracy: 96.0 }, { month: "Nov", cases: 22, accuracy: 95.8 }, { month: "Dec", cases: 26, accuracy: 95.5 }, { month: "Jan", cases: 32, accuracy: 95.7 }], types: [{ name: "Crowns", value: 48 }, { name: "Bridges", value: 28 }, { name: "Implants", value: 24 }] },
];

const trendData = [
  { month: "Jul", remakes: 5.2, cases: 980 }, { month: "Aug", remakes: 4.8, cases: 1020 },
  { month: "Sep", remakes: 4.1, cases: 1100 }, { month: "Oct", remakes: 3.6, cases: 1180 },
  { month: "Nov", remakes: 3.2, cases: 1250 }, { month: "Dec", remakes: 2.8, cases: 1340 },
  { month: "Jan", remakes: 2.4, cases: 1420 },
];

const kpiSparklines = {
  "Total Cases": [{ month: "Aug", value: 980 }, { month: "Sep", value: 1020 }, { month: "Oct", value: 1100 }, { month: "Nov", value: 1180 }, { month: "Dec", value: 1250 }, { month: "Jan", value: 1454 }],
  "Remake Rate": [{ month: "Aug", value: 4.8 }, { month: "Sep", value: 4.1 }, { month: "Oct", value: 3.6 }, { month: "Nov", value: 3.2 }, { month: "Dec", value: 2.9 }, { month: "Jan", value: 2.8 }],
  "Avg Turnaround": [{ month: "Aug", value: 5.8 }, { month: "Sep", value: 5.4 }, { month: "Oct", value: 5.0 }, { month: "Nov", value: 4.7 }, { month: "Dec", value: 4.4 }, { month: "Jan", value: 4.2 }],
  "Active Locations": [{ month: "Aug", value: 3 }, { month: "Sep", value: 3 }, { month: "Oct", value: 4 }, { month: "Nov", value: 4 }, { month: "Dec", value: 4 }, { month: "Jan", value: 5 }],
};

const dashTabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "locations", label: "Locations", icon: MapPin },
  { id: "providers", label: "Providers", icon: Users },
  { id: "trends", label: "Trends", icon: TrendingUp },
];

// ─── Custom tooltip ─────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: p.color }} />
          {p.name}: <span className="text-foreground font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Location Detail ────────────────────────────────────────────────
const LocationDetail = ({ loc, onBack }: { loc: typeof locationData[0]; onBack: () => void }) => (
  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-primary hover:underline"><ArrowLeft className="w-3.5 h-3.5" /> All locations</button>
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-foreground">{loc.name}</h3>
      <div className="flex items-center gap-4">
        <div className="text-right"><p className="text-xl font-bold text-foreground">{loc.cases}</p><p className="text-[10px] text-muted-foreground">total cases</p></div>
        <div className="text-right"><p className={`text-xl font-bold ${loc.remakes > 3.5 ? "text-destructive" : "text-primary"}`}>{loc.remakes}%</p><p className="text-[10px] text-muted-foreground">remake rate</p></div>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Monthly Cases & Remakes</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={loc.monthly} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(192, 15%, 13%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="cases" name="Cases" fill="hsl(72, 70%, 55%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="remakes" name="Remakes" fill="hsl(0, 70%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Product Mix</p>
        <ResponsiveContainer width="100%" height={140}>
          <PieChart><Pie data={loc.products} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30} paddingAngle={3}>{loc.products.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 mt-2">{loc.products.map((p, i) => (<span key={p.name} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />{p.name}</span>))}</div>
      </div>
    </div>
  </motion.div>
);

// ─── Provider Detail ────────────────────────────────────────────────
const ProviderDetail = ({ doc, onBack }: { doc: typeof providerData[0]; onBack: () => void }) => (
  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-primary hover:underline"><ArrowLeft className="w-3.5 h-3.5" /> All providers</button>
    <div className="flex items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">{doc.name.split(" ").slice(1).map(n => n[0]).join("")}</div>
      <div><h3 className="text-lg font-semibold text-foreground">{doc.name}</h3><p className="text-xs text-muted-foreground">{doc.location}</p></div>
      <div className="ml-auto flex items-center gap-6">
        <div className="text-right"><p className="text-xl font-bold text-foreground">{doc.cases}</p><p className="text-[10px] text-muted-foreground">cases</p></div>
        <div className="text-right"><p className={`text-xl font-bold ${doc.accuracy >= 97 ? "text-primary" : "text-foreground"}`}>{doc.accuracy}%</p><p className="text-[10px] text-muted-foreground">accuracy</p></div>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Cases Over Time</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={doc.monthly}>
            <defs><linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(72, 70%, 55%)" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(72, 70%, 55%)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(192, 15%, 13%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="cases" name="Cases" stroke="hsl(72, 70%, 55%)" fill="url(#caseGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Accuracy Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={doc.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(192, 15%, 13%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[90, 100]} tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke="hsl(72, 70%, 55%)" strokeWidth={2} dot={{ fill: "hsl(72, 70%, 55%)", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Case Type Breakdown</p>
      <div className="flex items-center gap-6">
        {doc.types.map((t, i) => (
          <div key={t.name} className="flex-1">
            <div className="flex items-center justify-between mb-1"><span className="text-xs text-muted-foreground">{t.name}</span><span className="text-xs font-medium text-foreground">{t.value}%</span></div>
            <div className="h-2 rounded-full bg-muted overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${t.value}%` }} transition={{ duration: 0.6, delay: i * 0.1 }} className="h-full rounded-full" style={{ background: PIE_COLORS[i] }} /></div>
          </div>
        ))}
      </div>
    </div>
  </motion.div>
);

// ─── KPI Card ───────────────────────────────────────────────────────
const KPICard = ({ stat, index, expandedCard, setExpandedCard }: {
  stat: { label: string; value: string; change: string; up: boolean; numericValue: number; decimals: number; prefix: string; suffix: string };
  index: number; expandedCard: string | null; setExpandedCard: (v: string | null) => void;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, margin: "-50px" });
  const count = useCountUp(stat.numericValue, 1400 + index * 200, stat.decimals, inView);
  const isExpanded = expandedCard === stat.label;
  const sparkData = kpiSparklines[stat.label as keyof typeof kpiSparklines];
  const displayValue = `${stat.prefix}${stat.decimals > 0 ? count.toFixed(stat.decimals) : count.toLocaleString()}${stat.suffix}`;

  return (
    <motion.div ref={cardRef} key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
      onClick={() => setExpandedCard(isExpanded ? null : stat.label)}
      className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-all cursor-pointer select-none">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{stat.label}</p>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </div>
      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{displayValue}</p>
      <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
        stat.label === "Remake Rate" || stat.label === "Avg Turnaround" ? (stat.up ? "text-destructive" : "text-primary") : (stat.up ? "text-primary" : "text-destructive")
      }`}>
        {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{stat.change}
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 100, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden mt-3 border-t border-border pt-3">
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={sparkData}>
                <defs><linearGradient id={`spark-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(72, 70%, 55%)" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(72, 70%, 55%)" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="month" tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name={stat.label} stroke="hsl(72, 70%, 55%)" fill={`url(#spark-${index})`} strokeWidth={1.5} dot={{ r: 2, fill: "hsl(72, 70%, 55%)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Dashboard sub-views ────────────────────────────────────────────
const OverviewView = () => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const kpis = [
    { label: "Total Cases", value: "1,454", change: "+12.3%", up: true, numericValue: 1454, decimals: 0, prefix: "", suffix: "" },
    { label: "Remake Rate", value: "2.8%", change: "-1.4%", up: false, numericValue: 2.8, decimals: 1, prefix: "", suffix: "%" },
    { label: "Avg Turnaround", value: "4.2 days", change: "-0.8 days", up: false, numericValue: 4.2, decimals: 1, prefix: "", suffix: " days" },
    { label: "Active Locations", value: "5", change: "+1", up: true, numericValue: 5, decimals: 0, prefix: "", suffix: "" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{kpis.map((stat, i) => <KPICard key={stat.label} stat={stat} index={i} expandedCard={expandedCard} setExpandedCard={setExpandedCard} />)}</div>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-foreground">Monthly Case Volume</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />Cases</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" />Remakes</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trendData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(192, 15%, 13%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(192, 20%, 10%)" }} />
            <Bar dataKey="cases" name="Cases" fill="hsl(72, 70%, 55%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="remakes" name="Remakes %" fill="hsl(0, 70%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const LocationsView = ({ onSelect }: { onSelect: (i: number) => void }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
      <span className="col-span-4">Location</span><span className="col-span-2 text-center">Cases</span><span className="col-span-2 text-center">Remakes</span><span className="col-span-2 text-center">Score</span><span className="col-span-2 text-center">Trend</span>
    </div>
    {locationData.map((loc, i) => (
      <motion.div key={loc.name} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} onClick={() => onSelect(i)}
        className="grid grid-cols-12 gap-4 items-center rounded-lg border border-border bg-card px-4 py-3.5 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all group">
        <div className="col-span-4 flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-primary group-hover:translate-x-0.5 transition-transform" /><span className="text-sm font-medium text-foreground">{loc.name}</span></div>
        <span className="col-span-2 text-center text-sm text-muted-foreground">{loc.cases}</span>
        <span className={`col-span-2 text-center text-sm font-medium ${loc.remakes > 3.5 ? "text-destructive" : "text-primary"}`}>{loc.remakes}%</span>
        <div className="col-span-2 flex justify-center"><div className="w-full max-w-[60px] h-1.5 rounded-full bg-muted overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${loc.score}%` }} transition={{ delay: 0.2 + i * 0.06, duration: 0.6 }} className={`h-full rounded-full ${loc.score >= 96 ? "bg-primary" : "bg-muted-foreground"}`} /></div></div>
        <div className="col-span-2 flex justify-center">{loc.trend === "down" ? <span className="flex items-center gap-1 text-xs text-primary"><ArrowDownRight className="w-3 h-3" />Improving</span> : <span className="flex items-center gap-1 text-xs text-destructive/70"><ArrowUpRight className="w-3 h-3" />Watch</span>}</div>
      </motion.div>
    ))}
    <p className="text-[11px] text-muted-foreground text-center pt-2">Click a location to see detailed analytics</p>
  </motion.div>
);

const ProvidersView = ({ onSelect }: { onSelect: (i: number) => void }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
    {providerData.map((doc, i) => (
      <motion.div key={doc.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => onSelect(i)}
        className="rounded-lg border border-border bg-card p-4 flex items-center justify-between cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all group">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">{doc.name.split(" ").slice(1).map(n => n[0]).join("")}</div>
          <div><p className="text-sm font-medium text-foreground">{doc.name}</p><p className="text-xs text-muted-foreground">{doc.location}</p></div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right"><p className="text-sm font-semibold text-foreground">{doc.cases}</p><p className="text-[10px] text-muted-foreground">cases</p></div>
          <div className="text-right"><p className={`text-sm font-semibold ${doc.accuracy >= 97 ? "text-primary" : "text-foreground"}`}>{doc.accuracy}%</p><p className="text-[10px] text-muted-foreground">accuracy</p></div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </motion.div>
    ))}
    <p className="text-[11px] text-muted-foreground text-center pt-2">Click a provider to see detailed analytics</p>
  </motion.div>
);

const TrendsView = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Remake Rate Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData}>
            <defs><linearGradient id="remakeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(72, 70%, 55%)" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(72, 70%, 55%)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(192, 15%, 13%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="remakes" name="Remakes %" stroke="hsl(72, 70%, 55%)" fill="url(#remakeGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-primary"><TrendingUp className="w-3 h-3" />53% improvement over 7 months</div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Case Volume Growth</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(192, 15%, 13%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(192, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(192, 20%, 10%)" }} />
            <Bar dataKey="cases" name="Cases" fill="hsl(72, 70%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Activity className="w-3 h-3" />45% case volume increase</div>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[{ title: "Fastest Improving", value: "Location C", detail: "Remakes down 62% in 6 months" }, { title: "Highest Volume", value: "Dr. Sarah Chen", detail: "142 cases this quarter" }, { title: "Best New Location", value: "Location E", detail: "On-boarded 3 months ago, already top 3" }].map((card, i) => (
        <motion.div key={card.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] text-primary uppercase tracking-wider font-medium">{card.title}</p>
          <p className="text-base font-semibold text-foreground mt-2">{card.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{card.detail}</p>
        </motion.div>
      ))}
    </div>
  </motion.div>
);


// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const MicrositeHeartlandSkin = ({ data, skinConfig, onOpenDemo, onTrackCTA, editorMode, sectionStyles, onUpdateSectionStyle }: HeartlandSkinProps) => {
  const company = data.companyName;
  const cfg = skinConfig;
  const size = data.sizeAndLocations;
  const practiceCount = size?.practiceCount ? parseInt(size.practiceCount.replace(/[^\d]/g, ""), 10) : null;
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  // Navbar
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Dashboard
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState("Last 6 months");
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const DATE_RANGES = ["Last 7 days", "Last 30 days", "Last 90 days", "Last 6 months", "Last 12 months"];

  // Calculator
  const [calcOpen, setCalcOpen] = useState(false);

  // Lab tour video
  const [videoOpen, setVideoOpen] = useState(false);

  // Visible sections from config
  const defaultVisibleSectionIds = ["hero", "hiddenCost", "problem", "comparison", "dashboard", "aiScanReview", "successStories", "pilotApproach", "labTour", "calculator", "finalCTA"];
  const visibleSections = useMemo(() => {
    const configured = (cfg?.sections || []).filter((s) => s.visible).map((s) => s.id);
    return new Set(configured.length > 0 ? configured : defaultVisibleSectionIds);
  }, [cfg]);
  const getSectionHeadline = (id: string) => {
    const s = cfg?.sections.find(s => s.id === id);
    return s?.headline ? rep(s.headline, company) : "";
  };

  // Stats bar
  const stats = cfg?.statsBar && cfg.statsBar.length > 0 ? cfg.statsBar : [{ value: "96%", label: "First-time right" }, { value: "60%", label: "Fewer remakes" }];

  // Challenges
  const challengeIcons = [TrendingDown, BarChart3, Scale, Wallet];
  const challenges = cfg?.challenges && cfg.challenges.length > 0 ? cfg.challenges : [];

  // Comparison rows
  const compRows = cfg?.comparisonRows && cfg.comparisonRows.length > 0 ? cfg.comparisonRows : [];

  // Case studies
  const DEFAULT_HL_CASE_STUDIES = [
    { name: "APEX Dental Partners", stat: "12.5%", label: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Layla Lohmann, Founder" },
    { name: "Open & Affordable Dental", stat: "96%", label: "reduction in remakes", quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.", author: "Clinical Director" },
    { name: "Dental Care Alliance", stat: "99%", label: "practices still using Dandy after one year", quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.", author: "Dr. Trey Mueller, Chief Clinical Officer" },
  ];
  const allCaseStudies: SkinCaseStudy[] = cfg?.caseStudies?.length ? cfg.caseStudies : DEFAULT_HL_CASE_STUDIES;
  const caseStudies = filterByPracticeCount(allCaseStudies, practiceCount, 3).slice(0, 3) as SkinCaseStudy[];

  // Nav links
  const navLinks = [
    { label: "Platform", href: "#dashboard" },
    { label: "Solutions", href: "#solutions" },
    { label: "Results", href: "#results" },
    { label: "See ROI", href: "#calculator" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleDashTabChange = (id: string) => { setActiveTab(id); setSelectedLocation(null); setSelectedProvider(null); };

  const renderDashContent = () => {
    if (activeTab === "locations" && selectedLocation !== null) return <LocationDetail loc={locationData[selectedLocation]} onBack={() => setSelectedLocation(null)} />;
    if (activeTab === "providers" && selectedProvider !== null) return <ProviderDetail doc={providerData[selectedProvider]} onBack={() => setSelectedProvider(null)} />;
    switch (activeTab) {
      case "overview": return <OverviewView />;
      case "locations": return <LocationsView onSelect={setSelectedLocation} />;
      case "providers": return <ProvidersView onSelect={setSelectedProvider} />;
      case "trends": return <TrendsView />;
      default: return null;
    }
  };

  // Pilot steps with tokenized content
  const pilotSteps = [
    { icon: Rocket, title: "Launch a Pilot", subtitle: "Start with 5–10 practices", desc: `Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows — no CAPEX, no disruption.`, details: ["Premium hardware included for every operatory", "Dedicated field team manages change management", "Doctors trained and scanning within days"] },
    { icon: BarChart3, title: "Validate Impact", subtitle: "Measure results in 60–90 days", desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time — proving ROI before you scale.", details: ["Live dashboard tracks pilot KPIs", "Compare pilot locations vs. control group", "Executive-ready reporting for leadership review"] },
    { icon: TrendingUp, title: "Scale With Confidence", subtitle: "Roll out across the network", desc: `Expand across ${company} with the same standard, same playbook, and same results — predictable execution at enterprise scale.`, details: ["Consistent onboarding across all locations", "One standard across every practice", "MSA ensures network-wide alignment at scale"] },
  ];

  // Solution pillars
  const pillars = [
    { number: "01", icon: TrendingUp, label: "Same-Store Growth", headline: "Your lab is the growth engine.", desc: "Higher case acceptance, faster throughput, and expanded services — turning a cost center into a scalable revenue driver.", stats: [{ value: "30%", label: "higher case acceptance" }, { value: "31%", label: "annual revenue growth" }] },
    { number: "02", icon: Layers, label: "Network-Wide Standardization", headline: "Growth breaks without a standard that scales.", desc: `Dandy embeds a single clinical and operational standard across every practice — ensuring predictable outcomes as ${company} grows.`, stats: [{ value: "300%", label: "nightguard volume increase" }, { value: "2–3 min", label: "saved per crown appt" }] },
    { number: "03", icon: Shield, label: "Waste Prevention", headline: "Waste is the hidden tax on every DSO.", desc: "By preventing remakes, delays, and variability before they occur, Dandy delivers immediate, visible value during pilots.", stats: [{ value: "96%", label: "remake reduction" }, { value: "2x", label: "faster denture workflow" }] },
    { number: "04", icon: Eye, label: "Executive Visibility", headline: "Visibility isn't reporting — it's control.", desc: "Actionable insights that allow leaders to intervene early, manage by exception, and maintain control as complexity increases.", stats: [{ value: "Real-time", label: "network-wide data" }, { value: "AI-powered", label: "issue detection" }] },
  ];

  // Pilot timeline scroll
  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: timelineProgress } = useScroll({ target: timelineRef, offset: ["start 80%", "end 60%"] });
  const lineHeight = useTransform(timelineProgress, [0, 1], ["0%", "100%"]);

  const heroHeadline = cfg?.heroHeadlinePattern ? rep(cfg.heroHeadlinePattern, company) : `Built for ${company}.`;
  const heroSubtext = cfg?.heroSubtext ? rep(cfg.heroSubtext, company) : `The lab partner built to match ${company}'s scale.`;
  const heroCTA = cfg?.heroCTAText || "Get Started";
  const secondaryCTA = cfg?.secondaryCTAText || "Calculate ROI";
  const navCTA = cfg?.navCTAText || "GET STARTED";
  const finalHeadline = cfg?.finalCTAHeadline ? rep(cfg.finalCTAHeadline, company) : `Prove ROI at a handful of practices — then scale across ${company}.`;
  const finalSubheadline = cfg?.finalCTASubheadline ? rep(cfg.finalCTASubheadline, company) : "We'll pilot at 5–10 practices, validate the impact on remakes, chair time, and revenue — then roll out with confidence.";

  const heroImage = cfg?.sectionImages?.heroImage || heroBoardroom;

  const sectionLabels: Record<string, string> = {
    hero: "Hero", hiddenCost: "Hidden Cost", problem: "Problem", comparison: "Comparison",
    solution: "Solution", dashboard: "Dashboard", aiScanReview: "AI Quality",
    successStories: "Success Stories", pilotApproach: "Pilot Program", labTour: "Lab Tour",
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

  return (
    <div className="heartland-skin" style={DARK_VARS as React.CSSProperties}>
      {/* ═══ NAVBAR ═══ */}
      <motion.nav initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/90 backdrop-blur-xl border-b border-border" : "bg-transparent"}`}>
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 flex items-center justify-between h-16">
          <a href="https://www.meetdandy.com" className="hover:opacity-80 transition-opacity"><img src={dandyLogoWhite} alt="Dandy" className="h-5 w-auto" /></a>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <a key={link.label} href={link.href} onClick={e => { e.preventDefault(); document.getElementById(link.href.replace("#",""))?.scrollIntoView({ behavior: "smooth" }); }}
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">{link.label}</a>
            ))}
            <button onClick={() => onOpenDemo(undefined, "Nav CTA")} className="inline-flex items-center justify-center rounded-full px-5 py-2 text-[13px] font-semibold text-background transition-colors bg-primary">{navCTA}</button>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-foreground" aria-label="Toggle menu">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.nav>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed inset-0 z-40 bg-background pt-16">
            <div className="flex flex-col items-center gap-8 p-10">
              {navLinks.map(link => <a key={link.label} href={link.href} onClick={e => { e.preventDefault(); setMobileOpen(false); setTimeout(() => document.getElementById(link.href.replace("#",""))?.scrollIntoView({ behavior: "smooth" }), 300); }} className="text-lg font-medium text-foreground">{link.label}</a>)}
              <button onClick={() => { onOpenDemo(undefined, "Mobile Nav CTA"); setMobileOpen(false); }} className="inline-flex items-center justify-center rounded-full bg-foreground px-8 py-3 text-sm font-semibold text-background">{navCTA}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* ═══ HERO ═══ */}
        {visibleSections.has("hero") && wrapSection("hero",
          <section ref={heroRef} className="relative min-h-screen flex flex-col overflow-hidden">
            <div className="absolute inset-0">
              <img src={heroImage} alt={`${company} executive overview`} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(192 30% 5% / 0.65) 0%, hsl(192 30% 5% / 0.75) 50%, hsl(192 25% 8% / 0.9) 100%)" }} />
            </div>
            <motion.div style={{ opacity: heroOpacity }} className="relative z-10 flex-1 flex flex-col justify-center max-w-[1200px] mx-auto px-6 md:px-10 w-full pt-24 pb-12">
              <div className="text-center mb-12">
                <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[1.05] drop-shadow-[0_2px_30px_rgba(0,0,0,0.4)]" style={{ color: "hsl(0 0% 100%)" }}>
                  {heroHeadline.includes(company) ? (
                    <>{heroHeadline.split(company)[0]}<br /><span className="text-primary">{company}.</span></>
                  ) : heroHeadline}
                </motion.h1>
                <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
                  className="mt-6 text-base md:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">{heroSubtext}</motion.p>
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
                  className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={() => onOpenDemo(undefined, "Hero CTA")} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                    {heroCTA}<ArrowRight className="w-4 h-4" />
                  </button>
                  <a href="#calculator" onClick={e => { e.preventDefault(); document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" }); }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-8 py-3.5 text-sm font-semibold text-foreground hover:border-foreground/40 transition-colors">{secondaryCTA}</a>
                </motion.div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }} className="flex flex-col items-center gap-2 pb-8">
                <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} className="w-5 h-8 rounded-full border border-muted-foreground/20 flex items-start justify-center pt-1.5">
                  <div className="w-1 h-1.5 rounded-full bg-muted-foreground/40" />
                </motion.div>
              </motion.div>
            </motion.div>
          </section>
        )}

        {/* ═══ METRICS BAR ═══ */}
        <section className="border-t border-border/50 relative z-[2]" style={{ background: "hsl(192, 28%, 4%)" }}>
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-5">
            <div className="grid grid-cols-4 divide-x divide-border/40">
              {stats.map((m, i) => (
                <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="text-center px-4">
                  <p className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "hsl(72, 55%, 48%)" }}>{m.value}</p>
                  <p className="text-[10px] md:text-xs mt-0.5 uppercase tracking-wider" style={{ color: "hsl(192, 15%, 55%)" }}>{m.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {visibleSections.has("hiddenCost") && challenges.length > 0 && wrapSection("hiddenCost",
          <div style={{ background: "hsl(192, 30%, 5%)" }}>
            <section className="py-20 md:py-28 lg:py-36 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <img src={heroBusiness} alt="" className="w-full h-full object-cover opacity-[0.04]" aria-hidden="true" />
                <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-primary/5" />
              </div>
              <div className="relative max-w-[1200px] mx-auto px-6 md:px-10">
                <div className="max-w-2xl">
                  <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-sm font-medium text-primary mb-4">The Hidden Cost</motion.p>
                  <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-display text-foreground">
                    {getSectionHeadline("hiddenCost") || `At ${company}'s scale — even small inefficiencies compound fast.`}
                  </motion.h2>
                </div>
                <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {challenges.map((c, i) => {
                    const Icon = challengeIcons[i % challengeIcons.length];
                    return (
                      <motion.div key={c.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                        className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6 hover:border-primary/30 transition-colors duration-300">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-primary" /></div>
                        <h3 className="text-base font-semibold text-foreground">{c.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{rep(c.desc, company)}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}


        {visibleSections.has("problem") && wrapSection("problem",
          <section className="py-20 md:py-28 lg:py-36 relative z-10 overflow-hidden" style={{ background: "hsl(0, 0%, 98%)", color: "hsl(192, 30%, 10%)" }}>
            <div className="max-w-[1200px] mx-auto px-6 md:px-10 relative z-10">
              <div className="text-center mb-16">
                <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-5" style={{ color: "hsl(72, 55%, 48%)" }}>
                  The Problem
                </motion.p>
                <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display" style={{ color: "hsl(192, 30%, 10%)" }}>
                  {getSectionHeadline("problem") || "Lab consolidation shouldn't mean compromise."}
                </motion.h2>
                <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-6 text-base md:text-lg max-w-2xl mx-auto" style={{ color: "hsl(192, 10%, 40%)" }}>
                  {company}'s doctor-led model is its greatest strength. But managing lab relationships across 1,900+ practices creates fragmentation that undermines both cost control and clinical quality.
                </motion.p>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                {[
                  { icon: AlertTriangle, title: "Fragmented Networks", desc: "No centralized visibility or control across your lab relationships." },
                  { icon: BarChart3, title: "Scattered Data", desc: "Performance tracking impossible across disconnected systems." },
                  { icon: Users2, title: "Provider Resistance", desc: "Inconsistent quality erodes provider confidence and slows adoption." },
                  { icon: TrendingDown, title: "Revenue Leakage", desc: "Remakes, wasted chair time, and inefficiency drain profitability silently." },
                ].map((p, i) => (
                  <motion.div key={p.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="rounded-2xl p-8 group" style={{ background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-6 group-hover:opacity-80 transition-colors" style={{ background: "hsl(72, 55%, 48% / 0.08)" }}>
                      <p.icon className="w-5 h-5" style={{ color: "hsl(72, 55%, 48%)" }} />
                    </div>
                    <h3 className="text-lg font-medium tracking-tight" style={{ color: "hsl(192, 30%, 10%)" }}>{p.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "hsl(192, 10%, 40%)" }}>{p.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}




        {/* ═══ COMPARISON ═══ */}
        {visibleSections.has("comparison") && compRows.length > 0 && wrapSection("comparison",
          <div style={{ background: "hsl(192, 30%, 5%)" }}>
            <section id="solutions" className="py-20 md:py-28 lg:py-36">
              <div className="max-w-[1000px] mx-auto px-6 md:px-10">
                <div className="text-center mb-14">
                  <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-4">The Dandy Difference</motion.p>
                  <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-display text-foreground">
                    {getSectionHeadline("comparison") || "Your lab should be a competitive advantage."}
                  </motion.h2>
                </div>
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.6 }} className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="grid grid-cols-3 bg-card/80">
                    <div className="p-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">What DSOs Need</div>
                    <div className="p-4 text-[10px] font-semibold uppercase tracking-widest text-primary">Dandy</div>
                    <div className="p-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Traditional Labs</div>
                  </div>
                  {compRows.map((row, i) => (
                    <motion.div key={row.need} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                      className="grid grid-cols-3 border-t border-border/40 hover:bg-card/30 transition-colors">
                      <div className="p-4 text-sm font-medium text-foreground">{row.need}</div>
                      <div className="p-4 flex items-start gap-2"><Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" /><span className="text-sm text-foreground/80">{row.dandy}</span></div>
                      <div className="p-4 flex items-start gap-2"><Minus className="w-3.5 h-3.5 text-muted-foreground/30 mt-0.5 shrink-0" /><span className="text-sm text-muted-foreground/50">{row.traditional}</span></div>
                    </motion.div>
                  ))}
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="mt-10 text-center">
                  <button onClick={() => onOpenDemo(undefined, "Comparison CTA")} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-background hover:bg-white/90 transition-colors">Request a Demo<ArrowRight className="w-4 h-4" /></button>
                </motion.div>
              </div>
            </section>
          </div>
        )}

        {/* ═══ SOLUTION ═══ */}
        {visibleSections.has("solution") && wrapSection("solution",
          <section className="py-20 md:py-28 lg:py-36" style={{ background: "hsl(0, 0%, 98%)", color: "hsl(192, 30%, 10%)" }}>
            <div className="max-w-[1200px] mx-auto px-6 md:px-10">
              <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center mb-20">
                <div>
                  <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-5" style={{ color: "hsl(72, 55%, 48%)" }}>
                    The Dandy Platform
                  </motion.p>
                  <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display" style={{ color: "hsl(192, 30%, 10%)" }}>
                    {getSectionHeadline("solution") || <>Four systems.<br />One growth engine.</>}
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-6 text-base md:text-lg" style={{ color: "hsl(192, 10%, 40%)" }}>
                    Dandy combines advanced manufacturing, AI-driven quality control, and network-wide insights — giving {company} the tools to drive same-store growth across every office.
                  </motion.p>
                </div>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="relative rounded-3xl overflow-hidden group">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={digitalScanning} alt="Dandy digital scanning workflow" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" loading="lazy" />
                  </div>
                </motion.div>
              </div>
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-px hidden md:block" style={{ background: "hsl(192, 10%, 88%)" }} />
                <div className="space-y-5">
                  {pillars.map((p, i) => (
                    <motion.div key={p.label} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6 }} className="group relative md:pl-20">
                      <div className="hidden md:flex absolute left-0 top-8 w-12 h-12 rounded-full border-2 items-center justify-center z-10 transition-all duration-300" style={{ background: "hsl(0, 0%, 95%)", borderColor: "hsl(192, 10%, 88%)" }}>
                        <span className="text-xs font-semibold" style={{ color: "hsl(72, 55%, 48%)" }}>{p.number}</span>
                      </div>
                      <div className="rounded-2xl p-7 md:p-9" style={{ background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" }}>
                        <div className="flex flex-col md:flex-row md:items-start md:gap-10">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors" style={{ background: "hsl(72, 55%, 48% / 0.08)" }}>
                                <p.icon className="w-4 h-4" style={{ color: "hsl(72, 55%, 48%)" }} />
                              </div>
                              <span className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: "hsl(72, 55%, 48%)" }}>{p.label}</span>
                            </div>
                            <h3 className="text-xl md:text-2xl font-medium leading-snug tracking-tight" style={{ color: "hsl(192, 30%, 10%)" }}>{p.headline}</h3>
                            <p className="mt-3 text-[15px] leading-relaxed max-w-lg" style={{ color: "hsl(192, 10%, 40%)" }}>{p.desc}</p>
                          </div>
                          <div className="flex md:flex-col gap-8 md:gap-5 mt-6 md:mt-0 md:min-w-[160px] md:text-right">
                            {p.stats.map((s) => (
                              <div key={s.label}>
                                <p className="text-2xl md:text-3xl font-medium tracking-tight" style={{ color: "hsl(192, 30%, 10%)" }}>{s.value}</p>
                                <p className="text-xs mt-0.5 leading-snug" style={{ color: "hsl(192, 10%, 40%)" }}>{s.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}


        {/* ═══ DASHBOARD ═══ */}
        {visibleSections.has("dashboard") && wrapSection("dashboard",
          <div style={{ background: "hsl(192, 30%, 5%)" }}>
            <section id="dashboard" className="py-20 md:py-28 lg:py-36">
              <div className="max-w-[1200px] mx-auto px-6 md:px-10">
                <div className="text-center mb-12">
                  <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-sm font-medium text-primary mb-4">Executive Visibility</motion.p>
                  <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-display text-foreground">
                    {getSectionHeadline("dashboard") || "Visibility isn't reporting. It's control."}
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                    className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
                    Here's what {company}'s dashboard could look like — real-time visibility across your entire network.
                  </motion.p>
                </div>
                {/* Tab bar */}
                <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="flex justify-center mb-8">
                  <div className="rounded-lg border border-border bg-card p-1 flex gap-1">
                    {dashTabs.map(tab => {
                      const Icon = tab.icon;
                      return (
                        <button key={tab.id} onClick={() => handleDashTabChange(tab.id)}
                          className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                          <Icon className="w-4 h-4" /><span className="hidden sm:inline">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
                {/* Dashboard frame */}
                <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.7 }} className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" /><div className="w-2.5 h-2.5 rounded-full bg-primary/30" /><div className="w-2.5 h-2.5 rounded-full bg-primary/20" />
                    <div className="ml-3 flex-1 max-w-xs"><div className="rounded bg-muted px-3 py-1 text-[11px] text-muted-foreground text-center">app.meetdandy.com/dashboard</div></div>
                    <div className="relative ml-auto">
                      <button onClick={() => setDateDropdownOpen(!dateDropdownOpen)} className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                        <CalendarIcon className="w-3 h-3" />{dateRange}<ChevronDown className={`w-3 h-3 transition-transform ${dateDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {dateDropdownOpen && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-card shadow-lg py-1 min-w-[140px]">
                            {DATE_RANGES.map(range => (
                              <button key={range} onClick={() => { setDateRange(range); setDateDropdownOpen(false); }} className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${dateRange === range ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>{range}</button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="p-5 md:p-7 min-h-[400px] bg-background">
                    <AnimatePresence mode="wait">
                      <motion.div key={`${activeTab}-${selectedLocation}-${selectedProvider}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                        {renderDashContent()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            </section>
          </div>
        )}

        {/* ═══ AI QUALITY ═══ */}
        {visibleSections.has("aiScanReview") && wrapSection("aiScanReview",
          <div style={{ background: "hsl(192, 25%, 8%)" }}>
            <section className="py-20 md:py-28 lg:py-36">
              <div className="max-w-[1200px] mx-auto px-6 md:px-10">
                <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
                  <div>
                    <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-4">Waste Prevention</motion.p>
                    <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-display text-foreground">
                      {getSectionHeadline("aiScanReview") || "Remakes are a tax. AI eliminates them."}
                    </motion.h2>
                    <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed">
                      AI Scan Review catches issues in real time — avoiding costly rework and maximizing revenue potential before a case ever reaches the bench.
                    </motion.p>
                    <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="mt-8 space-y-3">
                      {[{ icon: BrainCircuit, text: "AI reviews every scan for clinical accuracy" }, { icon: ScanLine, text: "Real-time feedback before case submission" }, { icon: ShieldCheck, text: "Eliminates remakes at the source" }].map(item => (
                        <div key={item.text} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/[0.08] border border-primary/10 flex items-center justify-center shrink-0"><item.icon className="w-4 h-4 text-primary" /></div>
                          <span className="text-sm text-foreground/80">{item.text}</span>
                        </div>
                      ))}
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="mt-10 flex gap-8">
                      {[{ value: "96%", label: "First-Time Right" }, { value: "<30s", label: "Scan Review" }, { value: "100%", label: "AI-Screened" }].map(s => (
                        <div key={s.label}><p className="text-2xl font-semibold text-foreground">{s.value}</p><p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{s.label}</p></div>
                      ))}
                    </motion.div>
                  </div>
                  <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="relative order-first md:order-last">
                    <div className="rounded-xl overflow-hidden border border-border/60 relative">
                      <motion.img src={cfg?.sectionImages?.aiScanReviewImage || aiScanReview} alt="AI-powered dental scan quality review" className="w-full h-auto aspect-[4/3] object-cover" loading="lazy"
                        animate={{ scale: [1, 1.03, 1], rotate: [0, 0.3, -0.3, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
                      <motion.div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent"
                        animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} />
                    </div>
                  </motion.div>
                </div>
              </div>
            </section>
          </div>
        )}



        {/* ═══ SUCCESS STORIES ═══ */}
        {visibleSections.has("successStories") && caseStudies.length > 0 && wrapSection("successStories",
          <section id="results" className="py-20 md:py-28 lg:py-36 relative z-10 overflow-hidden" style={{ background: "hsl(0, 0%, 98%)", color: "hsl(192, 30%, 10%)" }}>
            <div className="max-w-[1200px] mx-auto px-6 md:px-10 relative z-10">
              <div className="text-center mb-14">
                <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "hsl(160, 35%, 18%)" }}>Proven Results</motion.p>
                <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-display" style={{ color: "hsl(192, 30%, 10%)" }}>
                  {getSectionHeadline("successStories") || "DSOs that switched and never looked back."}
                </motion.h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {caseStudies.map((s, i) => (
                  <motion.div key={s.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }}
                    className="group rounded-xl border overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col" style={{ borderColor: "hsl(192, 10%, 88%)", background: "white" }}>
                    <div className="relative h-40 overflow-hidden">
                      <img src={CASE_IMAGES[i % CASE_IMAGES.length]} alt={`${s.name} case study`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
                      <div className="absolute bottom-3 left-5"><p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "hsl(192, 30%, 10% / 0.7)" }}>{s.name}</p></div>
                    </div>
                    <div className="p-6 pt-4 flex flex-col flex-1">
                      <p className="text-3xl font-semibold tracking-tight" style={{ color: "hsl(160, 35%, 18%)" }}>{s.stat}</p>
                      <p className="mt-1 text-sm" style={{ color: "hsl(192, 10%, 40%)" }}>{s.label}</p>
                      <div className="mt-5 flex-1">
                        <Quote className="w-3.5 h-3.5 mb-2" style={{ color: "hsl(192, 10%, 40% / 0.2)" }} />
                        <blockquote className="text-sm leading-relaxed italic" style={{ color: "hsl(192, 10%, 40%)" }}>{s.quote}</blockquote>
                      </div>
                      <p className="mt-5 text-xs font-medium" style={{ color: "hsl(192, 30%, 10% / 0.6)" }}>— {s.author}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}



        {/* ═══ PILOT PROGRAM ═══ */}
        {visibleSections.has("pilotApproach") && wrapSection("pilotApproach",
          <div style={{ background: "hsl(192, 30%, 5%)" }}>
            <section className="py-20 md:py-28 lg:py-36">
              <div className="max-w-3xl mx-auto px-6 md:px-10">
                <div className="text-center mb-14">
                  <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-4">How It Works</motion.p>
                  <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-display text-foreground">
                    {getSectionHeadline("pilotApproach") || "Start small. Prove it. Then scale."}
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                    className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">Validate impact with a focused pilot — then scale with confidence.</motion.p>
                </div>
                <div className="relative" ref={timelineRef}>
                  <div className="absolute left-5 md:left-6 top-0 bottom-0 w-px bg-border/50" />
                  <motion.div className="absolute left-5 md:left-6 top-0 w-px bg-primary origin-top" style={{ height: lineHeight }} />
                  <div className="space-y-12">
                    {pilotSteps.map((step, i) => (
                      <motion.div key={step.title} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5 }} className="relative flex gap-5 md:gap-7">
                        <div className="relative z-10 shrink-0"><div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary flex items-center justify-center"><step.icon className="w-5 h-5 text-primary-foreground" /></div></div>
                        <div className="pb-2 -mt-0.5">
                          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-1">Step 0{i + 1}</p>
                          <h3 className="text-lg font-semibold text-foreground tracking-tight">{step.title}</h3>
                          <p className="text-sm font-medium text-primary/80 mt-0.5">{step.subtitle}</p>
                          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                          <ul className="mt-3 space-y-1.5">{step.details.map(d => (
                            <li key={d} className="flex items-start gap-2 text-sm text-foreground/60"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /><span>{d}</span></li>
                          ))}</ul>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}


        {/* ═══ LAB TOUR ═══ */}
        {visibleSections.has("labTour") && wrapSection("labTour",
          <div style={{ background: "hsl(192, 25%, 8%)" }}>
            <section className="py-20 md:py-28 lg:py-36">
              <div className="max-w-[1200px] mx-auto px-6 md:px-10">
                <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
                  <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
                    className="relative rounded-xl overflow-hidden border border-border group cursor-pointer" onClick={() => setVideoOpen(true)}>
                    <div className="relative aspect-[4/3]">
                      <img src={cfg?.sectionImages?.labTourImage || dandyLabMachines} alt="Dandy lab manufacturing floor" className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-background/30 group-hover:bg-background/20 transition-colors duration-300" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300"><Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" /></div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/80 to-transparent">
                        <p className="text-xs font-medium text-primary uppercase tracking-wider">Lab Tour</p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">Inside Dandy's U.S. Manufacturing Facility</p>
                      </div>
                    </div>
                  </motion.div>
                  <div>
                    <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-4">Built in the USA</motion.p>
                    <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-display text-foreground">
                      {getSectionHeadline("labTour") || "See vertical integration in action."}
                    </motion.h2>
                    <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-5 text-lg text-muted-foreground leading-relaxed">
                      U.S.-based manufacturing, AI quality control, and expert technicians — delivering a 96% first-time right rate at enterprise scale.
                    </motion.p>
                    <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="mt-8 grid grid-cols-2 gap-3">
                      {[{ icon: Microscope, label: "Advanced Materials Lab" }, { icon: Cpu, label: "AI Quality Control" }, { icon: Users, label: "U.S.-Based Technicians" }, { icon: MapPin, label: "Multiple Locations" }].map(h => (
                        <div key={h.label} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border"><h.icon className="w-4 h-4 text-primary shrink-0" /><span className="text-sm text-foreground/80">{h.label}</span></div>
                      ))}
                    </motion.div>
                    <motion.button initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                      onClick={() => onOpenDemo(undefined, "Lab Tour CTA")} className="inline-flex items-center gap-2 mt-8 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                      <MapPin className="w-4 h-4" />Request a Lab Tour
                    </motion.button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ═══ CALCULATOR ═══ */}
        {visibleSections.has("calculator") && wrapSection("calculator",
          <div style={{ background: "hsl(192, 30%, 5%)" }}>
            <section id="calculator" className="py-20 md:py-28 lg:py-36">
              <div className="max-w-[1100px] mx-auto px-6 md:px-10">
                <div className="text-center mb-10">
                  <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-sm font-medium text-primary mb-4">See the Numbers</motion.p>
                  <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-display text-foreground">
                    {getSectionHeadline("calculator") || "Calculate the cost of inaction."}
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                    className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
                    Enter {company}'s network size and see exactly how much remakes and inefficiencies are draining — and what Dandy recovers.
                  </motion.p>
                </div>
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
                  className="relative rounded-2xl border border-border bg-card overflow-hidden cursor-pointer group" onClick={() => setCalcOpen(true)}>
                  <div className="relative aspect-[16/7] overflow-hidden">
                    <img src={dandyInsightsDashboard} alt="ROI Calculator preview" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-card/40" />
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                    <div className="grid grid-cols-3 gap-6 md:gap-10 mb-8 w-full max-w-2xl">
                      <div className="text-center"><p className="text-3xl md:text-5xl font-bold text-primary tracking-tight">60%</p><p className="text-xs md:text-sm text-muted-foreground mt-1">Fewer remakes</p></div>
                      <div className="text-center"><p className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">$1.2M+</p><p className="text-xs md:text-sm text-muted-foreground mt-1">Avg. annual upside</p></div>
                      <div className="text-center"><p className="text-3xl md:text-5xl font-bold text-primary tracking-tight">200+</p><p className="text-xs md:text-sm text-muted-foreground mt-1">Hours recovered / yr</p></div>
                    </div>
                    <div className="flex items-center gap-2 mb-3"><Calculator className="w-5 h-5 text-primary" /><span className="text-sm font-medium text-muted-foreground">Interactive ROI Calculator</span></div>
                    <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                      Calculate Your Savings<ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              </div>
              {/* Calculator Modal */}
              <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
                <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0" style={{ background: "hsl(192, 28%, 6%)", borderColor: "hsl(192, 20%, 15%)" }}>
                  <DialogTitle className="sr-only">ROI Calculator</DialogTitle>
                  <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b" style={{ background: "hsl(192, 28%, 6%)", borderColor: "hsl(192, 20%, 15%)" }}>
                    <div><h3 className="text-lg font-bold" style={{ color: "hsl(72, 55%, 48%)" }}>ROI Calculator</h3><p className="text-xs mt-0.5" style={{ color: "hsl(192, 15%, 55%)" }}>See how Dandy impacts your bottom line.</p></div>
                  </div>
                  <div className="p-6 heartland-light-theme" style={{ background: "hsl(0, 0%, 98%)", color: "hsl(192, 30%, 10%)" }}>
                    <Tabs defaultValue="financial" className="w-full">
                      <TabsList className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 bg-transparent h-auto p-0 mb-8">
                        <TabsTrigger value="financial" className="relative rounded-full px-6 py-3 text-base font-semibold transition-all data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-400 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">Financial Impact</TabsTrigger>
                        <TabsTrigger value="remake" className="relative rounded-full px-6 py-3 text-base font-semibold transition-all data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-400 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">Remake Cost</TabsTrigger>
                      </TabsList>
                      <TabsContent value="financial"><FinancialCalc company={company} onCTA={() => onOpenDemo(undefined, "Calculator CTA")} /></TabsContent>
                      <TabsContent value="remake"><RemakeCalc company={company} onCTA={() => onOpenDemo(undefined, "Calculator CTA")} /></TabsContent>
                    </Tabs>
                  </div>
                </DialogContent>
              </Dialog>
            </section>
          </div>
        )}

        {/* ═══ FINAL CTA ═══ */}
        {visibleSections.has("finalCTA") && wrapSection("finalCTA",
          <section id="contact" className="relative overflow-hidden" style={{ background: "hsl(192, 28%, 4%)" }}>
            <div className="absolute inset-0 pointer-events-none">
              <img src={cfg?.sectionImages?.finalCTAImage || ctaOperations} alt="" className="w-full h-full object-cover opacity-[0.06]" aria-hidden="true" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, hsl(192, 28%, 4%), hsl(192, 28%, 4%, 0.95), hsl(192, 28%, 4%))" }} />
            </div>
            <div className="relative py-20 md:py-28 lg:py-36">
              <div className="max-w-[720px] mx-auto px-6 md:px-10 text-center">
                <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "hsl(72, 55%, 48%)" }}>Next Steps</motion.p>
                <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-display" style={{ color: "hsl(0, 0%, 95%)" }}>{finalHeadline}</motion.h2>
                <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                  className="mt-5 text-base md:text-lg leading-relaxed" style={{ color: "hsl(192, 15%, 60%)" }}>{finalSubheadline}</motion.p>
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
                  className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto justify-center">
                  <button onClick={() => onOpenDemo(undefined, "Final CTA")} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                    Get started<ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 }} className="mt-10 grid sm:grid-cols-2 gap-4 max-w-md mx-auto">
                  <button onClick={() => onOpenDemo(undefined, "Lab Tour")} className="flex items-center gap-3 rounded-xl p-5 hover:border-primary/30 transition-all text-left" style={{ border: "1px solid hsl(192, 20%, 18%)", background: "hsl(192, 25%, 10%)" }}>
                    <MapPin className="w-4 h-4 shrink-0" style={{ color: "hsl(72, 55%, 48%)" }} /><div><p className="text-sm font-medium" style={{ color: "hsl(0, 0%, 92%)" }}>Lab Tour</p><p className="text-xs mt-0.5" style={{ color: "hsl(192, 15%, 50%)" }}>See our facilities firsthand</p></div>
                  </button>
                  <button onClick={() => onOpenDemo(undefined, "Executive Briefing")} className="flex items-center gap-3 rounded-xl p-5 hover:border-primary/30 transition-all text-left" style={{ border: "1px solid hsl(192, 20%, 18%)", background: "hsl(192, 25%, 10%)" }}>
                    <Calendar className="w-4 h-4 shrink-0" style={{ color: "hsl(72, 55%, 48%)" }} /><div><p className="text-sm font-medium" style={{ color: "hsl(0, 0%, 92%)" }}>Executive Briefing</p><p className="text-xs mt-0.5" style={{ color: "hsl(192, 15%, 50%)" }}>Custom EBITDA impact analysis</p></div>
                  </button>
                </motion.div>
                <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="mt-10 text-[10px] tracking-wide" style={{ color: "hsl(192, 15%, 35%)" }}>
                  {cfg?.footerText || "Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing"}
                </motion.p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-10" style={{ background: "hsl(192, 28%, 4%)", borderTop: "1px solid hsl(192, 20%, 12%)" }}>
        <div className="max-w-[1200px] mx-auto px-6 md:px-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <img src={dandyLogoWhite} alt="Dandy" className="h-4 w-auto opacity-60" />
            <div className="flex items-center gap-8">
              {[{ label: "Solutions", href: "https://www.meetdandy.com/solutions" }, { label: "Technology", href: "https://www.meetdandy.com/technology" }, { label: "About", href: "https://www.meetdandy.com/about" }].map(link => (
                <a key={link.label} href={link.href} className="text-[11px] hover:opacity-100 transition-colors" style={{ color: "hsl(192, 15%, 55%)" }}>{link.label}</a>
              ))}
            </div>
          </div>
          <div className="mt-6 pt-6 flex flex-col md:flex-row items-center justify-between gap-3" style={{ borderTop: "1px solid hsl(192, 20%, 10%)" }}>
            <p className="text-[10px]" style={{ color: "hsl(192, 15%, 35%)" }}>© {new Date().getFullYear()} Dandy Dental Lab. All rights reserved.</p>
            <p className="text-[10px]" style={{ color: "hsl(192, 15%, 28%)" }}>Prepared exclusively for {company}.</p>
          </div>
        </div>
      </footer>

      {/* ═══ VIDEO MODAL ═══ */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setVideoOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }}
              className="relative w-full max-w-4xl aspect-video rounded-xl overflow-hidden border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
              <button onClick={() => setVideoOpen(false)} className="absolute -top-10 right-0 z-10 text-muted-foreground hover:text-foreground transition-colors" aria-label="Close video"><X className="w-6 h-6" /></button>
              <iframe src={cfg?.sectionImages?.labTourVideoUrl || "https://www.youtube.com/embed/SjXFjvWW9o0?autoplay=1&rel=0"} title="Inside Dandy's 100% Digital Dental Lab"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// CALCULATOR COMPONENTS (simplified inlined versions)
// ═══════════════════════════════════════════════════════════════════

// ─── Remake Cost Calculator ──────────────────────────────────────────
type Mode = "low" | "medium" | "high" | "custom";
const benchmarks: Record<Exclude<Mode, "custom">, { remakeRate: number; chairTime: number; revenuePerAppt: number }> = {
  low: { remakeRate: 2, chairTime: 20, revenuePerAppt: 250 },
  medium: { remakeRate: 5, chairTime: 30, revenuePerAppt: 350 },
  high: { remakeRate: 8, chairTime: 45, revenuePerAppt: 500 },
};

const defaultCategories = [
  { id: "crowns", label: "Crowns & Bridges", enabled: true, avgPerPractice: 180 },
  { id: "implants", label: "Implant Abutments", enabled: true, avgPerPractice: 40 },
  { id: "veneers", label: "Veneers", enabled: false, avgPerPractice: 20 },
  { id: "dentures", label: "Dentures & Partials", enabled: false, avgPerPractice: 15 },
  { id: "removables", label: "Removables & Appliances", enabled: false, avgPerPractice: 10 },
];

function RemakeCalc({ company, onCTA }: { company: string; onCTA: () => void }) {
  const [mode, setMode] = useState<Mode>("medium");
  const [practices, setPractices] = useState(10);
  const [categories, setCategories] = useState(defaultCategories.map(c => ({ ...c })));
  const [remakeRate, setRemakeRate] = useState(5);
  const [chairTime, setChairTime] = useState(30);
  const [revenuePerAppt, setRevenuePerAppt] = useState(350);
  const [operatories, setOperatories] = useState(8);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    if (newMode !== "custom") { const b = benchmarks[newMode]; setRemakeRate(b.remakeRate); setChairTime(b.chairTime); setRevenuePerAppt(b.revenuePerAppt); }
  };

  const results = useMemo(() => {
    const totalRestPerPractice = categories.filter(c => c.enabled).reduce((sum, c) => sum + c.avgPerPractice, 0);
    const totalMonthlyCases = practices * totalRestPerPractice;
    const monthlyRemakes = totalMonthlyCases * (remakeRate / 100);
    const monthlyChairTimeLost = (monthlyRemakes * chairTime) / 60;
    const monthlyRevenueLost = monthlyRemakes * revenuePerAppt;
    const annualRevenueAtRisk = monthlyRevenueLost * 12;
    const totalOps = practices * operatories;
    const annualPerPractice = annualRevenueAtRisk / (practices || 1);
    const annualPerOperatory = annualRevenueAtRisk / (totalOps || 1);
    const monthlyChairPerPractice = monthlyChairTimeLost / (practices || 1);
    const dandyRemakeRate = remakeRate * 0.4;
    const dandyMonthlyRemakes = totalMonthlyCases * (dandyRemakeRate / 100);
    const dandyMonthlyRevLost = dandyMonthlyRemakes * revenuePerAppt;
    const dandyAnnualRisk = dandyMonthlyRevLost * 12;
    const annualSavings = annualRevenueAtRisk - dandyAnnualRisk;
    const remakeReduction = monthlyRemakes - dandyMonthlyRemakes;
    const chairTimeRecovered = ((monthlyRemakes - dandyMonthlyRemakes) * chairTime) / 60;
    return { totalMonthlyCases, monthlyRemakes, monthlyChairTimeLost, monthlyRevenueLost, annualRevenueAtRisk, totalOps, annualPerPractice, annualPerOperatory, monthlyChairPerPractice, annualSavings, remakeReduction, chairTimeRecovered, totalRestPerPractice };
  }, [practices, categories, remakeRate, chairTime, revenuePerAppt, operatories]);

  return (
    <div className="grid lg:grid-cols-5 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Scenario</label>
          <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-card p-1">
            {(["low", "medium", "high", "custom"] as Mode[]).map(m => (
              <button key={m} onClick={() => handleModeChange(m)} className={`py-2 rounded-md text-xs font-medium capitalize transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Number of practices</label>
          <input type="number" min={1} max={1000} value={practices} onChange={e => setPractices(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">Restoration Types</label>
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className={`rounded-lg border p-3 transition-colors ${cat.enabled ? "border-primary/30 bg-card" : "border-border bg-card/50"}`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={cat.enabled} onChange={() => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, enabled: !c.enabled } : c))}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 accent-[hsl(72,70%,55%)]" />
                    <span className={`text-sm font-medium ${cat.enabled ? "text-foreground" : "text-muted-foreground"}`}>{cat.label}</span>
                  </label>
                  {cat.enabled && <input type="number" min={0} max={999} value={cat.avgPerPractice} onChange={e => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, avgPerPractice: Math.max(0, Math.min(999, parseInt(e.target.value) || 0)) } : c))}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />}
                </div>
                {cat.enabled && <p className="text-[10px] text-muted-foreground mt-1 ml-6.5">per practice / month</p>}
              </div>
            ))}
          </div>
        </div>
        {/* Advanced settings */}
        <div>
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />Advanced settings
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-card/50 p-4">
              <div><label className="text-[10px] text-muted-foreground mb-1 block">Remake rate (%)</label>
                <input type="number" min={0.5} max={20} step={0.5} value={remakeRate} onChange={e => { setRemakeRate(parseFloat(e.target.value) || 5); setMode("custom"); }}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
              <div><label className="text-[10px] text-muted-foreground mb-1 block">Chair time per remake (min)</label>
                <input type="number" min={5} max={120} value={chairTime} onChange={e => { setChairTime(parseInt(e.target.value) || 30); setMode("custom"); }}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
              <div><label className="text-[10px] text-muted-foreground mb-1 block">Revenue per appointment ($)</label>
                <input type="number" min={50} max={2000} value={revenuePerAppt} onChange={e => { setRevenuePerAppt(parseInt(e.target.value) || 350); setMode("custom"); }}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
              <div><label className="text-[10px] text-muted-foreground mb-1 block">Operatories per practice</label>
                <input type="number" min={1} max={30} value={operatories} onChange={e => setOperatories(Math.max(1, parseInt(e.target.value) || 8))}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            </div>
          )}
        </div>
      </div>
      <div className="lg:col-span-3 space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-xs font-medium text-destructive uppercase tracking-wider mb-5">Your Current Remake Cost</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-background p-4"><DollarSign className="w-4 h-4 text-destructive mb-2" /><p className="text-3xl font-bold text-foreground">{fmtDollar(results.annualRevenueAtRisk)}</p><p className="text-xs text-muted-foreground mt-1">Annual revenue at risk</p></div>
            <div className="rounded-lg bg-background p-4"><Clock className="w-4 h-4 text-destructive mb-2" /><p className="text-3xl font-bold text-foreground">{fmt(results.monthlyChairTimeLost)}<span className="text-lg">hrs</span></p><p className="text-xs text-muted-foreground mt-1">Chair time lost / month</p></div>
            <div className="rounded-lg bg-background p-4"><p className="text-xl font-bold text-foreground">{fmt(results.monthlyRemakes)}</p><p className="text-xs text-muted-foreground mt-1">Remakes / month</p></div>
            <div className="rounded-lg bg-background p-4"><p className="text-xl font-bold text-foreground">{fmtDollar(results.monthlyRevenueLost)}</p><p className="text-xs text-muted-foreground mt-1">Revenue lost / month</p></div>
          </div>
          {/* Per-practice / per-operatory breakdown */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-background p-3 text-center"><p className="text-lg font-bold text-foreground">{fmtDollar(results.annualPerPractice)}</p><p className="text-[10px] text-muted-foreground mt-0.5">Per practice / yr</p></div>
            <div className="rounded-lg bg-background p-3 text-center"><p className="text-lg font-bold text-foreground">{fmtDollar(results.annualPerOperatory)}</p><p className="text-[10px] text-muted-foreground mt-0.5">Per operatory / yr</p></div>
            <div className="rounded-lg bg-background p-3 text-center"><p className="text-lg font-bold text-foreground">{fmtDec(results.monthlyChairPerPractice)}<span className="text-sm">hrs</span></p><p className="text-[10px] text-muted-foreground mt-0.5">Chair lost / practice / mo</p></div>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-5">With Dandy (60% fewer remakes)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1 rounded-lg bg-card border border-primary/20 p-5"><TrendingDown className="w-5 h-5 text-primary mb-2" /><p className="text-4xl font-bold text-primary tracking-tight">{fmtDollar(results.annualSavings)}</p><p className="text-xs text-muted-foreground mt-1">Annual savings</p></div>
            <div className="rounded-lg bg-card border border-border p-4"><p className="text-2xl font-bold text-primary">{fmt(results.remakeReduction)}</p><p className="text-xs text-muted-foreground mt-1">Fewer remakes / mo</p></div>
            <div className="rounded-lg bg-card border border-border p-4"><p className="text-2xl font-bold text-primary">{results.chairTimeRecovered.toFixed(1)} hrs</p><p className="text-xs text-muted-foreground mt-1">Chair time recovered / mo</p></div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-lg bg-card border border-border p-4">
            <div><p className="text-sm font-semibold text-foreground">Ready to see these savings?</p><p className="text-xs text-muted-foreground mt-0.5">Get a custom ROI analysis for your DSO.</p></div>
            <button onClick={onCTA} className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap">Get Full Analysis</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Financial Impact Calculator ─────────────────────────────────────
type Scenario = "conservative" | "expected" | "aggressive";
const scenarioApptsSaved: Record<Scenario, number> = { conservative: 1, expected: 1.5, aggressive: 2 };

function FinancialCalc({ company, onCTA }: { company: string; onCTA: () => void }) {
  const [dentureCases, setDentureCases] = useState(150);
  const [scenario, setScenario] = useState<Scenario>("expected");
  const [avgMinPerAppt, setAvgMinPerAppt] = useState(30);
  const [workingDays, setWorkingDays] = useState(20);
  const [prodPerHour, setProdPerHour] = useState(500);
  const [pctReinvested, setPctReinvested] = useState(75);
  const [reinvestProdPerHr, setReinvestProdPerHr] = useState(750);
  const [restoCases, setRestoCases] = useState(250);
  const [avgCaseValue, setAvgCaseValue] = useState(1500);
  const [currentRemakeRate, setCurrentRemakeRate] = useState(5);
  const [improvedRemakeRate, setImprovedRemakeRate] = useState(2);
  const [chairTimePerAppt, setChairTimePerAppt] = useState(1);
  const [labCostPerCase, setLabCostPerCase] = useState(50);
  const [restoProdPerHour, setRestoProdPerHour] = useState(500);
  const [practices, setPractices] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const apptsSaved = scenarioApptsSaved[scenario];

  const dentureResults = useMemo(() => {
    const apptsFreed = dentureCases * apptsSaved;
    const chairMinFreed = apptsFreed * avgMinPerAppt;
    const chairHrsFreed = chairMinFreed / 60;
    const incProdMonth = chairHrsFreed * prodPerHour;
    const incProdYear = incProdMonth * 12;
    const reinvestedHrs = chairHrsFreed * (pctReinvested / 100);
    const reinvestProdMonth = reinvestedHrs * reinvestProdPerHr;
    return { apptsFreed, chairHrsFreed, incProdMonth, incProdYear, reinvestedHrs, reinvestProdMonth };
  }, [dentureCases, apptsSaved, avgMinPerAppt, prodPerHour, pctReinvested, reinvestProdPerHr]);

  const restoResults = useMemo(() => {
    const currentRemakes = restoCases * (currentRemakeRate / 100);
    const improvedRemakes = restoCases * (improvedRemakeRate / 100);
    const remakesAvoided = currentRemakes - improvedRemakes;
    const recoveredProdMonth = remakesAvoided * avgCaseValue;
    const recoveredProdYear = recoveredProdMonth * 12;
    const chairTimeSavedMonth = remakesAvoided * chairTimePerAppt;
    const labCostsAvoidedYear = remakesAvoided * labCostPerCase * 12;
    const opptyProdYear = chairTimeSavedMonth * restoProdPerHour * 12;
    const totalFinancialUpsideYear = recoveredProdYear + labCostsAvoidedYear + opptyProdYear;
    return { currentRemakes, improvedRemakes, remakesAvoided, recoveredProdMonth, recoveredProdYear, chairTimeSavedMonth, labCostsAvoidedYear, opptyProdYear, totalFinancialUpsideYear };
  }, [restoCases, currentRemakeRate, improvedRemakeRate, avgCaseValue, chairTimePerAppt, labCostPerCase, restoProdPerHour]);

  const totalAnnualUpside = (dentureResults.incProdYear + restoResults.totalFinancialUpsideYear) * practices;

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-4">
        <label className="text-sm text-muted-foreground">Number of practices:</label>
        <input type="number" min={1} max={1000} value={practices} onChange={e => setPractices(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
          className="w-20 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Denture Impact */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div><h3 className="text-base font-semibold text-foreground">Denture Workflow Impact</h3><p className="text-xs text-muted-foreground mt-1">Chair time freed by reducing intermediate appointments.</p></div>
          <div className="space-y-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Denture cases / month</label>
              <input type="number" min={1} max={9999} value={dentureCases} onChange={e => setDentureCases(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            <div><label className="text-xs text-muted-foreground mb-1.5 block">Scenario</label>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">
                {(["conservative", "expected", "aggressive"] as Scenario[]).map(s => (
                  <button key={s} onClick={() => setScenario(s)} className={`py-2 rounded-md text-xs font-medium capitalize transition-colors ${scenario === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{s}</button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{apptsSaved} appointments saved per case</p>
            </div>
          </div>
          {/* Advanced denture settings */}
          <div>
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />Advanced
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-lg border border-border bg-background/50 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">Avg min / appt</label>
                    <input type="number" min={10} max={120} value={avgMinPerAppt} onChange={e => setAvgMinPerAppt(parseInt(e.target.value) || 30)}
                      className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">Working days / mo</label>
                    <input type="number" min={10} max={30} value={workingDays} onChange={e => setWorkingDays(parseInt(e.target.value) || 20)}
                      className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">Production / hr ($)</label>
                    <input type="number" min={100} max={3000} value={prodPerHour} onChange={e => setProdPerHour(parseInt(e.target.value) || 500)}
                      className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">% time reinvested</label>
                    <input type="number" min={0} max={100} value={pctReinvested} onChange={e => setPctReinvested(parseInt(e.target.value) || 75)}
                      className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-border pt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-background p-3"><p className="text-2xl font-bold text-foreground">{fmt(dentureResults.apptsFreed)}</p><p className="text-[10px] text-muted-foreground mt-0.5">Appointments freed / mo</p></div>
              <div className="rounded-lg bg-background p-3"><p className="text-2xl font-bold text-foreground">{fmtDec(dentureResults.chairHrsFreed)} <span className="text-sm">hrs</span></p><p className="text-[10px] text-muted-foreground mt-0.5">Chair hours freed / mo</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-background p-3"><p className="text-2xl font-bold text-primary">{fmtDollar(dentureResults.incProdMonth)}</p><p className="text-[10px] text-muted-foreground mt-0.5">Incremental production / mo</p></div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3"><p className="text-2xl font-bold text-primary">{fmtDollar(dentureResults.incProdYear)}</p><p className="text-[10px] text-muted-foreground mt-0.5">Incremental production / yr</p></div>
            </div>
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-background p-3 border border-border"><p className="text-xl font-bold text-foreground">{fmtDec(dentureResults.reinvestedHrs)} <span className="text-sm">hrs</span></p><p className="text-[10px] text-muted-foreground mt-0.5">Reinvested hours / mo</p></div>
                <div className="rounded-lg bg-background p-3 border border-border"><p className="text-xl font-bold text-primary">{fmtDollar(dentureResults.reinvestProdMonth)}</p><p className="text-[10px] text-muted-foreground mt-0.5">Reinvestment production / mo</p></div>
              </div>
            )}
          </div>
        </div>
        {/* Fixed Resto Remake Impact */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div><h3 className="text-base font-semibold text-foreground">Fixed Resto Remake Impact</h3><p className="text-xs text-muted-foreground mt-1">Production recovered and costs avoided by reducing remakes.</p></div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Cases / month</label>
                <input type="number" min={1} max={9999} value={restoCases} onChange={e => setRestoCases(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Avg case value ($)</label>
                <input type="number" min={100} max={10000} value={avgCaseValue} onChange={e => setAvgCaseValue(parseInt(e.target.value) || 1500)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Current remake rate (%)</label>
                <input type="number" min={0.5} max={20} step={0.5} value={currentRemakeRate} onChange={e => setCurrentRemakeRate(parseFloat(e.target.value) || 5)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Improved remake rate (%)</label>
                <input type="number" min={0} max={20} step={0.5} value={improvedRemakeRate} onChange={e => setImprovedRemakeRate(parseFloat(e.target.value) || 2)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            </div>
          </div>
          <div className="border-t border-border pt-5 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-background p-3 text-center"><p className="text-xl font-bold text-foreground">{fmtDec(restoResults.currentRemakes)}</p><p className="text-[10px] text-muted-foreground mt-0.5">Current remakes / mo</p></div>
              <div className="rounded-lg bg-background p-3 text-center"><p className="text-xl font-bold text-primary">{fmtDec(restoResults.improvedRemakes)}</p><p className="text-[10px] text-muted-foreground mt-0.5">Improved remakes / mo</p></div>
              <div className="rounded-lg bg-background p-3 text-center"><p className="text-xl font-bold text-primary">{fmtDec(restoResults.remakesAvoided)}</p><p className="text-[10px] text-muted-foreground mt-0.5">Remakes avoided / mo</p></div>
            </div>
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total financial upside / year</p>
              <p className="text-3xl font-bold text-primary">{fmtDollar(restoResults.totalFinancialUpsideYear)}</p>
            </div>
          </div>
        </div>
      </div>
      {/* Combined total */}
      <div className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Combined Annual Upside {practices > 1 ? `(${practices} practices)` : "(per practice)"}</p>
            <p className="text-5xl font-bold text-primary tracking-tight">{fmtDollar(totalAnnualUpside)}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Denture: {fmtDollar(dentureResults.incProdYear * practices)}</span><span>•</span><span>Resto remakes: {fmtDollar(restoResults.totalFinancialUpsideYear * practices)}</span>
            </div>
          </div>
          <button onClick={onCTA} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap">Get Full Analysis<ArrowRight className="w-4 h-4" /></button>
        </div>
      </div>
      <p className="mt-6 text-[11px] text-muted-foreground/50 leading-relaxed text-center">Calculations based on per-practice estimates. Actual results may vary based on case mix, clinical workflow, and lab partner quality.</p>
    </div>
  );
}

export default MicrositeHeartlandSkin;
