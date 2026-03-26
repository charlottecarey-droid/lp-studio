import { motion, AnimatePresence, useInView } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import {
  BarChart3, TrendingUp, Users, MapPin, Activity,
  ChevronRight, ArrowUpRight, ArrowDownRight, ArrowLeft,
  CalendarIcon, ChevronDown
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Area, AreaChart, PieChart, Pie, Cell
} from "recharts";

/* ── Props ── */
interface MicrositeInteractiveDashboardProps {
  variant?: "dark" | "light";
  practiceCount?: string | number;
}

/* ── Static data ── */
const tabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "locations", label: "Locations", icon: MapPin },
  { id: "providers", label: "Providers", icon: Users },
  { id: "trends", label: "Trends", icon: TrendingUp },
];

const locationData = [
  {
    name: "Chicago – Michigan Ave", remakes: 2.1, cases: 312, trend: "down" as const, score: 97,
    monthly: [
      { month: "Aug", cases: 38, remakes: 3 }, { month: "Sep", cases: 42, remakes: 2 },
      { month: "Oct", cases: 48, remakes: 1 }, { month: "Nov", cases: 52, remakes: 1 },
      { month: "Dec", cases: 55, remakes: 1 }, { month: "Jan", cases: 77, remakes: 2 },
    ],
    products: [
      { name: "Crowns", value: 45 }, { name: "Bridges", value: 20 },
      { name: "Implants", value: 25 }, { name: "Other", value: 10 },
    ],
  },
  {
    name: "Orlando – Colonial", remakes: 3.8, cases: 287, trend: "up" as const, score: 94,
    monthly: [
      { month: "Aug", cases: 35, remakes: 5 }, { month: "Sep", cases: 40, remakes: 4 },
      { month: "Oct", cases: 44, remakes: 4 }, { month: "Nov", cases: 48, remakes: 3 },
      { month: "Dec", cases: 55, remakes: 3 }, { month: "Jan", cases: 65, remakes: 2 },
    ],
    products: [
      { name: "Crowns", value: 50 }, { name: "Bridges", value: 15 },
      { name: "Implants", value: 20 }, { name: "Other", value: 15 },
    ],
  },
  {
    name: "Dallas – Greenville Ave", remakes: 1.9, cases: 401, trend: "down" as const, score: 98,
    monthly: [
      { month: "Aug", cases: 50, remakes: 2 }, { month: "Sep", cases: 56, remakes: 1 },
      { month: "Oct", cases: 62, remakes: 1 }, { month: "Nov", cases: 68, remakes: 1 },
      { month: "Dec", cases: 75, remakes: 1 }, { month: "Jan", cases: 90, remakes: 1 },
    ],
    products: [
      { name: "Crowns", value: 40 }, { name: "Bridges", value: 25 },
      { name: "Implants", value: 30 }, { name: "Other", value: 5 },
    ],
  },
  {
    name: "Phoenix – Scottsdale", remakes: 4.2, cases: 198, trend: "up" as const, score: 91,
    monthly: [
      { month: "Aug", cases: 22, remakes: 4 }, { month: "Sep", cases: 26, remakes: 3 },
      { month: "Oct", cases: 30, remakes: 3 }, { month: "Nov", cases: 34, remakes: 2 },
      { month: "Dec", cases: 38, remakes: 2 }, { month: "Jan", cases: 48, remakes: 2 },
    ],
    products: [
      { name: "Crowns", value: 55 }, { name: "Bridges", value: 10 },
      { name: "Implants", value: 15 }, { name: "Other", value: 20 },
    ],
  },
  {
    name: "Tampa – Brandon", remakes: 2.7, cases: 256, trend: "down" as const, score: 95,
    monthly: [
      { month: "Aug", cases: 30, remakes: 3 }, { month: "Sep", cases: 36, remakes: 2 },
      { month: "Oct", cases: 40, remakes: 2 }, { month: "Nov", cases: 44, remakes: 2 },
      { month: "Dec", cases: 50, remakes: 1 }, { month: "Jan", cases: 56, remakes: 1 },
    ],
    products: [
      { name: "Crowns", value: 42 }, { name: "Bridges", value: 22 },
      { name: "Implants", value: 28 }, { name: "Other", value: 8 },
    ],
  },
];

