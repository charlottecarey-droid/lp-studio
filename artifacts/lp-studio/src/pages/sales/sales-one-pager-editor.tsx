import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, Upload, X, FileDown, Loader2, RotateCcw,
  Image as ImageIcon, Type, Ruler, Users, Eye, EyeOff,
  Save, Table, BarChart3, Palette, ArrowLeft, Check,
} from "lucide-react";
import { Link } from "wouter";
import { Slider } from "@/components/ui/slider";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  generatePilotOnePager,
  generateComparisonOnePager,
  generateNewPartnerOnePager,
  generateROIOnePager,
} from "./sales-one-pager";

// ── API helpers (mirrors sales-one-pager.tsx) ──────────────────────
const API_BASE = "/api";

async function loadLayoutDefault(key: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data) { localStorage.setItem(`lp_studio_${key}`, JSON.stringify(data)); return data; }
    }
  } catch {}
  try { const raw = localStorage.getItem(`lp_studio_${key}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

async function saveLayoutDefault(key: string, config: Record<string, any>): Promise<void> {
  try { localStorage.setItem(`lp_studio_${key}`, JSON.stringify(config)); } catch {}
  try {
    await fetch(`${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }),
    });
  } catch {}
}

// ── Types ───────────────────────────────────────────────────────────
type EditorTemplate = "pilot" | "comparison" | "partner" | "roi";
type Audience = "executive" | "clinical" | "practice-manager";

interface HeaderConfig {
  height: number; splitRatio: number; titleText: string; titleFontSize: number;
  subtitleFontSize: number; subtitleOffsetY: number; subtitleText: string; headerImage: string | null;
  imageCropAnchor: "top" | "center" | "bottom"; partnerLogoScale: number;
  partnerLogoOffsetX: number; partnerLogoOffsetY: number; titleLineSpacing: number;
}
interface BodyConfig {
  headlineText: string; headlineFontSize: number; introFontSize: number;
  featureTitleFontSize: number; featureDescFontSize: number; featureTitleDescSpacing: number; showIntro: boolean;
  contentOffsetX: number; sectionSpacing: number; statValueFontSize: number;
  statDescFontSize: number; bulletOffsetX: number; bulletOffsetY: number;
  checklistSpacing: number; checklistShowDividers: boolean; checklistFontSize: number;
  dividerOffsetX: number; dividerOffsetY: number; dividerLength: number;
  quoteShow: boolean; quoteText: string; quoteFontSize: number;
  // Comparison-specific
  compTableFontSize: number; compTableHeaderFontSize: number;
  compTableRowHeight: number; compTableHeaderHeight: number; compTableCapColWidth: number;
  compStatValueSize: number; compStatLabelSize: number; compStatCardHeight: number;
}
interface TeamConfig { show: boolean; headingFontSize: number; nameFontSize: number; }
interface FooterConfig { fontSize: number; show: boolean; link: string; height: number; }

const defaultHeaderConfig: HeaderConfig = {
  height: 280, splitRatio: 48, titleText: "", titleFontSize: 28,
  subtitleFontSize: 11, subtitleOffsetY: 0,
  subtitleText: "Your custom partnership overview — built for scale, savings & growth",
  headerImage: null,
  imageCropAnchor: "center", partnerLogoScale: 100, partnerLogoOffsetX: 0, partnerLogoOffsetY: 0,
  titleLineSpacing: 1.32,
};
const DEFAULT_QUOTE_TEXT = "I've used Dandy Dental Lab for the last two years for crowns, implant crowns, and removables, and their work is consistently excellent. The quality is outstanding and their customer service is even better. I wouldn't change this lab for any other.";

const defaultBodyConfig: BodyConfig = {
  headlineText: "Experience the world's most advanced dental lab for 90 days. No long-term commitment needed.",
  headlineFontSize: 16, introFontSize: 9.5, featureTitleFontSize: 10, featureDescFontSize: 8.5,
  featureTitleDescSpacing: 14, showIntro: true, contentOffsetX: 0, sectionSpacing: 16,
  statValueFontSize: 30, statDescFontSize: 8, bulletOffsetX: 0, bulletOffsetY: 0,
  checklistSpacing: 10, checklistShowDividers: false, checklistFontSize: 9,
  dividerOffsetX: 0, dividerOffsetY: 0, dividerLength: 0,
  quoteShow: true, quoteText: DEFAULT_QUOTE_TEXT, quoteFontSize: 9.5,
  // Comparison-specific defaults (match generator hard-coded values)
  compTableFontSize: 8, compTableHeaderFontSize: 8,
  compTableRowHeight: 40, compTableHeaderHeight: 28, compTableCapColWidth: 130,
  compStatValueSize: 22, compStatLabelSize: 7.5, compStatCardHeight: 80,
};
const defaultTeamConfig: TeamConfig = { show: true, headingFontSize: 13, nameFontSize: 10 };
const defaultFooterConfig: FooterConfig = { fontSize: 10, show: true, link: "meetdandy.com", height: 36 };

const defaultAudienceContent = {
  executive: {
    subtitle: "Achieve quality, consistency, and control at scale.",
    introText: "What to expect during this pilot: Over the next 90 days, we'll partner with your organization to onboard clinicians efficiently, support adoption of digital workflows, and ensure cases run smoothly in practice.",
    features: [
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your practices up to speed fast with free onboarding." },
      { icon: "💬", title: "Clinical collaboration", description: "Live Chat and Live Scan Review connect clinicians directly with our team of lab technicians in real time." },
      { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "📊", title: "Dandy Insights", description: "Dandy surfaces aggregate, pilot-level insights including scanner utilization, workflow adoption, and quality signals." },
      { icon: "📋", title: "Case management simplified", description: "Access the Dandy Portal to track, manage, and review active orders and our dashboard to streamline invoicing." },
      { icon: "💰", title: "Exclusive pricing for your organization", description: "Contact the team below to access a product guide with approved pricing." },
    ],
    checklist: [] as string[],
  },
  clinical: {
    subtitle: "Fully embrace digital dentistry with smarter technology and seamless workflows.",
    introText: "",
    features: [
      { icon: "💬", title: "Clinical collaboration", description: "Clinicians and staff can speak with our team of clinical experts in just 60 seconds or collaborate on complex cases virtually." },
      { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "🦷", title: "2-Appointment Dentures", description: "Utilize seamless digital workflows like 2-Appointment Dentures to save chair time and create a better patient experience." },
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. Get up to speed fast with free onboarding and unlimited access to ongoing digital CPD credit education." },
    ],
    checklist: [] as string[],
  },
  "practice-manager": {
    subtitle: "Reduce operational friction and administrative burden with Dandy.",
    introText: "",
    features: [
      { icon: "💰", title: "Invoicing made easy", description: "Our dashboard makes invoicing a simple and efficient process." },
      { icon: "📊", title: "Get insights in Practice Portal", description: "Gain visibility into order delivery dates, seamless communicate with the lab, scanner, manage payment, and more." },
      { icon: "💬", title: "Real-time lab communication", description: "Our team of clinical experts handle lab communication including live collaboration, fielding questions, and issue resolution." },
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your teams up to speed fast with free onboarding and CPD training." },
    ],
    checklist: [
      "Attend an in-person or virtual onboarding session",
      "Use the Dandy Portal to track, manage, and review orders",
      "Access Dandy Insights to get an overview of pilot performance",
      "Check in with clinicians to gather high-level feedback",
    ],
  },
};

