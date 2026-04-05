import { motion, AnimatePresence, useInView } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart3, TrendingUp, Users, MapPin, Activity,
  ChevronRight, ArrowUpRight, ArrowDownRight, ArrowLeft, X,
  CalendarIcon, ChevronDown } from
"lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Area, AreaChart, PieChart, Pie, Cell } from
"recharts";

const tabs = [
{ id: "overview", label: "Overview", icon: BarChart3 },
{ id: "locations", label: "Locations", icon: MapPin },
{ id: "providers", label: "Providers", icon: Users },
{ id: "trends", label: "Trends", icon: TrendingUp }];


const locationData = [
{
  name: "Chicago – Michigan Ave", remakes: 2.1, cases: 312, trend: "down" as const, score: 97,
  monthly: [
  { month: "Aug", cases: 38, remakes: 3 }, { month: "Sep", cases: 42, remakes: 2 },
  { month: "Oct", cases: 48, remakes: 1 }, { month: "Nov", cases: 52, remakes: 1 },
  { month: "Dec", cases: 55, remakes: 1 }, { month: "Jan", cases: 77, remakes: 2 }],

  products: [
  { name: "Crowns", value: 45 }, { name: "Bridges", value: 20 },
  { name: "Implants", value: 25 }, { name: "Other", value: 10 }]

},
{
  name: "Orlando – Colonial", remakes: 3.8, cases: 287, trend: "up" as const, score: 94,
  monthly: [
  { month: "Aug", cases: 35, remakes: 5 }, { month: "Sep", cases: 40, remakes: 4 },
  { month: "Oct", cases: 44, remakes: 4 }, { month: "Nov", cases: 48, remakes: 3 },
  { month: "Dec", cases: 55, remakes: 3 }, { month: "Jan", cases: 65, remakes: 2 }],

  products: [
  { name: "Crowns", value: 50 }, { name: "Bridges", value: 15 },
  { name: "Implants", value: 20 }, { name: "Other", value: 15 }]

},
{
  name: "Dallas – Greenville Ave", remakes: 1.9, cases: 401, trend: "down" as const, score: 98,
  monthly: [
  { month: "Aug", cases: 50, remakes: 2 }, { month: "Sep", cases: 56, remakes: 1 },
  { month: "Oct", cases: 62, remakes: 1 }, { month: "Nov", cases: 68, remakes: 1 },
  { month: "Dec", cases: 75, remakes: 1 }, { month: "Jan", cases: 90, remakes: 1 }],

  products: [
  { name: "Crowns", value: 40 }, { name: "Bridges", value: 25 },
  { name: "Implants", value: 30 }, { name: "Other", value: 5 }]

},
{
  name: "Phoenix – Scottsdale", remakes: 4.2, cases: 198, trend: "up" as const, score: 91,
  monthly: [
  { month: "Aug", cases: 22, remakes: 4 }, { month: "Sep", cases: 26, remakes: 3 },
  { month: "Oct", cases: 30, remakes: 3 }, { month: "Nov", cases: 34, remakes: 2 },
  { month: "Dec", cases: 38, remakes: 2 }, { month: "Jan", cases: 48, remakes: 2 }],

  products: [
  { name: "Crowns", value: 55 }, { name: "Bridges", value: 10 },
  { name: "Implants", value: 15 }, { name: "Other", value: 20 }]

},
{
  name: "Tampa – Brandon", remakes: 2.7, cases: 256, trend: "down" as const, score: 95,
  monthly: [
  { month: "Aug", cases: 30, remakes: 3 }, { month: "Sep", cases: 36, remakes: 2 },
  { month: "Oct", cases: 40, remakes: 2 }, { month: "Nov", cases: 44, remakes: 2 },
  { month: "Dec", cases: 50, remakes: 1 }, { month: "Jan", cases: 56, remakes: 1 }],

  products: [
  { name: "Crowns", value: 42 }, { name: "Bridges", value: 22 },
  { name: "Implants", value: 28 }, { name: "Other", value: 8 }]

}];


