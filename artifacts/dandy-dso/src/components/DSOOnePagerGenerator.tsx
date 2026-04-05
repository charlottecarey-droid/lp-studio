import { useState, useRef, useMemo, useEffect } from "react";
import { loadLayoutDefault, clearLayoutDefault } from "@/lib/layout-defaults";
import { type CustomTemplate, type OverlayField, TEMPLATE_VISIBILITY_KEY } from "@/components/template-types";
import {
  type Audience,
  type TeamContact,
  type AudienceContent,
  type NewPartnerContent,
  generatePilotOnePager as sharedGeneratePilotOnePager,
  generateComparisonOnePager as sharedGenerateComparisonOnePager,
  generateNewPartnerOnePager as sharedGenerateNewPartnerOnePager,
  generateROIOnePager as sharedGenerateROIOnePager,
} from "@workspace/one-pager-types/generators";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { FileDown, Loader2, ChevronUp, ChevronDown, Upload, X, Pencil, AlertTriangle, Link, RotateCcw, QrCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { registerCustomFonts, getPdfFontFamily } from "@/lib/pdf-fonts";
import headerImgExecutive from "@/assets/ai-scan-review-news.jpg";
import headerImgClinical from "@/assets/ai-scan-review-clinical.png";
import headerImgPracticeManager from "@/assets/dandy-dso-enterprise-data.webp";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import greenCheckboxIcon from "@/assets/green-checkbox.png";

const svgToPng = (svgSrc: string, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width * 2, height * 2);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = svgSrc;
  });
};

const loadImageAsBase64 = (src: string, format: "image/jpeg" | "image/png" = "image/jpeg"): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL(format));
    };
    img.onerror = reject;
    img.src = src;
  });
};

// =============================================
// DSO AUDIENCE CONTENT (with DSO-specific header image assets)
// =============================================

type DSOAudienceContent = AudienceContent & { headerImage: string };

const defaultAudienceContent: Record<Audience, DSOAudienceContent> = {
  executive: {
    subtitle: "Achieve quality, consistency, and control at scale.",
    headerImage: headerImgExecutive,
    introText: "What to expect during this pilot: Over the next 90 days, we'll partner with your organization to onboard clinicians efficiently, support adoption of digital workflows, and ensure cases run smoothly in practice.",
    features: [
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your practices up to speed fast with free onboarding." },
      { icon: "💬", title: "Clinical collaboration", description: "Live Chat and Live Scan Review connect clinicians directly with our team of lab technicians in real time." },
      { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "📊", title: "Dandy Insights", description: "Dandy surfaces aggregate, pilot-level insights including scanner utilization, workflow adoption, and quality signals." },
      { icon: "📋", title: "Case management simplified", description: "Access the Dandy Portal to track, manage, and review active orders and our dashboard to streamline invoicing." },
      { icon: "💰", title: "Exclusive pricing for your organization", description: "Contact the team below to access a product guide with approved pricing." },
    ],
  },
  clinical: {
    subtitle: "Fully embrace digital dentistry with smarter technology and seamless workflows.",
    headerImage: headerImgClinical,
    features: [
      { icon: "💬", title: "Clinical collaboration", description: "Clinicians and staff can speak with our team of clinical experts in just 60 seconds or collaborate on complex cases virtually." },
      { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "🦷", title: "2-Appointment Dentures", description: "Utilize seamless digital workflows like 2-Appointment Dentures to save chair time and create a better patient experience." },
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. Get up to speed fast with free onboarding and unlimited access to ongoing digital CPD credit education." },
    ],
  },
  "practice-manager": {
    subtitle: "Reduce operational friction and administrative burden with Dandy.",
    headerImage: headerImgPracticeManager,
    checklist: [
      "Attend an in-person or virtual onboarding session",
      "Use the Dandy Portal to track, manage, and review orders",
      "Access Dandy Insights to get an overview of pilot performance",
      "Check in with clinicians to gather high-level feedback",
    ],
    features: [
      { icon: "💰", title: "Invoicing made easy", description: "Our dashboard makes invoicing a simple and efficient process." },
      { icon: "📊", title: "Get insights in Practice Portal", description: "Gain visibility into order delivery dates, seamless communicate with the lab, scanner, manage payment, and more." },
      { icon: "💬", title: "Real-time lab communication", description: "Our team of clinical experts handle lab communication including live collaboration, fielding questions, and issue resolution." },
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your teams up to speed fast with free onboarding and CPD training." },
    ],
  },
};