const defaultComparisonRows = [
  { capability: "Quality & Remakes", then: "Greater variability across cases", now: "Standardized quality control systems + 96% remake rate reduction with AI scan review" },
  { capability: "Case Acceptance & Diagnostics", then: "Limited diagnostic scan support", now: "Free Dandy diagnostic scans driving ~30% average lift in case acceptance" },
  { capability: "Workflow & Case Management", then: "More manual coordination and back-and-forth", now: "Real-time lab support — 88% say it makes case management easier" },
  { capability: "Turnaround & Predictability", then: "Less predictable production timelines", now: "National manufacturing scale with more consistent turnaround windows" },
  { capability: "Digital Integration", then: "Early-stage digital workflow", now: "Fully integrated digital lab system with streamlined file submission" },
  { capability: "Product Offering", then: "More limited restorative options", now: "Expanded product portfolio across key restorative categories" },
  { capability: "Support Structure", then: "General support model", now: "Dedicated account support with more proactive case visibility" },
];
const defaultComparisonStats = [
  { value: "88%", label: "say real-time lab support makes case management easier" },
  { value: "~30%", label: "average increase in case acceptance with free Dandy diagnostic scans" },
  { value: "96%", label: "remake rate reduction with AI scan review" },
];

const defaultPartnerHeadline = "Unlock the Power of Digital Dentistry with Dandy";
const defaultPartnerIntro = `As {dso}'s newest preferred lab partner, Dandy is here to help your practice thrive with the most advanced digital dental lab in the industry. Together, we're delivering smarter, faster, and more predictable outcomes—while elevating patient care and your bottom line.`;
const defaultPartnerFeatures = [
  { title: "Increase treatment predictability", desc: "Get real-time expert guidance while your patient is in the chair for confident, accurate outcomes." },
  { title: "Digitize every restorative workflow", desc: "Get a free Dandy Vision Scanner and Cart." },
  { title: "Access state-of-the-art lab quality", desc: "Deliver high-quality prosthetics with digital precision, premium materials, and unmatched consistency." },
  { title: "Get your new partnership perks and preferred pricing", desc: "" },
];
const defaultPartnerStats = [
  { value: "88%", desc: "say Dandy's real-time lab support makes case management easier." },
  { value: "83%", desc: "say they have saved time using Dandy's portal to manage lab cases." },
  { value: "67%", desc: "say Dandy's technology gives them a competitive edge over other practices." },
];

// ── Collapsible section ─────────────────────────────────────────────
function EditorSection({ title, icon, open, onToggle, children }: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors">
        <span className="flex items-center gap-2">{icon}{title}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-2 space-y-4 border-t border-border">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Slider row ──────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step = 1, unit = "", onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium text-muted-foreground w-40 shrink-0">{label}</span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} className="flex-1" />
      <span className="text-xs font-mono text-foreground w-14 text-right">{value}{unit}</span>
    </div>
  );
}