const providerData = [
  {
    name: "Dr. Sarah Chen", location: "Dallas – Greenville Ave", cases: 142, accuracy: 99.1, trend: "up",
    monthly: [
      { month: "Aug", cases: 18, accuracy: 98.2 }, { month: "Sep", cases: 20, accuracy: 98.6 },
      { month: "Oct", cases: 22, accuracy: 99.0 }, { month: "Nov", cases: 24, accuracy: 99.2 },
      { month: "Dec", cases: 28, accuracy: 99.4 }, { month: "Jan", cases: 30, accuracy: 99.1 },
    ],
    types: [{ name: "Crowns", value: 60 }, { name: "Bridges", value: 22 }, { name: "Implants", value: 18 }],
  },
  {
    name: "Dr. James Park", location: "Chicago – Michigan Ave", cases: 118, accuracy: 97.8, trend: "up",
    monthly: [
      { month: "Aug", cases: 14, accuracy: 96.5 }, { month: "Sep", cases: 16, accuracy: 97.0 },
      { month: "Oct", cases: 18, accuracy: 97.4 }, { month: "Nov", cases: 20, accuracy: 97.8 },
      { month: "Dec", cases: 24, accuracy: 98.0 }, { month: "Jan", cases: 26, accuracy: 97.8 },
    ],
    types: [{ name: "Crowns", value: 50 }, { name: "Bridges", value: 30 }, { name: "Implants", value: 20 }],
  },
  {
    name: "Dr. Maria Lopez", location: "Tampa – Brandon", cases: 97, accuracy: 96.4, trend: "down",
    monthly: [
      { month: "Aug", cases: 12, accuracy: 97.0 }, { month: "Sep", cases: 14, accuracy: 96.8 },
      { month: "Oct", cases: 15, accuracy: 96.5 }, { month: "Nov", cases: 16, accuracy: 96.2 },
      { month: "Dec", cases: 18, accuracy: 96.0 }, { month: "Jan", cases: 22, accuracy: 96.4 },
    ],
    types: [{ name: "Crowns", value: 45 }, { name: "Bridges", value: 25 }, { name: "Implants", value: 30 }],
  },
  {
    name: "Dr. Kevin Wright", location: "Phoenix – Scottsdale", cases: 88, accuracy: 94.2, trend: "up",
    monthly: [
      { month: "Aug", cases: 10, accuracy: 92.0 }, { month: "Sep", cases: 12, accuracy: 93.0 },
      { month: "Oct", cases: 14, accuracy: 93.5 }, { month: "Nov", cases: 15, accuracy: 94.0 },
      { month: "Dec", cases: 17, accuracy: 94.5 }, { month: "Jan", cases: 20, accuracy: 94.2 },
    ],
    types: [{ name: "Crowns", value: 55 }, { name: "Bridges", value: 15 }, { name: "Implants", value: 30 }],
  },
  {
    name: "Dr. Amy Foster", location: "Orlando – Colonial", cases: 134, accuracy: 95.7, trend: "down",
    monthly: [
      { month: "Aug", cases: 16, accuracy: 96.5 }, { month: "Sep", cases: 18, accuracy: 96.2 },
      { month: "Oct", cases: 20, accuracy: 96.0 }, { month: "Nov", cases: 22, accuracy: 95.8 },
      { month: "Dec", cases: 26, accuracy: 95.5 }, { month: "Jan", cases: 32, accuracy: 95.7 },
    ],
    types: [{ name: "Crowns", value: 48 }, { name: "Bridges", value: 28 }, { name: "Implants", value: 24 }],
  },
];

const trendData = [
  { month: "Jul", remakes: 5.2, cases: 980 },
  { month: "Aug", remakes: 4.8, cases: 1020 },
  { month: "Sep", remakes: 4.1, cases: 1100 },
  { month: "Oct", remakes: 3.6, cases: 1180 },
  { month: "Nov", remakes: 3.2, cases: 1250 },
  { month: "Dec", remakes: 2.8, cases: 1340 },
  { month: "Jan", remakes: 2.4, cases: 1420 },
];