// =============================================
// DSO PDF GENERATOR WRAPPERS
// These pre-load DSO-specific assets and call the shared generators.
// =============================================

export const generatePilotOnePager = async (
  dsoName: string,
  audience: Audience,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  editedContent: DSOAudienceContent | undefined,
  customLinkText?: string,
  customLinkUrl?: string,
) => {
  const content = editedContent ?? defaultAudienceContent[audience];
  const layoutOverrides = await loadLayoutDefault('dandy_pilot_template_layout').catch(() => null) ?? {};
  const hCfg = (layoutOverrides.headerCfg ?? {}) as { headerImage?: string };

  let logoPng: string | null = null;
  let headerImgData: string | null = null;
  let checkboxImgData: string | null = null;
  try {
    if (hCfg.headerImage) {
      [logoPng, checkboxImgData] = await Promise.all([
        svgToPng(dandyLogoWhite, 206, 74),
        loadImageAsBase64(greenCheckboxIcon, 'image/png'),
      ]);
      headerImgData = hCfg.headerImage;
    } else {
      [headerImgData, logoPng, checkboxImgData] = await Promise.all([
        loadImageAsBase64(content.headerImage),
        svgToPng(dandyLogoWhite, 206, 74),
        loadImageAsBase64(greenCheckboxIcon, 'image/png'),
      ]);
    }
  } catch { /* continue without assets */ }

  return sharedGeneratePilotOnePager(
    dsoName, audience, teamContacts, phoneNumber,
    prospectLogoData, prospectLogoDims, content,
    customLinkText, customLinkUrl,
    { logoPng, headerImgData, checkboxImgData, layoutOverrides },
  );
};

export const generateComparisonOnePager = async (
  dsoName: string,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  customLinkText?: string,
  customLinkUrl?: string,
) => {
  const layoutOverrides = await loadLayoutDefault('dandy_comparison_template_layout').catch(() => null) ?? {};
  const hCfg = (layoutOverrides.headerCfg ?? {}) as { headerImage?: string };

  let logoPng: string | null = null;
  let headerImgData: string | null = null;
  try {
    if (hCfg.headerImage) {
      logoPng = await svgToPng(dandyLogoWhite, 206, 74);
      headerImgData = hCfg.headerImage;
    } else {
      [logoPng, headerImgData] = await Promise.all([
        svgToPng(dandyLogoWhite, 206, 74),
        loadImageAsBase64(headerImgClinical),
      ]);
    }
  } catch { /* continue without assets */ }

  return sharedGenerateComparisonOnePager(
    dsoName, teamContacts, phoneNumber,
    prospectLogoData, prospectLogoDims,
    customLinkText, customLinkUrl,
    { logoPng, headerImgData, layoutOverrides },
  );
};

