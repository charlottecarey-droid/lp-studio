import { useState, useRef, useCallback, useEffect } from "react";
import { saveLayoutDefault, loadLayoutDefault } from "@/lib/layout-defaults";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Upload,
  X,
  FileDown,
  Loader2,
  RotateCcw,
  Image as ImageIcon,
  Type,
  Ruler,
  Palette,
  Users,
  Link,
  Eye,
  EyeOff,
  Save,
  Table,
  BarChart3,
  Copy,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import headerImgExecutive from "@/assets/ai-scan-review-news.jpg";
import headerImgClinical from "@/assets/ai-scan-review-clinical.png";
import headerImgPracticeManager from "@/assets/dandy-dso-enterprise-data.webp";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import greenCheckboxIcon from "@/assets/green-checkbox.png";
import { Slider } from "@/components/ui/slider";
import DSOTemplateImporter, { type DSOTemplateImporterHandle, cloneFieldsForBuiltin } from "@/components/DSOTemplateImporter";
import { type OverlayField } from "@/components/template-types";

// ── Helpers ──────────────────────────────────────────────

const svgToPng = (svgSrc: string, width: number, height: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width * 2;
      c.height = height * 2;
      c.getContext("2d")!.drawImage(img, 0, 0, width * 2, height * 2);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = svgSrc;
  });

const loadImageAsBase64 = (src: string, fmt: "image/jpeg" | "image/png" = "image/jpeg"): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")?.drawImage(img, 0, 0);
      resolve(c.toDataURL(fmt));
    };
    img.onerror = reject;
    img.src = src;
  });

/**
 * Load an image and crop it (cover-style) to match targetW:targetH aspect ratio.
 * Returns a base64 data URL of the cropped image — no distortion, always fills the target area.
 */
const loadImageCover = (src: string, targetW: number, targetH: number, fmt: "image/jpeg" | "image/png" = "image/jpeg"): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const targetAspect = targetW / targetH;
      const imgAspect = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > targetAspect) {
        // Image is wider — crop sides
        sw = img.height * targetAspect;
        sx = (img.width - sw) / 2;
      } else {
        // Image is taller — crop top/bottom
        sh = img.width / targetAspect;
        sy = (img.height - sh) / 2;
      }
      const c = document.createElement("canvas");
      c.width = Math.round(sw);
      c.height = Math.round(sh);
      c.getContext("2d")?.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      resolve(c.toDataURL(fmt));
    };
    img.onerror = reject;
    img.src = src;
  });

/**
 * Add an image to jsPDF using cover-crop (no distortion).
 * Crops the source to match target aspect ratio, centered, then draws it.
 */
const addImageCover = (
  doc: jsPDF, data: string, fmt: string,
  x: number, y: number, targetW: number, targetH: number,
  anchor: "top" | "center" | "bottom" = "center"
): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const targetAspect = targetW / targetH;
      const imgAspect = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > targetAspect) {
        sw = img.height * targetAspect;
        sx = anchor === "top" ? 0 : anchor === "bottom" ? img.width - sw : (img.width - sw) / 2;
      } else {
        sh = img.width / targetAspect;
        sy = anchor === "top" ? 0 : anchor === "bottom" ? img.height - sh : (img.height - sh) / 2;
      }
      const c = document.createElement("canvas");
      c.width = Math.round(sw);
      c.height = Math.round(sh);
      c.getContext("2d")?.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      try {
        doc.addImage(c.toDataURL(fmt === "JPEG" ? "image/jpeg" : "image/png"), fmt, x, y, targetW, targetH);
      } catch { /* skip */ }
      resolve();
    };
    img.onerror = () => {
      try { doc.addImage(data, fmt, x, y, targetW, targetH); } catch {}
      resolve();
    };
    img.src = data;
  });

const drawSeparator = (doc: jsPDF, x: number, y: number, length: number, color: [number, number, number]) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + length, y);
};

type Audience = "executive" | "clinical" | "practice-manager";
type EditorTemplate = "pilot" | "comparison" | "roi" | "partner";

interface TeamContact {
  name: string;
  title: string;
  contactInfo: string;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
}

// ── Default content per audience (Pilot) ─────────────────────────

const audienceHeaders: Record<Audience, string> = {
  executive: headerImgExecutive,
  clinical: headerImgClinical,
  "practice-manager": headerImgPracticeManager,
};