const kpiSparklines = {
  "Total Cases": [
    { month: "Aug", value: 980 }, { month: "Sep", value: 1020 }, { month: "Oct", value: 1100 },
    { month: "Nov", value: 1180 }, { month: "Dec", value: 1250 }, { month: "Jan", value: 1454 },
  ],
  "Remake Rate": [
    { month: "Aug", value: 4.8 }, { month: "Sep", value: 4.1 }, { month: "Oct", value: 3.6 },
    { month: "Nov", value: 3.2 }, { month: "Dec", value: 2.9 }, { month: "Jan", value: 2.8 },
  ],
  "Avg Turnaround": [
    { month: "Aug", value: 5.8 }, { month: "Sep", value: 5.4 }, { month: "Oct", value: 5.0 },
    { month: "Nov", value: 4.7 }, { month: "Dec", value: 4.4 }, { month: "Jan", value: 4.2 },
  ],
  "Active Locations": [
    { month: "Aug", value: 3 }, { month: "Sep", value: 3 }, { month: "Oct", value: 4 },
    { month: "Nov", value: 4 }, { month: "Dec", value: 4 }, { month: "Jan", value: 5 },
  ],
};

/* ── Theme helpers ── */
const getTheme = (variant: "dark" | "light") => {
  if (variant === "dark") {
    return {
      barFill: "hsl(80, 70%, 55%)",
      barRemake: "hsl(0, 70%, 55%)",
      areaStroke: "hsl(80, 70%, 55%)",
      areaGradientStart: "hsl(80, 70%, 55%)",
      gridStroke: "rgba(255,255,255,0.06)",
      tickFill: "rgba(255,255,255,0.35)",
      pieFills: ["hsl(80, 70%, 55%)", "hsl(80, 50%, 40%)", "hsl(80, 30%, 30%)", "rgba(255,255,255,0.15)"],
      cardBg: "bg-white/[0.03]",
      cardBorder: "border-white/[0.06]",
      textPrimary: "text-white",
      textSecondary: "text-white/50",
      textMuted: "text-white/30",
      textAccent: "text-[hsl(80,70%,55%)]",
      textDanger: "text-red-400",
      tabActiveBg: "bg-white/10",
      tabActiveText: "text-white",
      tabInactiveText: "text-white/40",
      tabHoverText: "hover:text-white",
      tooltipBg: "bg-[#1a1f1c]",
      tooltipBorder: "border-white/10",
      tooltipText: "text-white",
      tooltipMuted: "text-white/60",
      browserChromeBg: "bg-white/[0.03]",
      browserChromeBorder: "border-white/[0.06]",
      browserDots: "bg-white/10",
      browserUrlBg: "bg-white/[0.06]",
      browserUrlText: "text-white/30",
      contentBg: "",
      dateBtn: "border-white/10 bg-white/[0.04] text-white/40 hover:text-white hover:border-white/20",
      dateBtnActive: "text-[hsl(80,70%,55%)] bg-[hsl(80,70%,55%)]/10",
      dateBtnInactive: "text-white/40 hover:text-white hover:bg-white/5",
      scoreBarBg: "bg-white/10",
      scoreBarFill: "bg-[hsl(80,70%,55%)]",
      scoreBarDefault: "bg-white/30",
      hoverBorder: "hover:border-white/20",
      providerAvatarBg: "bg-[hsl(80,70%,55%)]/10",
      providerAvatarText: "text-[hsl(80,70%,55%)]",
      progressBarBg: "bg-white/10",
      cursorFill: "rgba(255,255,255,0.04)",
    };
  }
  return {
    barFill: "hsl(152, 38%, 18%)",
    barRemake: "hsl(0, 70%, 55%)",
    areaStroke: "hsl(152, 38%, 18%)",
    areaGradientStart: "hsl(152, 38%, 18%)",
    gridStroke: "hsl(36, 15%, 88%)",
    tickFill: "hsl(152, 10%, 45%)",
    pieFills: ["hsl(152, 38%, 18%)", "hsl(152, 30%, 30%)", "hsl(152, 20%, 45%)", "hsl(36, 15%, 70%)"],
    cardBg: "bg-card",
    cardBorder: "border-border",
    textPrimary: "text-foreground",
    textSecondary: "text-muted-foreground",
    textMuted: "text-muted-foreground/50",
    textAccent: "text-primary",
    textDanger: "text-destructive",
    tabActiveBg: "bg-primary",
    tabActiveText: "text-primary-foreground",
    tabInactiveText: "text-muted-foreground",
    tabHoverText: "hover:text-foreground",
    tooltipBg: "bg-card",
    tooltipBorder: "border-border",
    tooltipText: "text-foreground",
    tooltipMuted: "text-muted-foreground",
    browserChromeBg: "bg-card",
    browserChromeBorder: "border-border",
    browserDots: "",
    browserUrlBg: "bg-muted",
    browserUrlText: "text-muted-foreground",
    contentBg: "bg-background",
    dateBtn: "border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/30",
    dateBtnActive: "text-primary bg-primary/10",
    dateBtnInactive: "text-muted-foreground hover:text-foreground hover:bg-muted",
    scoreBarBg: "bg-muted",
    scoreBarFill: "bg-primary",
    scoreBarDefault: "bg-muted-foreground",
    hoverBorder: "hover:border-primary/40",
    providerAvatarBg: "bg-primary/10",
    providerAvatarText: "text-primary",
    progressBarBg: "bg-muted",
    cursorFill: "hsl(36, 20%, 92%)",
  };
};