export const generateNewPartnerOnePager = async (
  dsoName: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  qrUrl: string,
) => {
  const saved = await loadLayoutDefault('dandy_partner_template_layout').catch(() => null) ?? {};
  const hCfg = (saved.headerCfg ?? {}) as { headerImage?: string };

  let logoPng: string | null = null;
  let headerImgData: string | null = null;
  try {
    if (hCfg.headerImage) {
      logoPng = await svgToPng(dandyLogoWhite, 206, 74);
      headerImgData = hCfg.headerImage;
    } else {
      [logoPng, headerImgData] = await Promise.all([
        svgToPng(dandyLogoWhite, 206, 74),
        loadImageAsBase64(headerImgClinical),
      ]);
    }
  } catch { /* continue without assets */ }

  const content: NewPartnerContent = {
    headline: saved.partnerHeadline as string | undefined,
    intro: saved.partnerIntro as string | undefined,
    features: saved.partnerFeatures as Array<{ title: string; desc: string }> | undefined,
    stats: saved.partnerStats as Array<{ value: string; desc: string }> | undefined,
    footerLink: (saved.footerCfg as { link?: string } | undefined)?.link,
  };

  const newPartnerOpts = { logoPng, headerImgData, content, layoutOverrides: saved };
  return sharedGenerateNewPartnerOnePager(
    dsoName, prospectLogoData, prospectLogoDims, qrUrl,
    {},
    newPartnerOpts,
  );
};

export const generateROIOnePager = async (dsoName: string, numPractices: number) => {
  const layoutOverrides = await loadLayoutDefault('dandy_roi_template_layout').catch(() => null) ?? {};
  const hCfg = (layoutOverrides.headerCfg ?? {}) as { headerImage?: string };

  let logoPng: string | null = null;
  let headerImgData: string | null = null;
  try {
    if (hCfg.headerImage) {
      logoPng = await svgToPng(dandyLogoWhite, 206, 74);
      headerImgData = hCfg.headerImage;
    } else {
      [headerImgData, logoPng] = await Promise.all([
        loadImageAsBase64(headerImgExecutive),
        svgToPng(dandyLogoWhite, 206, 74),
      ]);
    }
  } catch { /* continue without assets */ }

  return sharedGenerateROIOnePager(dsoName, numPractices, { logoPng, headerImgData, layoutOverrides });
};

// =============================================
// COMPONENT
// =============================================

type Template = "roi" | "pilot" | "comparison" | "new-partner" | "partner2" | "custom";