const defaultFeatures: Record<Audience, Feature[]> = {
  executive: [
    { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your practices up to speed fast with free onboarding." },
    { icon: "💬", title: "Clinical collaboration", description: "Live Chat and Live Scan Review connect clinicians directly with our team of lab technicians in real time." },
    { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
    { icon: "📊", title: "Dandy Insights", description: "Dandy surfaces aggregate, pilot-level insights including scanner utilization, workflow adoption, and quality signals." },
    { icon: "📋", title: "Case management simplified", description: "Access the Dandy Portal to track, manage, and review active orders and our dashboard to streamline invoicing." },
    { icon: "💰", title: "Exclusive pricing for your organization", description: "Contact the team below to access a product guide with approved pricing." },
  ],
  clinical: [
    { icon: "💬", title: "Clinical collaboration", description: "Clinicians and staff can speak with our team of clinical experts in just 60 seconds or collaborate on complex cases virtually." },
    { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
    { icon: "🦷", title: "2-Appointment Dentures", description: "Utilize seamless digital workflows like 2-Appointment Dentures to save chair time and create a better patient experience." },
    { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. Get up to speed fast with free onboarding and unlimited access to ongoing digital CPD credit education." },
  ],
  "practice-manager": [
    { icon: "💰", title: "Invoicing made easy", description: "Our dashboard makes invoicing a simple and efficient process." },
    { icon: "📊", title: "Get insights in Practice Portal", description: "Gain visibility into order delivery dates, seamless communicate with the lab, scanner, manage payment, and more." },
    { icon: "💬", title: "Real-time lab communication", description: "Our team of clinical experts handle lab communication including live collaboration, fielding questions, and issue resolution." },
    { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your teams up to speed fast with free onboarding and CPD training." },
  ],
};

const defaultSubtitles: Record<Audience, string> = {
  executive: "Achieve quality, consistency, and control at scale.",
  clinical: "Fully embrace digital dentistry with smarter technology and seamless workflows.",
  "practice-manager": "Reduce operational friction and administrative burden with Dandy.",
};

const defaultIntroTexts: Record<Audience, string> = {
  executive: "What to expect during this pilot: Over the next 90 days, we'll partner with your organization to onboard clinicians efficiently, support adoption of digital workflows, and ensure cases run smoothly in practice.",
  clinical: "",
  "practice-manager": "",
};

const defaultChecklist = [
  "Attend an in-person or virtual onboarding session",
  "Use the Dandy Portal to track, manage, and review orders",
  "Access Dandy Insights to get an overview of pilot performance",
  "Check in with clinicians to gather high-level feedback",
];

// ── Default content for Comparison (Evolution) ──────────────────

interface ComparisonRow {
  capability: string;
  then: string;
  now: string;
}

interface StatItem {
  value: string;
  label: string;
}

const defaultComparisonRows: ComparisonRow[] = [
  { capability: "Quality & Remakes", then: "Greater variability across cases", now: "Standardized quality control systems + 96% remake rate reduction with AI scan review" },
  { capability: "Case Acceptance & Diagnostics", then: "Limited diagnostic scan support", now: "Free Dandy diagnostic scans driving ~30% average lift in case acceptance" },
  { capability: "Workflow & Case Management", then: "More manual coordination and back-and-forth", now: "Real-time lab support — 88% say it makes case management easier" },
  { capability: "Turnaround & Predictability", then: "Less predictable production timelines", now: "National manufacturing scale with more consistent turnaround windows" },
  { capability: "Digital Integration", then: "Early-stage digital workflow", now: "Fully integrated digital lab system with streamlined file submission" },
  { capability: "Product Offering", then: "More limited restorative options", now: "Expanded product portfolio across key restorative categories" },
  { capability: "Support Structure", then: "General support model", now: "Dedicated account support with more proactive case visibility" },
];

const defaultStats: StatItem[] = [
  { value: "88%", label: "say real-time lab support makes case management easier" },
  { value: "~30%", label: "average increase in case acceptance with free Dandy diagnostic scans" },
  { value: "96%", label: "remake rate reduction with AI scan review" },
];

// ── Default content for Partner Practices ───────────────

interface PartnerFeature {
  title: string;
  desc: string;
}

interface PartnerStat {
  value: string;
  desc: string;
}

const defaultPartnerFeatures: PartnerFeature[] = [
  { title: "Increase treatment predictability", desc: "Get real-time expert guidance while your patient is in the chair for confident, accurate outcomes." },
  { title: "Digitize every restorative workflow", desc: "Get a free Dandy Vision Scanner and Cart." },
  { title: "Access state-of-the-art lab quality", desc: "Deliver high-quality prosthetics with digital precision, premium materials, and unmatched consistency." },
  { title: "Get your new partnership perks and preferred pricing", desc: "" },
];

const defaultPartnerStats: PartnerStat[] = [
  { value: "88%", desc: "say Dandy's real-time lab support makes case management easier." },
  { value: "83%", desc: "say they have saved time using Dandy's portal to manage lab cases." },
  { value: "67%", desc: "say Dandy's technology gives them a competitive edge over other practices." },
];

const defaultPartnerIntro = "As {dso}'s newest preferred lab partner, Dandy is here to help your practice thrive with the most advanced digital dental lab in the industry. Together, we're delivering smarter, faster, and more predictable outcomes—while elevating patient care and your bottom line.";

const defaultPartnerHeadline = "Unlock the Power of Digital Dentistry with Dandy";

// ── Section config types ─────────────────────────────────

interface HeaderConfig {
  height: number;
  splitRatio: number;
  titleText: string;
  titleFontSize: number;
  subtitleFontSize: number;
  subtitleOffsetY: number;
  headerImage: string | null;
  imageCropAnchor: "top" | "center" | "bottom";
  partnerLogoScale: number;
  partnerLogoOffsetX: number;
  partnerLogoOffsetY: number;
}

interface BodyConfig {
  headlineText: string;
  headlineFontSize: number;
  introFontSize: number;
  featureTitleFontSize: number;
  featureDescFontSize: number;
  showIntro: boolean;
  contentOffsetX: number;
  sectionSpacing: number;
  statValueFontSize: number;
  statDescFontSize: number;
  bulletOffsetX: number;
  bulletOffsetY: number;
  checklistSpacing: number;
  checklistShowDividers: boolean;
  checklistFontSize: number;
  dividerOffsetX: number;
  dividerOffsetY: number;
  dividerLength: number;
}

const defaultBodyConfig: BodyConfig = {
  headlineText: "Experience the world's most advanced dental lab for 90 days. No long-term commitment needed.",
  headlineFontSize: 16,
  introFontSize: 9.5,
  featureTitleFontSize: 10,
  featureDescFontSize: 8.5,
  showIntro: true,
  contentOffsetX: 0,
  sectionSpacing: 16,
  statValueFontSize: 30,
  statDescFontSize: 8,
  bulletOffsetX: 0,
  bulletOffsetY: 0,
  checklistSpacing: 10,
  checklistShowDividers: false,
  checklistFontSize: 9,
  dividerOffsetX: 0,
  dividerOffsetY: 0,
  dividerLength: 0,
};

interface TeamConfig {
  show: boolean;
  headingFontSize: number;
  nameFontSize: number;
}

interface FooterConfig {
  fontSize: number;
  show: boolean;
  link: string;
  height: number;
}

const defaultHeaderConfig: HeaderConfig = {
  height: 280,
  splitRatio: 48,
  titleText: "",
  titleFontSize: 28,
  subtitleFontSize: 11,
  subtitleOffsetY: 0,
  headerImage: null,
  partnerLogoScale: 100,
  partnerLogoOffsetX: 0,
  partnerLogoOffsetY: 0,
  imageCropAnchor: "center",
};

const defaultTeamConfig: TeamConfig = {
  show: true,
  headingFontSize: 13,
  nameFontSize: 10,
};

const defaultFooterConfig: FooterConfig = {
  fontSize: 10,
  show: true,
  link: "meetdandy.com",
  height: 36,
};

// ── Collapsible Section wrapper ─────────────────────────

const EditorSection = ({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card overflow-hidden">
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
    >
      <span className="flex items-center gap-2">
        {icon}
        {title}
      </span>
      <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="px-5 pb-5 pt-1 space-y-4 border-t border-border">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// ── Slider control row ──────────────────────────────────

const SliderRow = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) => (
  <div className="flex items-center gap-3">
    <span className="text-[11px] font-medium text-muted-foreground w-36 shrink-0">{label}</span>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
      className="flex-1"
    />
    <span className="text-xs font-mono text-foreground w-14 text-right">
      {value}
      {unit}
    </span>
  </div>
);

// ═══════════════════════════════════════════════════════════
// PILOT PDF BUILD FUNCTION
// ═══════════════════════════════════════════════════════════

interface BuildPilotParams {
  dsoName: string;
  audience: Audience;
  headerCfg: HeaderConfig;
  bodyCfg: BodyConfig;
  teamCfg: TeamConfig;
  footerCfg: FooterConfig;
  subtitle: string;
  introText: string;
  features: Feature[];
  checklist: string[];
  teamContacts: TeamContact[];
  phoneNumber: string;
  customLinkText: string;
  customLinkUrl: string;
  prospectLogoData: string | null;
  prospectLogoDims: { w: number; h: number };
  cloneMode?: boolean;
}

async function buildPilotPdf(params: BuildPilotParams): Promise<jsPDF> {
  const {
    dsoName, audience, headerCfg, bodyCfg, teamCfg, footerCfg,
    subtitle, introText, features, checklist, teamContacts,
    phoneNumber, customLinkText, customLinkUrl,
    prospectLogoData, prospectLogoDims,
    cloneMode = false,
  } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const darkGreen: [number, number, number] = [0, 40, 32];
  const white: [number, number, number] = [255, 255, 255];
  const textDark: [number, number, number] = [30, 40, 35];
  const textMuted: [number, number, number] = [90, 100, 95];
  const lineColor: [number, number, number] = [200, 205, 200];

  const headerSrc = headerCfg.headerImage || audienceHeaders[audience];
  const imgFormat = headerCfg.headerImage ? "PNG" : audience === "clinical" ? "PNG" : "JPEG";

  let headerImgData: string | null = null;
  let logoPngData: string | null = null;
  let checkboxImgData: string | null = null;
  try {
    [headerImgData, logoPngData, checkboxImgData] = await Promise.all([
      loadImageAsBase64(headerSrc, headerCfg.headerImage ? "image/png" : (audience === "clinical" ? "image/png" : "image/jpeg")),
      svgToPng(dandyLogoWhite, 206, 74),
      loadImageAsBase64(greenCheckboxIcon, "image/png"),
    ]);
  } catch {}

  // HEADER
  const headerH = headerCfg.height;
  const splitX = w * (headerCfg.splitRatio / 100);

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    await addImageCover(doc, headerImgData, imgFormat, splitX, 0, w - splitX, headerH, headerCfg.imageCropAnchor);
  } else {
    doc.setFillColor(20, 50, 40);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  if (logoPngData && !cloneMode) {
    try {
      doc.addImage(logoPngData, "PNG", margin, 50, 80, 28);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(...white);
      doc.text("dandy", margin, 68);
    }
  }

  const logoEndX = margin + 90;
  doc.setDrawColor(180, 210, 195);
  doc.setLineWidth(0.75);
  doc.line(logoEndX, 50, logoEndX, 78);

  if (prospectLogoData) {
    try {
      const scaleFactor = (headerCfg.partnerLogoScale ?? 100) / 100;
      const maxW = 135, maxH = 36;
      const ratio = Math.min(maxW / prospectLogoDims.w, maxH / prospectLogoDims.h);
      const lw = prospectLogoDims.w * ratio * scaleFactor;
      const lh = prospectLogoDims.h * ratio * scaleFactor;
      const logoX = logoEndX + 12 + (headerCfg.partnerLogoOffsetX || 0);
      const logoY = 64 - lh / 2 + (headerCfg.partnerLogoOffsetY || 0);
      doc.addImage(prospectLogoData, "PNG", logoX, logoY, lw, lh);
    } catch {}
  } else {
    const displayName = dsoName || "Your DSO";
    doc.setFont("helvetica", "italic");
    doc.setFontSize(displayName.length > 15 ? 12 : 16);
    doc.setTextColor(...white);
    doc.text(displayName, logoEndX + 12, 70);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(headerCfg.titleFontSize);
  doc.setTextColor(...white);
  const headerTitleText = headerCfg.titleText || `Dandy x ${dsoName || "Your DSO"}\n90-Day Pilot`;
  const titleLines = doc.splitTextToSize(headerTitleText.replace("{dso}", dsoName || "Your DSO"), splitX - margin - 20);
  doc.text(titleLines, margin, 120);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(headerCfg.subtitleFontSize);
  doc.setTextColor(200, 215, 210);
  const subLines = doc.splitTextToSize(subtitle, splitX - margin - 20);
  doc.text(subLines, margin, 220 + (headerCfg.subtitleOffsetY || 0));

  // BODY
  let y = headerH + 35;
  const offsetX = bodyCfg.contentOffsetX || 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(bodyCfg.headlineFontSize);
  doc.setTextColor(...textDark);
  const headlineLines = doc.splitTextToSize(
    bodyCfg.headlineText || "Experience the world's most advanced dental lab for 90 days. No long-term commitment needed.",
    contentW
  );
  doc.text(headlineLines, w / 2 + offsetX, y, { align: "center", maxWidth: contentW });
  y += headlineLines.length * 20 + (bodyCfg.sectionSpacing || 16);

  if (bodyCfg.showIntro && introText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyCfg.introFontSize);
    doc.setTextColor(...textMuted);
    const introLines = doc.splitTextToSize(introText, contentW - 40);
    doc.text(introLines, w / 2 + offsetX, y, { align: "center", maxWidth: contentW - 40 });
    y += introLines.length * 13 + (bodyCfg.sectionSpacing || 16);
  }

  const bx = bodyCfg.bulletOffsetX || 0;
  const by = bodyCfg.bulletOffsetY || 0;
  const clSpacing = bodyCfg.checklistSpacing ?? 10;

  if (audience === "practice-manager" && checklist.length > 0) {
    y += 4;
    const leftColW = contentW * 0.42;
    const rightColX = margin + contentW * 0.48 + offsetX;
    const rightColW = contentW * 0.52;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodyCfg.featureTitleFontSize);
    doc.setTextColor(...textDark);
    doc.text("How to get the most out of this pilot:", margin + offsetX, y);

    // First pass: measure each item's height
    const checkItems: { text: string; lines: string[]; height: number }[] = checklist.map((item) => {
      const lines = doc.splitTextToSize(item, leftColW - 40);
      return { text: item, lines, height: lines.length * 12 };
    });

    let checkY = y + 20;
    checkItems.forEach((item, idx) => {
      // Draw divider line exactly between previous item bottom and this item top
      if (bodyCfg.checklistShowDividers && idx > 0) {
        const dividerY = checkY - clSpacing / 2 + (bodyCfg.dividerOffsetY || 0);
        const divLineStart = margin + 4 + offsetX + (bodyCfg.dividerOffsetX || 0);
        const defaultEnd = margin + leftColW - 10 + offsetX;
        const divLineEnd = defaultEnd + (bodyCfg.dividerLength || 0);
        doc.setDrawColor(...lineColor);
        doc.setLineWidth(0.5);
        doc.line(divLineStart, dividerY, divLineEnd, dividerY);
      }
      if (checkboxImgData) {
        try {
          doc.addImage(checkboxImgData, "PNG", margin + 4 + offsetX, checkY - 9, 11, 11);
        } catch {}
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodyCfg.checklistFontSize || 9);
      doc.setTextColor(...textDark);
      doc.text(item.lines, margin + 22 + offsetX, checkY);
      checkY += item.height + clSpacing;
    });

    let featY = y + by;
    features.forEach((feat) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(bodyCfg.featureTitleFontSize);
      doc.setTextColor(...textDark);
      doc.text(feat.title, rightColX + 28 + bx, featY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodyCfg.featureDescFontSize);
      doc.setTextColor(...textMuted);
      const descLines = doc.splitTextToSize(feat.description, rightColW - 40);
      doc.text(descLines, rightColX + 28 + bx, featY + 14);
      featY += 14 + descLines.length * 11 + 18;
    });
    y = Math.max(checkY, featY) + 4;
  } else {
    y += 4 + by;
    const colW = contentW / 2;
    const rows = Math.ceil(features.length / 2);
    const rowH = (features.length > 4 ? 64 : 80) + (bodyCfg.sectionSpacing || 0);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        const idx = row * 2 + col;
        if (idx >= features.length) continue;
        const feat = features[idx];
        const fx = margin + col * colW + offsetX + bx;
        const fy = y + row * rowH;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(bodyCfg.featureTitleFontSize);
        doc.setTextColor(...textDark);
        doc.text(feat.title, fx, fy);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(bodyCfg.featureDescFontSize);
        doc.setTextColor(...textMuted);
        const descLines = doc.splitTextToSize(feat.description, colW - 32);
        doc.text(descLines, fx, fy + 14);
      }
    }
    y += rows * rowH + 4;

    if (audience === "clinical") {
      y -= 20;
      doc.setDrawColor(...lineColor);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentW, y);
      y += 30;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      doc.setTextColor(163, 190, 60);
      doc.text("\u201C", margin, y + 7);
      const quoteText =
        "I've used Dandy Dental Lab for the last two years for crowns, implant crowns, and removables, and their work is consistently excellent. The quality is outstanding and their customer service is even better. I wouldn't change this lab for any other.";
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9.5);
      doc.setTextColor(...textDark);
      const quoteLines = doc.splitTextToSize(quoteText, contentW - 30);
      doc.text(quoteLines, margin + 18, y);
      y += quoteLines.length * 13 + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...textDark);
      doc.text("Dr. Tania Arthur", margin + 18, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...textMuted);
      doc.text("Dentist, Oasis Modern Dentistry, TX US", margin + 18, y + 12);
      y += 30;
    }
  }

  // TEAM SECTION
  if (teamCfg.show) {
    const filteredContacts = teamContacts.filter((c) => c.name.trim());
    if (filteredContacts.length > 0) {
      doc.setDrawColor(...lineColor);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentW, y);
      y += 29;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(teamCfg.headingFontSize);
      doc.setTextColor(...textDark);
      doc.text("Your dedicated team", w / 2, y, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...textMuted);
      doc.text("Meet your contacts for training, clinical support, and pilot check-ins.", w / 2, y + 15, {
        align: "center",
      });
      y += 44;
      const contactColW = contentW / Math.max(filteredContacts.length, 1);
      let maxContactBottom = y;
      filteredContacts.forEach((contact, i) => {
        const cx = margin + contactColW * i + contactColW / 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(teamCfg.nameFontSize);
        doc.setTextColor(...textDark);
        doc.text(contact.name, cx, y, { align: "center" });
        let contactY = y + 14;
        if (contact.title) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...textMuted);
          doc.text(contact.title, cx, contactY, { align: "center" });
          contactY += 14;
        }
        if (contact.contactInfo) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...textMuted);
          doc.text(contact.contactInfo, cx, contactY, { align: "center" });
          contactY += 12;
        }
        maxContactBottom = Math.max(maxContactBottom, contactY);
      });
      y = maxContactBottom + 10;
    }
  }

  // FOOTER
  if (footerCfg.show) {
    const footerH = customLinkText?.trim() && customLinkUrl?.trim() ? 56 : 44;
    const footerY = h - footerH;
    if (y < footerY) {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, y, w, footerY - y, "F");
    }
    doc.setFillColor(...darkGreen);
    doc.rect(0, footerY, w, footerH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(footerCfg.fontSize);
    doc.setTextColor(...white);
    const footerText = phoneNumber.trim()
      ? `To contact us, please call: ${phoneNumber}`
      : "www.meetdandy.com/dso";
    doc.text(footerText, w / 2, footerY + (customLinkText?.trim() && customLinkUrl?.trim() ? 20 : 28), {
      align: "center",
    });
    if (customLinkText?.trim() && customLinkUrl?.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(footerCfg.fontSize);
      doc.setTextColor(180, 210, 195);
      doc.textWithLink(customLinkText, w / 2 - doc.getTextWidth(customLinkText) / 2, footerY + 38, {
        url: customLinkUrl,
      });
    }
  }

  return doc;
}

// ═══════════════════════════════════════════════════════════
// COMPARISON (EVOLUTION) PDF BUILD FUNCTION
// ═══════════════════════════════════════════════════════════

interface BuildComparisonParams {
  dsoName: string;
  headerCfg: HeaderConfig;
  teamCfg: TeamConfig;
  footerCfg: FooterConfig;
  comparisonRows: ComparisonRow[];
  stats: StatItem[];
  teamContacts: TeamContact[];
  phoneNumber: string;
  customLinkText: string;
  customLinkUrl: string;
  prospectLogoData: string | null;
  prospectLogoDims: { w: number; h: number };
  cloneMode?: boolean;
}