/* ── Tooltip ── */
const ThemedTooltip = ({ active, payload, label, t }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={`rounded-lg border ${t.tooltipBorder} ${t.tooltipBg} px-3 py-2 shadow-lg text-xs`}>
      <p className={`font-medium ${t.tooltipText} mb-1`}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className={t.tooltipMuted}>
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: p.color }} />
          {p.name}: <span className={`${t.tooltipText} font-medium`}>{p.value}</span>
        </p>
      ))}
    </div>
  );
};

/* ── Animated counter ── */
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

/* ── KPI Card ── */
const KPICard = ({ stat, index, expandedCard, setExpandedCard, t }: {
  stat: { label: string; value: string; change: string; up: boolean; numericValue: number; decimals: number; prefix: string; suffix: string };
  index: number;
  expandedCard: string | null;
  setExpandedCard: (v: string | null) => void;
  t: ReturnType<typeof getTheme>;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, margin: "-50px" });
  const count = useCountUp(stat.numericValue, 1400 + index * 200, stat.decimals, inView);
  const isExpanded = expandedCard === stat.label;
  const sparkData = kpiSparklines[stat.label as keyof typeof kpiSparklines];
  const displayValue = `${stat.prefix}${stat.decimals > 0 ? count.toFixed(stat.decimals) : count.toLocaleString()}${stat.suffix}`;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => setExpandedCard(isExpanded ? null : stat.label)}
      className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-4 ${t.hoverBorder} transition-all cursor-pointer select-none`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-xs ${t.textMuted}`}>{stat.label}</p>
        <ChevronDown className={`w-3 h-3 ${t.textMuted} transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </div>
      <p className={`text-2xl font-bold ${t.textPrimary} mt-1 tabular-nums`}>{displayValue}</p>
      <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
        (stat.label === "Remake Rate" || stat.label === "Avg Turnaround")
          ? (stat.up ? t.textDanger : t.textAccent)
          : (stat.up ? t.textAccent : t.textDanger)
      }`}>
        {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {stat.change}
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 100, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`overflow-hidden mt-3 border-t ${t.cardBorder} pt-3`}
          >
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id={`spark-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.areaGradientStart} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={t.areaGradientStart} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: t.tickFill, fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={(props: any) => <ThemedTooltip {...props} t={t} />} />
                <Area type="monotone" dataKey="value" name={stat.label} stroke={t.areaStroke} fill={`url(#spark-${index})`} strokeWidth={1.5} dot={{ r: 2, fill: t.areaStroke }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ── Overview ── */
const OverviewView = ({ t }: { t: ReturnType<typeof getTheme> }) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const kpis = [
    { label: "Total Cases", value: "1,454", change: "+12.3%", up: true, numericValue: 1454, decimals: 0, prefix: "", suffix: "" },
    { label: "Remake Rate", value: "2.8%", change: "-1.4%", up: false, numericValue: 2.8, decimals: 1, prefix: "", suffix: "%" },
    { label: "Avg Turnaround", value: "4.2 days", change: "-0.8 days", up: false, numericValue: 4.2, decimals: 1, prefix: "", suffix: " days" },
    { label: "Active Locations", value: "5", change: "+1", up: true, numericValue: 5, decimals: 0, prefix: "", suffix: "" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((stat, i) => (
          <KPICard key={stat.label} stat={stat} index={i} expandedCard={expandedCard} setExpandedCard={setExpandedCard} t={t} />
        ))}
      </div>
      <div className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <p className={`text-sm font-medium ${t.textPrimary}`}>Monthly Case Volume</p>
          <div className={`flex items-center gap-4 text-xs ${t.textMuted}`}>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: t.barFill }} />Cases</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: t.barRemake }} />Remakes</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trendData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
            <XAxis dataKey="month" tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={(props: any) => <ThemedTooltip {...props} t={t} />} cursor={{ fill: t.cursorFill }} />
            <Bar dataKey="cases" name="Cases" fill={t.barFill} radius={[4, 4, 0, 0]} />
            <Bar dataKey="remakes" name="Remakes %" fill={t.barRemake} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ── Location Detail ── */