const providerData = [
{
  name: "Dr. Sarah Chen", location: "Dallas – Greenville Ave", cases: 142, accuracy: 99.1, trend: "up",
  monthly: [
  { month: "Aug", cases: 18, accuracy: 98.2 }, { month: "Sep", cases: 20, accuracy: 98.6 },
  { month: "Oct", cases: 22, accuracy: 99.0 }, { month: "Nov", cases: 24, accuracy: 99.2 },
  { month: "Dec", cases: 28, accuracy: 99.4 }, { month: "Jan", cases: 30, accuracy: 99.1 }],

  types: [{ name: "Crowns", value: 60 }, { name: "Bridges", value: 22 }, { name: "Implants", value: 18 }]
},
{
  name: "Dr. James Park", location: "Chicago – Michigan Ave", cases: 118, accuracy: 97.8, trend: "up",
  monthly: [
  { month: "Aug", cases: 14, accuracy: 96.5 }, { month: "Sep", cases: 16, accuracy: 97.0 },
  { month: "Oct", cases: 18, accuracy: 97.4 }, { month: "Nov", cases: 20, accuracy: 97.8 },
  { month: "Dec", cases: 24, accuracy: 98.0 }, { month: "Jan", cases: 26, accuracy: 97.8 }],

  types: [{ name: "Crowns", value: 50 }, { name: "Bridges", value: 30 }, { name: "Implants", value: 20 }]
},
{
  name: "Dr. Maria Lopez", location: "Tampa – Brandon", cases: 97, accuracy: 96.4, trend: "down",
  monthly: [
  { month: "Aug", cases: 12, accuracy: 97.0 }, { month: "Sep", cases: 14, accuracy: 96.8 },
  { month: "Oct", cases: 15, accuracy: 96.5 }, { month: "Nov", cases: 16, accuracy: 96.2 },
  { month: "Dec", cases: 18, accuracy: 96.0 }, { month: "Jan", cases: 22, accuracy: 96.4 }],

  types: [{ name: "Crowns", value: 45 }, { name: "Bridges", value: 25 }, { name: "Implants", value: 30 }]
},
{
  name: "Dr. Kevin Wright", location: "Phoenix – Scottsdale", cases: 88, accuracy: 94.2, trend: "up",
  monthly: [
  { month: "Aug", cases: 10, accuracy: 92.0 }, { month: "Sep", cases: 12, accuracy: 93.0 },
  { month: "Oct", cases: 14, accuracy: 93.5 }, { month: "Nov", cases: 15, accuracy: 94.0 },
  { month: "Dec", cases: 17, accuracy: 94.5 }, { month: "Jan", cases: 20, accuracy: 94.2 }],

  types: [{ name: "Crowns", value: 55 }, { name: "Bridges", value: 15 }, { name: "Implants", value: 30 }]
},
{
  name: "Dr. Amy Foster", location: "Orlando – Colonial", cases: 134, accuracy: 95.7, trend: "down",
  monthly: [
  { month: "Aug", cases: 16, accuracy: 96.5 }, { month: "Sep", cases: 18, accuracy: 96.2 },
  { month: "Oct", cases: 20, accuracy: 96.0 }, { month: "Nov", cases: 22, accuracy: 95.8 },
  { month: "Dec", cases: 26, accuracy: 95.5 }, { month: "Jan", cases: 32, accuracy: 95.7 }],

  types: [{ name: "Crowns", value: 48 }, { name: "Bridges", value: 28 }, { name: "Implants", value: 24 }]
}];


const trendData = [
{ month: "Jul", remakes: 5.2, cases: 980 },
{ month: "Aug", remakes: 4.8, cases: 1020 },
{ month: "Sep", remakes: 4.1, cases: 1100 },
{ month: "Oct", remakes: 3.6, cases: 1180 },
{ month: "Nov", remakes: 3.2, cases: 1250 },
{ month: "Dec", remakes: 2.8, cases: 1340 },
{ month: "Jan", remakes: 2.4, cases: 1420 }];


const PIE_COLORS = ["hsl(152, 38%, 18%)", "hsl(152, 30%, 30%)", "hsl(152, 20%, 45%)", "hsl(36, 15%, 70%)"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) =>
      <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: p.color }} />
          {p.name}: <span className="text-foreground font-medium">{p.value}</span>
        </p>
      )}
    </div>);

};