async function buildComparisonPdf(params: BuildComparisonParams): Promise<jsPDF> {
  const {
    dsoName, headerCfg, teamCfg, footerCfg,
    comparisonRows, stats, teamContacts,
    phoneNumber, customLinkText, customLinkUrl,
    prospectLogoData, prospectLogoDims,
    cloneMode = false,
  } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const darkGreen: [number, number, number] = [0, 40, 32];
  const white: [number, number, number] = [255, 255, 255];
  const textDark: [number, number, number] = [30, 40, 35];
  const textMuted: [number, number, number] = [90, 100, 95];
  const lineColor: [number, number, number] = [200, 205, 200];
  const lime: [number, number, number] = [163, 190, 60];
  const offWhite: [number, number, number] = [248, 248, 244];
  const subtleText: [number, number, number] = [140, 150, 145];

  let logoPngData: string | null = null;
  let headerImgData: string | null = null;
  try {
    [logoPngData, headerImgData] = await Promise.all([
      svgToPng(dandyLogoWhite, 206, 74),
      loadImageAsBase64(headerCfg.headerImage || headerImgClinical, headerCfg.headerImage ? "image/png" : "image/png"),
    ]);
  } catch {}

  const headerH = headerCfg.height;
  const splitX = w * (headerCfg.splitRatio / 100);

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    await addImageCover(doc, headerImgData, "PNG", splitX, 0, w - splitX, headerH, headerCfg.imageCropAnchor);
  } else {
    doc.setFillColor(20, 50, 40);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  if (logoPngData && !cloneMode) {
    try { doc.addImage(logoPngData, "PNG", margin, 22, 70, 24); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...white); doc.text("dandy", margin, 40);
    }
  }

  if (prospectLogoData) {
    const logoEndX = margin + 80;
    doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.75);
    doc.line(logoEndX, 22, logoEndX, 46);
    try {
      const scaleFactor = (headerCfg.partnerLogoScale ?? 100) / 100;
      const maxW = 135, maxH = 30;
      const ratio = Math.min(maxW / prospectLogoDims.w, maxH / prospectLogoDims.h);
      const lw = prospectLogoDims.w * ratio * scaleFactor;
      const lh = prospectLogoDims.h * ratio * scaleFactor;
      const logoX = logoEndX + 10 + (headerCfg.partnerLogoOffsetX || 0);
      const logoY = 34 - lh / 2 + (headerCfg.partnerLogoOffsetY || 0);
      doc.addImage(prospectLogoData, "PNG", logoX, logoY, lw, lh);
    } catch {}
  } else if (dsoName) {
    const logoEndX = margin + 80;
    doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.75);
    doc.line(logoEndX, 22, logoEndX, 46);
    doc.setFont("helvetica", "italic"); doc.setFontSize(dsoName.length > 15 ? 11 : 14);
    doc.setTextColor(...white); doc.text(dsoName, logoEndX + 10, 40);
  }

  doc.setFont("helvetica", "normal"); doc.setFontSize(headerCfg.titleFontSize); doc.setTextColor(...white);
  doc.text("Stronger Systems.", margin, 95);
  doc.text("Better Outcomes.", margin, 115);

  doc.setFont("helvetica", "normal"); doc.setFontSize(headerCfg.subtitleFontSize); doc.setTextColor(200, 215, 210);
  const subLines = doc.splitTextToSize("See how Dandy has matured to deliver more consistent clinical performance across practices.", splitX - margin - 20);
  doc.text(subLines, margin, 150 + (headerCfg.subtitleOffsetY || 0));

  // TABLE
  let y = headerH + 20;
  const col1W = 130;
  const col2W = (contentW - col1W) / 2;
  const tableHeaderH = 28;

  doc.setFillColor(...darkGreen);
  doc.roundedRect(margin, y, contentW, tableHeaderH, 4, 4, "F");
  doc.rect(margin, y + 4, contentW, tableHeaderH - 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190);
  doc.text("CAPABILITY", margin + 12, y + 18);
  doc.setTextColor(...lime); doc.text("DANDY 2022", margin + col1W + 12, y + 18);
  doc.text("DANDY TODAY", margin + col1W + col2W + 12, y + 18);
  y += tableHeaderH;

  const rowH = 40;
  comparisonRows.forEach((row, i) => {
    const bgColor: [number, number, number] = i % 2 === 0 ? offWhite : white;
    const isLast = i === comparisonRows.length - 1;
    doc.setFillColor(...bgColor);
    if (isLast) { doc.roundedRect(margin, y, contentW, rowH, 4, 4, "F"); doc.rect(margin, y, contentW, rowH - 4, "F"); } else { doc.rect(margin, y, contentW, rowH, "F"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...darkGreen);
    const capLines = doc.splitTextToSize(row.capability, col1W - 24); doc.text(capLines, margin + 12, y + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText);
    const thenLines = doc.splitTextToSize(row.then, col2W - 24); doc.text(thenLines, margin + col1W + 12, y + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(40, 80, 65);
    const nowLines = doc.splitTextToSize(row.now, col2W - 24); doc.text(nowLines, margin + col1W + col2W + 12, y + 14);
    y += rowH;
  });
  y += 24;

  // STATS
  const statGap = 14;
  const statW = (contentW - statGap * (stats.length - 1)) / stats.length;
  const statH = 80;
  stats.forEach((stat, i) => {
    const sx = margin + (statW + statGap) * i;
    doc.setFillColor(...offWhite); doc.roundedRect(sx, y, statW, statH, 6, 6, "F");
    doc.setFillColor(...lime); doc.roundedRect(sx, y, statW, 3, 3, 3, "F"); doc.rect(sx, y + 2, statW, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...darkGreen);
    doc.text(stat.value, sx + statW / 2, y + 32, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...textMuted);
    const labelLines = doc.splitTextToSize(stat.label, statW - 24);
    doc.text(labelLines, sx + statW / 2, y + 48, { align: "center", maxWidth: statW - 24 });
  });
  y += statH + 20;

  // TEAM
  if (teamCfg.show) {
    const filteredContacts = teamContacts.filter(c => c.name.trim());
    if (filteredContacts.length > 0) {
      drawSeparator(doc, margin, y, contentW, lineColor); y += 29;
      doc.setFont("helvetica", "bold"); doc.setFontSize(teamCfg.headingFontSize); doc.setTextColor(...textDark);
      doc.text("Your dedicated team", w / 2, y, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
      doc.text("Meet your contacts for training, clinical support, and check-ins.", w / 2, y + 15, { align: "center" });
      y += 39;
      const contactColW = contentW / Math.max(filteredContacts.length, 1);
      let maxContactBottom = y;
      filteredContacts.forEach((contact, i) => {
        const cx = margin + contactColW * i + contactColW / 2;
        doc.setFont("helvetica", "bold"); doc.setFontSize(teamCfg.nameFontSize); doc.setTextColor(...textDark);
        doc.text(contact.name, cx, y, { align: "center" });
        let contactY = y + 14;
        if (contact.title) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
          doc.text(contact.title, cx, contactY, { align: "center" });
          contactY += 14;
        }
        if (contact.contactInfo) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...textMuted);
          doc.text(contact.contactInfo, cx, contactY, { align: "center" });
          contactY += 12;
        }
        maxContactBottom = Math.max(maxContactBottom, contactY);
      });
      y = maxContactBottom + 30;
    }
  }

  // FOOTER
  if (footerCfg.show) {
    const footerH2 = customLinkText?.trim() && customLinkUrl?.trim() ? 38 : 30;
    const footerY = h - footerH2;
    if (y < footerY) {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, y, w, footerY - y, "F");
    }
    doc.setFillColor(...darkGreen); doc.rect(0, footerY, w, footerH2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(footerCfg.fontSize); doc.setTextColor(...white);
    const footerText = phoneNumber.trim() ? `To contact us, please call: ${phoneNumber}` : "meetdandy.com";
    doc.text(footerText, w / 2, footerY + (customLinkText?.trim() && customLinkUrl?.trim() ? 16 : 24), { align: "center" });
    if (customLinkText?.trim() && customLinkUrl?.trim()) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(footerCfg.fontSize); doc.setTextColor(180, 210, 195);
      doc.textWithLink(customLinkText, w / 2 - doc.getTextWidth(customLinkText) / 2, footerY + 28, { url: customLinkUrl });
    }
  }

  return doc;
}

// ═══════════════════════════════════════════════════════════
// PARTNER PRACTICES PDF BUILD FUNCTION
// ═══════════════════════════════════════════════════════════

export interface BuildPartnerParams {
  dsoName: string;
  headerCfg: HeaderConfig;
  bodyCfg: BodyConfig;
  footerCfg: FooterConfig;
  teamCfg: TeamConfig;
  headline: string;
  introText: string;
  features: PartnerFeature[];
  stats: PartnerStat[];
  qrUrl: string;
  teamContacts: TeamContact[];
  phoneNumber: string;
  prospectLogoData: string | null;
  prospectLogoDims: { w: number; h: number };
  cloneMode?: boolean;
}