const LocationDetail = ({ loc, onBack, t }: { loc: typeof locationData[0]; onBack: () => void; t: ReturnType<typeof getTheme> }) => (
  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
    <button onClick={onBack} className={`flex items-center gap-1.5 text-sm ${t.textAccent} hover:underline`}>
      <ArrowLeft className="w-3.5 h-3.5" /> All locations
    </button>
    <div className="flex items-center justify-between">
      <h3 className={`text-lg font-semibold ${t.textPrimary}`}>{loc.name}</h3>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={`text-xl font-bold ${t.textPrimary}`}>{loc.cases}</p>
          <p className={`text-[10px] ${t.textMuted}`}>total cases</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${loc.remakes > 3.5 ? t.textDanger : t.textAccent}`}>{loc.remakes}%</p>
          <p className={`text-[10px] ${t.textMuted}`}>remake rate</p>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className={`md:col-span-2 rounded-lg border ${t.cardBorder} ${t.cardBg} p-4`}>
        <p className={`text-xs ${t.textMuted} uppercase tracking-wider mb-3`}>Monthly Cases & Remakes</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={loc.monthly} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
            <XAxis dataKey="month" tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={(props: any) => <ThemedTooltip {...props} t={t} />} />
            <Bar dataKey="cases" name="Cases" fill={t.barFill} radius={[4, 4, 0, 0]} />
            <Bar dataKey="remakes" name="Remakes" fill={t.barRemake} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-4`}>
        <p className={`text-xs ${t.textMuted} uppercase tracking-wider mb-3`}>Product Mix</p>
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie data={loc.products} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30} paddingAngle={3}>
              {loc.products.map((_, i) => <Cell key={i} fill={t.pieFills[i % t.pieFills.length]} />)}
            </Pie>
            <Tooltip content={(props: any) => <ThemedTooltip {...props} t={t} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 mt-2">
          {loc.products.map((p, i) => (
            <span key={p.name} className={`flex items-center gap-1 text-[10px] ${t.textMuted}`}>
              <span className="w-2 h-2 rounded-full" style={{ background: t.pieFills[i] }} />{p.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  </motion.div>
);

/* ── Provider Detail ── */
const ProviderDetail = ({ doc, onBack, t }: { doc: typeof providerData[0]; onBack: () => void; t: ReturnType<typeof getTheme> }) => (
  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
    <button onClick={onBack} className={`flex items-center gap-1.5 text-sm ${t.textAccent} hover:underline`}>
      <ArrowLeft className="w-3.5 h-3.5" /> All providers
    </button>
    <div className="flex items-center gap-4">
      <div className={`w-11 h-11 rounded-full ${t.providerAvatarBg} flex items-center justify-center ${t.providerAvatarText} text-sm font-semibold`}>
        {doc.name.split(" ").slice(1).map(n => n[0]).join("")}
      </div>
      <div>
        <h3 className={`text-lg font-semibold ${t.textPrimary}`}>{doc.name}</h3>
        <p className={`text-xs ${t.textMuted}`}>{doc.location}</p>
      </div>
      <div className="ml-auto flex items-center gap-6">
        <div className="text-right">
          <p className={`text-xl font-bold ${t.textPrimary}`}>{doc.cases}</p>
          <p className={`text-[10px] ${t.textMuted}`}>cases</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${doc.accuracy >= 97 ? t.textAccent : t.textPrimary}`}>{doc.accuracy}%</p>
          <p className={`text-[10px] ${t.textMuted}`}>accuracy</p>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-4`}>
        <p className={`text-xs ${t.textMuted} uppercase tracking-wider mb-3`}>Cases Over Time</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={doc.monthly}>
            <defs>
              <linearGradient id="caseGradProvider" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.areaGradientStart} stopOpacity={0.2} />
                <stop offset="100%" stopColor={t.areaGradientStart} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
            <XAxis dataKey="month" tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={(props: any) => <ThemedTooltip {...props} t={t} />} />
            <Area type="monotone" dataKey="cases" name="Cases" stroke={t.areaStroke} fill="url(#caseGradProvider)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-4`}>
        <p className={`text-xs ${t.textMuted} uppercase tracking-wider mb-3`}>Accuracy Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={doc.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
            <XAxis dataKey="month" tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[90, 100]} tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={(props: any) => <ThemedTooltip {...props} t={t} />} />
            <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke={t.areaStroke} strokeWidth={2} dot={{ fill: t.areaStroke, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-4`}>
      <p className={`text-xs ${t.textMuted} uppercase tracking-wider mb-3`}>Case Type Breakdown</p>
      <div className="flex items-center gap-6">
        {doc.types.map((typ, i) => (
          <div key={typ.name} className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs ${t.textMuted}`}>{typ.name}</span>
              <span className={`text-xs font-medium ${t.textPrimary}`}>{typ.value}%</span>
            </div>
            <div className={`h-2 rounded-full ${t.progressBarBg} overflow-hidden`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${typ.value}%` }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="h-full rounded-full"
                style={{ background: t.pieFills[i] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  </motion.div>
);

/* ── Locations List ── */
const LocationsView = ({ onSelect, t }: { onSelect: (i: number) => void; t: ReturnType<typeof getTheme> }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
    <div className={`grid grid-cols-12 gap-4 px-4 py-2 text-[10px] uppercase tracking-widest ${t.textMuted} font-medium`}>
      <span className="col-span-4">Location</span>
      <span className="col-span-2 text-center">Cases</span>
      <span className="col-span-2 text-center">Remakes</span>
      <span className="col-span-2 text-center">Score</span>
      <span className="col-span-2 text-center">Trend</span>
    </div>
    {locationData.map((loc, i) => (
      <motion.div
        key={loc.name}
        initial={{ opacity: 0, x: -15 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.05 }}
        onClick={() => onSelect(i)}
        className={`grid grid-cols-12 gap-4 items-center rounded-lg border ${t.cardBorder} ${t.cardBg} px-4 py-3.5 cursor-pointer ${t.hoverBorder} transition-all group`}
      >
        <div className="col-span-4 flex items-center gap-2">
          <ChevronRight className={`w-3.5 h-3.5 ${t.textAccent} group-hover:translate-x-0.5 transition-transform`} />
          <span className={`text-sm font-medium ${t.textPrimary}`}>{loc.name}</span>
        </div>
        <span className={`col-span-2 text-center text-sm ${t.textSecondary}`}>{loc.cases}</span>
        <span className={`col-span-2 text-center text-sm font-medium ${loc.remakes > 3.5 ? t.textDanger : t.textAccent}`}>
          {loc.remakes}%
        </span>
        <div className="col-span-2 flex justify-center">
          <div className={`w-full max-w-[60px] h-1.5 rounded-full ${t.scoreBarBg} overflow-hidden`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${loc.score}%` }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.6 }}
              className={`h-full rounded-full ${loc.score >= 96 ? t.scoreBarFill : t.scoreBarDefault}`}
            />
          </div>
        </div>
        <div className="col-span-2 flex justify-center">
          {loc.trend === "down" ? (
            <span className={`flex items-center gap-1 text-xs ${t.textAccent}`}><ArrowDownRight className="w-3 h-3" />Improving</span>
          ) : (
            <span className={`flex items-center gap-1 text-xs ${t.textDanger}`}><ArrowUpRight className="w-3 h-3" />Watch</span>
          )}
        </div>
      </motion.div>
    ))}
    <p className={`text-[11px] ${t.textMuted} text-center pt-2`}>Click a location to see detailed analytics</p>
  </motion.div>
);