// ── Input helpers ────────────────────────────────────────────────────
const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30";
const textareaCls = `${inputCls} resize-none`;

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
export default function SalesOnePagerEditor() {
  const { hasPerm } = useAuth();
  const isAdmin = hasPerm("sales_campaigns");

  const [editorTemplate, setEditorTemplate] = useState<EditorTemplate>("pilot");
  const [audience, setAudience] = useState<Audience>("executive");
  const [previewVisible, setPreviewVisible] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [dsoName, setDsoName] = useState("Acme DSO");
  const [numPractices, setNumPractices] = useState(50);

  // Layout configs
  const [headerCfg, setHeaderCfg] = useState<HeaderConfig>({ ...defaultHeaderConfig });
  // bodyCfg is per-audience for pilot; shared for comparison/partner
  const [audienceBodyCfgs, setAudienceBodyCfgs] = useState<Record<Audience, BodyConfig>>({
    executive: { ...defaultBodyConfig },
    clinical: { ...defaultBodyConfig },
    "practice-manager": { ...defaultBodyConfig },
  });
  const [sharedBodyCfg, setSharedBodyCfg] = useState<BodyConfig>({ ...defaultBodyConfig });
  const bodyCfg: BodyConfig = editorTemplate === "pilot" ? audienceBodyCfgs[audience] : sharedBodyCfg;
  const setBodyCfg = (updater: BodyConfig | ((prev: BodyConfig) => BodyConfig)) => {
    if (editorTemplate === "pilot") {
      setAudienceBodyCfgs(p => {
        const val = typeof updater === "function" ? updater(p[audience]) : updater;
        return { ...p, [audience]: val };
      });
    } else {
      setSharedBodyCfg(prev => typeof updater === "function" ? updater(prev) : updater);
    }
  };
  const [teamCfg, setTeamCfg] = useState<TeamConfig>({ ...defaultTeamConfig });
  const [footerCfg, setFooterCfg] = useState<FooterConfig>({ ...defaultFooterConfig });

  // Pilot content — keyed by audience
  const [audienceContent, setAudienceContent] = useState(JSON.parse(JSON.stringify(defaultAudienceContent)));
  // Full per-audience header configs (every setting, including image, is independent per audience)
  const [audienceHeaderCfgs, setAudienceHeaderCfgs] = useState<Record<Audience, HeaderConfig>>({
    executive: { ...defaultHeaderConfig },
    clinical: { ...defaultHeaderConfig },
    "practice-manager": { ...defaultHeaderConfig },
  });

  // Comparison content
  const [comparisonRows, setComparisonRows] = useState(JSON.parse(JSON.stringify(defaultComparisonRows)));
  const [comparisonStats, setComparisonStats] = useState(JSON.parse(JSON.stringify(defaultComparisonStats)));

  // Partner content
  const [partnerHeadline, setPartnerHeadline] = useState(defaultPartnerHeadline);
  const [partnerIntro, setPartnerIntro] = useState(defaultPartnerIntro);
  const [partnerFeatures, setPartnerFeatures] = useState(JSON.parse(JSON.stringify(defaultPartnerFeatures)));
  const [partnerStats, setPartnerStats] = useState(JSON.parse(JSON.stringify(defaultPartnerStats)));
  const [partnerQrUrl, setPartnerQrUrl] = useState("https://meetdandy.com");

  // Team contacts
  const [teamContacts, setTeamContacts] = useState([
    { name: "", title: "", contactInfo: "" },
    { name: "", title: "", contactInfo: "" },
    { name: "", title: "", contactInfo: "" },
  ]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customLinkText, setCustomLinkText] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");

  // Prospect logo
  const [prospectLogoData, setProspectLogoData] = useState<string | null>(null);
  const [prospectLogoName, setProspectLogoName] = useState("");
  const [prospectLogoDims, setProspectLogoDims] = useState({ w: 200, h: 100 });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const headerImgInputRef = useRef<HTMLInputElement>(null);

  // Collapsible sections
  const [openSections, setOpenSections] = useState({
    header: true, body: false, content: true, team: false, footer: false, table: true, stats: false,
  });
  const toggle = (k: keyof typeof openSections) => setOpenSections(p => ({ ...p, [k]: !p[k] }));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load saved defaults on mount + template switch ────────────────
  const loadDefaults = useCallback(async (tmpl: EditorTemplate) => {
    if (tmpl === "pilot") {
      const audienceKeyMap: Record<Audience, string> = {
        executive: "dandy_pilot_executive_layout",
        clinical: "dandy_pilot_clinical_layout",
        "practice-manager": "dandy_pilot_practicemgr_layout",
      };
      // Load shared pilot key (team, footer, content; headerCfg kept for backward compat)
      const shared = await loadLayoutDefault("dandy_pilot_template_layout");
      const sharedData = shared ?? {};
      if (sharedData.teamCfg) setTeamCfg(p => ({ ...p, ...sharedData.teamCfg }));
      if (sharedData.footerCfg) setFooterCfg(p => ({ ...p, ...sharedData.footerCfg }));
      if (sharedData.audienceContent) setAudienceContent((p: typeof defaultAudienceContent) => ({ ...p, ...sharedData.audienceContent }));
      // Legacy: bodyCfg in shared key → seed all three audiences
      if (sharedData.bodyCfg) {
        setAudienceBodyCfgs({
          executive: { ...defaultBodyConfig, ...sharedData.bodyCfg },
          clinical: { ...defaultBodyConfig, ...sharedData.bodyCfg },
          "practice-manager": { ...defaultBodyConfig, ...sharedData.bodyCfg },
        });
      }

      // Load per-audience configs (headerCfg + bodyCfg) from each audience key
      const legacyImages = (sharedData.audienceHeaderImages ?? {}) as Record<string, string | null>;
      const sharedHeaderBase = (sharedData.headerCfg ?? {}) as Partial<HeaderConfig>;
      const newHeaderCfgs: Record<Audience, HeaderConfig> = {
        executive: { ...defaultHeaderConfig, ...sharedHeaderBase },
        clinical: { ...defaultHeaderConfig, ...sharedHeaderBase },
        "practice-manager": { ...defaultHeaderConfig, ...sharedHeaderBase },
      };
      const newBodyCfgs: Record<Audience, BodyConfig> = {
        executive: { ...defaultBodyConfig },
        clinical: { ...defaultBodyConfig },
        "practice-manager": { ...defaultBodyConfig },
      };
      for (const aud of (["executive", "clinical", "practice-manager"] as Audience[])) {
        const saved = await loadLayoutDefault(audienceKeyMap[aud]);
        if (saved?.headerCfg) {
          newHeaderCfgs[aud] = { ...defaultHeaderConfig, ...sharedHeaderBase, ...saved.headerCfg as Partial<HeaderConfig> };
        } else if (legacyImages[aud] !== undefined) {
          // Backward compat: old saves stored image in shared audienceHeaderImages
          newHeaderCfgs[aud] = { ...newHeaderCfgs[aud], headerImage: legacyImages[aud] };
        }
        if (saved?.bodyCfg) {
          newBodyCfgs[aud] = { ...defaultBodyConfig, ...saved.bodyCfg };
        }
      }
      setAudienceHeaderCfgs(newHeaderCfgs);
      setAudienceBodyCfgs(newBodyCfgs);
      // Apply current audience's headerCfg to the live headerCfg state
      setHeaderCfg(newHeaderCfgs[audience]);
      return;
    }

    if (tmpl === "roi") {
      // Start with ROI-specific defaults (shorter header than other templates)
      setHeaderCfg({
        ...defaultHeaderConfig,
        height: 160,
        titleFontSize: 22,
        subtitleFontSize: 11,
        subtitleText: "Your custom partnership overview — built for scale, savings & growth",
      });
      const saved = await loadLayoutDefault("dandy_roi_template_layout");
      if (saved?.headerCfg) setHeaderCfg(p => ({ ...p, ...saved.headerCfg }));
      return;
    }

    const keyMap: Record<EditorTemplate, string> = {
      pilot: "",
      comparison: "dandy_comparison_template_layout",
      partner: "dandy_partner_template_layout",
      roi: "",
    };
    const key = keyMap[tmpl];
    if (!key) return;
    const saved = await loadLayoutDefault(key);
    if (!saved) return;

    if (saved.headerCfg) setHeaderCfg(p => ({ ...p, ...saved.headerCfg }));
    if (saved.bodyCfg) setSharedBodyCfg(p => ({ ...p, ...saved.bodyCfg }));
    if (saved.teamCfg) setTeamCfg(p => ({ ...p, ...saved.teamCfg }));
    if (saved.footerCfg) setFooterCfg(p => ({ ...p, ...saved.footerCfg }));

    if (tmpl === "comparison") {
      if (saved.comparisonRows) setComparisonRows(saved.comparisonRows);
      if (saved.stats) setComparisonStats(saved.stats);
    }
    if (tmpl === "partner") {
      if (saved.partnerHeadline) setPartnerHeadline(saved.partnerHeadline);
      if (saved.partnerIntro) setPartnerIntro(saved.partnerIntro);
      if (saved.partnerFeatures) setPartnerFeatures(saved.partnerFeatures);
      if (saved.partnerStats) setPartnerStats(saved.partnerStats);
      if (saved.partnerQrUrl) setPartnerQrUrl(saved.partnerQrUrl);
    }
  }, [audience]);

  useEffect(() => { loadDefaults(editorTemplate); }, [editorTemplate]);

  // When audience changes in pilot, save/restore the full per-audience headerCfg
  const switchAudience = (a: Audience) => {
    // Snapshot current headerCfg into the current audience's slot
    setAudienceHeaderCfgs(p => ({ ...p, [audience]: headerCfg }));
    // Load the target audience's headerCfg (already in state from loadDefaults)
    setHeaderCfg(audienceHeaderCfgs[a]);
    setAudience(a);
  };

  // ── Live preview (debounced 500ms) ────────────────────────────────
  useEffect(() => {
    if (!previewVisible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        let doc;
        const override: Record<string, any> = { headerCfg, bodyCfg, teamCfg, footerCfg };
        if (editorTemplate === "pilot") {
          const content = audienceContent[audience];
          doc = await generatePilotOnePager(
            dsoName, audience, teamContacts, phoneNumber,
            prospectLogoData, prospectLogoDims,
            { ...content, headerImage: content.headerImage ?? "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80" },
            customLinkText, customLinkUrl, override,
          );
        } else if (editorTemplate === "comparison") {
          doc = await generateComparisonOnePager(
            dsoName, teamContacts, phoneNumber, prospectLogoData, prospectLogoDims,
            customLinkText, customLinkUrl,
            { ...override, comparisonRows, stats: comparisonStats },
          );
        } else if (editorTemplate === "partner") {
          doc = await generateNewPartnerOnePager(
            dsoName, prospectLogoData, prospectLogoDims, partnerQrUrl,
            { ...override, partnerHeadline, partnerIntro, partnerFeatures, partnerStats, partnerQrUrl },
          );
        } else {
          doc = await generateROIOnePager(dsoName, numPractices, { headerCfg });
        }
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        setPreviewUrl(prev => { if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev); return url; });
      } catch (err) {
        console.error("[Preview]", err);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [
    previewVisible, editorTemplate, audience, dsoName, numPractices,
    headerCfg, bodyCfg, teamCfg, footerCfg, audienceContent,
    comparisonRows, comparisonStats, partnerHeadline, partnerIntro,
    partnerFeatures, partnerStats, partnerQrUrl,
    teamContacts, phoneNumber, customLinkText, customLinkUrl,
    prospectLogoData, prospectLogoDims,
  ]);

  // ── Save defaults ─────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      if (editorTemplate === "pilot") {
        // Capture the current audience's live headerCfg into the per-audience map
        const allHeaderCfgs = { ...audienceHeaderCfgs, [audience]: headerCfg };
        const audienceKeyMap: Record<Audience, string> = {
          executive: "dandy_pilot_executive_layout",
          clinical: "dandy_pilot_clinical_layout",
          "practice-manager": "dandy_pilot_practicemgr_layout",
        };
        // Save shared data (team, footer, content) + backward-compat audienceHeaderImages
        await saveLayoutDefault("dandy_pilot_template_layout", {
          teamCfg, footerCfg, audienceContent,
          audienceHeaderImages: Object.fromEntries(
            (["executive", "clinical", "practice-manager"] as Audience[]).map(a => [a, allHeaderCfgs[a].headerImage])
          ),
        });
        // Save ALL three audiences' full headerCfg + bodyCfg to their own keys
        await Promise.all((["executive", "clinical", "practice-manager"] as Audience[]).map(aud =>
          saveLayoutDefault(audienceKeyMap[aud], {
            headerCfg: allHeaderCfgs[aud],
            bodyCfg: audienceBodyCfgs[aud],
          })
        ));
      } else if (editorTemplate === "comparison") {
        await saveLayoutDefault("dandy_comparison_template_layout", {
          headerCfg, bodyCfg, teamCfg, footerCfg, comparisonRows, stats: comparisonStats,
        });
      } else if (editorTemplate === "partner") {
        await saveLayoutDefault("dandy_partner_template_layout", {
          headerCfg, bodyCfg, teamCfg, footerCfg,
          partnerHeadline, partnerIntro, partnerFeatures, partnerStats, partnerQrUrl,
        });
      } else if (editorTemplate === "roi") {
        await saveLayoutDefault("dandy_roi_template_layout", { headerCfg });
      }
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2500);
      toast({ title: "Template saved!", description: "All sales reps will now see these defaults when generating one-pagers." });
    } catch {
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Reset to defaults ─────────────────────────────────────────────
  const handleReset = () => {
    setHeaderCfg({ ...defaultHeaderConfig });
    setBodyCfg({ ...defaultBodyConfig });
    setTeamCfg({ ...defaultTeamConfig });
    setFooterCfg({ ...defaultFooterConfig });
    if (editorTemplate === "pilot") setAudienceContent(JSON.parse(JSON.stringify(defaultAudienceContent)));
    if (editorTemplate === "comparison") { setComparisonRows(JSON.parse(JSON.stringify(defaultComparisonRows))); setComparisonStats(JSON.parse(JSON.stringify(defaultComparisonStats))); }
    if (editorTemplate === "partner") { setPartnerHeadline(defaultPartnerHeadline); setPartnerIntro(defaultPartnerIntro); setPartnerFeatures(JSON.parse(JSON.stringify(defaultPartnerFeatures))); setPartnerStats(JSON.parse(JSON.stringify(defaultPartnerStats))); }
  };

  // ── Download ──────────────────────────────────────────────────────
  const handleDownload = async () => {
    setGenerating(true);
    try {
      const override: Record<string, any> = { headerCfg, bodyCfg, teamCfg, footerCfg };
      let doc;
      if (editorTemplate === "pilot") {
        const content = audienceContent[audience];
        doc = await generatePilotOnePager(dsoName, audience, teamContacts, phoneNumber, prospectLogoData, prospectLogoDims, content, customLinkText, customLinkUrl, override);
        doc.save(`Dandy_x_${dsoName.replace(/\s+/g, "_")}_90Day_Pilot.pdf`);
      } else if (editorTemplate === "comparison") {
        doc = await generateComparisonOnePager(dsoName, teamContacts, phoneNumber, prospectLogoData, prospectLogoDims, customLinkText, customLinkUrl, { ...override, comparisonRows, stats: comparisonStats });
        doc.save(`Dandy_Evolution_${dsoName.replace(/\s+/g, "_")}.pdf`);
      } else if (editorTemplate === "partner") {
        doc = await generateNewPartnerOnePager(dsoName, prospectLogoData, prospectLogoDims, partnerQrUrl, { ...override, partnerHeadline, partnerIntro, partnerFeatures, partnerStats, partnerQrUrl });
        doc.save(`Dandy_x_${dsoName.replace(/\s+/g, "_")}_Partner.pdf`);
      } else {
        doc = await generateROIOnePager(dsoName, numPractices, { headerCfg });
        doc.save(`Dandy_for_${dsoName.replace(/\s+/g, "_")}.pdf`);
      }
    } finally { setGenerating(false); }
  };

  // ── Logo upload ───────────────────────────────────────────────────
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setProspectLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => { setProspectLogoDims({ w: img.naturalWidth, h: img.naturalHeight }); setProspectLogoData(dataUrl); };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleHeaderImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setHeaderCfg(p => ({ ...p, headerImage: reader.result as string }));
    reader.readAsDataURL(file);
  };

  // ── Content helpers ───────────────────────────────────────────────
  const updateFeature = (i: number, field: "title" | "description", value: string) => {
    setAudienceContent((p: typeof defaultAudienceContent) => {
      const updated = { ...p, [audience]: { ...p[audience], features: p[audience].features.map((f: { icon: string; title: string; description: string }, j: number) => j === i ? { ...f, [field]: value } : f) } };
      return updated;
    });
  };
  const updateChecklist = (i: number, value: string) => {
    setAudienceContent((p: typeof defaultAudienceContent) => ({
      ...p, [audience]: { ...p[audience], checklist: p[audience].checklist.map((c: string, j: number) => j === i ? value : c) },
    }));
  };
  const updateComparisonRow = (i: number, field: "capability" | "then" | "now", value: string) =>
    setComparisonRows((p: typeof defaultComparisonRows) => p.map((r: typeof defaultComparisonRows[0], j: number) => j === i ? { ...r, [field]: value } : r));
  const updateComparisonStat = (i: number, field: "value" | "label", value: string) =>
    setComparisonStats((p: typeof defaultComparisonStats) => p.map((s: typeof defaultComparisonStats[0], j: number) => j === i ? { ...s, [field]: value } : s));

  if (!isAdmin) {
    return (
      <SalesLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Restricted</h2>
            <p className="text-muted-foreground text-sm mb-4">Only admins can access the template editor.</p>
            <Link href="/sales/one-pager"><button className="text-sm text-primary hover:underline">← Back to One-Pager Generator</button></Link>
          </div>
        </div>
      </SalesLayout>
    );
  }

  const currentContent = audienceContent[audience];
  const templateLabels: Record<EditorTemplate, string> = { pilot: "90-Day Pilot", comparison: "Dandy Evolution", partner: "Partner Practices", roi: "ROI Brief" };

  return (
    <SalesLayout>
      <div className="py-8 bg-background min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6">

          {/* Header */}
          <div className="text-center mb-6">
            <Link href="/sales/one-pager">
              <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
                <ArrowLeft className="w-4 h-4" /> Back to One-Pager Generator
              </button>
            </Link>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Template Editor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Customize every section — changes preview live. Save to update defaults for all sales reps.
            </p>
          </div>

          {/* Template selector */}
          <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
            <div className="inline-flex rounded-full border border-border overflow-hidden">
              {(["pilot", "comparison", "partner", "roi"] as EditorTemplate[]).map(t => (
                <button key={t} onClick={() => setEditorTemplate(t)}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${editorTemplate === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}>
                  {templateLabels[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
            {editorTemplate === "pilot" && (
              <div className="flex flex-col items-center gap-1">
                <div className="inline-flex rounded-full border border-border overflow-hidden">
                  {(["executive", "clinical", "practice-manager"] as Audience[]).map(a => (
                    <button key={a} onClick={() => switchAudience(a)}
                      className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${audience === a ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}>
                      {a === "practice-manager" ? "Practice Mgr" : a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">All settings below are saved independently per audience</span>
              </div>
            )}
            <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
            </button>
            <button onClick={() => setPreviewVisible(p => !p)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {previewVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {previewVisible ? "Hide Preview" : "Show Preview"}
            </button>
            <button onClick={handleSave} disabled={saving}
              className={`flex items-center gap-1.5 text-xs font-medium transition-all border rounded-lg px-3 py-1.5 ${savedIndicator ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "text-primary hover:text-primary/80 border-primary/30 bg-background hover:bg-primary/5"}`}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedIndicator ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Saving…" : savedIndicator ? "Saved!" : "Save as Default"}
            </button>
            <button onClick={handleDownload} disabled={generating}
              className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all border border-primary/30 rounded-lg px-3 py-1.5 disabled:opacity-60">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              {generating ? "Generating…" : "Download PDF"}
            </button>
          </div>

          {/* Main layout: editor + preview */}
          <div className={`flex gap-6 ${previewVisible ? "flex-col md:flex-row items-start" : ""}`}>

            {/* ── LEFT: Controls ── */}
            <div className={previewVisible ? "w-full md:w-[40%] shrink-0 md:max-h-[calc(100vh-80px)] md:overflow-y-auto md:pr-1" : "max-w-[960px] mx-auto w-full"}>

              {/* Preview name + logo row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">
                    Preview DSO Name
                  </label>
                  <input type="text" value={dsoName} maxLength={25}
                    onChange={e => setDsoName(e.target.value.slice(0, 25))}
                    placeholder="e.g. Heartland Dental"
                    className={inputCls} />
                </div>
                {editorTemplate === "roi" ? (
                  <div>
                    <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block"># Practices</label>
                    <input type="number" min={1} max={2000} value={numPractices}
                      onChange={e => setNumPractices(Math.max(1, Math.min(2000, parseInt(e.target.value) || 1)))}
                      className={inputCls} />
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">Prospect Logo (preview only)</label>
                    <div className="flex items-center gap-3">
                      <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoUpload} className="hidden" />
                      <button onClick={() => logoInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all">
                        <Upload className="w-3.5 h-3.5" />{prospectLogoData ? "Change" : "Upload"}
                      </button>
                      {prospectLogoData && (
                        <div className="flex items-center gap-2">
                          <img src={prospectLogoData} alt="" className="h-7 w-auto max-w-[60px] object-contain rounded border border-border p-0.5" />
                          <button onClick={() => { setProspectLogoData(null); setProspectLogoName(""); }} className="text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section panels */}
              <div className="space-y-3">

                {/* ═══ PILOT ═══ */}
                {editorTemplate === "pilot" && (<>
                  <EditorSection title="Header" icon={<Ruler className="w-4 h-4 text-muted-foreground" />} open={openSections.header} onToggle={() => toggle("header")}>
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Header Headline</span>
                      <textarea value={headerCfg.titleText} rows={2} placeholder={`Dandy x ${dsoName}\n90-Day Pilot`}
                        onChange={e => setHeaderCfg(p => ({ ...p, titleText: e.target.value }))}
                        className={`mt-1 ${textareaCls}`} />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Use {"{dso}"} for DSO name. Leave blank for default.</p>
                    </div>
                    <SliderRow label="Header Height" value={headerCfg.height} min={160} max={400} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, height: v }))} />
                    <SliderRow label="Split Ratio (left %)" value={headerCfg.splitRatio} min={30} max={70} unit="%" onChange={v => setHeaderCfg(p => ({ ...p, splitRatio: v }))} />
                    <SliderRow label="Title Font Size" value={headerCfg.titleFontSize} min={14} max={40} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, titleFontSize: v }))} />
                    <SliderRow label="Subtitle Font Size" value={headerCfg.subtitleFontSize} min={8} max={18} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, subtitleFontSize: v }))} />
                    <SliderRow label="Subtitle Offset Y" value={headerCfg.subtitleOffsetY} min={-60} max={60} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, subtitleOffsetY: v }))} />
                    <SliderRow label="Partner Logo Scale" value={headerCfg.partnerLogoScale} min={30} max={300} unit="%" onChange={v => setHeaderCfg(p => ({ ...p, partnerLogoScale: v }))} />
                    <SliderRow label="Partner Logo Offset X" value={headerCfg.partnerLogoOffsetX} min={-80} max={80} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, partnerLogoOffsetX: v }))} />
                    <SliderRow label="Partner Logo Offset Y" value={headerCfg.partnerLogoOffsetY} min={-40} max={40} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, partnerLogoOffsetY: v }))} />
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Header Image ({audience})</span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input ref={headerImgInputRef} type="file" accept="image/*" onChange={handleHeaderImageUpload} className="hidden" />
                        <button onClick={() => headerImgInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all">
                          <ImageIcon className="w-3.5 h-3.5" />{headerCfg.headerImage ? "Change Image" : "Upload Custom"}
                        </button>
                        {headerCfg.headerImage && <button onClick={() => setHeaderCfg(p => ({ ...p, headerImage: null }))} className="text-xs text-muted-foreground hover:text-destructive">Reset to default</button>}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Image Crop Position</span>
                      <div className="flex gap-1.5 mt-1.5">
                        {(["top", "center", "bottom"] as const).map(pos => (
                          <button key={pos} onClick={() => setHeaderCfg(p => ({ ...p, imageCropAnchor: pos }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${headerCfg.imageCropAnchor === pos ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:text-foreground"}`}>
                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </EditorSection>

                  <EditorSection title="Body & Layout" icon={<Type className="w-4 h-4 text-muted-foreground" />} open={openSections.body} onToggle={() => toggle("body")}>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Middle Headline</label>
                      <textarea value={bodyCfg.headlineText} rows={2} onChange={e => setBodyCfg(p => ({ ...p, headlineText: e.target.value }))} className={`mt-1 ${textareaCls}`} placeholder="Experience the world's most advanced dental lab..." />
                    </div>
                    <SliderRow label="Headline Font Size" value={bodyCfg.headlineFontSize} min={10} max={24} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, headlineFontSize: v }))} />
                    <SliderRow label="Intro Text Size" value={bodyCfg.introFontSize} min={7} max={14} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, introFontSize: v }))} />
                    <SliderRow label="Feature Title Size" value={bodyCfg.featureTitleFontSize} min={7} max={16} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, featureTitleFontSize: v }))} />
                    <SliderRow label="Feature Desc Size" value={bodyCfg.featureDescFontSize} min={6} max={14} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, featureDescFontSize: v }))} />
                    <SliderRow label="Title → Desc Spacing" value={bodyCfg.featureTitleDescSpacing} min={6} max={28} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, featureTitleDescSpacing: v }))} />
                    <SliderRow label="Content Offset X" value={bodyCfg.contentOffsetX} min={-80} max={80} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, contentOffsetX: v }))} />
                    <SliderRow label="Bullet Offset X" value={bodyCfg.bulletOffsetX} min={-80} max={80} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, bulletOffsetX: v }))} />
                    <SliderRow label="Bullet Offset Y" value={bodyCfg.bulletOffsetY} min={-80} max={80} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, bulletOffsetY: v }))} />
                    <SliderRow label="Section Spacing" value={bodyCfg.sectionSpacing} min={0} max={60} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, sectionSpacing: v }))} />
                    {audience === "practice-manager" && (<>
                      <SliderRow label="Checklist Font Size" value={bodyCfg.checklistFontSize} min={6} max={16} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, checklistFontSize: v }))} />
                      <SliderRow label="Checklist Spacing" value={bodyCfg.checklistSpacing} min={2} max={30} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, checklistSpacing: v }))} />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={bodyCfg.checklistShowDividers} onChange={e => setBodyCfg(p => ({ ...p, checklistShowDividers: e.target.checked }))} className="rounded border-border" />
                        <span className="text-xs text-muted-foreground">Show dividers between items</span>
                      </label>
                      {bodyCfg.checklistShowDividers && (<>
                        <SliderRow label="Divider Length (0=auto)" value={bodyCfg.dividerLength} min={0} max={300} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, dividerLength: v }))} />
                        <SliderRow label="Divider Offset X" value={bodyCfg.dividerOffsetX} min={-50} max={50} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, dividerOffsetX: v }))} />
                        <SliderRow label="Divider Offset Y" value={bodyCfg.dividerOffsetY} min={-10} max={10} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, dividerOffsetY: v }))} />
                      </>)}
                    </>)}
                    {audience === "clinical" && (<>
                      <div className="border-t border-border pt-3 mt-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Testimonial Quote</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={bodyCfg.quoteShow} onChange={e => setBodyCfg(p => ({ ...p, quoteShow: e.target.checked }))} className="rounded border-border" />
                        <span className="text-xs text-muted-foreground">Show testimonial quote</span>
                      </label>
                      {bodyCfg.quoteShow && (<>
                        <SliderRow label="Quote Font Size" value={bodyCfg.quoteFontSize} min={7} max={14} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, quoteFontSize: v }))} />
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Quote Copy</label>
                          <textarea rows={3} value={bodyCfg.quoteText} onChange={e => setBodyCfg(p => ({ ...p, quoteText: e.target.value }))}
                            className={`mt-1 ${textareaCls}`} placeholder="Enter quote text…" />
                        </div>
                      </>)}
                    </>)}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={bodyCfg.showIntro} onChange={e => setBodyCfg(p => ({ ...p, showIntro: e.target.checked }))} className="rounded border-border" />
                      <span className="text-xs text-muted-foreground">Show intro text</span>
                    </label>
                  </EditorSection>

                  <EditorSection title="Content" icon={<Palette className="w-4 h-4 text-muted-foreground" />} open={openSections.content} onToggle={() => toggle("content")}>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Subtitle</label>
                      <input type="text" maxLength={100} value={currentContent.subtitle}
                        onChange={e => setAudienceContent((p: typeof defaultAudienceContent) => ({ ...p, [audience]: { ...p[audience], subtitle: e.target.value } }))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Intro Paragraph</label>
                      <textarea rows={3} maxLength={300} value={currentContent.introText}
                        onChange={e => setAudienceContent((p: typeof defaultAudienceContent) => ({ ...p, [audience]: { ...p[audience], introText: e.target.value } }))}
                        className={textareaCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Features — Title / Description</label>
                      {currentContent.features.map((feat: { icon: string; title: string; description: string }, i: number) => (
                        <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                          <input type="text" maxLength={40} value={feat.title} onChange={e => updateFeature(i, "title", e.target.value)} placeholder="Title" className={inputCls} />
                          <input type="text" maxLength={160} value={feat.description} onChange={e => updateFeature(i, "description", e.target.value)} placeholder="Description" className={inputCls} />
                        </div>
                      ))}
                    </div>
                    {audience === "practice-manager" && currentContent.checklist.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Checklist Items</label>
                        {currentContent.checklist.map((item: string, i: number) => (
                          <input key={i} type="text" value={item} onChange={e => updateChecklist(i, e.target.value)} className={inputCls} />
                        ))}
                      </div>
                    )}
                  </EditorSection>
                </>)}

                {/* ═══ COMPARISON ═══ */}
                {editorTemplate === "comparison" && (<>
                  <EditorSection title="Header" icon={<Ruler className="w-4 h-4 text-muted-foreground" />} open={openSections.header} onToggle={() => toggle("header")}>
                    <SliderRow label="Header Height" value={headerCfg.height} min={120} max={300} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, height: v }))} />
                    <SliderRow label="Split Ratio (left %)" value={headerCfg.splitRatio} min={30} max={70} unit="%" onChange={v => setHeaderCfg(p => ({ ...p, splitRatio: v }))} />
                    <SliderRow label="Headline Font Size" value={headerCfg.titleFontSize} min={12} max={32} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, titleFontSize: v }))} />
                    <SliderRow label="Headline Line Spacing" value={headerCfg.titleLineSpacing} min={0.8} max={3.0} step={0.01} unit="×" onChange={v => setHeaderCfg(p => ({ ...p, titleLineSpacing: v }))} />
                    <SliderRow label="Subheadline Font Size" value={headerCfg.subtitleFontSize} min={7} max={14} step={0.5} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, subtitleFontSize: v }))} />
                    <SliderRow label="Subheadline Offset Y" value={headerCfg.subtitleOffsetY} min={-60} max={60} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, subtitleOffsetY: v }))} />
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Header Image</span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input ref={headerImgInputRef} type="file" accept="image/*" onChange={handleHeaderImageUpload} className="hidden" />
                        <button onClick={() => headerImgInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all">
                          <ImageIcon className="w-3.5 h-3.5" />{headerCfg.headerImage ? "Change Image" : "Upload Custom"}
                        </button>
                        {headerCfg.headerImage && <button onClick={() => setHeaderCfg(p => ({ ...p, headerImage: null }))} className="text-xs text-muted-foreground hover:text-destructive">Reset</button>}
                      </div>
                    </div>
                  </EditorSection>

                  <EditorSection title="Comparison Table" icon={<Table className="w-4 h-4 text-muted-foreground" />} open={openSections.table} onToggle={() => toggle("table")}>
                    <div className="border-b border-border pb-3 mb-3 space-y-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Table Layout</span>
                      <SliderRow label="Row Font Size" value={bodyCfg.compTableFontSize} min={5} max={14} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, compTableFontSize: v }))} />
                      <SliderRow label="Header Label Font Size" value={bodyCfg.compTableHeaderFontSize} min={5} max={14} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, compTableHeaderFontSize: v }))} />
                      <SliderRow label="Row Height" value={bodyCfg.compTableRowHeight} min={24} max={80} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, compTableRowHeight: v }))} />
                      <SliderRow label="Header Row Height" value={bodyCfg.compTableHeaderHeight} min={16} max={50} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, compTableHeaderHeight: v }))} />
                      <SliderRow label="Capability Column Width" value={bodyCfg.compTableCapColWidth} min={60} max={220} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, compTableCapColWidth: v }))} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">Capability | Then (old Dandy) | Now (Dandy today)</p>
                    <div className="space-y-3">
                      {comparisonRows.map((row: typeof defaultComparisonRows[0], i: number) => (
                        <div key={i} className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/20">
                          <input type="text" value={row.capability} onChange={e => updateComparisonRow(i, "capability", e.target.value)} placeholder="Capability" className={`${inputCls} font-semibold`} />
                          <input type="text" value={row.then} onChange={e => updateComparisonRow(i, "then", e.target.value)} placeholder="Then (Dandy 2022)" className={inputCls} />
                          <input type="text" value={row.now} onChange={e => updateComparisonRow(i, "now", e.target.value)} placeholder="Now (Dandy today)" className={inputCls} />
                        </div>
                      ))}
                    </div>
                  </EditorSection>

                  <EditorSection title="Stats" icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />} open={openSections.stats} onToggle={() => toggle("stats")}>
                    <SliderRow label="Stat Number Font Size" value={bodyCfg.compStatValueSize} min={12} max={40} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, compStatValueSize: v }))} />
                    <SliderRow label="Stat Label Font Size" value={bodyCfg.compStatLabelSize} min={5} max={14} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, compStatLabelSize: v }))} />
                    <SliderRow label="Stat Card Height" value={bodyCfg.compStatCardHeight} min={50} max={140} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, compStatCardHeight: v }))} />
                    <div className="border-t border-border pt-3 mt-1 space-y-2">
                      {comparisonStats.map((stat: typeof defaultComparisonStats[0], i: number) => (
                        <div key={i} className="grid grid-cols-[80px_1fr] gap-2">
                          <input type="text" value={stat.value} onChange={e => updateComparisonStat(i, "value", e.target.value)} placeholder="88%" className={`${inputCls} font-bold`} />
                          <input type="text" value={stat.label} onChange={e => updateComparisonStat(i, "label", e.target.value)} placeholder="Stat label" className={inputCls} />
                        </div>
                      ))}
                    </div>
                  </EditorSection>
                </>)}

                {/* ═══ PARTNER ═══ */}
                {editorTemplate === "partner" && (<>
                  <EditorSection title="Header" icon={<Ruler className="w-4 h-4 text-muted-foreground" />} open={openSections.header} onToggle={() => toggle("header")}>
                    <SliderRow label="Header Height" value={headerCfg.height} min={180} max={400} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, height: v }))} />
                    <SliderRow label="Split Ratio (left %)" value={headerCfg.splitRatio} min={30} max={70} unit="%" onChange={v => setHeaderCfg(p => ({ ...p, splitRatio: v }))} />
                    <SliderRow label="Title Font Size" value={headerCfg.titleFontSize} min={16} max={42} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, titleFontSize: v }))} />
                    <SliderRow label="Subtitle Font Size" value={headerCfg.subtitleFontSize} min={8} max={24} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, subtitleFontSize: v }))} />
                    <SliderRow label="Title Offset Y" value={headerCfg.subtitleOffsetY} min={-60} max={60} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, subtitleOffsetY: v }))} />
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Header Image</span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input ref={headerImgInputRef} type="file" accept="image/*" onChange={handleHeaderImageUpload} className="hidden" />
                        <button onClick={() => headerImgInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all">
                          <ImageIcon className="w-3.5 h-3.5" />{headerCfg.headerImage ? "Change Image" : "Upload Custom"}
                        </button>
                        {headerCfg.headerImage && <button onClick={() => setHeaderCfg(p => ({ ...p, headerImage: null }))} className="text-xs text-muted-foreground hover:text-destructive">Reset</button>}
                      </div>
                    </div>
                  </EditorSection>

                  <EditorSection title="Body & Layout" icon={<Type className="w-4 h-4 text-muted-foreground" />} open={openSections.body} onToggle={() => toggle("body")}>
                    <SliderRow label="Headline Font Size" value={bodyCfg.headlineFontSize} min={10} max={28} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, headlineFontSize: v }))} />
                    <SliderRow label="Intro Text Size" value={bodyCfg.introFontSize} min={7} max={14} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, introFontSize: v }))} />
                    <SliderRow label="Feature Title Size" value={bodyCfg.featureTitleFontSize} min={7} max={16} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, featureTitleFontSize: v }))} />
                    <SliderRow label="Feature Desc Size" value={bodyCfg.featureDescFontSize} min={6} max={14} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, featureDescFontSize: v }))} />
                    <SliderRow label="Content Offset X" value={bodyCfg.contentOffsetX} min={-80} max={80} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, contentOffsetX: v }))} />
                    <SliderRow label="Section Spacing" value={bodyCfg.sectionSpacing} min={0} max={60} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, sectionSpacing: v }))} />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={bodyCfg.showIntro} onChange={e => setBodyCfg(p => ({ ...p, showIntro: e.target.checked }))} className="rounded border-border" />
                      <span className="text-xs text-muted-foreground">Show intro paragraph</span>
                    </label>
                  </EditorSection>

                  <EditorSection title="Content" icon={<Palette className="w-4 h-4 text-muted-foreground" />} open={openSections.content} onToggle={() => toggle("content")}>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Headline ({partnerHeadline.length}/60)</label>
                      <input type="text" maxLength={60} value={partnerHeadline} onChange={e => setPartnerHeadline(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                        Intro Paragraph ({partnerIntro.length}/300) <span className="font-normal opacity-60">— use {"{dso}"} for DSO name</span>
                      </label>
                      <textarea rows={3} maxLength={300} value={partnerIntro} onChange={e => setPartnerIntro(e.target.value)} className={textareaCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Feature Cards — Title / Description</label>
                      {partnerFeatures.map((feat: typeof defaultPartnerFeatures[0], i: number) => (
                        <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                          <input type="text" maxLength={50} value={feat.title} onChange={e => setPartnerFeatures((p: typeof defaultPartnerFeatures) => p.map((f, j) => j === i ? { ...f, title: e.target.value } : f))} placeholder="Title" className={inputCls} />
                          <input type="text" maxLength={160} value={feat.desc} onChange={e => setPartnerFeatures((p: typeof defaultPartnerFeatures) => p.map((f, j) => j === i ? { ...f, desc: e.target.value } : f))} placeholder="Description" className={inputCls} />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">QR Code URL</label>
                      <input type="url" value={partnerQrUrl} onChange={e => setPartnerQrUrl(e.target.value)} placeholder="https://meetdandy.com" className={inputCls} />
                    </div>
                  </EditorSection>

                  <EditorSection title="Stats" icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />} open={openSections.stats} onToggle={() => toggle("stats")}>
                    <SliderRow label="Stat Number Size" value={bodyCfg.statValueFontSize} min={14} max={48} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, statValueFontSize: v }))} />
                    <SliderRow label="Stat Desc Size" value={bodyCfg.statDescFontSize} min={5} max={16} step={0.5} unit="pt" onChange={v => setBodyCfg(p => ({ ...p, statDescFontSize: v }))} />
                    <div className="space-y-2">
                      {partnerStats.map((stat: typeof defaultPartnerStats[0], i: number) => (
                        <div key={i} className="grid grid-cols-[80px_1fr] gap-2">
                          <input type="text" value={stat.value} onChange={e => setPartnerStats((p: typeof defaultPartnerStats) => p.map((s, j) => j === i ? { ...s, value: e.target.value } : s))} placeholder="88%" className={`${inputCls} font-bold`} />
                          <input type="text" value={stat.desc} onChange={e => setPartnerStats((p: typeof defaultPartnerStats) => p.map((s, j) => j === i ? { ...s, desc: e.target.value } : s))} placeholder="Description" className={inputCls} />
                        </div>
                      ))}
                    </div>
                  </EditorSection>
                </>)}

                {/* ═══ ROI ═══ */}
                {editorTemplate === "roi" && (<>
                  <EditorSection title="Header" icon={<Ruler className="w-4 h-4 text-muted-foreground" />} open={openSections.header} onToggle={() => toggle("header")}>
                    <SliderRow label="Header Height" value={headerCfg.height} min={100} max={280} step={4} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, height: v }))} />
                    <SliderRow label="Title Font Size" value={headerCfg.titleFontSize} min={10} max={34} step={1} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, titleFontSize: v }))} />
                    <SliderRow label="Subtitle Font Size" value={headerCfg.subtitleFontSize} min={7} max={18} step={0.5} unit="pt" onChange={v => setHeaderCfg(p => ({ ...p, subtitleFontSize: v }))} />
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Subtitle Text</label>
                      <input
                        type="text"
                        value={headerCfg.subtitleText}
                        onChange={e => setHeaderCfg(p => ({ ...p, subtitleText: e.target.value }))}
                        placeholder="Your custom partnership overview…"
                        className={`mt-1 ${inputCls}`}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">Custom Header Image</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                          {headerCfg.headerImage ? "Replace image" : "Upload image"}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0]; if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setHeaderCfg(p => ({ ...p, headerImage: reader.result as string }));
                          reader.readAsDataURL(file);
                        }} />
                        {headerCfg.headerImage && (
                          <button onClick={() => setHeaderCfg(p => ({ ...p, headerImage: null }))} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">Remove</button>
                        )}
                      </label>
                    </div>
                  </EditorSection>
                  <div className="rounded-xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">
                      ROI metrics and case studies are auto-calculated from the practice count above — no content editing needed.
                    </p>
                  </div>
                </>)}

                {/* ═══ SHARED: Team & Footer (pilot + comparison + partner) ═══ */}
                {editorTemplate !== "roi" && (<>
                  <EditorSection title="Team & Contact" icon={<Users className="w-4 h-4 text-muted-foreground" />} open={openSections.team} onToggle={() => toggle("team")}>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={teamCfg.show} onChange={e => setTeamCfg(p => ({ ...p, show: e.target.checked }))} className="rounded border-border" />
                      <span className="text-xs text-muted-foreground">Show team section</span>
                    </label>
                    {teamCfg.show && (<>
                      <SliderRow label="Heading Font Size" value={teamCfg.headingFontSize} min={9} max={20} unit="pt" onChange={v => setTeamCfg(p => ({ ...p, headingFontSize: v }))} />
                      <SliderRow label="Name Font Size" value={teamCfg.nameFontSize} min={7} max={16} unit="pt" onChange={v => setTeamCfg(p => ({ ...p, nameFontSize: v }))} />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {teamContacts.map((c, i) => (
                          <div key={i} className="space-y-1.5">
                            <input type="text" placeholder={`Contact ${i + 1} name`} value={c.name} onChange={e => setTeamContacts(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={inputCls} />
                            <input type="text" placeholder="Title" value={c.title} onChange={e => setTeamContacts(p => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} className={inputCls} />
                            <input type="text" placeholder="Email or phone" value={c.contactInfo} onChange={e => setTeamContacts(p => p.map((x, j) => j === i ? { ...x, contactInfo: e.target.value } : x))} className={inputCls} />
                          </div>
                        ))}
                      </div>
                      <input type="text" placeholder="Phone number (optional)" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className={inputCls} />
                    </>)}
                  </EditorSection>

                  <EditorSection title="Footer" icon={<Type className="w-4 h-4 text-muted-foreground" />} open={openSections.footer} onToggle={() => toggle("footer")}>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={footerCfg.show} onChange={e => setFooterCfg(p => ({ ...p, show: e.target.checked }))} className="rounded border-border" />
                      <span className="text-xs text-muted-foreground">Show footer</span>
                    </label>
                    {footerCfg.show && (<>
                      <SliderRow label="Font Size" value={footerCfg.fontSize} min={7} max={16} unit="pt" onChange={v => setFooterCfg(p => ({ ...p, fontSize: v }))} />
                      <SliderRow label="Footer Height" value={footerCfg.height} min={24} max={72} unit="pt" onChange={v => setFooterCfg(p => ({ ...p, height: v }))} />
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">Footer Link</label>
                        <input type="text" value={footerCfg.link} onChange={e => setFooterCfg(p => ({ ...p, link: e.target.value }))} placeholder="meetdandy.com" className={`mt-1 ${inputCls}`} />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">Custom CTA Link Text</label>
                        <input type="text" value={customLinkText} onChange={e => setCustomLinkText(e.target.value)} placeholder="e.g. Schedule a Call" className={`mt-1 ${inputCls}`} />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">Custom CTA URL</label>
                        <input type="url" value={customLinkUrl} onChange={e => setCustomLinkUrl(e.target.value)} placeholder="https://calendly.com/..." className={`mt-1 ${inputCls}`} />
                      </div>
                    </>)}
                  </EditorSection>
                </>)}

              </div>
            </div>

            {/* ── RIGHT: Live preview ── */}
            {previewVisible && (
              <div className="flex-1 min-w-0">
                <div className="sticky top-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</span>
                    <span className="text-[10px] text-muted-foreground">Updates automatically as you edit</span>
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden bg-muted/10" style={{ height: "calc(100vh - 100px)" }}>
                    {previewUrl ? (
                      <iframe src={previewUrl} className="w-full h-full" title="PDF Preview" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">Generating preview…</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </SalesLayout>
  );
}