export async function buildPartnerPdf(params: BuildPartnerParams): Promise<jsPDF> {
  const {
    dsoName, headerCfg, bodyCfg, footerCfg, teamCfg,
    headline, introText, features, stats, qrUrl,
    teamContacts, phoneNumber,
    prospectLogoData, prospectLogoDims,
    cloneMode = false,
  } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const darkGreen: [number, number, number] = [0, 40, 32];
  const white: [number, number, number] = [255, 255, 255];
  const textDark: [number, number, number] = [30, 40, 35];
  const textMuted: [number, number, number] = [90, 100, 95];
  const lime: [number, number, number] = [163, 190, 60];
  const offWhite: [number, number, number] = [240, 240, 236];
  const cardBorder: [number, number, number] = [180, 200, 60];
  const lineColor: [number, number, number] = [200, 205, 200];

  let logoPngData: string | null = null;
  let headerImgData: string | null = null;
  try {
    [logoPngData, headerImgData] = await Promise.all([
      svgToPng(dandyLogoWhite, 206, 74),
      loadImageAsBase64(headerCfg.headerImage || headerImgClinical, "image/png"),
    ]);
  } catch {}

  // === HEADER ===
  const headerH = headerCfg.height;
  const splitX = w * (headerCfg.splitRatio / 100);

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    await addImageCover(doc, headerImgData, "PNG", splitX, 0, w - splitX, headerH, headerCfg.imageCropAnchor);
  } else {
    doc.setFillColor(20, 50, 40);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  // Dandy logo (top left, over headline area) — suppressed in cloneMode so overlay field handles it
  if (logoPngData && !cloneMode) {
    try {
      doc.addImage(logoPngData, "PNG", margin, 30, 70, 24);
    } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...white); doc.text("dandy", margin, 48);
    }
  }

  // Separator + partner logo (left side, next to Dandy logo)
  const logoSepX = margin + 78;
  if (prospectLogoData) {
    doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.75);
    doc.line(logoSepX, 28, logoSepX, 56);
    try {
      const scaleFactor = (headerCfg.partnerLogoScale ?? 100) / 100;
      const baseMaxW = 70, baseMaxH = 26;
      const ratio = Math.min(baseMaxW / prospectLogoDims.w, baseMaxH / prospectLogoDims.h);
      const lw = prospectLogoDims.w * ratio * scaleFactor;
      const lh = prospectLogoDims.h * ratio * scaleFactor;
      const logoX = logoSepX + 8 + (headerCfg.partnerLogoOffsetX || 0);
      const logoY = 42 - lh / 2 + (headerCfg.partnerLogoOffsetY || 0);
      doc.addImage(prospectLogoData, "PNG", logoX, logoY, lw, lh);
    } catch {}
  } else if (dsoName && !cloneMode) {
    doc.setDrawColor(180, 210, 195); doc.setLineWidth(0.75);
    doc.line(logoSepX, 28, logoSepX, 56);
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...white);
    doc.text(dsoName, logoSepX + 8, 46);
  }

  // Title — suppressed in cloneMode so the overlay field handles it dynamically
  if (!cloneMode) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(headerCfg.subtitleFontSize); doc.setTextColor(200, 215, 210);
    const titleLead = `Dandy & ${dsoName || "Your DSO"}:`;
    doc.text(titleLead, margin, 100 + (headerCfg.subtitleOffsetY || 0));
  }

  doc.setFont("helvetica", "normal"); doc.setFontSize(headerCfg.titleFontSize); doc.setTextColor(...white);
  const titleLines = doc.splitTextToSize("The Winning Combo for Predictable, Precise Dentistry", splitX - margin - 20);
  doc.text(titleLines, margin, 135 + (headerCfg.subtitleOffsetY || 0));

  // === BODY ===
  const offsetX = bodyCfg.contentOffsetX || 0;
  let y = headerH + 30;

  doc.setFont("helvetica", "bold"); doc.setFontSize(bodyCfg.headlineFontSize); doc.setTextColor(...textDark);
  const headlineLines = doc.splitTextToSize(headline, contentW);
  doc.text(headlineLines, margin + offsetX, y);
  y += headlineLines.length * 22 + (bodyCfg.sectionSpacing || 14);

  if (bodyCfg.showIntro && introText) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(bodyCfg.introFontSize); doc.setTextColor(...textMuted);
    const introReplacement = cloneMode ? "your practice" : (dsoName || "Your DSO");
    const actualIntro = introText.replace(/\{dso\}/gi, introReplacement);
    const introLines = doc.splitTextToSize(actualIntro, contentW);
    doc.text(introLines, margin + offsetX, y);
    y += introLines.length * 14 + (bodyCfg.sectionSpacing || 10);
  }

  // Feature cards (2×2)
  const cardGap = 14;
  const cardW = (contentW - cardGap) / 2;
  const cardH = 90;
  const cardBorderW = 3;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      if (idx >= features.length) continue;
      const feat = features[idx];
      const cx = margin + col * (cardW + cardGap) + offsetX;
      const cy = y + row * (cardH + cardGap);

      doc.setFillColor(...offWhite);
      doc.roundedRect(cx, cy, cardW, cardH, 4, 4, "F");
      doc.setFillColor(...cardBorder);
      doc.roundedRect(cx, cy, cardBorderW, cardH, 2, 0, "F");

      // Last card = QR card
      if (idx === features.length - 1 && !feat.desc) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(bodyCfg.featureTitleFontSize); doc.setTextColor(...textDark);
        const qrTitleLines = doc.splitTextToSize(feat.title, cardW - 90);
        const titleBlockH = qrTitleLines.length * (bodyCfg.featureTitleFontSize + 2);
        const titleStartY = cy + (cardH - titleBlockH) / 2 + bodyCfg.featureTitleFontSize;
        doc.text(qrTitleLines, cx + 16, titleStartY);

        if (!cloneMode) {
          try {
            const QRCode = (await import("qrcode")).default;
            const qrDataUrl = await QRCode.toDataURL(qrUrl || "https://meetdandy.com", { width: 400, margin: 1 });
            doc.addImage(qrDataUrl, "PNG", cx + cardW - 72, cy + 14, 58, 58);
          } catch {}
        }
      } else {
        doc.setFont("helvetica", "bold"); doc.setFontSize(bodyCfg.featureTitleFontSize); doc.setTextColor(...textDark);
        doc.text(feat.title, cx + 16, cy + 28);
        if (feat.desc) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(bodyCfg.featureDescFontSize); doc.setTextColor(...textMuted);
          const descLines = doc.splitTextToSize(feat.desc, cardW - 36);
          doc.text(descLines, cx + 16, cy + 44);
        }
      }
    }
  }
  y += 2 * (cardH + cardGap) + 20;

  // === STATS ===
  doc.setFont("helvetica", "bold"); doc.setFontSize(bodyCfg.headlineFontSize); doc.setTextColor(...darkGreen);
  doc.text("See what Dandy doctors are saying:", margin + offsetX, y);
  y += 28;

  const statGap = 14;
  const statW = (contentW - statGap * (stats.length - 1)) / stats.length;
  const statH = 85;

  stats.forEach((stat, i) => {
    const sx = margin + (statW + statGap) * i + offsetX;
    doc.setFillColor(...offWhite);
    doc.roundedRect(sx, y, statW, statH, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(bodyCfg.statValueFontSize); doc.setTextColor(...darkGreen);
    doc.text(stat.value, sx + statW / 2, y + 32, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(bodyCfg.statDescFontSize); doc.setTextColor(...textMuted);
    const statLines = doc.splitTextToSize(stat.desc, statW - 24);
    doc.text(statLines, sx + statW / 2, y + 48, { align: "center", maxWidth: statW - 24 });
  });
  y += statH + 16;

  // === TEAM ===
  if (teamCfg.show) {
    const filteredContacts = teamContacts.filter(c => c.name.trim());
    if (filteredContacts.length > 0) {
      drawSeparator(doc, margin, y, contentW, lineColor); y += 29;
      doc.setFont("helvetica", "bold"); doc.setFontSize(teamCfg.headingFontSize); doc.setTextColor(...textDark);
      doc.text("Your dedicated team", w / 2, y, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
      doc.text("Meet your contacts for training, clinical support, and check-ins.", w / 2, y + 15, { align: "center" });
      y += 39;
      const contactColW = contentW / Math.max(filteredContacts.length, 1);
      let maxContactBottom = y;
      filteredContacts.forEach((contact, i) => {
        const cx = margin + contactColW * i + contactColW / 2;
        doc.setFont("helvetica", "bold"); doc.setFontSize(teamCfg.nameFontSize); doc.setTextColor(...textDark);
        doc.text(contact.name, cx, y, { align: "center" });
        let contactY = y + 14;
        if (contact.title) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
          doc.text(contact.title, cx, contactY, { align: "center" });
          contactY += 14;
        }
        if (contact.contactInfo) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...textMuted);
          doc.text(contact.contactInfo, cx, contactY, { align: "center" });
          contactY += 12;
        }
        maxContactBottom = Math.max(maxContactBottom, contactY);
      });
      y = maxContactBottom + 10;
    }
  }

  // === FOOTER ===
  const fH = footerCfg.height;
  const footerY = h - fH;
  doc.setFillColor(...darkGreen);
  doc.rect(0, footerY, w, fH, "F");

  doc.setFont("helvetica", "normal"); doc.setFontSize(footerCfg.fontSize); doc.setTextColor(...white);
  const footerParts: string[] = [];
  if (footerCfg.link) footerParts.push(footerCfg.link);
  else footerParts.push("meetdandy.com");
  if (phoneNumber.trim()) footerParts.push(phoneNumber.trim());
  doc.text(footerParts.join("  |  "), w / 2, footerY + fH / 2 + 3, { align: "center" });

  return doc;
}

// ═══════════════════════════════════════════════════════════
// ROI PDF BUILD FUNCTION
// ═══════════════════════════════════════════════════════════

interface BuildROIParams {
  dsoName: string;
  numPractices: number;
  cloneMode?: boolean;
}