/* ── Providers List ── */
const ProvidersView = ({ onSelect, t }: { onSelect: (i: number) => void; t: ReturnType<typeof getTheme> }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
    {providerData.map((doc, i) => (
      <motion.div
        key={doc.name}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        onClick={() => onSelect(i)}
        className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-4 flex items-center justify-between cursor-pointer ${t.hoverBorder} transition-all group`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${t.providerAvatarBg} flex items-center justify-center ${t.providerAvatarText} text-xs font-semibold`}>
            {doc.name.split(" ").slice(1).map(n => n[0]).join("")}
          </div>
          <div>
            <p className={`text-sm font-medium ${t.textPrimary}`}>{doc.name}</p>
            <p className={`text-xs ${t.textMuted}`}>{doc.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className={`text-sm font-semibold ${t.textPrimary}`}>{doc.cases}</p>
            <p className={`text-[10px] ${t.textMuted}`}>cases</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold ${doc.accuracy >= 97 ? t.textAccent : t.textPrimary}`}>{doc.accuracy}%</p>
            <p className={`text-[10px] ${t.textMuted}`}>accuracy</p>
          </div>
          <ChevronRight className={`w-4 h-4 ${t.textMuted} group-hover:translate-x-0.5 transition-all`} />
        </div>
      </motion.div>
    ))}
    <p className={`text-[11px] ${t.textMuted} text-center pt-2`}>Click a provider to see detailed analytics</p>
  </motion.div>
);

/* ── Trends ── */
const TrendsView = ({ t }: { t: ReturnType<typeof getTheme> }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-5`}>
        <p className={`text-xs ${t.textMuted} uppercase tracking-wider mb-4`}>Remake Rate Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="remakeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.areaGradientStart} stopOpacity={0.2} />
                <stop offset="100%" stopColor={t.areaGradientStart} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
            <XAxis dataKey="month" tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={(props: any) => <ThemedTooltip {...props} t={t} />} />
            <Area type="monotone" dataKey="remakes" name="Remakes %" stroke={t.areaStroke} fill="url(#remakeGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        <div className={`mt-3 flex items-center gap-1.5 text-xs ${t.textAccent}`}>
          <TrendingUp className="w-3 h-3" />
          53% improvement over 7 months
        </div>
      </div>
      <div className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-5`}>
        <p className={`text-xs ${t.textMuted} uppercase tracking-wider mb-4`}>Case Volume Growth</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} />
            <XAxis dataKey="month" tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: t.tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={(props: any) => <ThemedTooltip {...props} t={t} />} cursor={{ fill: t.cursorFill }} />
            <Bar dataKey="cases" name="Cases" fill={t.barFill} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className={`mt-3 flex items-center gap-1.5 text-xs ${t.textSecondary}`}>
          <Activity className="w-3 h-3" />
          45% case volume increase
        </div>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        { title: "Fastest Improving", value: "Dallas – Central", detail: "Remakes down 62% in 6 months" },
        { title: "Highest Volume", value: "Dr. Sarah Chen", detail: "142 cases this quarter" },
        { title: "Best New Location", value: "San Antonio", detail: "On-boarded 3 months ago, already top 3" },
      ].map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.08 }}
          className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-4`}
        >
          <p className={`text-[10px] ${t.textAccent} uppercase tracking-wider font-medium`}>{card.title}</p>
          <p className={`text-base font-semibold ${t.textPrimary} mt-2`}>{card.value}</p>
          <p className={`text-xs ${t.textMuted} mt-1`}>{card.detail}</p>
        </motion.div>
      ))}
    </div>
  </motion.div>
);

