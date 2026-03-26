import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Plus, Trash2, Save, GripVertical, Eye, Loader2, Move, MousePointerClick, QrCode, ImageIcon, Copy, Pencil, Settings2, RotateCcw } from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { saveLayoutDefault, loadLayoutDefault } from "@/lib/layout-defaults";
import jsPDF from "jspdf";
import {
  generatePilotOnePager,
  generateComparisonOnePager,
  generateNewPartnerOnePager,
  generateROIOnePager,
} from "@/components/DSOOnePagerGenerator";
import { buildPartnerPdf } from "@/components/DSOPilotEditor";
import { registerCustomFonts, getPdfFontFamily } from "@/lib/pdf-fonts";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";

const svgToPng = (svgSrc: string, width: number, height: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = width; c.height = height;
      const ctx = c.getContext("2d"); if (!ctx) { reject(new Error("no ctx")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = svgSrc;
  });

import { type OverlayField, type CustomTemplate, TEMPLATE_VISIBILITY_KEY } from "@/components/template-types";

const FONT_OPTIONS = [
  { value: "helvetica", label: "Helvetica", css: "Helvetica, Arial, sans-serif" },
  { value: "arial", label: "Arial", css: "Arimo, Arial, Helvetica, sans-serif" },
  { value: "helvetica-neue", label: "Helvetica Neue / SF", css: "'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" },
  { value: "open-sans", label: "Open Sans", css: "'Open Sans', sans-serif" },
  { value: "georgia", label: "Georgia", css: "Lora, Georgia, 'Times New Roman', serif" },
  { value: "times", label: "Times", css: "'Times New Roman', Times, serif" },
  { value: "courier", label: "Courier", css: "'Courier New', Courier, monospace" },
];

const getFontCss = (fontFamily: string) => FONT_OPTIONS.find(f => f.value === fontFamily)?.css || "sans-serif";

// Built-in preset backgrounds rendered programmatically
const PRESET_BACKGROUNDS = [
  { id: "preset:green-header", label: "Green Header", description: "Full-width dark green header bar" },
  { id: "preset:green-header-image", label: "Green Header + Image", description: "Green header left, image placeholder right" },
] as const;

// Built-in templates that can be cloned into custom templates
const BUILTIN_TEMPLATES = [
  { id: "roi", label: "ROI One-Pager", description: "Financial ROI summary for DSOs" },
  { id: "pilot", label: "90-Day Pilot", description: "Pilot program overview with team contacts" },
  { id: "comparison", label: "Dandy Evolution", description: "Before/after comparison table" },
  { id: "new-partner", label: "Partner Practices", description: "Partner onboarding one-pager" },
  { id: "partner2", label: "Partner 2", description: "Alternative partner template" },
] as const;

const DARK_GREEN: [number, number, number] = [0, 40, 32];
const MID_GREEN: [number, number, number] = [20, 50, 40];

const isPresetBg = (url: string) => url.startsWith("preset:");

/** Generate a canvas data URL for a preset background (for preview) */
const generatePresetCanvas = (presetId: string, headerPct: number, orientation: string, imageUrl?: string): Promise<string> => {
  return new Promise((resolve) => {
    const isLandscape = orientation === "landscape";
    const cw = isLandscape ? 792 : 612;
    const ch = isLandscape ? 612 : 792;
    const canvas = document.createElement("canvas");
    canvas.width = cw * 2; canvas.height = ch * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    // White base
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, cw, ch);

    const headerH = ch * (headerPct / 100);

    const drawSplitPlaceholder = () => {
      ctx.fillStyle = `rgb(${MID_GREEN[0]},${MID_GREEN[1]},${MID_GREEN[2]})`;
      const splitX = cw * 0.48;
      ctx.fillRect(splitX, 0, cw - splitX, headerH);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.font = `${headerH * 0.15}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("📷 Image", splitX + (cw - splitX) / 2, headerH / 2);
    };

    if (presetId === "preset:green-header") {
      ctx.fillStyle = `rgb(${DARK_GREEN[0]},${DARK_GREEN[1]},${DARK_GREEN[2]})`;
      ctx.fillRect(0, 0, cw, headerH);
      resolve(canvas.toDataURL("image/png"));
    } else if (presetId === "preset:green-header-image") {
      const splitX = cw * 0.48;
      ctx.fillStyle = `rgb(${DARK_GREEN[0]},${DARK_GREEN[1]},${DARK_GREEN[2]})`;
      ctx.fillRect(0, 0, splitX, headerH);

      if (imageUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          // Cover-crop: maintain aspect ratio, center crop
          const targetW = cw - splitX;
          const targetH = headerH;
          const targetAspect = targetW / targetH;
          const imgAspect = img.width / img.height;
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          if (imgAspect > targetAspect) {
            sw = img.height * targetAspect;
            sx = (img.width - sw) / 2;
          } else {
            sh = img.width / targetAspect;
            sy = (img.height - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, splitX, 0, targetW, targetH);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => {
          drawSplitPlaceholder();
          resolve(canvas.toDataURL("image/png"));
        };
        img.src = imageUrl;
      } else {
        drawSplitPlaceholder();
        resolve(canvas.toDataURL("image/png"));
      }
    } else {
      resolve(canvas.toDataURL("image/png"));
    }
  });
};

/**
 * Add an image to jsPDF using cover-crop (no distortion).
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

/** Draw preset background directly on a jsPDF doc */
const drawPresetOnPdf = async (doc: jsPDF, presetId: string, headerPct: number, headerImgData?: string) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const headerH = h * (headerPct / 100);

  // White base
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");

  if (presetId === "preset:green-header") {
    doc.setFillColor(...DARK_GREEN);
    doc.rect(0, 0, w, headerH, "F");
  } else if (presetId === "preset:green-header-image") {
    const splitX = w * 0.48;
    doc.setFillColor(...DARK_GREEN);
    doc.rect(0, 0, splitX, headerH, "F");
    if (headerImgData) {
      await addImageCover(doc, headerImgData, "JPEG", splitX, 0, w - splitX, headerH);
    } else {
      doc.setFillColor(...MID_GREEN);
      doc.rect(splitX, 0, w - splitX, headerH, "F");
    }
  }
};

const DEFAULT_FIELD: Omit<OverlayField, "id"> = {
  label: "DSO Name",
  type: "dso_name",
  x: 10,
  y: 10,
  fontSize: 24,
  fontFamily: "helvetica",
  color: "#FFFFFF",
  bold: true,
  italic: false,
  defaultValue: "",
};

export type BuiltinTemplateId = (typeof BUILTIN_TEMPLATES)[number]["id"];

export const cloneFieldsForBuiltin = (builtinId: BuiltinTemplateId): OverlayField[] => {
  const mk = (field: Omit<OverlayField, "id">): OverlayField => ({ ...field, id: crypto.randomUUID() });

  // ROI Brief — DSO name appears at top-left below Dandy logo; "& {DSO}" line
  // PDF coords: (48, 92) on 612×792 → x≈7.8%, y≈11.6%
  if (builtinId === "roi") {
    return [
      mk({ ...DEFAULT_FIELD, label: "Dandy Logo", type: "dandy_logo", x: 7.8, y: 4.5, fontSize: 18, color: "#FFFFFF", bold: true, italic: false, logoScale: 13 }),
      mk({ ...DEFAULT_FIELD, label: "& DSO Name", type: "dso_name", x: 7.8, y: 11.6, fontSize: 22, color: "#FFFFFF", bold: false, italic: false, prefix: "& ", suffix: "" }),
    ];
  }

  // 90-Day Pilot — Dandy logo top-left; DSO italic next to logo separator; logo same spot; phone in footer
  if (builtinId === "pilot") {
    return [
      mk({ ...DEFAULT_FIELD, label: "Dandy Logo", type: "dandy_logo", x: 7.8, y: 6.3, fontSize: 18, color: "#FFFFFF", bold: true, italic: false, logoScale: 13 }),
      mk({ ...DEFAULT_FIELD, label: "Dandy & DSO Name", type: "dso_name", x: 24.5, y: 8.8, fontSize: 14, color: "#FFFFFF", bold: false, italic: true, prefix: "Dandy & ", suffix: ":" }),
      mk({ ...DEFAULT_FIELD, label: "Phone Number", type: "phone", x: 50, y: 96, fontSize: 10, color: "#FFFFFF", bold: false, italic: false }),
      mk({ ...DEFAULT_FIELD, label: "Prospect Logo", type: "logo", x: 24.5, y: 7.6, fontSize: 12, color: "#FFFFFF", bold: false, italic: false, logoScale: 16, logoWidth: 135, logoHeight: 36 }),
    ];
  }

  // Dandy Evolution (comparison) — Dandy logo top-left; DSO italic next to smaller logo separator; phone in footer
  if (builtinId === "comparison") {
    return [
      mk({ ...DEFAULT_FIELD, label: "Dandy Logo", type: "dandy_logo", x: 7.8, y: 2.8, fontSize: 18, color: "#FFFFFF", bold: true, italic: false, logoScale: 11.4 }),
      mk({ ...DEFAULT_FIELD, label: "Dandy & DSO Name", type: "dso_name", x: 22.5, y: 5, fontSize: 12, color: "#FFFFFF", bold: false, italic: true, prefix: "Dandy & ", suffix: ":" }),
      mk({ ...DEFAULT_FIELD, label: "Phone Number", type: "phone", x: 50, y: 96, fontSize: 8, color: "#FFFFFF", bold: false, italic: false }),
      mk({ ...DEFAULT_FIELD, label: "Prospect Logo", type: "logo", x: 22.5, y: 4.3, fontSize: 12, color: "#FFFFFF", bold: false, italic: false, logoScale: 14, logoWidth: 135, logoHeight: 30 }),
    ];
  }

  // Partner Practices — DSO italic subtitle in header; Dandy logo top-left; logo top-right after separator; QR in feature card; phone in footer bar
  // Dandy logo: (48, 30) on 612×792 → x≈7.8%, y≈3.8%
  // DSO: (48, 100) → x≈7.8%, y≈12.6%;  Logo: (538, 42) → x≈88%, y≈5.3%;  QR: card area x≈80%, y≈66.5%;  Phone: x≈66%, y≈95.4%
  return [
    mk({ ...DEFAULT_FIELD, label: "Dandy Logo", type: "dandy_logo", x: 7.8, y: 3.8, fontSize: 18, color: "#FFFFFF", bold: true, italic: false, logoScale: 11.4 }),
    mk({ ...DEFAULT_FIELD, label: "Dandy & DSO Name", type: "dso_name", x: 7.8, y: 12.6, fontSize: 16, color: "#C8D7D2", bold: false, italic: true, prefix: "Dandy & ", suffix: ":" }),
    mk({ ...DEFAULT_FIELD, label: "Phone Number", type: "phone", x: 66, y: 95.4, fontSize: 9, color: "#FFFFFF", bold: false, italic: false }),
    mk({ ...DEFAULT_FIELD, label: "QR Code", type: "qr_code", x: 80.2, y: 66.5, fontSize: 12, color: "#000000", bold: false, italic: false, defaultValue: "https://meetdandy.com", qrSize: 9.5 }),
    mk({ ...DEFAULT_FIELD, label: "Prospect Logo", type: "logo", x: 88, y: 5.3, fontSize: 12, color: "#FFFFFF", bold: false, italic: false, logoScale: 11, logoWidth: 70, logoHeight: 26 }),
  ];
};

// ── Draggable field on the preview ──────────────────────
const DraggableField = ({
  field,
  containerRef,
  selected,
  onSelect,
  onMove,
}: {
  field: OverlayField;
  containerRef: React.RefObject<HTMLDivElement>;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) => {
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    onMove(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };

  const handlePointerUp = () => setDragging(false);

  const displayText = field.type === "dso_name" ? `${field.prefix || ""}{DSO Name}${field.suffix || ""}` : field.type === "phone" ? "{Phone}" : field.type === "qr_code" ? "{QR Code}" : field.type === "logo" ? "{Logo}" : field.type === "dandy_logo" ? "{Dandy Logo}" : (field.defaultValue || field.label || "{Text}");
  // Scale font size relative to preview (assume ~500px wide preview ≈ 612pt page)
  const scaledFontSize = Math.max(10, (field.fontSize / 612) * 500);

  return (
    <div
      className={`absolute select-none touch-none ${dragging ? "z-30" : "z-20"}`}
      style={{
        left: `${field.x}%`,
        top: `${field.y}%`,
        transform: "translate(-4px, -50%)",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className={`flex items-center gap-1 rounded px-1.5 py-0.5 cursor-grab active:cursor-grabbing transition-shadow whitespace-nowrap ${
          selected ? "ring-2 ring-primary shadow-lg" : "hover:ring-1 hover:ring-primary/50"
        } ${dragging ? "opacity-80 scale-105" : ""}`}
        style={{
          backgroundColor: selected ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)",
        }}
      >
        {field.type === "qr_code" ? <QrCode className="w-3 h-3 shrink-0" style={{ color: field.color }} /> : (field.type === "logo" || field.type === "dandy_logo") ? <ImageIcon className="w-3 h-3 shrink-0" style={{ color: field.color }} /> : <Move className="w-3 h-3 shrink-0" style={{ color: field.color }} />}
        {field.type === "logo" && field.logoUrl && (
          <img src={field.logoUrl} alt="Logo" className="h-4 max-w-[40px] object-contain" />
        )}
        <span
          style={{
            color: field.color,
            fontSize: `${Math.min(scaledFontSize, 18)}px`,
            fontWeight: field.bold ? 700 : 400,
            fontStyle: field.italic ? "italic" : "normal",
            fontFamily: getFontCss(field.fontFamily),
            lineHeight: 1.2,
          }}
        >
          {displayText}
        </span>
      </div>
    </div>
  );
};

export interface DSOTemplateImporterHandle {
  openWithTemplate: (template: CustomTemplate, bgPreviewUrl: string) => void;
}

const DSOTemplateImporter = forwardRef<DSOTemplateImporterHandle>((_, ref) => {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<(CustomTemplate & { id: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [clickToPlace, setClickToPlace] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [showManagement, setShowManagement] = useState(false);

  // Template visibility: { [templateId]: boolean } – true = enabled
  // Deleted built-ins: { [templateId]: true } – permanently hidden
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    roi: true,
    pilot: true,
    comparison: true,
    "new-partner": false,
    partner2: true,
  });
  const [deletedBuiltins, setDeletedBuiltins] = useState<Record<string, boolean>>({});
  const [confirmDeleteBuiltin, setConfirmDeleteBuiltin] = useState<string | null>(null);

  // Editor state
  const [editing, setEditing] = useState<CustomTemplate | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  // Imperative handle for external callers (e.g. "Save as New Template" from editor)
  useImperativeHandle(ref, () => ({
    openWithTemplate: (template: CustomTemplate, bgPreviewUrl: string) => {
      setOpen(true);
      setBgPreview(bgPreviewUrl);
      setEditing(template);
      // Fetch templates so the list is up to date when they save
      fetchTemplates();
      loadVisibility();
    },
  }));


  useEffect(() => {
    if (open) {
      fetchTemplates();
      loadVisibility();
    }
  }, [open]);

  const loadVisibility = async () => {
    const saved = await loadLayoutDefault(TEMPLATE_VISIBILITY_KEY);
    if (saved) setVisibility(prev => ({ ...prev, ...saved }));
    const savedDeleted = await loadLayoutDefault("deleted_builtin_templates");
    if (savedDeleted) setDeletedBuiltins(savedDeleted);
  };

  const toggleVisibility = async (templateId: string) => {
    const updated = { ...visibility, [templateId]: !visibility[templateId] };
    setVisibility(updated);
    await saveLayoutDefault(TEMPLATE_VISIBILITY_KEY, updated);
    toast({ title: updated[templateId] ? "Template enabled" : "Template disabled" });
  };

  const deleteBuiltinTemplate = async (builtinId: string) => {
    const updated = { ...deletedBuiltins, [builtinId]: true };
    setDeletedBuiltins(updated);
    await saveLayoutDefault("deleted_builtin_templates", updated);
    // Also disable visibility
    const updatedVis = { ...visibility, [builtinId]: false };
    setVisibility(updatedVis);
    await saveLayoutDefault(TEMPLATE_VISIBILITY_KEY, updatedVis);
    setConfirmDeleteBuiltin(null);
    toast({ title: "Built-in template removed" });
  };

  const restoreBuiltinTemplate = async (builtinId: string) => {
    const updated = { ...deletedBuiltins };
    delete updated[builtinId];
    setDeletedBuiltins(updated);
    await saveLayoutDefault("deleted_builtin_templates", updated);
    toast({ title: "Template restored" });
  };

  const cloneBuiltinTemplate = async (builtinId: BuiltinTemplateId) => {
    setCloningId(builtinId);
    try {
      // Generate the real PDF using the actual generator (with latest saved defaults)
      let doc: jsPDF;
      const placeholderDso = " ";

      if (builtinId === "roi") {
        doc = await generateROIOnePager(placeholderDso, 10);
      } else if (builtinId === "pilot") {
        doc = await generatePilotOnePager(placeholderDso, "executive", [], "", null, { w: 0, h: 0 }, undefined, undefined, undefined);
      } else if (builtinId === "comparison") {
        doc = await generateComparisonOnePager(placeholderDso, [], "", null, { w: 0, h: 0 }, undefined, undefined);
      } else if (builtinId === "new-partner" || builtinId === "partner2") {
        // Use the editor's buildPartnerPdf with saved defaults for pixel-perfect clone
        const saved = await loadLayoutDefault("dandy_partner_template_layout");
        const headerCfg = saved?.headerCfg || { height: 247, splitRatio: 53, titleFontSize: 22, subtitleFontSize: 16, subtitleOffsetY: 0, headerImage: null };
        const bodyCfg = saved?.bodyCfg || { headlineFontSize: 16, introFontSize: 9.5, featureTitleFontSize: 10, featureDescFontSize: 8.5, showIntro: true, contentOffsetX: 0, sectionSpacing: 16 };
        const footerCfg = saved?.footerCfg || { fontSize: 10, show: true, link: "meetdandy.com" };
        const teamCfg = saved?.teamCfg || { show: true, headingFontSize: 13, nameFontSize: 10 };
        const partnerHeadline = saved?.partnerHeadline || "Unlock the Power of Digital Dentistry with Dandy";
        const partnerIntro = saved?.partnerIntro || "As {dso}'s newest preferred lab partner, Dandy is here to help your practice thrive with the most advanced digital dental lab in the industry. Together, we're delivering smarter, faster, and more predictable outcomes—while elevating patient care and your bottom line.";
        const partnerFeatures = saved?.partnerFeatures || [
          { title: "Increase treatment predictability", desc: "Get real-time expert guidance while your patient is in the chair for confident, accurate outcomes." },
          { title: "Digitize every restorative workflow", desc: "Get a free Dandy Vision Scanner and Cart." },
          { title: "Access state-of-the-art lab quality", desc: "Deliver high-quality prosthetics with digital precision, premium materials, and unmatched consistency." },
          { title: "Get your new partnership perks and preferred pricing", desc: "" },
        ];
        const partnerStats = saved?.partnerStats || [
          { value: "88%", desc: "say Dandy's real-time lab support makes case management easier." },
          { value: "83%", desc: "say they have saved time using Dandy's portal to manage lab cases." },
          { value: "67%", desc: "say Dandy's technology gives them a competitive edge over other practices." },
        ];
        const partnerQrUrl = saved?.partnerQrUrl || "https://meetdandy.com";

        doc = await buildPartnerPdf({
          dsoName: placeholderDso,
          headerCfg, bodyCfg, footerCfg, teamCfg,
          headline: partnerHeadline,
          introText: partnerIntro,
          features: partnerFeatures,
          stats: partnerStats,
          qrUrl: partnerQrUrl,
          teamContacts: [],
          phoneNumber: "",
          prospectLogoData: null,
          prospectLogoDims: { w: 0, h: 0 },
          cloneMode: true,
        });
      } else {
        toast({ title: "Unknown template", variant: "destructive" });
        return;
      }

      // Convert each page of the PDF to a PNG and upload the first page as the background
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
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
      const imgBlob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/png"));

      const path = `cloned/${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage.from("template-backgrounds").upload(path, imgBlob, { upsert: true });
      if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
      const { data: urlData } = supabase.storage.from("template-backgrounds").getPublicUrl(path);
      const bgUrl = urlData.publicUrl;

      const label = BUILTIN_TEMPLATES.find(t => t.id === builtinId)?.label || builtinId;

      setBgPreview(bgUrl);
      setEditing({
        name: `${label} (Custom)`,
        background_url: bgUrl,
        orientation: "portrait",
        fields: cloneFieldsForBuiltin(builtinId),
        headerHeight: 30,
      });

      toast({ title: `Cloned "${label}"`, description: "Full template rendered with latest saved defaults. Customize and save." });
    } catch (err) {
      toast({ title: "Clone failed", description: String(err), variant: "destructive" });
    } finally {
      setCloningId(null);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("custom_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTemplates(data.map(t => ({ ...t, fields: (t.fields || []) as unknown as OverlayField[], headerHeight: (t as any).header_height ?? 30, headerImageUrl: (t as any).header_image_url || undefined })));
    setLoading(false);
  };

  const pdfToImageBlob = async (file: File): Promise<Blob> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    const arrayBuf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
    const page = await pdf.getPage(1);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    return new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("canvas toBlob failed")), "image/png"));
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    let uploadFile = file;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    // Convert PDF first page to PNG for preview & storage
    if (isPdf) {
      try {
        const blob = await pdfToImageBlob(file);
        uploadFile = new File([blob], file.name.replace(/\.pdf$/i, ".png"), { type: "image/png" });
      } catch (err) {
        toast({ title: "PDF conversion failed", description: "Could not render PDF as image.", variant: "destructive" });
        setUploading(false);
        return;
      }
    }

    const ext = uploadFile.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("template-backgrounds")
      .upload(path, uploadFile, { upsert: true });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("template-backgrounds")
      .getPublicUrl(path);

    const url = urlData.publicUrl;
    setBgPreview(url);

    setEditing(prev => prev ? { ...prev, background_url: url } : {
      name: file.name.replace(/\.[^.]+$/, ""),
      background_url: url,
      orientation: "portrait",
      fields: [],
    });

    setUploading(false);
  };

  const addField = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      fields: [...editing.fields, { ...DEFAULT_FIELD, id: crypto.randomUUID() }],
    });
  };

  const updateField = (id: string, updates: Partial<OverlayField>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      fields: editing.fields.map(f => f.id === id ? { ...f, ...updates } : f),
    });
  };

  const removeField = (id: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      fields: editing.fields.filter(f => f.id !== id),
    });
  };

  const saveTemplate = async () => {
    if (!editing || !editing.name.trim() || (!editing.background_url && !isPresetBg(editing.background_url || ""))) {
      if (!editing || !editing.name.trim() || !editing.background_url) {
        toast({ title: "Missing info", description: "Please provide a name and a background.", variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    const payload = {
      name: editing.name.trim(),
      background_url: editing.background_url,
      orientation: editing.orientation,
      fields: editing.fields as any,
      header_height: editing.headerHeight,
      header_image_url: editing.headerImageUrl || null,
      updated_at: new Date().toISOString(),
    } as any;

    if (editing.id) {
      const { error } = await supabase.from("custom_templates").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); setLoading(false); return; }
    } else {
      const { error } = await supabase.from("custom_templates").insert(payload);
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); setLoading(false); return; }
    }

    toast({ title: "Template saved!", description: "Sales reps can now use this template." });
    setEditing(null);
    setBgPreview(null);
    await fetchTemplates();
    setLoading(false);
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("custom_templates").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", variant: "destructive" }); return; }
    toast({ title: "Template deleted" });
    fetchTemplates();
  };

  const previewPdf = async (tpl: CustomTemplate, dsoName = "Sample DSO") => {
    const doc = new jsPDF({ orientation: tpl.orientation === "landscape" ? "landscape" : "portrait", unit: "pt", format: "letter" });
    await registerCustomFonts(doc);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    // Load background
    if (isPresetBg(tpl.background_url)) {
      let headerImgData: string | undefined;
      if (tpl.headerImageUrl && tpl.background_url === "preset:green-header-image") {
        try { headerImgData = await loadImg(tpl.headerImageUrl); } catch { /* skip */ }
      }
      await drawPresetOnPdf(doc, tpl.background_url, tpl.headerHeight || 30, headerImgData);
    } else {
      try {
        const img = await loadImg(tpl.background_url);
        await addImageCover(doc, img, "JPEG", 0, 0, w, h);
      } catch {
        doc.setFillColor(240, 240, 240);
        doc.rect(0, 0, w, h, "F");
      }
    }

    // Overlay fields
    for (const field of tpl.fields) {
      if (field.type === "qr_code") {
        const url = field.defaultValue || "https://meetdandy.com";
        try {
          const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 1 });
          const qrSizePt = w * ((field.qrSize || 15) / 100);
          doc.addImage(qrDataUrl, "PNG", w * (field.x / 100), h * (field.y / 100), qrSizePt, qrSizePt);
        } catch { /* skip */ }
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
          const rgb = hexToRgb(field.color || "#FFFFFF");
          doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text("dandy", w * (field.x / 100), h * (field.y / 100) + (field.fontSize || 18));
        }
        continue;
      }
      if (field.type === "logo") {
        if (field.logoUrl) {
          try {
            const { dataUrl, width: nw, height: nh } = await loadImgWithDimensions(field.logoUrl);
            const scale = field.logoScale || field.logoWidth || 15;
            const lw = w * (scale / 100);
            const lh = lw * (nh / nw);
            doc.addImage(dataUrl, "PNG", w * (field.x / 100), h * (field.y / 100), lw, lh);
          } catch { /* skip */ }
        } else if (dsoName.trim()) {
          // No logo — render DSO name as fallback
          const fontStyle = field.bold && field.italic ? "bolditalic" : field.bold ? "bold" : field.italic ? "italic" : "normal";
          doc.setFont(getPdfFontFamily(field.fontFamily || "helvetica"), fontStyle);
          doc.setFontSize(field.fontSize || 12);
          const rgb = hexToRgb(field.color || "#000000");
          doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text(dsoName.trim(), w * (field.x / 100), h * (field.y / 100) + (field.fontSize || 12));
        }
        continue;
      }
      let text = field.type === "dso_name" ? dsoName : field.type === "phone" ? "(555) 123-4567" : (field.defaultValue || field.label);
      if (field.type === "dso_name") {
        text = `${field.prefix || ""}${text}${field.suffix || ""}`;
      }
      const fontStyle = field.bold && field.italic ? "bolditalic" : field.bold ? "bold" : field.italic ? "italic" : "normal";
      doc.setFont(getPdfFontFamily(field.fontFamily), fontStyle);
      doc.setFontSize(field.fontSize);
      const rgb = hexToRgb(field.color);
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(text, w * (field.x / 100), h * (field.y / 100));
    }

    doc.save(`Preview_${tpl.name.replace(/\s+/g, "_")}.pdf`);
  };

  const startNew = () => {
    setEditing({ name: "", background_url: "", orientation: "portrait", fields: [], headerHeight: 30 });
    setBgPreview(null);
  };

  const selectPreset = async (presetId: string) => {
    const hh = editing?.headerHeight || 30;
    const orient = editing?.orientation || "portrait";
    const imgUrl = editing?.headerImageUrl;
    const preview = await generatePresetCanvas(presetId, hh, orient, imgUrl);
    setBgPreview(preview);
    setEditing(prev => prev ? { ...prev, background_url: presetId, headerHeight: hh } : prev);
  };

  const refreshPresetPreview = async (overrides?: Partial<CustomTemplate>) => {
    const tpl = { ...editing, ...overrides };
    if (!tpl || !isPresetBg(tpl.background_url || "")) return;
    const preview = await generatePresetCanvas(tpl.background_url!, tpl.headerHeight || 30, tpl.orientation || "portrait", tpl.headerImageUrl);
    setBgPreview(preview);
  };

  const editExisting = async (tpl: CustomTemplate & { id: string }) => {
    setEditing(tpl);
    if (isPresetBg(tpl.background_url)) {
      const preview = await generatePresetCanvas(tpl.background_url, tpl.headerHeight || 30, tpl.orientation, tpl.headerImageUrl);
      setBgPreview(preview);
    } else {
      setBgPreview(tpl.background_url);
    }
  };

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider flex items-center gap-1.5"
      >
        <Upload className="w-3.5 h-3.5" />
        {open ? "Hide Template Manager" : "Marketing: Import Templates"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Template Manager</h3>
                <div className="flex items-center gap-3">
                  {!editing && (
                    <>
                      <button
                        onClick={() => setShowManagement(!showManagement)}
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Settings2 className="w-3.5 h-3.5" /> {showManagement ? "Hide" : "Manage"} Live Templates
                      </button>
                      <button onClick={startNew} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> New Template
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ──── Live Templates Management ──── */}
              {!editing && showManagement && (
                <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Live Templates</h4>
                  <p className="text-[11px] text-muted-foreground">Enable or disable templates visible to sales reps in the generator.</p>

                  {/* Built-in templates */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Built-in Templates</span>
                    {BUILTIN_TEMPLATES.filter(bt => !deletedBuiltins[bt.id]).map(bt => (
                      <div key={bt.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleVisibility(bt.id)}
                            className="text-foreground hover:text-primary transition-colors"
                            title={visibility[bt.id] ? "Disable" : "Enable"}
                          >
                            {visibility[bt.id] ? (
                              <div className="w-9 h-5 rounded-full bg-primary flex items-center justify-end px-0.5 transition-colors">
                                <div className="w-4 h-4 rounded-full bg-primary-foreground" />
                              </div>
                            ) : (
                              <div className="w-9 h-5 rounded-full bg-muted flex items-center justify-start px-0.5 transition-colors">
                                <div className="w-4 h-4 rounded-full bg-muted-foreground/40" />
                              </div>
                            )}
                          </button>
                          <div>
                            <span className={`text-sm font-medium ${visibility[bt.id] ? "text-foreground" : "text-muted-foreground"}`}>{bt.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">{bt.description}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => cloneBuiltinTemplate(bt.id)}
                            disabled={cloningId === bt.id}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                          >
                            {cloningId === bt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                            Clone
                          </button>
                          {confirmDeleteBuiltin === bt.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteBuiltinTemplate(bt.id)}
                                className="text-[10px] font-semibold text-destructive hover:text-destructive/80 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteBuiltin(null)}
                                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteBuiltin(bt.id)}
                              className="text-xs text-destructive/70 hover:text-destructive transition-colors"
                              title="Delete built-in template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Deleted built-in templates (restore) */}
                  {BUILTIN_TEMPLATES.some(bt => deletedBuiltins[bt.id]) && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Deleted Built-ins</span>
                      {BUILTIN_TEMPLATES.filter(bt => deletedBuiltins[bt.id]).map(bt => (
                        <div key={bt.id} className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/20 px-4 py-2.5">
                          <span className="text-sm text-muted-foreground line-through">{bt.label}</span>
                          <button
                            onClick={() => restoreBuiltinTemplate(bt.id)}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Custom templates visibility */}
                  {templates.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Custom Templates</span>
                      {templates.map(tpl => (
                        <div key={tpl.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleVisibility(`custom:${tpl.id}`)}
                              className="text-foreground hover:text-primary transition-colors"
                            >
                              {visibility[`custom:${tpl.id}`] !== false ? (
                                <div className="w-9 h-5 rounded-full bg-primary flex items-center justify-end px-0.5 transition-colors">
                                  <div className="w-4 h-4 rounded-full bg-primary-foreground" />
                                </div>
                              ) : (
                                <div className="w-9 h-5 rounded-full bg-muted flex items-center justify-start px-0.5 transition-colors">
                                  <div className="w-4 h-4 rounded-full bg-muted-foreground/40" />
                                </div>
                              )}
                            </button>
                            <div>
                              <span className={`text-sm font-medium ${visibility[`custom:${tpl.id}`] !== false ? "text-foreground" : "text-muted-foreground"}`}>{tpl.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({tpl.fields.length} fields)</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => editExisting(tpl)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => deleteTemplate(tpl.id)} className="text-xs text-destructive hover:text-destructive/80 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ──── Clone Built-in Section ──── */}
              {!editing && !showManagement && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Clone a Built-in Template</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {BUILTIN_TEMPLATES.filter(bt => !deletedBuiltins[bt.id]).map(bt => (
                      <button
                        key={bt.id}
                        onClick={() => cloneBuiltinTemplate(bt.id)}
                        disabled={!!cloningId}
                        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                      >
                        {cloningId === bt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                        <div className="text-left">
                          <div className="font-semibold">{bt.label}</div>
                          <div className="text-[9px] text-muted-foreground">{bt.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing custom templates list */}
              {!editing && !showManagement && (
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Custom Templates</span>
                  {loading && <p className="text-xs text-muted-foreground">Loading...</p>}
                  {!loading && templates.length === 0 && (
                    <p className="text-xs text-muted-foreground">No custom templates yet. Clone a built-in or click "New Template" to create one.</p>
                  )}
                  {templates.map(tpl => (
                    <div key={tpl.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                      <div>
                        <span className="text-sm font-medium text-foreground">{tpl.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({tpl.fields.length} fields, {tpl.orientation})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => previewPdf(tpl)} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                        <button onClick={() => editExisting(tpl)} className="text-xs text-primary hover:text-primary/80 transition-colors">Edit</button>
                        <button onClick={() => deleteTemplate(tpl.id)} className="text-xs text-destructive hover:text-destructive/80 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Editor */}
              {editing && (
                <div className="space-y-5">
                  {/* Name + orientation */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1 block">Template Name</label>
                      <input
                        type="text"
                        value={editing.name}
                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                        placeholder="e.g. Q1 Promo One-Pager"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1 block">Orientation</label>
                      <div className="inline-flex rounded-full border border-border overflow-hidden">
                        {(["portrait", "landscape"] as const).map(o => (
                          <button
                            key={o}
                            onClick={async () => {
                              setEditing({ ...editing, orientation: o });
                              if (isPresetBg(editing.background_url)) {
                                const preview = await generatePresetCanvas(editing.background_url, editing.headerHeight || 30, o, editing.headerImageUrl);
                                setBgPreview(preview);
                              }
                            }}
                            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${editing.orientation === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Background */}
                  <div>
                    <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2 block">Background</label>

                    {/* Preset options */}
                    {!bgPreview && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {PRESET_BACKGROUNDS.map(preset => (
                            <button
                              key={preset.id}
                              onClick={() => selectPreset(preset.id)}
                              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                            >
                              <div className="w-6 h-4 rounded-sm overflow-hidden border border-border flex-shrink-0">
                                <div className="w-full h-1/3" style={{ backgroundColor: `rgb(${DARK_GREEN.join(",")})` }} />
                                {preset.id === "preset:green-header-image" && (
                                  <div className="w-1/2 h-1/3 ml-auto" style={{ backgroundColor: `rgb(${MID_GREEN.join(",")})` }} />
                                )}
                              </div>
                              <div className="text-left">
                                <div className="font-semibold">{preset.label}</div>
                                <div className="text-[9px] text-muted-foreground">{preset.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">or upload custom</span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleBgUpload} className="hidden" />
                        <button
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          className="w-full rounded-lg border-2 border-dashed border-border bg-muted/30 py-8 text-center hover:bg-muted/50 transition-colors"
                        >
                          {uploading ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                          ) : (
                            <>
                              <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Upload background image (PNG, JPG, PDF)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Preview with background */}
                    {bgPreview && (
                      <>
                        {/* Header height control for presets */}
                        {isPresetBg(editing.background_url) && (
                          <div className="space-y-3 mb-3">
                            <div className="flex items-center gap-3">
                              <label className="text-[9px] text-muted-foreground uppercase whitespace-nowrap">Header Height</label>
                              <input
                                type="range"
                                min={10} max={60} step={1}
                                value={editing.headerHeight || 30}
                                onChange={async (e) => {
                                  const hh = Number(e.target.value);
                                  setEditing(prev => prev ? { ...prev, headerHeight: hh } : prev);
                                  const preview = await generatePresetCanvas(editing.background_url, hh, editing.orientation, editing.headerImageUrl);
                                  setBgPreview(preview);
                                }}
                                className="flex-1 accent-primary"
                              />
                              <span className="text-xs text-muted-foreground font-mono w-10 text-right">{editing.headerHeight || 30}%</span>
                            </div>
                            {editing.background_url === "preset:green-header-image" && (
                              <div className="flex items-center gap-3">
                                <label className="text-[9px] text-muted-foreground uppercase whitespace-nowrap">Header Image</label>
                                <div className="flex items-center gap-2 flex-1">
                                  {editing.headerImageUrl && (
                                    <img src={editing.headerImageUrl} alt="Header" className="h-8 max-w-[100px] object-cover rounded border border-border" />
                                  )}
                                  <label className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors">
                                    <Upload className="w-3 h-3" /> {editing.headerImageUrl ? "Replace" : "Upload"}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (ev) => {
                                        const file = ev.target.files?.[0];
                                        if (!file) return;
                                        const ext = file.name.split(".").pop();
                                        const path = `header-images/${crypto.randomUUID()}.${ext}`;
                                        const { error } = await supabase.storage.from("template-backgrounds").upload(path, file, { upsert: true });
                                        if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
                                        const { data: urlData } = supabase.storage.from("template-backgrounds").getPublicUrl(path);
                                        const newUrl = urlData.publicUrl;
                                        setEditing(prev => prev ? { ...prev, headerImageUrl: newUrl } : prev);
                                        const preview = await generatePresetCanvas(editing.background_url, editing.headerHeight || 30, editing.orientation, newUrl);
                                        setBgPreview(preview);
                                        toast({ title: "Header image uploaded" });
                                      }}
                                    />
                                  </label>
                                  {editing.headerImageUrl && (
                                    <button
                                      onClick={async () => {
                                        setEditing(prev => prev ? { ...prev, headerImageUrl: undefined } : prev);
                                        const preview = await generatePresetCanvas(editing.background_url, editing.headerHeight || 30, editing.orientation);
                                        setBgPreview(preview);
                                      }}
                                      className="text-xs text-destructive hover:text-destructive/80"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <div
                          ref={previewRef}
                          className="relative rounded-lg overflow-hidden border border-border"
                          style={{ aspectRatio: editing.orientation === "landscape" ? "11/8.5" : "8.5/11" }}
                          onClick={(e) => {
                            const el = e.target as HTMLElement;
                            const isBackground = el === previewRef.current || el.tagName === "IMG";
                            if (isBackground && !clickToPlace) {
                              setSelectedFieldId(null);
                            }
                          }}
                        >
                          <img src={bgPreview} alt="Background" className={`w-full h-full object-cover pointer-events-none ${clickToPlace ? "cursor-crosshair" : ""}`} />
                          {clickToPlace && <div className="absolute inset-0 z-10 cursor-crosshair" onClick={(e) => {
                            if (!previewRef.current) return;
                            const rect = previewRef.current.getBoundingClientRect();
                            const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
                            const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
                            const newId = crypto.randomUUID();
                            setEditing(prev => prev ? {
                              ...prev,
                              fields: [...prev.fields, { ...DEFAULT_FIELD, id: newId, x, y }],
                            } : prev);
                            setSelectedFieldId(newId);
                          }} />}
                          {/* Draggable field overlays */}
                          {editing.fields.map(field => (
                            <DraggableField
                              key={field.id}
                              field={field}
                              containerRef={previewRef as React.RefObject<HTMLDivElement>}
                              selected={selectedFieldId === field.id}
                              onSelect={() => setSelectedFieldId(field.id)}
                              onMove={(x, y) => updateField(field.id, { x, y })}
                            />
                          ))}
                          <button
                            onClick={(e) => { e.stopPropagation(); setBgPreview(null); setEditing({ ...editing, background_url: "" }); }}
                            className="absolute top-2 right-2 rounded-full bg-background/80 p-1 hover:bg-background transition-colors z-40"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute bottom-2 left-2 flex items-center gap-2 z-40">
                            <button
                              onClick={(e) => { e.stopPropagation(); setClickToPlace(!clickToPlace); }}
                              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-medium transition-colors ${
                                clickToPlace
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background/80 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <MousePointerClick className="w-3 h-3" />
                              {clickToPlace ? "Click to place: ON" : "Click to place"}
                            </button>
                            {editing.fields.length > 0 && !clickToPlace && (
                              <span className="bg-background/80 rounded-md px-2 py-1 text-[9px] text-muted-foreground">Drag fields to reposition</span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Overlay fields */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Dynamic Fields</label>
                      <button onClick={addField} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add Field
                      </button>
                    </div>
                    <div className="space-y-3">
                      {editing.fields.length === 0 && (
                        <p className="text-xs text-muted-foreground">No fields yet. Add dynamic fields that sales reps can fill in (DSO name, phone, etc.)</p>
                      )}
                      {editing.fields.map(field => (
                        <div
                          key={field.id}
                          className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors ${selectedFieldId === field.id ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-background hover:border-primary/30"}`}
                          onClick={() => setSelectedFieldId(field.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">{field.label || "Untitled Field"}</span>
                            <button onClick={() => removeField(field.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">Label</label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={e => updateField(field.id, { label: e.target.value })}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">Type</label>
                              <select
                                value={field.type}
                                onChange={e => updateField(field.id, { type: e.target.value as OverlayField["type"] })}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                              >
                                <option value="dso_name">DSO Name (auto-filled)</option>
                                <option value="phone">Phone (auto-filled)</option>
                                <option value="custom_text">Custom Text</option>
                                <option value="qr_code">QR Code</option>
                                <option value="logo">Logo Image</option>
                                <option value="dandy_logo">Dandy Logo</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">X %</label>
                              <input
                                type="number"
                                min={0} max={100}
                                value={field.x}
                                onChange={e => updateField(field.id, { x: Number(e.target.value) })}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">Y %</label>
                              <input
                                type="number"
                                min={0} max={100}
                                value={field.y}
                                onChange={e => updateField(field.id, { y: Number(e.target.value) })}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">Size</label>
                              <input
                                type="number"
                                min={6} max={72}
                                value={field.fontSize}
                                onChange={e => updateField(field.id, { fontSize: Number(e.target.value) })}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">Font</label>
                              <select
                                value={field.fontFamily || "helvetica"}
                                onChange={e => updateField(field.id, { fontFamily: e.target.value })}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                              >
                                {FONT_OPTIONS.map(f => (
                                  <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">Color</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={field.color}
                                  onChange={e => updateField(field.id, { color: e.target.value })}
                                  className="w-7 h-[26px] rounded border border-border bg-background cursor-pointer shrink-0 p-0"
                                />
                                <input
                                  type="text"
                                  value={field.color}
                                  onChange={e => {
                                    let v = e.target.value;
                                    if (!v.startsWith("#")) v = "#" + v;
                                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                                      updateField(field.id, { color: v });
                                    }
                                  }}
                                  onBlur={e => {
                                    if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                      updateField(field.id, { color: "#FFFFFF" });
                                    }
                                  }}
                                  maxLength={7}
                                  className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  placeholder="#FFFFFF"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {field.type !== "qr_code" && field.type !== "logo" && (
                              <>
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.bold}
                                    onChange={e => updateField(field.id, { bold: e.target.checked })}
                                    className="rounded"
                                  />
                                  Bold
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.italic}
                                    onChange={e => updateField(field.id, { italic: e.target.checked })}
                                    className="rounded"
                                  />
                                  <span className="italic">Italic</span>
                                </label>
                              </>
                            )}
                            {field.type === "dso_name" && (
                              <div className="flex items-center gap-2 flex-1">
                                <div>
                                  <label className="text-[9px] text-muted-foreground uppercase">Prefix</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Dandy & "
                                    value={field.prefix || ""}
                                    onChange={e => updateField(field.id, { prefix: e.target.value })}
                                    className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-muted-foreground uppercase">Suffix</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. :"
                                    value={field.suffix || ""}
                                    onChange={e => updateField(field.id, { suffix: e.target.value })}
                                    className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  />
                                </div>
                              </div>
                            )}
                            {field.type === "custom_text" && (
                              <div className="flex-1">
                                <input
                                  type="text"
                                  placeholder="Default text value"
                                  value={field.defaultValue}
                                  onChange={e => updateField(field.id, { defaultValue: e.target.value })}
                                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                                />
                              </div>
                            )}
                            {field.type === "qr_code" && (
                              <div className="flex items-center gap-3 flex-1">
                                <div>
                                  <label className="text-[9px] text-muted-foreground uppercase">QR Size %</label>
                                  <input
                                    type="number"
                                    min={5} max={50}
                                    value={field.qrSize || 15}
                                    onChange={e => updateField(field.id, { qrSize: Math.max(5, Math.min(50, Number(e.target.value))) })}
                                    className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[9px] text-muted-foreground uppercase">Default URL</label>
                                  <input
                                    type="text"
                                    placeholder="https://meetdandy.com"
                                    value={field.defaultValue}
                                    onChange={e => updateField(field.id, { defaultValue: e.target.value })}
                                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  />
                                </div>
                              </div>
                            )}
                            {field.type === "logo" && (
                              <div className="flex items-center gap-3 flex-1">
                                <div className="flex items-center gap-2">
                                  <label className="text-[9px] text-muted-foreground uppercase whitespace-nowrap">Scale</label>
                                  <input
                                    type="range"
                                    min={3} max={60} step={1}
                                    value={field.logoScale || field.logoWidth || 15}
                                    onChange={e => updateField(field.id, { logoScale: Number(e.target.value) })}
                                    className="w-24 accent-primary"
                                  />
                                  <span className="text-[9px] text-muted-foreground font-mono w-8">{field.logoScale || field.logoWidth || 15}%</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {field.logoUrl && (
                                      <img src={field.logoUrl} alt="Logo" className="h-8 max-w-[80px] object-contain rounded" style={{ background: "repeating-conic-gradient(#d5d5d5 0% 25%, transparent 0% 50%) 50% / 8px 8px" }} />
                                    )}
                                    <label className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors">
                                      <Upload className="w-3 h-3" /> {field.logoUrl ? "Replace" : "Upload Logo"}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const ext = file.name.split(".").pop();
                                          const path = `logos/${crypto.randomUUID()}.${ext}`;
                                          const { error } = await supabase.storage.from("template-backgrounds").upload(path, file, { upsert: true });
                                          if (error) { toast({ title: "Logo upload failed", description: error.message, variant: "destructive" }); return; }
                                          const { data: urlData } = supabase.storage.from("template-backgrounds").getPublicUrl(path);
                                          updateField(field.id, { logoUrl: urlData.publicUrl });
                                          toast({ title: "Logo uploaded" });
                                        }}
                                      />
                                    </label>
                                    {field.logoUrl && (
                                      <button
                                        onClick={() => updateField(field.id, { logoUrl: undefined })}
                                        className="text-xs text-destructive hover:text-destructive/80"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            {field.type === "dandy_logo" && (
                              <div className="flex items-center gap-2 flex-1">
                                <label className="text-[9px] text-muted-foreground uppercase whitespace-nowrap">Scale</label>
                                <input
                                  type="range"
                                  min={3} max={60} step={1}
                                  value={field.logoScale || 11.4}
                                  onChange={e => updateField(field.id, { logoScale: Number(e.target.value) })}
                                  className="w-24 accent-primary"
                                />
                                <span className="text-[9px] text-muted-foreground font-mono w-8">{field.logoScale || 11.4}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={saveTemplate}
                      disabled={loading || !editing.name.trim() || !editing.background_url}
                      className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Template
                    </button>
                    <button
                      onClick={() => previewPdf(editing)}
                      disabled={!editing.background_url}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview PDF
                    </button>
                    <button
                      onClick={() => { setEditing(null); setBgPreview(null); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Helpers
function loadImg(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d")?.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/** Load image and return { dataUrl, width, height } for aspect-ratio-aware rendering */
function loadImgWithDimensions(src: string): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d")?.drawImage(img, 0, 0);
      resolve({ dataUrl: c.toDataURL("image/png"), width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = src;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export default DSOTemplateImporter;
export { TEMPLATE_VISIBILITY_KEY } from "@/components/template-types";
export type { CustomTemplate, OverlayField } from "@/components/template-types";