// ─── Location Detail ────────────────────────────────────────────────
const LocationDetail = ({ loc, onBack }: {loc: typeof locationData[0];onBack: () => void;}) =>
<motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
      <ArrowLeft className="w-3.5 h-3.5" /> All locations
    </button>
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-foreground">{loc.name}</h3>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xl font-bold text-foreground">{loc.cases}</p>
          <p className="text-[10px] text-muted-foreground">total cases</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${loc.remakes > 3.5 ? "text-destructive" : "text-primary"}`}>{loc.remakes}%</p>
          <p className="text-[10px] text-muted-foreground">remake rate</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Monthly Cases & Remakes</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={loc.monthly} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(36, 15%, 88%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="cases" name="Cases" fill="hsl(152, 38%, 18%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="remakes" name="Remakes" fill="hsl(0, 70%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Product Mix</p>
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie data={loc.products} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30} paddingAngle={3}>
              {loc.products.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 mt-2">
          {loc.products.map((p, i) =>
        <span key={p.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />{p.name}
            </span>
        )}
        </div>
      </div>
    </div>
  </motion.div>;


// ─── Provider Detail ────────────────────────────────────────────────
const ProviderDetail = ({ doc, onBack }: {doc: typeof providerData[0];onBack: () => void;}) =>
<motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
      <ArrowLeft className="w-3.5 h-3.5" /> All providers
    </button>
    <div className="flex items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
        {doc.name.split(" ").slice(1).map((n) => n[0]).join("")}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{doc.name}</h3>
        <p className="text-xs text-muted-foreground">{doc.location}</p>
      </div>
      <div className="ml-auto flex items-center gap-6">
        <div className="text-right">
          <p className="text-xl font-bold text-foreground">{doc.cases}</p>
          <p className="text-[10px] text-muted-foreground">cases</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${doc.accuracy >= 97 ? "text-primary" : "text-foreground"}`}>{doc.accuracy}%</p>
          <p className="text-[10px] text-muted-foreground">accuracy</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Cases Over Time</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={doc.monthly}>
            <defs>
              <linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(152, 38%, 18%)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(152, 38%, 18%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(36, 15%, 88%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="cases" name="Cases" stroke="hsl(152, 38%, 18%)" fill="url(#caseGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Accuracy Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={doc.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(36, 15%, 88%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[90, 100]} tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke="hsl(152, 38%, 18%)" strokeWidth={2} dot={{ fill: "hsl(152, 38%, 18%)", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Case Type Breakdown</p>
      <div className="flex items-center gap-6">
        {doc.types.map((t, i) =>
      <div key={t.name} className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{t.name}</span>
              <span className="text-xs font-medium text-foreground">{t.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${t.value}%` }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="h-full rounded-full"
            style={{ background: PIE_COLORS[i] }} />

            </div>
          </div>
      )}
      </div>
    </div>
  </motion.div>;


// ─── KPI sparkline data ─────────────────────────────────────────────
const kpiSparklines = {
  "Total Cases": [
  { month: "Aug", value: 980 }, { month: "Sep", value: 1020 }, { month: "Oct", value: 1100 },
  { month: "Nov", value: 1180 }, { month: "Dec", value: 1250 }, { month: "Jan", value: 1454 }],

  "Remake Rate": [
  { month: "Aug", value: 4.8 }, { month: "Sep", value: 4.1 }, { month: "Oct", value: 3.6 },
  { month: "Nov", value: 3.2 }, { month: "Dec", value: 2.9 }, { month: "Jan", value: 2.8 }],

  "Avg Turnaround": [
  { month: "Aug", value: 5.8 }, { month: "Sep", value: 5.4 }, { month: "Oct", value: 5.0 },
  { month: "Nov", value: 4.7 }, { month: "Dec", value: 4.4 }, { month: "Jan", value: 4.2 }],

  "Active Locations": [
  { month: "Aug", value: 3 }, { month: "Sep", value: 3 }, { month: "Oct", value: 4 },
  { month: "Nov", value: 4 }, { month: "Dec", value: 4 }, { month: "Jan", value: 5 }]

};

// ─── Animated counter hook ───────────────────────────────────────────
const useCountUp = (end: number, duration = 1200, decimals = 0, started = false) => {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!started) {setCount(0);return;}
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(parseFloat((eased * end).toFixed(decimals)));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {if (rafRef.current) cancelAnimationFrame(rafRef.current);};
  }, [end, duration, decimals, started]);

  return count;
};

// ─── Single KPI Card ────────────────────────────────────────────────
const KPICard = ({ stat, index, expandedCard, setExpandedCard




}: {stat: {label: string;value: string;change: string;up: boolean;numericValue: number;decimals: number;prefix: string;suffix: string;};index: number;expandedCard: string | null;setExpandedCard: (v: string | null) => void;}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, margin: "-50px" });
  const count = useCountUp(stat.numericValue, 1400 + index * 200, stat.decimals, inView);
  const isExpanded = expandedCard === stat.label;
  const sparkData = kpiSparklines[stat.label as keyof typeof kpiSparklines];

  const displayValue = `${stat.prefix}${stat.decimals > 0 ? count.toFixed(stat.decimals) : count.toLocaleString()}${stat.suffix}`;

  return (
    <motion.div
      ref={cardRef}
      key={stat.label}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => setExpandedCard(isExpanded ? null : stat.label)}
      className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-all cursor-pointer select-none">

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{stat.label}</p>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </div>
      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{displayValue}</p>
      <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
      stat.label === "Remake Rate" || stat.label === "Avg Turnaround" ?
      stat.up ? "text-destructive" : "text-primary" :
      stat.up ? "text-primary" : "text-destructive"}`
      }>
        {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {stat.change}
      </div>
      <AnimatePresence>
        {isExpanded &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 100, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden mt-3 border-t border-border pt-3">

            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={sparkData}>
                <defs>
                   <linearGradient id={`spark-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(152, 38%, 18%)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(152, 38%, 18%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name={stat.label} stroke="hsl(152, 38%, 18%)" fill={`url(#spark-${index})`} strokeWidth={1.5} dot={{ r: 2, fill: "hsl(152, 38%, 18%)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

};

// ─── Overview ───────────────────────────────────────────────────────
const OverviewView = () => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const kpis = [
  { label: "Total Cases", value: "1,454", change: "+12.3%", up: true, numericValue: 1454, decimals: 0, prefix: "", suffix: "" },
  { label: "Remake Rate", value: "2.8%", change: "-1.4%", up: false, numericValue: 2.8, decimals: 1, prefix: "", suffix: "%" },
  { label: "Avg Turnaround", value: "4.2 days", change: "-0.8 days", up: false, numericValue: 4.2, decimals: 1, prefix: "", suffix: " days" },
  { label: "Active Locations", value: "5", change: "+1", up: true, numericValue: 5, decimals: 0, prefix: "", suffix: "" }];


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((stat, i) =>
        <KPICard key={stat.label} stat={stat} index={i} expandedCard={expandedCard} setExpandedCard={setExpandedCard} />
        )}
      </div>

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
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(36, 15%, 88%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(36, 20%, 92%)" }} />
            <Bar dataKey="cases" name="Cases" fill="hsl(152, 38%, 18%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="remakes" name="Remakes %" fill="hsl(0, 70%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>);

};

// ─── Locations List ─────────────────────────────────────────────────
const LocationsView = ({ onSelect }: {onSelect: (i: number) => void;}) =>
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
      <span className="col-span-4">Location</span>
      <span className="col-span-2 text-center">Cases</span>
      <span className="col-span-2 text-center">Remakes</span>
      <span className="col-span-2 text-center">Score</span>
      <span className="col-span-2 text-center">Trend</span>
    </div>
    {locationData.map((loc, i) =>
  <motion.div
    key={loc.name}
    initial={{ opacity: 0, x: -15 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: i * 0.05 }}
    onClick={() => onSelect(i)}
    className="grid grid-cols-12 gap-4 items-center rounded-lg border border-border bg-card px-4 py-3.5 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all group">

        <div className="col-span-4 flex items-center gap-2">
          <ChevronRight className="w-3.5 h-3.5 text-primary group-hover:translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium text-foreground">{loc.name}</span>
        </div>
        <span className="col-span-2 text-center text-sm text-muted-foreground">{loc.cases}</span>
        <span className={`col-span-2 text-center text-sm font-medium ${loc.remakes > 3.5 ? "text-destructive" : "text-primary"}`}>
          {loc.remakes}%
        </span>
        <div className="col-span-2 flex justify-center">
          <div className="w-full max-w-[60px] h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${loc.score}%` }}
          transition={{ delay: 0.2 + i * 0.06, duration: 0.6 }}
          className={`h-full rounded-full ${loc.score >= 96 ? "bg-primary" : "bg-muted-foreground"}`} />

          </div>
        </div>
        <div className="col-span-2 flex justify-center">
          {loc.trend === "down" ?
      <span className="flex items-center gap-1 text-xs text-primary"><ArrowDownRight className="w-3 h-3" />Improving</span> :

      <span className="flex items-center gap-1 text-xs text-destructive/70"><ArrowUpRight className="w-3 h-3" />Watch</span>
      }
        </div>
      </motion.div>
  )}
    <p className="text-[11px] text-muted-foreground text-center pt-2">Click a location to see detailed analytics</p>
  </motion.div>;


// ─── Providers List ─────────────────────────────────────────────────
const ProvidersView = ({ onSelect }: {onSelect: (i: number) => void;}) =>
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
    {providerData.map((doc, i) =>
  <motion.div
    key={doc.name}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05 }}
    onClick={() => onSelect(i)}
    className="rounded-lg border border-border bg-card p-4 flex items-center justify-between cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all group">

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
            {doc.name.split(" ").slice(1).map((n) => n[0]).join("")}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{doc.name}</p>
            <p className="text-xs text-muted-foreground">{doc.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{doc.cases}</p>
            <p className="text-[10px] text-muted-foreground">cases</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold ${doc.accuracy >= 97 ? "text-primary" : "text-foreground"}`}>{doc.accuracy}%</p>
            <p className="text-[10px] text-muted-foreground">accuracy</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </motion.div>
  )}
    <p className="text-[11px] text-muted-foreground text-center pt-2">Click a provider to see detailed analytics</p>
  </motion.div>;


// ─── Trends ─────────────────────────────────────────────────────────
const TrendsView = () =>
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Remake Rate Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="remakeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(152, 38%, 18%)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(152, 38%, 18%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(36, 15%, 88%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="remakes" name="Remakes %" stroke="hsl(152, 38%, 18%)" fill="url(#remakeGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-primary">
          <TrendingUp className="w-3 h-3" />
          53% improvement over 7 months
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Case Volume Growth</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(36, 15%, 88%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(152, 10%, 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(36, 20%, 92%)" }} />
            <Bar dataKey="cases" name="Cases" fill="hsl(152, 38%, 18%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="w-3 h-3" />
          45% case volume increase
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
    { title: "Fastest Improving", value: "Dallas – Central", detail: "Remakes down 62% in 6 months" },
    { title: "Highest Volume", value: "Dr. Sarah Chen", detail: "142 cases this quarter" },
    { title: "Best New Location", value: "San Antonio", detail: "On-boarded 3 months ago, already top 3" }].
    map((card, i) =>
    <motion.div
      key={card.title}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + i * 0.08 }}
      className="rounded-lg border border-border bg-card p-4">

          <p className="text-[10px] text-primary uppercase tracking-wider font-medium">{card.title}</p>
          <p className="text-base font-semibold text-foreground mt-2">{card.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{card.detail}</p>
        </motion.div>
    )}
    </div>
  </motion.div>;


// ─── Main Dashboard ─────────────────────────────────────────────────
const DATE_RANGES = ["Last 7 days", "Last 30 days", "Last 90 days", "Last 6 months", "Last 12 months"];

const DSODashboard = () => {
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
      return <LocationDetail loc={locationData[selectedLocation]} onBack={() => setSelectedLocation(null)} />;
    }
    if (activeTab === "providers" && selectedProvider !== null) {
      return <ProviderDetail doc={providerData[selectedProvider]} onBack={() => setSelectedProvider(null)} />;
    }

    switch (activeTab) {
      case "overview":return <OverviewView />;
      case "locations":return <LocationsView onSelect={setSelectedLocation} />;
      case "providers":return <ProvidersView onSelect={setSelectedProvider} />;
      case "trends":return <TrendsView />;
      default:return null;
    }
  };

  return (
    <section id="dashboard" className="section-padding bg-secondary">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[11px] font-semibold text-primary mb-5 tracking-[0.15em] uppercase">

            Executive Visibility
          </motion.p>
           <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-display text-foreground">
            Dashboards don't change outcomes. <br />Decisions do.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-5 text-body-lg text-muted-foreground max-w-xl mx-auto">

            Dandy Insights gives leaders actionable data — not just reports. Know where to intervene before problems scale, manage by exception, and maintain control as complexity increases.
          </motion.p>
        </div>

        {/* Tab bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="flex justify-center mb-8">

          <div className="rounded-lg border border-border bg-card p-1 flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive ?
                  "bg-primary text-primary-foreground" :
                  "text-muted-foreground hover:text-foreground"}`
                  }>

                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>);

            })}
          </div>
        </motion.div>

        {/* Dashboard frame */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="rounded-xl border border-border overflow-hidden">

          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-primary/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-primary/20" />
            <div className="ml-3 flex-1 max-w-xs">
              <div className="rounded bg-muted px-3 py-1 text-[11px] text-muted-foreground text-center">
                app.meetdandy.com/dashboard
              </div>
            </div>
            {/* Date range filter */}
            <div className="relative ml-auto">
              <button
                onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">

                <CalendarIcon className="w-3 h-3" />
                {dateRange}
                <ChevronDown className={`w-3 h-3 transition-transform ${dateDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {dateDropdownOpen &&
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-card shadow-lg py-1 min-w-[140px]">

                    {DATE_RANGES.map((range) =>
                  <button
                    key={range}
                    onClick={() => {setDateRange(range);setDateDropdownOpen(false);}}
                    className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                    dateRange === range ?
                    "text-primary bg-primary/10" :
                    "text-muted-foreground hover:text-foreground hover:bg-muted"}`
                    }>

                        {range}
                      </button>
                  )}
                  </motion.div>
                }
              </AnimatePresence>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 md:p-7 min-h-[400px] bg-background">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${selectedLocation}-${selectedProvider}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}>

                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>);

};

export default DSODashboard;