/* ── Main Component ── */
const DATE_RANGES = ["Last 7 days", "Last 30 days", "Last 90 days", "Last 6 months", "Last 12 months"];

const MicrositeInteractiveDashboard = ({ variant = "dark" }: MicrositeInteractiveDashboardProps) => {
  const t = getTheme(variant);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState("Last 6 months");
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setSelectedLocation(null);
    setSelectedProvider(null);
  };

  const renderContent = () => {
    if (activeTab === "locations" && selectedLocation !== null) {
      return <LocationDetail loc={locationData[selectedLocation]} onBack={() => setSelectedLocation(null)} t={t} />;
    }
    if (activeTab === "providers" && selectedProvider !== null) {
      return <ProviderDetail doc={providerData[selectedProvider]} onBack={() => setSelectedProvider(null)} t={t} />;
    }
    switch (activeTab) {
      case "overview": return <OverviewView t={t} />;
      case "locations": return <LocationsView onSelect={setSelectedLocation} t={t} />;
      case "providers": return <ProvidersView onSelect={setSelectedProvider} t={t} />;
      case "trends": return <TrendsView t={t} />;
      default: return null;
    }
  };

  return (
    <div>
      {/* Tab bar */}
      <div className="flex justify-center mb-6">
        <div className={`rounded-lg border ${t.cardBorder} ${t.cardBg} p-1 flex gap-1`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive ? `${t.tabActiveBg} ${t.tabActiveText}` : `${t.tabInactiveText} ${t.tabHoverText ?? ""}`
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dashboard frame */}
      <div className={`rounded-xl border ${t.cardBorder} overflow-hidden`}>
        {/* Browser chrome */}
        <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${t.browserChromeBorder} ${t.browserChromeBg}`}>
          {variant === "dark" ? (
            <div className="flex gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${t.browserDots}`} />
              <div className={`w-2.5 h-2.5 rounded-full ${t.browserDots}`} />
              <div className={`w-2.5 h-2.5 rounded-full ${t.browserDots}`} />
            </div>
          ) : (
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
            </div>
          )}
          <div className="ml-3 flex-1 max-w-xs">
            <div className={`rounded ${t.browserUrlBg} px-3 py-1 text-[11px] ${t.browserUrlText} text-center`}>
              app.meetdandy.com/dashboard
            </div>
          </div>
          {/* Date range */}
          <div className="relative ml-auto">
            <button
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] transition-colors ${t.dateBtn}`}
            >
              <CalendarIcon className="w-3 h-3" />
              {dateRange}
              <ChevronDown className={`w-3 h-3 transition-transform ${dateDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {dateDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`absolute right-0 top-full mt-1 z-20 rounded-lg border ${t.cardBorder} ${variant === "dark" ? "bg-[#1a1f1c]" : "bg-white"} shadow-lg py-1 min-w-[140px]`}
                >
                  {DATE_RANGES.map((range) => (
                    <button
                      key={range}
                      onClick={() => { setDateRange(range); setDateDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                        dateRange === range ? t.dateBtnActive : t.dateBtnInactive
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content */}
        <div className={`p-5 md:p-7 min-h-[400px] ${t.contentBg}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${selectedLocation}-${selectedProvider}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default MicrositeInteractiveDashboard;