const DSOOnePagerGenerator = () => {
  const [dsoName, setDsoName] = useState("");
  const [numPractices, setNumPractices] = useState(100);
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState<Template>("roi");
  const [audience, setAudience] = useState<Audience>("executive");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customTemplates, setCustomTemplates] = useState<(CustomTemplate & { id: string })[]>([]);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [teamContacts, setTeamContacts] = useState<TeamContact[]>([
    { name: "", title: "", contactInfo: "" },
    { name: "", title: "", contactInfo: "" },
    { name: "", title: "", contactInfo: "" },
  ]);
  const [showTeam, setShowTeam] = useState(false);
  const [showEditContent, setShowEditContent] = useState(false);
  const [customLinkText, setCustomLinkText] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");
  const [pilotLayoutSaved, setPilotLayoutSaved] = useState(false);
  const [comparisonLayoutSaved, setComparisonLayoutSaved] = useState(false);
  const [qrFieldValues, setQrFieldValues] = useState<Record<string, string>>({});
  const [logoFieldValues, setLogoFieldValues] = useState<Record<string, string>>({});
  const logoFieldRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Template visibility from management — null until loaded from DB
  const [templateVisibility, setTemplateVisibility] = useState<Record<string, boolean> | null>(null);
  const defaultVisibility: Record<string, boolean> = {
    roi: true, pilot: true, comparison: true, "new-partner": false, partner2: true,
  };
  const [deletedBuiltins, setDeletedBuiltins] = useState<Record<string, boolean>>({});

  // Check if saved layouts exist on mount + load visibility
  useEffect(() => {
    const checkSaved = async () => {
      const pilot = await loadLayoutDefault("dandy_pilot_template_layout");
      setPilotLayoutSaved(!!pilot);
      const comparison = await loadLayoutDefault("dandy_comparison_template_layout");
      setComparisonLayoutSaved(!!comparison);
      const vis = await loadLayoutDefault(TEMPLATE_VISIBILITY_KEY);
      setTemplateVisibility({ ...defaultVisibility, ...(vis || {}) });
      const deleted = await loadLayoutDefault("deleted_builtin_templates");
      if (deleted) setDeletedBuiltins(deleted);
    };
    checkSaved();
  }, []);

  // Fetch custom templates
  useEffect(() => {
    const fetchCustom = async () => {
      const { data } = await supabase.from("custom_templates").select("*").order("created_at", { ascending: false });
      if (data) setCustomTemplates(data.map((t: Record<string, unknown>) => ({ ...t, fields: (t.fields || []) as unknown as OverlayField[], headerHeight: (t.header_height as number | undefined) ?? 30, headerImageUrl: (t.header_image_url as string | undefined) || undefined })));
    };
    fetchCustom();
  }, []);

  // Logo upload
  const [prospectLogoData, setProspectLogoData] = useState<string | null>(null);
  const [prospectLogoName, setProspectLogoName] = useState<string>("");
  const [prospectLogoDims, setProspectLogoDims] = useState<{ w: number; h: number }>({ w: 200, h: 100 });
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Editable content per audience
  const [editedContent, setEditedContent] = useState<Record<Audience, typeof defaultAudienceContent[Audience]>>(
    JSON.parse(JSON.stringify(defaultAudienceContent))
  );

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProspectLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setProspectLogoDims({ w: img.naturalWidth, h: img.naturalHeight });
        setProspectLogoData(dataUrl);
      };
      img.onerror = () => setProspectLogoData(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setProspectLogoData(null);
    setProspectLogoName("");
    setProspectLogoDims({ w: 200, h: 100 });
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const logoWarnings = useMemo(() => {
    if (!prospectLogoData) return [];
    const warnings: string[] = [];
    const { w, h } = prospectLogoDims;
    if (w < 200 || h < 80) warnings.push(`Image is too small (${w}×${h}px). Min recommended: 200×80px — may appear blurry.`);
    if (w > 800 || h > 400) warnings.push(`Image is very large (${w}×${h}px). Max recommended: 800×400px — may slow PDF generation.`);
    if (h > w) warnings.push("Portrait/vertical logos may not render well. Horizontal/landscape logos work best.");
    if (w / h > 6) warnings.push("Logo is extremely wide. It may be cropped or shrunk significantly to fit.");
    return warnings;
  }, [prospectLogoData, prospectLogoDims]);

  const updateContact = (idx: number, field: keyof TeamContact, value: string) => {
    setTeamContacts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const updateFeature = (audienceKey: Audience, featureIdx: number, field: "title" | "description", value: string) => {
    setEditedContent(prev => {
      const updated = { ...prev };
      updated[audienceKey] = { ...updated[audienceKey], features: [...updated[audienceKey].features] };
      updated[audienceKey].features[featureIdx] = { ...updated[audienceKey].features[featureIdx], [field]: value };
      return updated;
    });
  };

  const updateSubtitle = (audienceKey: Audience, value: string) => {
    setEditedContent(prev => ({
      ...prev,
      [audienceKey]: { ...prev[audienceKey], subtitle: value },
    }));
  };

  const updateIntroText = (audienceKey: Audience, value: string) => {
    setEditedContent(prev => ({
      ...prev,
      [audienceKey]: { ...prev[audienceKey], introText: value },
    }));
  };

  const generateCustomPdf = async (tpl: CustomTemplate) => {
    const doc = new jsPDF({ orientation: tpl.orientation === "landscape" ? "landscape" : "portrait", unit: "pt", format: "letter" });
    await registerCustomFonts(doc);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    // Draw background
    const isPreset = tpl.background_url.startsWith("preset:");
    if (isPreset) {
      const DARK_GREEN: [number, number, number] = [0, 40, 32];
      const MID_GREEN: [number, number, number] = [20, 50, 40];
      const headerH = h * ((tpl.headerHeight || 30) / 100);
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, w, h, "F");
      if (tpl.background_url === "preset:green-header") {
        doc.setFillColor(...DARK_GREEN);
        doc.rect(0, 0, w, headerH, "F");
      } else if (tpl.background_url === "preset:green-header-image") {
        const splitX = w * 0.48;
        doc.setFillColor(...DARK_GREEN);
        doc.rect(0, 0, splitX, headerH, "F");
        if (tpl.headerImageUrl) {
          try {
            const hdrImg = await loadImageAsBase64(tpl.headerImageUrl);
            doc.addImage(hdrImg, "JPEG", splitX, 0, w - splitX, headerH);
          } catch {
            doc.setFillColor(...MID_GREEN);
            doc.rect(splitX, 0, w - splitX, headerH, "F");
          }
        } else {
          doc.setFillColor(...MID_GREEN);
          doc.rect(splitX, 0, w - splitX, headerH, "F");
        }
      }
    } else {
      try {
        const imgData = await loadImageAsBase64(tpl.background_url);
        doc.addImage(imgData, "JPEG", 0, 0, w, h);
      } catch {
        doc.setFillColor(240, 240, 240);
        doc.rect(0, 0, w, h, "F");
      }
    }
    for (const field of tpl.fields) {
      if (field.type === "qr_code") {
        const url = qrFieldValues[field.id] || field.defaultValue || "https://meetdandy.com";
        try {
          const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 1 });
          const qrSizePt = w * ((field.qrSize || 15) / 100);
          doc.addImage(qrDataUrl, "PNG", w * (field.x / 100), h * (field.y / 100), qrSizePt, qrSizePt);
        } catch { /* skip invalid QR */ }
        continue;
      }
      if (field.type === "dandy_logo") {
        try {
          const dandyPng = await svgToPng(dandyLogoWhite, 206, 74);
          const scale = field.logoScale || 11.4;
          const lw = w * (scale / 100);
          const lh = lw * (74 / 206);
          doc.addImage(dandyPng, "PNG", w * (field.x / 100), h * (field.y / 100), lw, lh);
        } catch {
          doc.setFont("helvetica", "bold"); doc.setFontSize(field.fontSize || 18);
          const hex = field.color || "#FFFFFF";
          const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
          doc.setTextColor(r, g, b);
          doc.text("dandy", w * (field.x / 100), h * (field.y / 100) + (field.fontSize || 18));
        }
        continue;
      }
      if (field.type === "logo") {
        const logoSrc = logoFieldValues[field.id] || field.logoUrl;
        if (logoSrc) {
          try {
            const logoData = await loadImageAsBase64(logoSrc, "image/png");
            const scale = field.logoScale || field.logoWidth || 15;
            const lw = w * (scale / 100);
            const imgEl = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = logoSrc; });
            const lh = lw * (imgEl.naturalHeight / imgEl.naturalWidth);
            doc.addImage(logoData, "PNG", w * (field.x / 100), h * (field.y / 100), lw, lh);
          } catch { /* skip */ }
        } else if (dsoName.trim()) {
          // No logo uploaded — render DSO name as fallback text
          const fontStyle = field.bold && field.italic ? "bolditalic" : field.bold ? "bold" : field.italic ? "italic" : "normal";
          doc.setFont(getPdfFontFamily(field.fontFamily || "helvetica"), fontStyle);
          doc.setFontSize(field.fontSize || 12);
          const hex = field.color || "#000000";
          const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
          doc.setTextColor(r, g, b);
          doc.text(dsoName.trim(), w * (field.x / 100), h * (field.y / 100) + (field.fontSize || 12));
        }
        continue;
      }
      let text = field.type === "dso_name" ? dsoName.trim() : field.type === "phone" ? phoneNumber : (field.defaultValue || field.label);
      if (field.type === "dso_name") {
        text = `${field.prefix || ""}${text}${field.suffix || ""}`;
      }
      const fontStyle = field.bold && field.italic ? "bolditalic" : field.bold ? "bold" : field.italic ? "italic" : "normal";
      doc.setFont(getPdfFontFamily(field.fontFamily), fontStyle);
      doc.setFontSize(field.fontSize);
      const hex = field.color;
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      doc.setTextColor(r, g, b);
      doc.text(text, w * (field.x / 100), h * (field.y / 100));
    }
    doc.save(`${tpl.name.replace(/\s+/g, "_")}_${dsoName.trim().replace(/\s+/g, "_")}.pdf`);
  };

  const handleGenerate = async () => {
    if (!dsoName.trim()) return;
    setGenerating(true);
    try {
      if (template === "custom" && selectedCustomId) {
        const tpl = customTemplates.find(t => t.id === selectedCustomId);
        if (tpl) await generateCustomPdf(tpl);
      } else if (template === "pilot") {
        const doc = await generatePilotOnePager(dsoName.trim(), audience, teamContacts, phoneNumber, prospectLogoData, prospectLogoDims, editedContent[audience], customLinkText, customLinkUrl);
        doc.save(`Dandy_x_${dsoName.trim().replace(/\s+/g, "_")}_90Day_Pilot.pdf`);
      } else if (template === "comparison") {
        const doc = await generateComparisonOnePager(dsoName.trim(), teamContacts, phoneNumber, prospectLogoData, prospectLogoDims, customLinkText, customLinkUrl);
        doc.save(`Dandy_Evolution_${dsoName.trim().replace(/\s+/g, "_")}.pdf`);
      } else if (template === "new-partner") {
        const doc = await generateNewPartnerOnePager(dsoName.trim(), prospectLogoData, prospectLogoDims, customLinkUrl || "https://meetdandy.com");
        doc.save(`Dandy_x_${dsoName.trim().replace(/\s+/g, "_")}_New_Partner.pdf`);
      } else if (template === "partner2") {
        const doc = await generateNewPartnerOnePager(dsoName.trim(), prospectLogoData, prospectLogoDims, customLinkUrl || "https://meetdandy.com");
        doc.save(`Dandy_x_${dsoName.trim().replace(/\s+/g, "_")}_Partner2.pdf`);
      } else {
        const doc = await generateROIOnePager(dsoName.trim(), numPractices);
        doc.save(`Dandy_for_${dsoName.trim().replace(/\s+/g, "_")}.pdf`);
      }
      await supabase.from("pdf_submissions").insert({
        dso_name: dsoName.trim(),
        practice_count: numPractices,
      });
    } finally {
      setGenerating(false);
    }
  };

  const currentContent = editedContent[audience];

  return (
    <section className="py-16 bg-background">
      <div className="max-w-[900px] mx-auto px-6 md:px-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">One-Pager Generator</h2>
          <p className="text-sm text-muted-foreground mt-2">Generate branded PDFs for your prospects. Upload their logo, edit content, and download.</p>
        </div>


        {/* Template + Audience selectors */}
        {!templateVisibility ? (
          <div className="flex justify-center py-4">
            <div className="h-8 w-64 animate-pulse rounded-full bg-muted" />
          </div>
        ) : (
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <div className="inline-flex rounded-full border border-border overflow-hidden flex-wrap">
            {templateVisibility["roi"] !== false && !deletedBuiltins["roi"] && (
              <button
                onClick={() => setTemplate("roi")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "roi" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                ROI One-Pager
              </button>
            )}
            {templateVisibility["new-partner"] && !deletedBuiltins["new-partner"] && (
              <button
                onClick={() => setTemplate("new-partner")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "new-partner" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                Partner Practices
              </button>
            )}
            {templateVisibility["partner2"] !== false && !deletedBuiltins["partner2"] && (
              <button
                onClick={() => setTemplate("partner2")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "partner2" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                Partner 2
              </button>
            )}
            {templateVisibility["comparison"] !== false && !deletedBuiltins["comparison"] && (
              <button
                onClick={() => setTemplate("comparison")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "comparison" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                Dandy Evolution
              </button>
            )}
            {templateVisibility["pilot"] !== false && !deletedBuiltins["pilot"] && (
              <button
                onClick={() => setTemplate("pilot")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "pilot" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                90-Day Pilot
              </button>
            )}
            {customTemplates.filter(tpl => templateVisibility[`custom:${tpl.id}`] !== false).map(tpl => (
              <button
                key={tpl.id}
                onClick={() => { setTemplate("custom"); setSelectedCustomId(tpl.id); }}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${template === "custom" && selectedCustomId === tpl.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
              >
                {tpl.name}
              </button>
            ))}
          </div>

          {template === "pilot" && (
            <div className="inline-flex rounded-full border border-border overflow-hidden">
              {(["executive", "clinical", "practice-manager"] as Audience[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${audience === a ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                >
                  {a === "practice-manager" ? "Practice Mgr" : a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          )}

        </div>
        )}

        {/* Main form */}
        <div className="space-y-6">
          {/* DSO Name + Practices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">DSO Name</label>
              <input
                type="text"
                placeholder="Enter prospect name"
                maxLength={25}
                value={dsoName}
                onChange={(e) => setDsoName(e.target.value.slice(0, 25))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {template === "roi" && (
              <div>
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block"># Practices</label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={numPractices}
                  onChange={(e) => setNumPractices(Math.max(1, Math.min(2000, parseInt(e.target.value) || 1)))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}

            {(template === "new-partner" || template === "partner2") && (
              <div>
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">QR Code URL</label>
                <input
                  type="url"
                  placeholder="https://meetdandy.com"
                  value={customLinkUrl}
                  onChange={(e) => setCustomLinkUrl(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}
          </div>

          {/* QR Code URL inputs for custom templates */}
          {template === "custom" && selectedCustomId && (() => {
            const tpl = customTemplates.find(t => t.id === selectedCustomId);
            const qrFields = tpl?.fields.filter(f => f.type === "qr_code") || [];
            if (qrFields.length === 0) return null;
            return (
              <div className="space-y-3">
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5" /> QR Code Links
                </label>
                {qrFields.map(field => (
                  <div key={field.id}>
                    <label className="text-[10px] text-muted-foreground mb-1 block">{field.label || "QR Code"}</label>
                    <input
                      type="url"
                      placeholder={field.defaultValue || "https://meetdandy.com"}
                      value={qrFieldValues[field.id] || ""}
                      onChange={e => setQrFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Logo uploads for custom templates */}
          {template === "custom" && selectedCustomId && (() => {
            const tpl = customTemplates.find(t => t.id === selectedCustomId);
            const logoFields = tpl?.fields.filter(f => f.type === "logo") || [];
            if (logoFields.length === 0) return null;
            return (
              <div className="space-y-3">
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Partner Logo{logoFields.length > 1 ? "s" : ""}
                </label>
                {logoFields.map(field => (
                  <div key={field.id}>
                    <label className="text-[10px] text-muted-foreground mb-1 block">{field.label || "Logo"}</label>
                    <div className="flex items-center gap-3">
                      <input
                        ref={el => { logoFieldRefs.current[field.id] = el; }}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setLogoFieldValues(prev => ({ ...prev, [field.id]: reader.result as string }));
                          reader.readAsDataURL(file);
                        }}
                      />
                      <button
                        onClick={() => logoFieldRefs.current[field.id]?.click()}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {logoFieldValues[field.id] ? "Change" : "Upload"}
                      </button>
                      {logoFieldValues[field.id] && (
                        <div className="flex items-center gap-2">
                          <img src={logoFieldValues[field.id]} alt="Logo" className="h-8 w-auto max-w-[80px] object-contain rounded border border-border p-0.5" style={{ backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)", backgroundSize: "8px 8px", backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px" }} />
                          <button onClick={() => setLogoFieldValues(prev => { const n = { ...prev }; delete n[field.id]; return n; })} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Logo Upload (pilot & comparison only) */}
          {(template === "pilot" || template === "comparison" || template === "new-partner" || template === "partner2") && (
            <div>
              <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">Prospect Logo (optional)</label>
              <div className="flex items-center gap-3">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {prospectLogoData ? "Change Logo" : "Upload Logo"}
                </button>
                {prospectLogoData && (
                  <div className="flex items-center gap-2">
                    <img src={prospectLogoData} alt="Prospect logo" className="h-8 w-auto max-w-[80px] object-contain rounded border border-border p-0.5" />
                    <span className="text-xs text-muted-foreground">{prospectLogoName}</span>
                    <button onClick={clearLogo} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                PNG or JPG, transparent background recommended. Min 200×80px, max 800×400px. Horizontal/landscape logos work best.
              </p>
              {logoWarnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {logoWarnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-600">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Team & Phone (pilot & comparison) */}
          {(template === "pilot" || template === "comparison") && (
            <div>
              <button
                onClick={() => setShowTeam(!showTeam)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTeam ? "rotate-180" : ""}`} />
                {showTeam ? "Hide" : "Edit"} Team & Phone
              </button>

              {showTeam && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3"
                >
                    {teamContacts.map((contact, i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <input
                        type="text"
                        placeholder={`Contact ${i + 1} name`}
                        value={contact.name}
                        onChange={(e) => updateContact(i, "name", e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <input
                        type="text"
                        placeholder="Title"
                        value={contact.title}
                        onChange={(e) => updateContact(i, "title", e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <input
                        type="text"
                        placeholder="Email or phone"
                        value={contact.contactInfo}
                        onChange={(e) => updateContact(i, "contactInfo", e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  ))}
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      placeholder="Phone number (optional)"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Link className="w-3 h-3" />
                      Custom Link (optional)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Link text (e.g. View Product Guide)"
                        value={customLinkText}
                        onChange={(e) => setCustomLinkText(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <input
                        type="url"
                        placeholder="https://example.com"
                        value={customLinkUrl}
                        onChange={(e) => setCustomLinkUrl(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Edit Content (pilot only) */}
          {template === "pilot" && (
            <div>
              <button
                onClick={() => setShowEditContent(!showEditContent)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" />
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEditContent ? "rotate-180" : ""}`} />
                {showEditContent ? "Hide" : "Edit"} Content
              </button>

              {showEditContent && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 space-y-4 rounded-xl border border-border p-4 bg-muted/30"
                >
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                      Subtitle <span className="font-normal text-muted-foreground/60">({currentContent.subtitle.length}/80 chars)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={currentContent.subtitle}
                      onChange={(e) => updateSubtitle(audience, e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>

                  {currentContent.introText !== undefined && (
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                        Intro Text <span className="font-normal text-muted-foreground/60">({(currentContent.introText || "").length}/250 chars)</span>
                      </label>
                      <textarea
                        value={currentContent.introText}
                        maxLength={250}
                        onChange={(e) => updateIntroText(audience, e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Features <span className="font-normal text-muted-foreground/60">(title max 35 chars, description max 150 chars)</span>
                    </label>
                    {currentContent.features.map((feat, i) => (
                      <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                        <input
                          type="text"
                          maxLength={35}
                          value={feat.title}
                          onChange={(e) => updateFeature(audience, i, "title", e.target.value)}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          placeholder="Feature title"
                        />
                        <input
                          type="text"
                          maxLength={150}
                          value={feat.description}
                          onChange={(e) => updateFeature(audience, i, "description", e.target.value)}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          placeholder="Feature description"
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!dsoName.trim() || generating}
            className="w-full rounded-full bg-primary py-3.5 text-sm font-bold uppercase tracking-widest text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Generate & Download PDF
          </button>
        </div>
      </div>
    </section>
  );
};

export default DSOOnePagerGenerator;