async function buildROIPdf(params: BuildROIParams): Promise<jsPDF> {
  const { dsoName, numPractices, cloneMode = false } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const darkGreen: [number, number, number] = [0, 40, 32];
  const midGreen: [number, number, number] = [0, 55, 45];
  const lime: [number, number, number] = [163, 190, 60];
  const white: [number, number, number] = [255, 255, 255];
  const offWhite: [number, number, number] = [248, 248, 244];
  const mutedText: [number, number, number] = [90, 100, 95];
  const subtleText: [number, number, number] = [140, 150, 145];

  let headerImgData: string | null = null;
  let logoPngData: string | null = null;
  try {
    [headerImgData, logoPngData] = await Promise.all([
      loadImageAsBase64(headerImgExecutive),
      svgToPng(dandyLogoWhite, 206, 74),
    ]);
  } catch {}

  // PAGE 1
  const headerH = 160;
  doc.setFillColor(...darkGreen); doc.rect(0, 0, w, headerH, "F");
  if (headerImgData) {
    const imgNativeW = 1194; const imgNativeH = 976;
    const imgAspect = imgNativeW / imgNativeH;
    // Cover-crop the header image to fill the right portion
    await addImageCover(doc, headerImgData, "JPEG", 0, 0, w, headerH);
    // Overlay the dark green area on the left for text
    doc.setFillColor(...darkGreen); doc.rect(0, 0, w * 0.55, headerH, "F");
  }
  if (logoPngData && !cloneMode) {
    try { doc.addImage(logoPngData, "PNG", margin, 36, 80, 28); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...white); doc.text("dandy", margin, 45);
    }
  }

  const roiNameSize = dsoName.length > 15 ? 16 : 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(roiNameSize); doc.setTextColor(...white);
  doc.text("& ", margin, 92);
  const ampWidth = doc.getTextWidth("& ");
  doc.text(dsoName, margin + ampWidth, 92);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(180, 210, 195);
  doc.text("Your custom partnership overview — built for scale, savings & growth", margin, 128);

  // METRICS BAR
  let y = headerH + 28;
  const metricsH = 70;
  doc.setFillColor(...midGreen); doc.roundedRect(margin, y, contentW, metricsH, 6, 6, "F");

  const practices = numPractices;
  const apptsSavedYear = Math.round(22.5 * practices * 12);
  const chairHoursSavedYear = Math.round(11.25 * practices * 12 + 4.5 * practices);
  const totalUpsideYear = (7500 * practices * 12) + (32500 * practices);
  const fmtShort = (v: number) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`;

  const metrics = [
    { value: fmtShort(totalUpsideYear), label: "Revenue upside / yr" },
    { value: "96%", label: "First-time right rate" },
    { value: apptsSavedYear.toLocaleString(), label: "Appointments saved / yr" },
    { value: chairHoursSavedYear.toLocaleString(), label: "Chair hours recovered / yr" },
    { value: "$0", label: "CAPEX to start" },
  ];

  const colW = contentW / metrics.length;
  metrics.forEach((m, i) => {
    const cx = margin + colW * i + colW / 2;
    if (i > 0) { doc.setDrawColor(60, 90, 80); doc.setLineWidth(0.5); doc.line(margin + colW * i, y + 16, margin + colW * i, y + metricsH - 16); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(16); doc.setTextColor(...lime); doc.text(m.value, cx, y + 31, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text(m.label, cx, y + 45, { align: "center" });
  });
  y += metricsH + 28;

  // CASE STUDIES
  const caseStudies = [
    { org: "APEX Dental Partners", stat: "12.5%", statLabel: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", authorName: "Dr. Layla Lohmann", authorTitle: "Founder" },
    { org: "Open & Affordable Dental", stat: "96%", statLabel: "reduction in remakes", quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.", authorName: "Clinical Director", authorTitle: "" },
    { org: "Dental Care Alliance", stat: "99%", statLabel: "practices still using Dandy after one year", quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.", authorName: "Dr. Trey Mueller", authorTitle: "Chief Clinical Officer" },
  ];

  const gap = 14;
  const pillarW = (contentW - gap * 2) / 3;
  const pillarH = 215;

  caseStudies.forEach((cs, i) => {
    const px = margin + (pillarW + gap) * i;
    doc.setFillColor(...offWhite); doc.roundedRect(px, y, pillarW, pillarH, 6, 6, "F");
    doc.setFillColor(...lime); doc.roundedRect(px, y, pillarW, 3, 3, 3, "F"); doc.rect(px, y + 2, pillarW, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text(cs.org.toUpperCase(), px + 16, y + 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(26); doc.setTextColor(...darkGreen); doc.text(cs.stat, px + 16, y + 54);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...subtleText);
    const labelLines = doc.splitTextToSize(cs.statLabel, pillarW - 32); doc.text(labelLines, px + 16, y + 68);
    drawSeparator(doc, px + 16, y + 86, pillarW - 32, [220, 220, 215]);
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...mutedText);
    const quoteLines = doc.splitTextToSize(`"${cs.quote}"`, pillarW - 40); doc.text(quoteLines, px + 20, y + 102);
    const authorY = y + pillarH - 24;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(0, 120, 80); doc.text(`— ${cs.authorName}`, px + 16, authorY);
    if (cs.authorTitle) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text(cs.authorTitle, px + 28, authorY + 11); }
  });
  y += pillarH + 24;

  // NEXT STEPS
  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, contentW, 105, 6, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...darkGreen); doc.text("Recommended Next Step: Risk-Free Pilot", margin + 20, y + 24);
  const pilotItems = [
    "Start with 5–10 locations — no long-term commitment required",
    "Measure remake reduction, chair time recovered, and revenue lift in real time",
    "Dedicated onboarding team + change management support included",
    "Scale across the full network once ROI is validated",
  ];
  let pilotY = y + 44;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  pilotItems.forEach((item) => {
    doc.setFillColor(...lime); doc.circle(margin + 30, pilotY - 3, 3, "F");
    doc.setTextColor(...mutedText); doc.text(item, margin + 42, pilotY); pilotY += 16;
  });
  y += 105 + 20;

  // QUOTE
  const quoteBlockH = h - 36 - y - 20;
  doc.setFillColor(...midGreen); doc.roundedRect(margin, y, contentW, quoteBlockH, 6, 6, "F");
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5);
  const bottomQuote = "I've used Dandy Dental Lab for the last two years for crowns, implant crowns, and removables, and their work is consistently excellent. The quality is outstanding and their customer service is even better. I wouldn't change this lab for any other.";
  const bqLines = doc.splitTextToSize(bottomQuote, contentW - 110);
  const quoteTextH = bqLines.length * 13;
  const attrH = 12; const quoteMarkH = 24; const gapBetween = 10;
  const totalContentH = quoteMarkH + quoteTextH + gapBetween + attrH;
  const contentStartY = y + (quoteBlockH - totalContentH) / 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(40); doc.setTextColor(...lime); doc.text("\u201C", margin + 24, contentStartY + quoteMarkH + 19);
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(...white); doc.text(bqLines, margin + 50, contentStartY + quoteMarkH);
  const attrY = contentStartY + quoteMarkH + quoteTextH + gapBetween - 11;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...lime); doc.text("Dr. Tania Arthur", margin + 50, attrY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 210, 195); doc.text("  —  Oasis Modern Dentistry", margin + 50 + doc.getTextWidth("Dr. Tania Arthur "), attrY);

  // PAGE 1 FOOTER
  const footerH = 36;
  doc.setFillColor(...darkGreen); doc.rect(0, h - footerH, w, footerH, "F");
  try { doc.addImage(logoPngData!, "PNG", margin, h - footerH + 10, 48, 17); } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text("dandy", margin, h - footerH + 24);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(160, 185, 175);
  doc.text("www.meetdandy.com/dso", w / 2, h - footerH + 22, { align: "center" });
  doc.setTextColor(...lime); doc.text(`Prepared for ${dsoName}  •  Page 1 of 2`, w - margin, h - footerH + 22, { align: "right" });

  // PAGE 2
  doc.addPage();
  const p2HeaderH = 80;
  doc.setFillColor(...darkGreen); doc.rect(0, 0, w, p2HeaderH, "F");
  try { doc.addImage(logoPngData!, "PNG", margin, 22, 70, 24); } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...white); doc.text("dandy", margin, 40);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(15); doc.setTextColor(...white); doc.text("The Dandy Difference & ROI", margin, 66);
  y = p2HeaderH + 28;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...lime); doc.text("THE DANDY DIFFERENCE", margin, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...mutedText); doc.text("Built for DSO scale. Designed for provider trust.", margin, y + 12); y += 28;

  const tableRows = [
    { need: "Patient Volume Growth", dandy: "30% higher case acceptance, expanded services like Aligners", traditional: "No growth enablement" },
    { need: "Multi-Brand Consistency", dandy: "One standard across all your brands and locations", traditional: "Varies by location and vendor" },
    { need: "Waste Prevention", dandy: "AI Scan Review catches issues before they cost you", traditional: "Remakes discovered after the fact" },
    { need: "Executive Visibility", dandy: "Real-time, actionable data across your entire network", traditional: "Fragmented, non-actionable reports" },
    { need: "Capital Efficiency", dandy: "Premium scanners included — no CAPEX required", traditional: "Heavy CAPEX, scanner bottlenecks" },
    { need: "Change Management", dandy: "Hands-on training that respects provider autonomy", traditional: "Minimal onboarding, slow rollout" },
  ];

  const col1W2 = 120; const col2W2 = (contentW - col1W2) / 2; const rowH2 = 36;
  doc.setFillColor(...darkGreen); doc.roundedRect(margin, y, contentW, 28, 4, 4, "F"); doc.rect(margin, y + 4, contentW, 24, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text("WHAT YOUR DSO NEEDS", margin + 12, y + 18);
  doc.setTextColor(...lime); doc.text("DANDY", margin + col1W2 + 12, y + 18);
  doc.setTextColor(180, 200, 190); doc.text("TRADITIONAL LABS", margin + col1W2 + col2W2 + 12, y + 18); y += 28;

  tableRows.forEach((row, i) => {
    const bgColor2: [number, number, number] = i % 2 === 0 ? offWhite : white;
    const isLast = i === tableRows.length - 1;
    doc.setFillColor(...bgColor2);
    if (isLast) { doc.roundedRect(margin, y, contentW, rowH2, 4, 4, "F"); doc.rect(margin, y, contentW, rowH2 - 4, "F"); } else { doc.rect(margin, y, contentW, rowH2, "F"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...darkGreen); doc.text(row.need, margin + 12, y + 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(40, 80, 65);
    const dandyLines = doc.splitTextToSize(row.dandy, col2W2 - 24); doc.text(dandyLines, margin + col1W2 + 12, y + 14);
    doc.setTextColor(...subtleText);
    const tradLines = doc.splitTextToSize(row.traditional, col2W2 - 24); doc.text(tradLines, margin + col1W2 + col2W2 + 12, y + 14);
    y += rowH2;
  });
  y += 18;

  // ROI BREAKDOWN
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...lime); doc.text("ROI BREAKDOWN", margin, y); y += 6;
  const n = numPractices;
  const apptFreedPerMonth = Math.round(22.5 * n);
  const chairHoursPerMonth = Math.round(11.25 * n * 10) / 10;
  const dentureProductionPerMonth = Math.round(7500 * n);
  const dentureProductionPerYear = dentureProductionPerMonth * 12;
  const remakesAvoidedPerMonth = Math.round(0.75 * n * 10) / 10;
  const labCostsAvoidedPerYear = Math.round(600 * n);
  const chairHoursRestoPerYear = Math.round(4.5 * n * 10) / 10;
  const restoUpsidePerYear = Math.round(32500 * n);
  const combinedTotal = dentureProductionPerYear + restoUpsidePerYear;
  const fmtK = (v: number) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M+` : `$${Math.round(v / 1000)}K+`;
  const fmtDollar2 = (v: number) => `$${v.toLocaleString()}`;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...mutedText);
  doc.text(`Estimated annual financial impact for ${dsoName} (based on ${n} practices).`, margin, y + 12); y += 30;

  const cardGap = 14; const cardW2 = (contentW - cardGap) / 2; const cardH = 145;

  // Left card
  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, cardW2, cardH, 6, 6, "F");
  doc.setFillColor(...lime); doc.roundedRect(margin, y, cardW2, 3, 3, 3, "F"); doc.rect(margin, y + 2, cardW2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("DENTURE WORKFLOW IMPACT", margin + 16, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.setTextColor(...darkGreen); doc.text(fmtK(dentureProductionPerYear), margin + 16, y + 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("incremental production / year", margin + 16, y + 66);
  drawSeparator(doc, margin + 16, y + 78, cardW2 - 32, [220, 220, 215]);
  const dentureItems = [`${apptFreedPerMonth.toLocaleString()} appointments freed / month`, `${chairHoursPerMonth} chair hours recovered / month`, "1.5 fewer appointments per case", `${fmtDollar2(dentureProductionPerMonth)} incremental production / month`];
  let dentY = y + 92;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  dentureItems.forEach((item) => { doc.setFillColor(...lime); doc.circle(margin + 22, dentY - 2.5, 2, "F"); doc.setTextColor(...mutedText); doc.text(item, margin + 30, dentY); dentY += 14; });

  // Right card
  const rightX = margin + cardW2 + cardGap;
  doc.setFillColor(...offWhite); doc.roundedRect(rightX, y, cardW2, cardH, 6, 6, "F");
  doc.setFillColor(...lime); doc.roundedRect(rightX, y, cardW2, 3, 3, 3, "F"); doc.rect(rightX, y + 2, cardW2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("FIXED RESTO REMAKE IMPACT", rightX + 16, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.setTextColor(...darkGreen); doc.text(fmtK(restoUpsidePerYear), rightX + 16, y + 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("total financial upside / year", rightX + 16, y + 66);
  drawSeparator(doc, rightX + 16, y + 78, cardW2 - 32, [220, 220, 215]);
  const restoItems = ["60% fewer remakes with AI Scan Review", `${remakesAvoidedPerMonth} remakes avoided / month`, `${fmtDollar2(labCostsAvoidedPerYear)} lab costs avoided / year`, `${chairHoursRestoPerYear} chair hours recovered / year`];
  let restoY = y + 92;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  restoItems.forEach((item) => { doc.setFillColor(...lime); doc.circle(rightX + 22, restoY - 2.5, 2, "F"); doc.setTextColor(...mutedText); doc.text(item, rightX + 30, restoY); restoY += 14; });
  y += cardH + 20;

  // COMBINED TOTAL
  doc.setFillColor(...darkGreen); doc.roundedRect(margin, y, contentW, 58, 6, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text(`COMBINED ANNUAL UPSIDE (${n} PRACTICES)`, margin + 20, y + 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...lime); doc.text(fmtK(combinedTotal), margin + 20, y + 42);
  const div1X = margin + contentW - 280; doc.setDrawColor(60, 90, 80); doc.setLineWidth(0.5); doc.line(div1X, y + 12, div1X, y + 46);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text("DENTURE", div1X + 16, y + 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(18); doc.setTextColor(...lime); doc.text(fmtK(dentureProductionPerYear), div1X + 16, y + 42);
  const div2X = div1X + 140; doc.line(div2X, y + 12, div2X, y + 46);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text("FIXED RESTO REMAKES", div2X + 16, y + 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(18); doc.setTextColor(...lime); doc.text(fmtK(restoUpsidePerYear), div2X + 16, y + 42);
  y += 58 + 16;

  // CTA
  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, contentW, 55, 6, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...darkGreen); doc.text("Ready to validate these numbers?", margin + 20, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...mutedText); doc.text("Start a risk-free pilot with 5–10 locations. Get a custom ROI analysis at meetdandy.com/dso", margin + 20, y + 38);

  // PAGE 2 FOOTER
  doc.setFillColor(...darkGreen); doc.rect(0, h - footerH, w, footerH, "F");
  try { doc.addImage(logoPngData!, "PNG", margin, h - footerH + 10, 48, 17); } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text("dandy", margin, h - footerH + 24);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(160, 185, 175);
  doc.text("www.meetdandy.com/dso", w / 2, h - footerH + 22, { align: "center" });
  doc.setTextColor(...lime); doc.text(`Prepared for ${dsoName}  •  Page 2 of 2`, w - margin, h - footerH + 22, { align: "right" });

  return doc;
}

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════

const DSOPilotEditor = () => {
  // ── Template selection ─────────
  const [editorTemplate, setEditorTemplate] = useState<EditorTemplate>("pilot");

  // ── Basic info ─────────────────
  const [dsoName, setDsoName] = useState("");
  const [audience, setAudience] = useState<Audience>("executive");
  const [generating, setGenerating] = useState(false);
  const [numPractices, setNumPractices] = useState(100);

  // ── Section open states ────────
  const [openSections, setOpenSections] = useState({
    header: true,
    body: false,
    team: false,
    footer: false,
    content: false,
    table: false,
    stats: false,
  });
  const toggle = (key: keyof typeof openSections) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  // ── Section configs ────────────
  const [headerCfg, setHeaderCfg] = useState<HeaderConfig>(defaultHeaderConfig);
  const [bodyCfg, setBodyCfg] = useState<BodyConfig>(defaultBodyConfig);
  const [teamCfg, setTeamCfg] = useState<TeamConfig>(defaultTeamConfig);
  const [footerCfg, setFooterCfg] = useState<FooterConfig>(defaultFooterConfig);

  // ── Content (Pilot) ────────────
  const [subtitle, setSubtitle] = useState(defaultSubtitles.executive);
  const [introText, setIntroText] = useState(defaultIntroTexts.executive);
  const [features, setFeatures] = useState<Feature[]>(defaultFeatures.executive);
  const [checklist, setChecklist] = useState<string[]>([...defaultChecklist]);

  // ── Partner Practices state ─────
  const [partnerHeadline, setPartnerHeadline] = useState(defaultPartnerHeadline);
  const [partnerIntro, setPartnerIntro] = useState(defaultPartnerIntro);
  const [partnerFeatures, setPartnerFeatures] = useState<PartnerFeature[]>([...defaultPartnerFeatures]);
  const [partnerStats, setPartnerStats] = useState<PartnerStat[]>([...defaultPartnerStats]);
  const [partnerQrUrl, setPartnerQrUrl] = useState("https://meetdandy.com");

  // ── Content (Evolution) ────────
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([...defaultComparisonRows]);
  const [stats, setStats] = useState<StatItem[]>([...defaultStats]);

  // ── Team ───────────────────────
  const [teamContacts, setTeamContacts] = useState<TeamContact[]>([
    { name: "", title: "", contactInfo: "" },
    { name: "", title: "", contactInfo: "" },
    { name: "", title: "", contactInfo: "" },
  ]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customLinkText, setCustomLinkText] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");

  // ── Logo upload ────────────────
  const [prospectLogoData, setProspectLogoData] = useState<string | null>(null);
  const [prospectLogoDims, setProspectLogoDims] = useState({ w: 0, h: 0 });
  const [prospectLogoName, setProspectLogoName] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Header image upload ────────
  const headerImgInputRef = useRef<HTMLInputElement>(null);

  // ── Template importer ref ──────
  const importerRef = useRef<DSOTemplateImporterHandle>(null);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);

  // ── Preview state ──────────────
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProspectLogoName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setProspectLogoDims({ w: img.width, h: img.height });
        setProspectLogoData(data);
      };
      img.src = data;
    };
    reader.readAsDataURL(file);
  };

  const handleHeaderImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setHeaderCfg((p) => ({ ...p, headerImage: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // ── Per-audience header images ────
  const [audienceHeaderImages, setAudienceHeaderImages] = useState<Record<Audience, string | null>>({
    executive: null, clinical: null, "practice-manager": null,
  });

  // ── Audience change (Pilot) ────
  const switchAudience = (a: Audience) => {
    // Save current audience's header image before switching
    setAudienceHeaderImages((prev) => ({ ...prev, [audience]: headerCfg.headerImage }));
    setAudience(a);
    setSubtitle(defaultSubtitles[a]);
    setIntroText(defaultIntroTexts[a]);
    setFeatures([...defaultFeatures[a]]);
    setChecklist([...defaultChecklist]);
    // Restore the target audience's saved header image
    setHeaderCfg((p) => ({ ...p, headerImage: audienceHeaderImages[a] }));
  };

  // ── Template change ────────────
  const switchTemplate = (t: EditorTemplate) => {
    setEditorTemplate(t);
    if (t === "comparison") {
      setHeaderCfg({ height: 200, splitRatio: 55, titleText: "", titleFontSize: 20, subtitleFontSize: 9.5, subtitleOffsetY: 0, headerImage: null, imageCropAnchor: "center", partnerLogoScale: 100, partnerLogoOffsetX: 0, partnerLogoOffsetY: 0 });
    } else if (t === "partner") {
      setHeaderCfg({ height: 280, splitRatio: 55, titleText: "", titleFontSize: 30, subtitleFontSize: 16, subtitleOffsetY: 0, headerImage: null, imageCropAnchor: "center", partnerLogoScale: 100, partnerLogoOffsetX: 0, partnerLogoOffsetY: 0 });
    } else if (t === "pilot") {
      setHeaderCfg(defaultHeaderConfig);
    }
  };

  // ── Reset all ──────────────────
  const resetAll = () => {
    if (editorTemplate === "pilot") {
      setHeaderCfg(defaultHeaderConfig);
      setBodyCfg(defaultBodyConfig);
      setTeamCfg(defaultTeamConfig);
      setFooterCfg(defaultFooterConfig);
      setSubtitle(defaultSubtitles[audience]);
      setIntroText(defaultIntroTexts[audience]);
      setFeatures([...defaultFeatures[audience]]);
      setChecklist([...defaultChecklist]);
    } else if (editorTemplate === "comparison") {
      setHeaderCfg({ height: 200, splitRatio: 55, titleText: "", titleFontSize: 20, subtitleFontSize: 9.5, subtitleOffsetY: 0, headerImage: null, imageCropAnchor: "center", partnerLogoScale: 100, partnerLogoOffsetX: 0, partnerLogoOffsetY: 0 });
      setTeamCfg(defaultTeamConfig);
      setFooterCfg(defaultFooterConfig);
      setComparisonRows([...defaultComparisonRows]);
      setStats([...defaultStats]);
    } else if (editorTemplate === "partner") {
      setHeaderCfg({ height: 280, splitRatio: 55, titleText: "", titleFontSize: 30, subtitleFontSize: 16, subtitleOffsetY: 0, headerImage: null, imageCropAnchor: "center", partnerLogoScale: 100, partnerLogoOffsetX: 0, partnerLogoOffsetY: 0 });
      setBodyCfg(defaultBodyConfig);
      setTeamCfg(defaultTeamConfig);
      setFooterCfg(defaultFooterConfig);
      setPartnerHeadline(defaultPartnerHeadline);
      setPartnerIntro(defaultPartnerIntro);
      setPartnerFeatures([...defaultPartnerFeatures]);
      setPartnerStats([...defaultPartnerStats]);
      setPartnerQrUrl("https://meetdandy.com");
    } else {
      setNumPractices(100);
    }
  };

  const updateFeature = (idx: number, field: "title" | "description", value: string) => {
    setFeatures((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  const updateContact = (idx: number, field: keyof TeamContact, value: string) => {
    setTeamContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const updateComparisonRow = (idx: number, field: keyof ComparisonRow, value: string) => {
    setComparisonRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const updateStat = (idx: number, field: keyof StatItem, value: string) => {
    setStats((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  // ── Save as New Template ───────
  const saveAsNewTemplate = async () => {
    setSavingAsTemplate(true);
    try {
      // 1. Generate the PDF in cloneMode (suppresses dynamic content)
      let doc: jsPDF;
      const editorToBuiltinId: Record<EditorTemplate, string> = {
        roi: "roi",
        pilot: "pilot",
        comparison: "comparison",
        partner: "new-partner",
      };

      if (editorTemplate === "pilot") {
        doc = await buildPilotPdf({
          dsoName: " ", audience, headerCfg, bodyCfg, teamCfg, footerCfg,
          subtitle, introText, features, checklist, teamContacts: [],
          phoneNumber: "", customLinkText: "", customLinkUrl: "",
          prospectLogoData: null, prospectLogoDims: { w: 0, h: 0 },
          cloneMode: true,
        });
      } else if (editorTemplate === "comparison") {
        doc = await buildComparisonPdf({
          dsoName: " ", headerCfg, teamCfg, footerCfg,
          comparisonRows, stats, teamContacts: [],
          phoneNumber: "", customLinkText: "", customLinkUrl: "",
          prospectLogoData: null, prospectLogoDims: { w: 0, h: 0 },
          cloneMode: true,
        });
      } else if (editorTemplate === "partner") {
        doc = await buildPartnerPdf({
          dsoName: " ", headerCfg, bodyCfg, footerCfg, teamCfg,
          headline: partnerHeadline, introText: partnerIntro,
          features: partnerFeatures, stats: partnerStats, qrUrl: partnerQrUrl,
          teamContacts: [], phoneNumber: "",
          prospectLogoData: null, prospectLogoDims: { w: 0, h: 0 },
          cloneMode: true,
        });
      } else {
        doc = await buildROIPdf({ dsoName: " ", numPractices, cloneMode: true });
      }

      // 2. Convert PDF page 1 to PNG
      const pdfBlob = doc.output("blob");
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const arrayBuf = await pdfBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const page = await pdf.getPage(1);
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
      const imgBlob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/png"));

      // 3. Upload to storage
      const path = `cloned/${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage.from("template-backgrounds").upload(path, imgBlob as any);
      if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
      const { data: urlData } = supabase.storage.from("template-backgrounds").getPublicUrl(path);
      const bgUrl = urlData.publicUrl;

      // 4. Build the template with overlay fields
      const builtinId = editorToBuiltinId[editorTemplate] as any;
      const templateLabels: Record<EditorTemplate, string> = { pilot: "90-Day Pilot", comparison: "Dandy Evolution", partner: "Partner Practices", roi: "ROI Brief" };
      const template = {
        name: `${templateLabels[editorTemplate]} (Custom)`,
        background_url: bgUrl,
        orientation: "portrait" as const,
        fields: cloneFieldsForBuiltin(builtinId),
        headerHeight: 30,
      };

      // 5. Open the importer editor with this template
      importerRef.current?.openWithTemplate(template, bgUrl);
      toast({ title: "Template created!", description: "Customize the overlay fields and save." });
    } catch (err) {
      toast({ title: "Failed to save as template", description: String(err), variant: "destructive" });
    } finally {
      setSavingAsTemplate(false);
    }
  };

  // ── Live preview generation (debounced) ────────────
  useEffect(() => {
    if (!previewVisible) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        let doc: jsPDF;
        if (editorTemplate === "pilot") {
          doc = await buildPilotPdf({
            dsoName, audience, headerCfg, bodyCfg, teamCfg, footerCfg,
            subtitle, introText, features, checklist, teamContacts,
            phoneNumber, customLinkText, customLinkUrl,
            prospectLogoData, prospectLogoDims,
          });
        } else if (editorTemplate === "comparison") {
          doc = await buildComparisonPdf({
            dsoName, headerCfg, teamCfg, footerCfg,
            comparisonRows, stats, teamContacts,
            phoneNumber, customLinkText, customLinkUrl,
            prospectLogoData, prospectLogoDims,
          });
        } else if (editorTemplate === "partner") {
          doc = await buildPartnerPdf({
            dsoName: dsoName || "Your DSO", headerCfg, bodyCfg, footerCfg, teamCfg,
            headline: partnerHeadline, introText: partnerIntro,
            features: partnerFeatures, stats: partnerStats, qrUrl: partnerQrUrl,
            teamContacts, phoneNumber, prospectLogoData, prospectLogoDims,
          });
        } else {
          doc = await buildROIPdf({ dsoName: dsoName || "Your DSO", numPractices });
        }
        // Use blob URL for reliable rendering of large PDFs
        const pdfBlob = doc.output("blob");
        const blobUrl = URL.createObjectURL(pdfBlob);
        setPreviewUrl((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return blobUrl;
        });
      } catch (err) {
        console.error("[PDF Preview] Build failed:", err);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editorTemplate, dsoName, audience, headerCfg, bodyCfg, teamCfg, footerCfg,
    subtitle, introText, features, checklist, teamContacts,
    phoneNumber, customLinkText, customLinkUrl,
    prospectLogoData, prospectLogoDims, previewVisible,
    comparisonRows, stats, numPractices,
    partnerHeadline, partnerIntro, partnerFeatures, partnerStats, partnerQrUrl,
  ]);

  // ── Load saved defaults on mount & template switch ────────────
  const loadTemplateDefaults = useCallback(async (template: EditorTemplate) => {
    const keyMap: Record<EditorTemplate, string> = {
      pilot: "dandy_pilot_template_layout",
      comparison: "dandy_comparison_template_layout",
      partner: "dandy_partner_template_layout",
      roi: "",
    };
    const key = keyMap[template];
    if (!key) return;
    const saved = await loadLayoutDefault(key);
    if (!saved) return;

    if (saved.headerCfg) setHeaderCfg(prev => ({ ...prev, ...saved.headerCfg }));
    if (saved.bodyCfg) setBodyCfg(prev => ({ ...prev, ...saved.bodyCfg }));
    if (saved.teamCfg) setTeamCfg(prev => ({ ...prev, ...saved.teamCfg }));
    if (saved.footerCfg) setFooterCfg(prev => ({ ...prev, ...saved.footerCfg }));
    if (saved.audienceHeaderImages) {
      setAudienceHeaderImages(prev => ({ ...prev, ...saved.audienceHeaderImages }));
      // Restore the current audience's header image into headerCfg
      const currentAudienceImg = saved.audienceHeaderImages[audience];
      if (currentAudienceImg !== undefined) {
        setHeaderCfg(prev => ({ ...prev, headerImage: currentAudienceImg }));
      }
    }

    if (template === "comparison") {
      if (saved.comparisonRows) setComparisonRows(saved.comparisonRows);
      if (saved.stats) setStats(saved.stats);
    }
    if (template === "partner") {
      if (saved.partnerHeadline) setPartnerHeadline(saved.partnerHeadline);
      if (saved.partnerIntro) setPartnerIntro(saved.partnerIntro);
      if (saved.partnerFeatures) setPartnerFeatures(saved.partnerFeatures);
      if (saved.partnerStats) setPartnerStats(saved.partnerStats);
      if (saved.partnerQrUrl) setPartnerQrUrl(saved.partnerQrUrl);
    }
  }, []);

  useEffect(() => {
    loadTemplateDefaults(editorTemplate);
  }, [editorTemplate, loadTemplateDefaults]);

  // ── Download handler ───────────
  const handleGenerate = useCallback(async () => {
    if (!dsoName.trim() && editorTemplate !== "roi") return;
    setGenerating(true);
    try {
      let doc: jsPDF;
      let filename: string;
      if (editorTemplate === "pilot") {
        doc = await buildPilotPdf({
          dsoName, audience, headerCfg, bodyCfg, teamCfg, footerCfg,
          subtitle, introText, features, checklist, teamContacts,
          phoneNumber, customLinkText, customLinkUrl,
          prospectLogoData, prospectLogoDims,
        });
        filename = `Dandy_x_${dsoName.replace(/\s+/g, "_")}_90Day_Pilot.pdf`;
      } else if (editorTemplate === "comparison") {
        doc = await buildComparisonPdf({
          dsoName, headerCfg, teamCfg, footerCfg,
          comparisonRows, stats, teamContacts,
          phoneNumber, customLinkText, customLinkUrl,
          prospectLogoData, prospectLogoDims,
        });
        filename = `Dandy_Evolution_${dsoName.replace(/\s+/g, "_")}.pdf`;
      } else if (editorTemplate === "partner") {
        doc = await buildPartnerPdf({
          dsoName, headerCfg, bodyCfg, footerCfg, teamCfg,
          headline: partnerHeadline, introText: partnerIntro,
          features: partnerFeatures, stats: partnerStats, qrUrl: partnerQrUrl,
          teamContacts, phoneNumber, prospectLogoData, prospectLogoDims,
        });
        filename = `Dandy_x_${dsoName.replace(/\s+/g, "_")}_Partner_Practices.pdf`;
      } else {
        doc = await buildROIPdf({ dsoName: dsoName || "Your DSO", numPractices });
        filename = `Dandy_for_${(dsoName || "DSO").replace(/\s+/g, "_")}.pdf`;
      }
      doc.save(filename);
      await supabase.from("pdf_submissions").insert({
        dso_name: (dsoName || "DSO").trim(),
        practice_count: numPractices,
      });
    } finally {
      setGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editorTemplate, dsoName, audience, headerCfg, bodyCfg, teamCfg, footerCfg,
    subtitle, introText, features, checklist, teamContacts,
    phoneNumber, customLinkText, customLinkUrl,
    prospectLogoData, prospectLogoDims, comparisonRows, stats, numPractices,
    partnerHeadline, partnerIntro, partnerFeatures, partnerStats, partnerQrUrl,
  ]);

  // Template labels
  const templateLabels: Record<EditorTemplate, string> = {
    pilot: "90-Day Pilot",
    comparison: "Dandy Evolution",
    roi: "ROI Brief",
    partner: "Partner Practices",
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  return (
    <section className="py-8 bg-background min-h-screen">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6">
        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Template Editor</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize every section — see changes live in the preview panel.
          </p>
        </div>

        {/* Marketing: Template Importer */}
        <DSOTemplateImporter ref={importerRef} />

        {/* Template selector */}
        <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
          <div className="inline-flex rounded-full border border-border overflow-hidden">
            {(["pilot", "comparison", "partner", "roi"] as EditorTemplate[]).map((t) => (
              <button
                key={t}
                onClick={() => switchTemplate(t)}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                  editorTemplate === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground bg-background"
                }`}
              >
                {templateLabels[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Audience selector + controls (contextual) */}
        <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
          {editorTemplate === "pilot" && (
            <div className="inline-flex rounded-full border border-border overflow-hidden">
              {(["executive", "clinical", "practice-manager"] as Audience[]).map((a) => (
                <button
                  key={a}
                  onClick={() => switchAudience(a)}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                    audience === a
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground bg-background"
                  }`}
                >
                  {a === "practice-manager" ? "Practice Mgr" : a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Reset all settings to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={() => setPreviewVisible((p) => !p)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
          >
            {previewVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {previewVisible ? "Hide Preview" : "Show Preview"}
          </button>
          {(editorTemplate === "pilot" || editorTemplate === "comparison" || editorTemplate === "partner") && (
            <button
              onClick={async () => {
                if (editorTemplate === "pilot") {
                  // Merge current audience's header image into audienceHeaderImages before saving
                  const finalAudienceImages = { ...audienceHeaderImages, [audience]: headerCfg.headerImage };
                  const saved = { headerCfg, bodyCfg, teamCfg, footerCfg, audienceHeaderImages: finalAudienceImages };
                  await saveLayoutDefault("dandy_pilot_template_layout", saved);
                } else if (editorTemplate === "comparison") {
                  const saved = { headerCfg, teamCfg, footerCfg, comparisonRows, stats };
                  await saveLayoutDefault("dandy_comparison_template_layout", saved);
                } else if (editorTemplate === "partner") {
                  const saved = { headerCfg, bodyCfg, teamCfg, footerCfg, partnerHeadline, partnerIntro, partnerFeatures, partnerStats, partnerQrUrl };
                  await saveLayoutDefault("dandy_partner_template_layout", saved);
                }
                toast({ title: "Template saved!", description: "These layout settings are now the permanent defaults across all sessions." });
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors ml-2 border border-primary/30 rounded-lg px-3 py-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save as Default
            </button>
          )}
          <button
            onClick={saveAsNewTemplate}
            disabled={savingAsTemplate}
            className="flex items-center gap-1.5 text-xs font-medium text-accent-foreground hover:opacity-80 transition-colors ml-2 border border-border rounded-lg px-3 py-1.5 bg-accent"
          >
            {savingAsTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            {savingAsTemplate ? "Creating…" : "Save as New Template"}
          </button>
        </div>

        {/* MAIN LAYOUT: editor + preview side by side */}
        <div className={`flex gap-6 ${previewVisible ? "flex-col lg:flex-row" : ""}`}>
          {/* ── LEFT: Editor controls ── */}
          <div className={previewVisible ? "w-full lg:w-1/2 xl:w-[45%] shrink-0" : "max-w-[960px] mx-auto w-full"}>
            {/* DSO Name + Logo / Practices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">
                  DSO Name
                </label>
                <input
                  type="text"
                  placeholder="Enter prospect name"
                  maxLength={25}
                  value={dsoName}
                  onChange={(e) => setDsoName(e.target.value.slice(0, 25))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {editorTemplate === "roi" ? (
                <div>
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">
                    # Practices
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={numPractices}
                    onChange={(e) => setNumPractices(Math.max(1, Math.min(2000, parseInt(e.target.value) || 1)))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">
                    Prospect Logo (optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoUpload} className="hidden" />
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {prospectLogoData ? "Change" : "Upload"}
                    </button>
                    {prospectLogoData && (
                      <div className="flex items-center gap-2">
                        <img src={prospectLogoData} alt="" className="h-8 w-auto max-w-[80px] object-contain rounded border border-border p-0.5" />
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{prospectLogoName}</span>
                        <button onClick={() => { setProspectLogoData(null); setProspectLogoName(""); }} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION PANELS */}
            <div className="space-y-3 mb-6">
              {/* ══════ PILOT PANELS ══════ */}
              {editorTemplate === "pilot" && (
                <>
                  {/* ── HEADER ── */}
                  <EditorSection
                    title="Header"
                    icon={<Ruler className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.header}
                    onToggle={() => toggle("header")}
                  >
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Header Headline</span>
                      <textarea
                        value={headerCfg.titleText}
                        onChange={(e) => setHeaderCfg((p) => ({ ...p, titleText: e.target.value }))}
                        placeholder={`Dandy x ${dsoName || "Your DSO"}\n90-Day Pilot`}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Use {"{dso}"} for DSO name. Leave empty for default.</p>
                    </div>
                    <SliderRow label="Header Height" value={headerCfg.height} min={160} max={400} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, height: v }))} />
                    <SliderRow label="Split Ratio (left %)" value={headerCfg.splitRatio} min={30} max={70} unit="%" onChange={(v) => setHeaderCfg((p) => ({ ...p, splitRatio: v }))} />
                    <SliderRow label="Title Font Size" value={headerCfg.titleFontSize} min={14} max={40} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, titleFontSize: v }))} />
                    <SliderRow label="Subtitle Font Size" value={headerCfg.subtitleFontSize} min={8} max={18} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, subtitleFontSize: v }))} />
                    <SliderRow label="Partner Logo Scale" value={headerCfg.partnerLogoScale} min={30} max={300} unit="%" onChange={(v) => setHeaderCfg((p) => ({ ...p, partnerLogoScale: v }))} />
                    <SliderRow label="Partner Logo X" value={headerCfg.partnerLogoOffsetX} min={-80} max={80} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, partnerLogoOffsetX: v }))} />
                    <SliderRow label="Partner Logo Y" value={headerCfg.partnerLogoOffsetY} min={-40} max={40} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, partnerLogoOffsetY: v }))} />
                    <SliderRow label="Subtitle Offset Y" value={headerCfg.subtitleOffsetY} min={-60} max={60} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, subtitleOffsetY: v }))} />
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Header Image</span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input ref={headerImgInputRef} type="file" accept="image/*" onChange={handleHeaderImageUpload} className="hidden" />
                        <button
                          onClick={() => headerImgInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          {headerCfg.headerImage ? "Change Image" : "Upload Custom"}
                        </button>
                        {headerCfg.headerImage && (
                          <button
                            onClick={() => setHeaderCfg((p) => ({ ...p, headerImage: null }))}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Image Crop Position</span>
                      <div className="flex gap-1.5 mt-1.5">
                        {(["top", "center", "bottom"] as const).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => setHeaderCfg((p) => ({ ...p, imageCropAnchor: pos }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${headerCfg.imageCropAnchor === pos ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:text-foreground"}`}
                          >
                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </EditorSection>

                  {/* ── BODY & FEATURES ── */}
                  <EditorSection
                    title="Body & Features"
                    icon={<Type className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.body}
                    onToggle={() => toggle("body")}
                  >
                    <div className="space-y-1.5 mb-3">
                      <label className="text-xs font-medium text-muted-foreground">Middle Section Headline</label>
                      <textarea
                        value={bodyCfg.headlineText}
                        onChange={(e) => setBodyCfg((p) => ({ ...p, headlineText: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        rows={2}
                        placeholder="Experience the world's most advanced dental lab..."
                      />
                    </div>
                    <SliderRow label="Headline Font Size" value={bodyCfg.headlineFontSize} min={10} max={24} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, headlineFontSize: v }))} />
                    <SliderRow label="Intro Text Font Size" value={bodyCfg.introFontSize} min={7} max={14} step={0.5} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, introFontSize: v }))} />
                    <SliderRow label="Feature Title Size" value={bodyCfg.featureTitleFontSize} min={7} max={16} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, featureTitleFontSize: v }))} />
                    <SliderRow label="Feature Desc Size" value={bodyCfg.featureDescFontSize} min={6} max={14} step={0.5} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, featureDescFontSize: v }))} />
                    <SliderRow label="Content Offset (L/R)" value={bodyCfg.contentOffsetX} min={-80} max={80} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, contentOffsetX: v }))} />
                    <SliderRow label="Bullet Section Offset X" value={bodyCfg.bulletOffsetX} min={-80} max={80} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, bulletOffsetX: v }))} />
                    <SliderRow label="Bullet Section Offset Y" value={bodyCfg.bulletOffsetY} min={-80} max={80} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, bulletOffsetY: v }))} />
                    <SliderRow label="Section Spacing" value={bodyCfg.sectionSpacing} min={0} max={60} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, sectionSpacing: v }))} />
                    {audience === "practice-manager" && (
                      <>
                        <SliderRow label="Checklist Font Size" value={bodyCfg.checklistFontSize} min={6} max={16} step={0.5} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, checklistFontSize: v }))} />
                        <SliderRow label="Checklist Item Spacing" value={bodyCfg.checklistSpacing} min={2} max={30} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, checklistSpacing: v }))} />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={bodyCfg.checklistShowDividers}
                            onChange={(e) => setBodyCfg((p) => ({ ...p, checklistShowDividers: e.target.checked }))}
                            className="rounded border-border"
                          />
                          <span className="text-xs text-muted-foreground">Show divider lines between checklist items</span>
                        </div>
                        {bodyCfg.checklistShowDividers && (
                          <>
                            <SliderRow label="Divider Offset X" value={bodyCfg.dividerOffsetX} min={-80} max={80} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, dividerOffsetX: v }))} />
                            <SliderRow label="Divider Offset Y" value={bodyCfg.dividerOffsetY} min={-20} max={20} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, dividerOffsetY: v }))} />
                            <SliderRow label="Divider Length Adjust" value={bodyCfg.dividerLength} min={-100} max={100} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, dividerLength: v }))} />
                          </>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={bodyCfg.showIntro}
                        onChange={(e) => setBodyCfg((p) => ({ ...p, showIntro: e.target.checked }))}
                        className="rounded border-border"
                      />
                      <span className="text-xs text-muted-foreground">Show intro text</span>
                    </div>
                  </EditorSection>

                  {/* ── CONTENT EDITING ── */}
                  <EditorSection
                    title="Content"
                    icon={<Palette className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.content}
                    onToggle={() => toggle("content")}
                  >
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                        Subtitle ({subtitle.length}/80)
                      </label>
                      <input
                        type="text"
                        maxLength={80}
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    {introText !== undefined && (
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                          Intro Text ({introText.length}/250)
                        </label>
                        <textarea
                          value={introText}
                          maxLength={250}
                          onChange={(e) => setIntroText(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Features</label>
                      {features.map((feat, i) => (
                        <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                          <input type="text" maxLength={35} value={feat.title} onChange={(e) => updateFeature(i, "title", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Title" />
                          <input type="text" maxLength={150} value={feat.description} onChange={(e) => updateFeature(i, "description", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Description" />
                        </div>
                      ))}
                    </div>
                    {audience === "practice-manager" && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Checklist Items</label>
                        {checklist.map((item, i) => (
                          <input key={i} type="text" value={item} onChange={(e) => setChecklist((prev) => prev.map((c, j) => (j === i ? e.target.value : c)))} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                        ))}
                      </div>
                    )}
                  </EditorSection>
                </>
              )}

              {/* ══════ EVOLUTION PANELS ══════ */}
              {editorTemplate === "comparison" && (
                <>
                  <EditorSection
                    title="Header"
                    icon={<Ruler className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.header}
                    onToggle={() => toggle("header")}
                  >
                    <SliderRow label="Header Height" value={headerCfg.height} min={120} max={300} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, height: v }))} />
                    <SliderRow label="Split Ratio (left %)" value={headerCfg.splitRatio} min={30} max={70} unit="%" onChange={(v) => setHeaderCfg((p) => ({ ...p, splitRatio: v }))} />
                    <SliderRow label="Title Font Size" value={headerCfg.titleFontSize} min={12} max={32} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, titleFontSize: v }))} />
                    <SliderRow label="Subtitle Font Size" value={headerCfg.subtitleFontSize} min={7} max={14} step={0.5} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, subtitleFontSize: v }))} />
                    <SliderRow label="Subtitle Offset Y" value={headerCfg.subtitleOffsetY} min={-40} max={40} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, subtitleOffsetY: v }))} />
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Header Image</span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input ref={headerImgInputRef} type="file" accept="image/*" onChange={handleHeaderImageUpload} className="hidden" />
                        <button onClick={() => headerImgInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all">
                          <ImageIcon className="w-3.5 h-3.5" />
                          {headerCfg.headerImage ? "Change Image" : "Upload Custom"}
                        </button>
                        {headerCfg.headerImage && (
                          <button onClick={() => setHeaderCfg((p) => ({ ...p, headerImage: null }))} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Reset to default</button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Image Crop Position</span>
                      <div className="flex gap-1.5 mt-1.5">
                        {(["top", "center", "bottom"] as const).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => setHeaderCfg((p) => ({ ...p, imageCropAnchor: pos }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${headerCfg.imageCropAnchor === pos ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:text-foreground"}`}
                          >
                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </EditorSection>

                  <EditorSection
                    title="Comparison Table"
                    icon={<Table className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.table}
                    onToggle={() => toggle("table")}
                  >
                    <div className="space-y-3">
                      {comparisonRows.map((row, i) => (
                        <div key={i} className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/20">
                          <input type="text" value={row.capability} onChange={(e) => updateComparisonRow(i, "capability", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Capability" />
                          <input type="text" value={row.then} onChange={(e) => updateComparisonRow(i, "then", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Dandy 2022" />
                          <input type="text" value={row.now} onChange={(e) => updateComparisonRow(i, "now", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Dandy Today" />
                        </div>
                      ))}
                    </div>
                  </EditorSection>

                  <EditorSection
                    title="Stats"
                    icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.stats}
                    onToggle={() => toggle("stats")}
                  >
                    <div className="space-y-3">
                      {stats.map((stat, i) => (
                        <div key={i} className="grid grid-cols-[80px_1fr] gap-2">
                          <input type="text" value={stat.value} onChange={(e) => updateStat(i, "value", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Value" />
                          <input type="text" value={stat.label} onChange={(e) => updateStat(i, "label", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Label" />
                        </div>
                      ))}
                    </div>
                  </EditorSection>
                </>
              )}

              {/* ══════ PARTNER PRACTICES PANELS ══════ */}
              {editorTemplate === "partner" && (
                <>
                  {/* ── HEADER ── */}
                  <EditorSection
                    title="Header"
                    icon={<Ruler className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.header}
                    onToggle={() => toggle("header")}
                  >
                    <SliderRow label="Header Height" value={headerCfg.height} min={180} max={400} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, height: v }))} />
                    <SliderRow label="Split Ratio (left %)" value={headerCfg.splitRatio} min={30} max={70} unit="%" onChange={(v) => setHeaderCfg((p) => ({ ...p, splitRatio: v }))} />
                    <SliderRow label="Title Font Size" value={headerCfg.titleFontSize} min={16} max={42} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, titleFontSize: v }))} />
                    <SliderRow label="Subtitle Font Size" value={headerCfg.subtitleFontSize} min={8} max={24} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, subtitleFontSize: v }))} />
                    <SliderRow label="Title Offset Y" value={headerCfg.subtitleOffsetY} min={-60} max={60} unit="pt" onChange={(v) => setHeaderCfg((p) => ({ ...p, subtitleOffsetY: v }))} />
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Header Image</span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <input ref={headerImgInputRef} type="file" accept="image/*" onChange={handleHeaderImageUpload} className="hidden" />
                        <button onClick={() => headerImgInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all">
                          <ImageIcon className="w-3.5 h-3.5" />
                          {headerCfg.headerImage ? "Change Image" : "Upload Custom"}
                        </button>
                        {headerCfg.headerImage && (
                          <button onClick={() => setHeaderCfg((p) => ({ ...p, headerImage: null }))} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Reset to default</button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground">Image Crop Position</span>
                      <div className="flex gap-1.5 mt-1.5">
                        {(["top", "center", "bottom"] as const).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => setHeaderCfg((p) => ({ ...p, imageCropAnchor: pos }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${headerCfg.imageCropAnchor === pos ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:text-foreground"}`}
                          >
                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </EditorSection>

                  {/* ── BODY & FEATURES ── */}
                  <EditorSection
                    title="Body & Features"
                    icon={<Type className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.body}
                    onToggle={() => toggle("body")}
                  >
                    <SliderRow label="Headline Font Size" value={bodyCfg.headlineFontSize} min={10} max={28} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, headlineFontSize: v }))} />
                    <SliderRow label="Intro Text Font Size" value={bodyCfg.introFontSize} min={7} max={14} step={0.5} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, introFontSize: v }))} />
                    <SliderRow label="Feature Title Size" value={bodyCfg.featureTitleFontSize} min={7} max={16} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, featureTitleFontSize: v }))} />
                    <SliderRow label="Feature Desc Size" value={bodyCfg.featureDescFontSize} min={6} max={14} step={0.5} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, featureDescFontSize: v }))} />
                    <SliderRow label="Content Offset (L/R)" value={bodyCfg.contentOffsetX} min={-80} max={80} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, contentOffsetX: v }))} />
                    <SliderRow label="Section Spacing" value={bodyCfg.sectionSpacing} min={0} max={60} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, sectionSpacing: v }))} />
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={bodyCfg.showIntro} onChange={(e) => setBodyCfg((p) => ({ ...p, showIntro: e.target.checked }))} className="rounded border-border" />
                      <span className="text-xs text-muted-foreground">Show intro paragraph</span>
                    </div>
                  </EditorSection>

                  {/* ── CONTENT ── */}
                  <EditorSection
                    title="Content"
                    icon={<Palette className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.content}
                    onToggle={() => toggle("content")}
                  >
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                        Headline ({partnerHeadline.length}/60)
                      </label>
                      <input type="text" maxLength={60} value={partnerHeadline} onChange={(e) => setPartnerHeadline(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                        Intro Paragraph ({partnerIntro.length}/300) <span className="font-normal opacity-60">Use {"{dso}"} for DSO name</span>
                      </label>
                      <textarea value={partnerIntro} maxLength={300} onChange={(e) => setPartnerIntro(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Feature Cards</label>
                      {partnerFeatures.map((feat, i) => (
                        <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                          <input type="text" maxLength={40} value={feat.title} onChange={(e) => setPartnerFeatures(prev => prev.map((f, j) => j === i ? { ...f, title: e.target.value } : f))} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Title" />
                          <input type="text" maxLength={150} value={feat.desc} onChange={(e) => setPartnerFeatures(prev => prev.map((f, j) => j === i ? { ...f, desc: e.target.value } : f))} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Description (leave blank for QR card)" />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">QR Code URL</label>
                      <input type="url" value={partnerQrUrl} onChange={(e) => setPartnerQrUrl(e.target.value)} placeholder="https://meetdandy.com" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>
                  </EditorSection>

                  {/* ── STATS ── */}
                  <EditorSection
                    title="Stats"
                    icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.stats}
                    onToggle={() => toggle("stats")}
                  >
                    <SliderRow label="Stat Number Size" value={bodyCfg.statValueFontSize} min={14} max={48} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, statValueFontSize: v }))} />
                    <SliderRow label="Stat Description Size" value={bodyCfg.statDescFontSize} min={5} max={16} step={0.5} unit="pt" onChange={(v) => setBodyCfg((p) => ({ ...p, statDescFontSize: v }))} />
                    <div className="space-y-3">
                      {partnerStats.map((stat, i) => (
                        <div key={i} className="grid grid-cols-[80px_1fr] gap-2">
                          <input type="text" value={stat.value} onChange={(e) => setPartnerStats(prev => prev.map((s, j) => j === i ? { ...s, value: e.target.value } : s))} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="88%" />
                          <input type="text" value={stat.desc} onChange={(e) => setPartnerStats(prev => prev.map((s, j) => j === i ? { ...s, desc: e.target.value } : s))} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Description" />
                        </div>
                      ))}
                    </div>
                  </EditorSection>
                </>
              )}

              {/* ══════ ROI PANEL ══════ */}
              {editorTemplate === "roi" && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="text-sm text-muted-foreground">
                    The ROI Brief is a 2-page document automatically calculated from the number of practices.
                    Adjust the DSO name and practice count above to customize the output.
                  </p>
                </div>
              )}

              {/* ══════ SHARED: TEAM & FOOTER (pilot + comparison) ══════ */}
              {(editorTemplate === "pilot" || editorTemplate === "comparison" || editorTemplate === "partner") && (
                <>
                  <EditorSection
                    title="Team & Contact"
                    icon={<Users className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.team}
                    onToggle={() => toggle("team")}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" checked={teamCfg.show} onChange={(e) => setTeamCfg((p) => ({ ...p, show: e.target.checked }))} className="rounded border-border" />
                      <span className="text-xs text-muted-foreground">Show team section</span>
                    </div>
                    {teamCfg.show && (
                      <>
                        <SliderRow label="Heading Font Size" value={teamCfg.headingFontSize} min={9} max={20} unit="pt" onChange={(v) => setTeamCfg((p) => ({ ...p, headingFontSize: v }))} />
                        <SliderRow label="Name Font Size" value={teamCfg.nameFontSize} min={7} max={16} unit="pt" onChange={(v) => setTeamCfg((p) => ({ ...p, nameFontSize: v }))} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {teamContacts.map((contact, i) => (
                            <div key={i} className="flex flex-col gap-1.5">
                              <input type="text" placeholder={`Contact ${i + 1} name`} value={contact.name} onChange={(e) => updateContact(i, "name", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                              <input type="text" placeholder="Title" value={contact.title} onChange={(e) => updateContact(i, "title", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                              <input type="text" placeholder="Email or phone" value={contact.contactInfo} onChange={(e) => updateContact(i, "contactInfo", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                            </div>
                          ))}
                        </div>
                        <input type="text" placeholder="Phone number (optional)" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                      </>
                    )}
                  </EditorSection>

                  <EditorSection
                    title="Footer"
                    icon={<Link className="w-4 h-4 text-muted-foreground" />}
                    open={openSections.footer}
                    onToggle={() => toggle("footer")}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" checked={footerCfg.show} onChange={(e) => setFooterCfg((p) => ({ ...p, show: e.target.checked }))} className="rounded border-border" />
                      <span className="text-xs text-muted-foreground">Show footer bar</span>
                    </div>
                    {footerCfg.show && (
                      <>
                        <SliderRow label="Footer Height" value={footerCfg.height} min={20} max={80} unit="pt" onChange={(v) => setFooterCfg((p) => ({ ...p, height: v }))} />
                        <SliderRow label="Footer Font Size" value={footerCfg.fontSize} min={6} max={16} unit="pt" onChange={(v) => setFooterCfg((p) => ({ ...p, fontSize: v }))} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input type="text" placeholder="Link text (e.g. View Product Guide)" value={customLinkText} onChange={(e) => setCustomLinkText(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                          <input type="url" placeholder="https://example.com" value={customLinkUrl} onChange={(e) => setCustomLinkUrl(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                        </div>
                      </>
                    )}
                  </EditorSection>
                </>
              )}
            </div>

            {/* GENERATE BUTTON */}
            <button
              onClick={handleGenerate}
              disabled={(!dsoName.trim() && editorTemplate !== "roi") || generating}
              className="w-full rounded-full bg-primary py-3.5 text-sm font-bold uppercase tracking-widest text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Generate & Download PDF
            </button>
          </div>

          {/* ── RIGHT: Live PDF Preview ── */}
          {previewVisible && (
            <div className="w-full lg:w-1/2 xl:w-[55%] lg:sticky lg:top-[72px] lg:self-start">
              <div className="rounded-xl border border-border bg-muted/30 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5" />
                    Live Preview — {templateLabels[editorTemplate]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Updates automatically</span>
                </div>
                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="w-full bg-muted/20"
                    style={{ height: "calc(100vh - 160px)", minHeight: "600px" }}
                    title="PDF Preview"
                  />
                ) : (
                  <div
                    className="flex items-center justify-center text-muted-foreground text-sm"
                    style={{ height: "calc(100vh - 160px)", minHeight: "600px" }}
                  >
                    <div className="text-center space-y-2">
                      <Eye className="w-8 h-8 mx-auto opacity-30" />
                      <p>Preview will appear here</p>
                      <p className="text-xs opacity-60">Adjust any setting to see the PDF update live</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DSOPilotEditor;
