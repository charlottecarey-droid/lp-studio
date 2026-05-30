import { useState, useRef, useCallback, useEffect } from "react";
import dandyLogoWhiteUrl from "@/assets/dandy-logo-white.svg?url";
import agreementSummaryPreviewUrl from "@/assets/agreement-summary-preview.png";
import { AgreementNumbersEditor } from "./agreement-numbers-editor";
import {
  Search, Plus, Eye, EyeOff, Copy, Trash2, RotateCcw, Upload, X, Loader2,
  FileText, GripVertical, Settings2, ChevronDown, Save, FileDown, Image as ImageIcon,
  QrCode, Type, User, Phone, AlertCircle, Check, ArrowLeft, LayoutTemplate, Move,
  Heading1, Minus, Link, Users, AlignJustify,
} from "lucide-react";
import type { TeamMember } from "@workspace/one-pager-types";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { fetchBrandConfig, DEFAULT_BRAND, resolveOnePagerAssets, type BrandConfig as BrandConfigT } from "@/lib/brand-config";
import { scrubBrand, type BrandContext as BrandContextT } from "@workspace/one-pager-types";
import {
  generatePilotOnePager,
  generateComparisonOnePager,
  generateNewPartnerOnePager,
  generateROIOnePager,
  generateAgreementSummaryOnePager,
  defaultAudienceContent,
  defaultAgreementSummaryContent,
  loadLayoutDefault,
  type AgreementSummaryContent,
  type AgreementSection,
} from "./sales-one-pager";
import {
  OverlayField,
  CustomTemplate,
  TEMPLATE_VISIBILITY_KEY,
  DELETED_BUILTINS_KEY,
  apiLoadLayoutDefault,
  apiSaveLayoutDefault,
  fetchCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  generateCustomTemplatePdf,
} from "./one-pager-custom-utils";

export type { OverlayField, CustomTemplate };

const API_BASE = "/api";

// ── Preset starter backgrounds ────────────────────────────────────────
const PRESET_BACKGROUNDS = [
  { id: "preset:green-header", label: "Full Green Header", description: "Dark green header bar spanning full width" },
  { id: "preset:green-split", label: "Green + Image", description: "Green header left, image placeholder right" },
] as const;

const DARK_GREEN_FILL = "rgb(0,40,32)";
const MID_GREEN_FILL = "rgb(20,50,40)";

const generatePresetBg = (presetId: string, orientation = "portrait", headerImgUrl?: string): Promise<string> =>
  new Promise(resolve => {
    const isLandscape = orientation === "landscape";
    const cw = isLandscape ? 792 : 612;
    const ch = isLandscape ? 612 : 792;
    const canvas = document.createElement("canvas");
    canvas.width = cw * 2; canvas.height = ch * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, cw, ch);
    const headerH = ch * 0.3;

    const finish = () => resolve(canvas.toDataURL("image/png"));

    if (presetId === "preset:green-header") {
      ctx.fillStyle = DARK_GREEN_FILL;
      ctx.fillRect(0, 0, cw, headerH);
      finish();
    } else if (presetId === "preset:green-split") {
      const splitX = cw * 0.48;
      const panelW = cw - splitX;
      ctx.fillStyle = DARK_GREEN_FILL;
      ctx.fillRect(0, 0, splitX, headerH);

      if (headerImgUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          // Cover-fit the image into the right panel
          const imgAr = img.width / img.height;
          const panelAr = panelW / headerH;
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          if (imgAr > panelAr) { sw = img.height * panelAr; sx = (img.width - sw) / 2; }
          else { sh = img.width / panelAr; sy = (img.height - sh) / 2; }
          ctx.drawImage(img, sx, sy, sw, sh, splitX, 0, panelW, headerH);
          finish();
        };
        img.onerror = () => {
          // Fallback to placeholder if image fails
          ctx.fillStyle = MID_GREEN_FILL;
          ctx.fillRect(splitX, 0, panelW, headerH);
          finish();
        };
        img.src = headerImgUrl;
      } else {
        ctx.fillStyle = MID_GREEN_FILL;
        ctx.fillRect(splitX, 0, panelW, headerH);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font = `bold ${Math.round(headerH * 0.12)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("↑ upload image here", splitX + panelW / 2, headerH / 2);
        finish();
      }
    } else {
      finish();
    }
  });

// Returns the number of pages in a PDF file. Used to drive the multi-page
// picker in the background importer.
const pdfPageCount = async (file: File): Promise<number> => {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  return pdf.numPages;
};

// Renders a single PDF page (1-indexed) to a PNG blob.
// Also returns viewport dimensions so callers can detect orientation mismatch.
const pdfToImageBlob = async (
  file: File,
  pageNum = 1,
): Promise<{ blob: Blob; width: number; height: number }> => {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const safePage = Math.min(Math.max(1, pageNum), pdf.numPages);
  const page = await pdf.getPage(safePage);
  const vp = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/png"),
  );
  return { blob, width: vp.width, height: vp.height };
};

// ── Built-in templates ─────────────────────────────────────────────────
const BUILTIN_TEMPLATES = [
  { id: "roi", label: "ROI One-Pager", description: "Financial ROI summary" },
  { id: "pilot", label: "90-Day Pilot", description: "Pilot program overview" },
  { id: "comparison", label: "Dandy Evolution", description: "Before/after comparison" },
  { id: "new-partner", label: "Partner Practices", description: "Partner onboarding" },
  { id: "partner2", label: "Partner 2", description: "Alternative partner template" },
  { id: "agreement-summary", label: "Agreement Summary", description: "Summary of Dandy Agreement terms", backgroundUrl: agreementSummaryPreviewUrl },
] as const;

type BuiltinId = typeof BUILTIN_TEMPLATES[number]["id"];

const cloneFieldsForBuiltin = (id: BuiltinId): OverlayField[] => {
  const mk = (f: Omit<OverlayField, "id">): OverlayField => ({ ...f, id: crypto.randomUUID() });
  const base: Omit<OverlayField, "id"> = { label: "DSO Name", type: "dso_name", x: 10, y: 10, fontSize: 24, fontFamily: "helvetica", color: "#FFFFFF", bold: true, italic: false, defaultValue: "" };
  if (id === "roi") return [
    mk({ ...base, label: "Dandy Logo", type: "dandy_logo", x: 7.8, y: 4.5, fontSize: 18, logoScale: 13 }),
    mk({ ...base, label: "& DSO Name", type: "dso_name", x: 7.8, y: 11.6, fontSize: 22, bold: false, prefix: "& " }),
  ];
  if (id === "pilot") return [
    mk({ ...base, label: "Dandy Logo", type: "dandy_logo", x: 7.8, y: 6.3, fontSize: 18, logoScale: 13 }),
    mk({ ...base, label: "Dandy & DSO Name", type: "dso_name", x: 24.5, y: 8.8, fontSize: 14, bold: false, italic: true, prefix: "Dandy & ", suffix: ":" }),
    mk({ ...base, label: "Phone Number", type: "phone", x: 50, y: 96, fontSize: 10, bold: false }),
    mk({ ...base, label: "Prospect Logo", type: "logo", x: 24.5, y: 7.6, fontSize: 12, bold: false, logoScale: 16, logoWidth: 135, logoHeight: 36 }),
  ];
  if (id === "comparison") return [
    mk({ ...base, label: "Dandy Logo", type: "dandy_logo", x: 7.8, y: 2.8, fontSize: 18, logoScale: 11.4 }),
    mk({ ...base, label: "Dandy & DSO Name", type: "dso_name", x: 22.5, y: 5, fontSize: 12, bold: false, italic: true, prefix: "Dandy & ", suffix: ":" }),
    mk({ ...base, label: "Phone Number", type: "phone", x: 50, y: 96, fontSize: 8, bold: false }),
    mk({ ...base, label: "Prospect Logo", type: "logo", x: 22.5, y: 4.3, fontSize: 12, bold: false, logoScale: 14, logoWidth: 135, logoHeight: 30 }),
  ];
  // Agreement Summary is procedurally rendered (text edited in dialog), so a
  // clone gets the rendered defaults as a background with no overlays — the
  // user can then drop their own logo, DSO name, etc. on top if they want.
  if (id === "agreement-summary") return [];
  return [
    mk({ ...base, label: "Dandy Logo", type: "dandy_logo", x: 7.8, y: 3.8, fontSize: 18, logoScale: 11.4 }),
    mk({ ...base, label: "Dandy & DSO Name", type: "dso_name", x: 7.8, y: 12.6, fontSize: 16, bold: false, italic: true, prefix: "Dandy & ", suffix: ":" }),
    mk({ ...base, label: "Phone Number", type: "phone", x: 66, y: 95.4, fontSize: 9, bold: false }),
    mk({ ...base, label: "QR Code", type: "qr_code", x: 80.2, y: 66.5, fontSize: 12, color: "#000000", bold: false, defaultValue: "https://meetdandy.com", qrSize: 9.5 }),
    mk({ ...base, label: "Prospect Logo", type: "logo", x: 88, y: 5.3, fontSize: 12, bold: false, logoScale: 11, logoWidth: 70, logoHeight: 26 }),
  ];
};

// ── Font options ──────────────────────────────────────────────────────
const FONT_OPTIONS = [
  { value: "helvetica", label: "Helvetica", css: "Helvetica, Arial, sans-serif" },
  { value: "arial", label: "Arial", css: "Arimo, Arial, sans-serif" },
  { value: "open-sans", label: "Open Sans", css: "'Open Sans', sans-serif" },
  { value: "georgia", label: "Georgia", css: "Lora, Georgia, serif" },
  { value: "times", label: "Times", css: "'Times New Roman', serif" },
  { value: "courier", label: "Courier", css: "'Courier New', monospace" },
];

const getFontCss = (f: string) => FONT_OPTIONS.find(o => o.value === f)?.css || "sans-serif";

// ── Field type definitions (for toolbar) ──────────────────────────────
const FIELD_TYPES: { type: OverlayField["type"]; label: string; icon: React.ReactNode; defaultProps: Partial<OverlayField> }[] = [
  { type: "dso_name", label: "DSO Name", icon: <User className="w-3.5 h-3.5" />, defaultProps: { fontSize: 18, color: "#FFFFFF", bold: true } },
  { type: "phone", label: "Phone", icon: <Phone className="w-3.5 h-3.5" />, defaultProps: { fontSize: 10, color: "#FFFFFF", bold: false } },
  { type: "heading", label: "Heading", icon: <Heading1 className="w-3.5 h-3.5" />, defaultProps: { fontSize: 22, color: "#FFFFFF", bold: true, defaultValue: "Section Heading" } },
  { type: "custom_text", label: "Body Text", icon: <Type className="w-3.5 h-3.5" />, defaultProps: { fontSize: 12, color: "#333333", bold: false, defaultValue: "Text here" } },
  { type: "footer", label: "Footer", icon: <AlignJustify className="w-3.5 h-3.5" />, defaultProps: { fontSize: 9, color: "#FFFFFF", bold: false, defaultValue: "Footer text" } },
  { type: "link", label: "Link / URL", icon: <Link className="w-3.5 h-3.5" />, defaultProps: { fontSize: 10, color: "#7EC8E3", bold: false, underline: true, defaultValue: "https://meetdandy.com" } },
  { type: "divider", label: "Divider Line", icon: <Minus className="w-3.5 h-3.5" />, defaultProps: { fontSize: 10, color: "#FFFFFF", lineThickness: 0.75, width: 80 } },
  { type: "meet_the_team", label: "Meet the Team", icon: <Users className="w-3.5 h-3.5" />, defaultProps: { fontSize: 13, color: "#FFFFFF", bold: true, sectionTitle: "Meet The Team", width: 80, photoSize: 5, teamMembers: [{ name: "Rep Name", title: "Account Executive" }] } },
  { type: "qr_code", label: "QR Code", icon: <QrCode className="w-3.5 h-3.5" />, defaultProps: { fontSize: 12, color: "#000000", qrSize: 12, defaultValue: "https://meetdandy.com" } },
  { type: "logo", label: "Logo", icon: <ImageIcon className="w-3.5 h-3.5" />, defaultProps: { fontSize: 12, color: "#FFFFFF", logoScale: 15 } },
  // "Image" is the same underlying field type as "Logo" (both render a bitmap
  // via field.logoUrl) but exposed separately so marketing has a clear option
  // for decorative / inline images that aren't the prospect's logo. Defaults
  // sized larger than logo so dropped images aren't tiny.
  { type: "logo", label: "Image", icon: <ImageIcon className="w-3.5 h-3.5" />, defaultProps: { fontSize: 12, color: "#FFFFFF", logoScale: 25, label: "Image" } },
  { type: "dandy_logo", label: "Dandy Logo", icon: <FileText className="w-3.5 h-3.5" />, defaultProps: { fontSize: 18, color: "#FFFFFF", logoScale: 13, bold: true } },
];

// ── Coordinate rulers (top + left) ────────────────────────────────────
// Tiny visual aid that shows percent + inch markers along the page edges so
// marketing can position fields against physical coordinates without doing
// math. Page width: 8.5" portrait / 11" landscape; height the inverse.
function Rulers({ orientation, hoverPct }: {
  orientation: "portrait" | "landscape";
  hoverPct?: { x?: number; y?: number };
}) {
  const widthIn = orientation === "portrait" ? 8.5 : 11;
  const heightIn = orientation === "portrait" ? 11 : 8.5;
  const xInchTicks: number[] = [];
  for (let i = 0; i <= Math.floor(widthIn); i++) xInchTicks.push((i / widthIn) * 100);
  const yInchTicks: number[] = [];
  for (let i = 0; i <= Math.floor(heightIn); i++) yInchTicks.push((i / heightIn) * 100);

  return (
    <>
      {/* Top ruler */}
      <div className="absolute top-0 left-0 right-0 h-4 pointer-events-none z-30 bg-background/70 backdrop-blur-sm border-b border-border/50">
        {[0, 25, 50, 75, 100].map(p => (
          <div key={`x-${p}`} className="absolute top-0 h-full text-[8px] text-muted-foreground/80 font-mono leading-4"
            style={{ left: `${p}%`, transform: "translateX(-50%)" }}>
            <div className="absolute top-0 left-1/2 w-px h-2 bg-muted-foreground/40" />
            <span className="absolute top-1.5 left-1/2 -translate-x-1/2">{p}</span>
          </div>
        ))}
        {xInchTicks.map((p, i) => (
          <div key={`xi-${i}`} className="absolute bottom-0 w-px h-1 bg-fuchsia-500/40" style={{ left: `${p}%` }} />
        ))}
        {hoverPct?.x !== undefined && (
          <div className="absolute top-0 h-full px-1 rounded text-[8px] font-mono font-bold text-fuchsia-700 bg-fuchsia-100 border border-fuchsia-300 leading-4"
            style={{ left: `${hoverPct.x}%`, transform: "translateX(-50%)" }}>
            {hoverPct.x.toFixed(0)}%
          </div>
        )}
      </div>
      {/* Left ruler */}
      <div className="absolute top-0 left-0 bottom-0 w-4 pointer-events-none z-30 bg-background/70 backdrop-blur-sm border-r border-border/50">
        {[0, 25, 50, 75, 100].map(p => (
          <div key={`y-${p}`} className="absolute left-0 w-full text-[8px] text-muted-foreground/80 font-mono leading-none"
            style={{ top: `${p}%`, transform: "translateY(-50%)" }}>
            <div className="absolute left-0 top-1/2 h-px w-2 bg-muted-foreground/40" />
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2">{p}</span>
          </div>
        ))}
        {yInchTicks.map((p, i) => (
          <div key={`yi-${i}`} className="absolute right-0 h-px w-1 bg-fuchsia-500/40" style={{ top: `${p}%` }} />
        ))}
        {hoverPct?.y !== undefined && (
          <div className="absolute left-0 w-full px-0.5 rounded text-[8px] font-mono font-bold text-fuchsia-700 bg-fuchsia-100 border border-fuchsia-300 text-center leading-none py-0.5"
            style={{ top: `${hoverPct.y}%`, transform: "translateY(-50%)" }}>
            {hoverPct.y.toFixed(0)}
          </div>
        )}
      </div>
    </>
  );
}

// ── Draggable field overlay ───────────────────────────────────────────
function DraggableField({ field, containerRef, selected, onSelect, onMove, onDuplicate, onDelete, siblings, onDragChange, labelsHidden }: {
  field: OverlayField;
  containerRef: React.RefObject<HTMLDivElement>;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  siblings: OverlayField[];
  onDragChange: (guides: { x?: number; y?: number } | null) => void;
  labelsHidden?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); onSelect(); setDragging(true);
    // Capture on currentTarget (the persistent wrapper) — not e.target — so
    // when the chip morphs from "dot" to "chip" on drag-start the captured
    // node isn't unmounted out from under the pointer.
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    let y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    // T004 — snap-to-grid + alignment guides. Default: 1% grid + soft snap
    // to other fields' x/y and the page center (50). Shift disables snap.
    const guides: { x?: number; y?: number } = {};
    if (!e.shiftKey) {
      const tol = 1.0; // %
      const xTargets = [50, ...siblings.map(s => s.x)];
      const yTargets = [50, ...siblings.map(s => s.y)];
      let bestX: { v: number; d: number } | null = null;
      let bestY: { v: number; d: number } | null = null;
      for (const t of xTargets) {
        const d = Math.abs(x - t);
        if (d <= tol && (!bestX || d < bestX.d)) bestX = { v: t, d };
      }
      for (const t of yTargets) {
        const d = Math.abs(y - t);
        if (d <= tol && (!bestY || d < bestY.d)) bestY = { v: t, d };
      }
      if (bestX) { x = bestX.v; guides.x = bestX.v; }
      else x = Math.round(x); // fall back to 1% grid
      if (bestY) { y = bestY.v; guides.y = bestY.v; }
      else y = Math.round(y);
    }

    onDragChange(guides.x !== undefined || guides.y !== undefined ? guides : null);
    onMove(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };
  const handlePointerUp = () => { setDragging(false); onDragChange(null); };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); onSelect();
    setCtx({ x: e.clientX, y: e.clientY });
  };

  // Live mode: the actual styled text now lives in the PDF canvas behind us.
  // We render a lightweight handle chip with just an icon + short label so the
  // preview text isn't doubled. Click/drag the chip to reposition.
  const shortLabel =
    field.type === "dso_name" ? "DSO" :
    field.type === "phone" ? "Phone" :
    field.type === "qr_code" ? "QR" :
    field.type === "logo" ? "Logo" :
    field.type === "dandy_logo" ? "Dandy" :
    field.type === "divider" ? "Divider" :
    field.type === "meet_the_team" ? "Team" :
    field.type === "heading" ? "Heading" :
    field.type === "footer" ? "Footer" :
    field.type === "link" ? "Link" :
    "Text";

  const fieldIcon =
    field.type === "qr_code" ? <QrCode className="w-3 h-3 shrink-0" /> :
    (field.type === "logo" || field.type === "dandy_logo") ? <ImageIcon className="w-3 h-3 shrink-0" /> :
    field.type === "divider" ? <Minus className="w-3 h-3 shrink-0" /> :
    field.type === "meet_the_team" ? <Users className="w-3 h-3 shrink-0" /> :
    field.type === "link" ? <Link className="w-3 h-3 shrink-0" /> :
    field.type === "heading" ? <Heading1 className="w-3 h-3 shrink-0" /> :
    field.type === "footer" ? <AlignJustify className="w-3 h-3 shrink-0" /> :
    field.type === "phone" ? <Phone className="w-3 h-3 shrink-0" /> :
    field.type === "dso_name" ? <User className="w-3 h-3 shrink-0" /> :
    <Type className="w-3 h-3 shrink-0" />;

  return (
    <>
      {/* Anchor crosshair at the field's exact anchor point (top-left of the
          rendered text in jsPDF baseline space). */}
      {selected && (
        <div
          className="absolute pointer-events-none z-20"
          style={{ left: `${field.x}%`, top: `${field.y}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="w-3 h-3 rounded-full border-2 border-primary bg-background/80" />
        </div>
      )}
      {/* Persistent wrapper anchored at the field's (x,y) — pointer capture
          lives on this element so we don't lose the drag when the inner
          dot/chip swap unmounts. The inner child carries its own transform
          (centered dot vs. up-and-right chip) so the visual offset is
          preserved without remounting the capture target. */}
      <div
        className={`absolute select-none touch-none ${dragging ? "z-40" : "z-30"}`}
        style={{ left: `${field.x}%`, top: `${field.y}%` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        title={labelsHidden && !selected && !dragging ? shortLabel : undefined}
      >
        {labelsHidden && !selected && !dragging ? (
          <div
            className="w-2.5 h-2.5 rounded-full border border-white/80 shadow-sm cursor-grab active:cursor-grabbing hover:scale-150 transition-transform"
            style={{ backgroundColor: field.color || "#666", transform: "translate(-50%, -50%)" }}
          />
        ) : (
          <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium cursor-grab active:cursor-grabbing whitespace-nowrap shadow-sm ${selected ? "bg-primary text-primary-foreground ring-2 ring-primary" : "bg-background/90 text-foreground/80 ring-1 ring-border hover:ring-primary/50"} ${dragging ? "opacity-90 scale-105" : ""}`}
            style={{ transform: "translate(4px, -110%)" }}>
            {fieldIcon}
            <span>{shortLabel}</span>
            {field.editableBySales && (
              <span className={`ml-0.5 rounded px-1 py-px text-[8px] font-bold uppercase ${selected ? "bg-primary-foreground/30" : "bg-primary/15 text-primary"}`} title="Sales reps can edit this field">
                S
              </span>
            )}
          </div>
        )}
      </div>
      {ctx && (
        <div
          className="fixed z-50 rounded-lg border border-border bg-popover shadow-lg py-1 min-w-[130px]"
          style={{ top: ctx.y, left: ctx.x }}
          onPointerDown={e => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
            onMouseDown={() => { onDuplicate(); setCtx(null); }}
          >
            <Copy className="w-3 h-3" /> Duplicate
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5 transition-colors"
            onMouseDown={() => { onDelete(); setCtx(null); }}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <div className="h-px bg-border my-1" />
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            onMouseDown={() => setCtx(null)}
          >
            <X className="w-3 h-3" /> Dismiss
          </button>
        </div>
      )}
      {ctx && <div className="fixed inset-0 z-40" onClick={() => setCtx(null)} />}
    </>
  );
}

// ── Drag toolbar item ─────────────────────────────────────────────────
function ToolbarFieldItem({ index, label, icon, onDragStart }: {
  index: number; label: string; icon: React.ReactNode;
  onDragStart: (index: number) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 cursor-grab active:cursor-grabbing transition-colors"
      title={`Drag to place ${label}`}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
      <GripVertical className="w-3 h-3 text-muted-foreground ml-auto" />
    </div>
  );
}

// ── Visibility Toggle ─────────────────────────────────────────────────
function VisibilityToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} title={on ? "Hide from sales reps" : "Show to sales reps"} className="shrink-0">
      {on ? (
        <div className="w-9 h-5 rounded-full bg-primary flex items-center justify-end px-0.5 transition-colors">
          <div className="w-4 h-4 rounded-full bg-primary-foreground" />
        </div>
      ) : (
        <div className="w-9 h-5 rounded-full bg-muted flex items-center justify-start px-0.5 transition-colors">
          <div className="w-4 h-4 rounded-full bg-muted-foreground/40" />
        </div>
      )}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════
// TEMPLATE CARD
// ════════════════════════════════════════════════════════════════════
function TemplateCard({ tpl, isBuiltin, visible, onToggleVisibility, onEdit, onClone, onDelete, onRestore, onGeneratePdf, cloning }: {
  tpl: { id: string; label: string; description?: string; backgroundUrl?: string; fieldCount?: number; isDeleted?: boolean };
  isBuiltin: boolean; visible: boolean;
  onToggleVisibility: () => void;
  onEdit?: () => void;
  onClone: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  onGeneratePdf?: () => void;
  cloning?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const deleted = tpl.isDeleted;

  return (
    <div className={`relative rounded-xl border bg-card overflow-hidden flex flex-col transition-opacity ${deleted ? "opacity-60" : ""} ${visible ? "border-border" : "border-border/50"}`}>
      {/* Thumbnail */}
      <div className="relative bg-muted aspect-[8.5/11] overflow-hidden">
        {tpl.backgroundUrl ? (
          <img src={tpl.backgroundUrl} alt={tpl.label} className="w-full h-full object-cover" />
        ) : isBuiltin ? (
          <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-800 to-slate-900 p-3 gap-1.5">
            <div className="w-5 h-5 rounded bg-white/20 flex items-center justify-center mb-1">
              <LayoutTemplate className="w-3 h-3 text-white/80" />
            </div>
            <div className="h-1.5 bg-white/70 rounded-full w-4/5" />
            <div className="h-1 bg-white/30 rounded-full w-3/5" />
            <div className="mt-2 space-y-1 flex-1">
              {[85, 70, 60, 75, 55, 80, 65].map((w, i) => (
                <div key={i} className="h-0.5 bg-white/20 rounded-full" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="h-1 bg-white/10 rounded-full w-2/5 mt-auto" />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <LayoutTemplate className="w-8 h-8 opacity-30" />
            <span className="text-[10px] opacity-50">No preview</span>
          </div>
        )}
        {!visible && !deleted && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <EyeOff className="w-6 h-6 text-muted-foreground opacity-60" />
          </div>
        )}
        {deleted && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-xs font-semibold text-muted-foreground bg-background/80 px-2 py-1 rounded">Deleted</span>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="p-3 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${deleted ? "line-through text-muted-foreground" : "text-foreground"}`}>{tpl.label}</p>
          {tpl.description && <p className="text-[11px] text-muted-foreground truncate">{tpl.description}</p>}
          {tpl.fieldCount !== undefined && <p className="text-[10px] text-muted-foreground">{tpl.fieldCount} field{tpl.fieldCount !== 1 ? "s" : ""}</p>}
        </div>

        {!deleted ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <VisibilityToggle on={visible} onChange={onToggleVisibility} />
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-full mb-1 w-40 bg-popover border border-border rounded-lg shadow-lg py-1 z-50" onMouseLeave={() => setMenuOpen(false)}>
                  {onEdit && (
                    <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors">
                      <Settings2 className="w-3.5 h-3.5 text-muted-foreground" /> Edit
                    </button>
                  )}
                  <button onClick={() => { onClone(); setMenuOpen(false); }} disabled={cloning} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors disabled:opacity-50">
                    {cloning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />} Clone
                  </button>
                  {onGeneratePdf && (
                    <button onClick={() => { onGeneratePdf(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors">
                      <FileDown className="w-3.5 h-3.5 text-muted-foreground" /> Generate PDF
                    </button>
                  )}
                  <div className="my-1 border-t border-border" />
                  <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/5 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> {isBuiltin ? "Remove" : "Delete"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : onRestore ? (
          <button onClick={onRestore} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Restore
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PDF GENERATE DIALOG
// ════════════════════════════════════════════════════════════════════
const PILOT_AUDIENCES = [
  { value: "executive", label: "Executive" },
  { value: "clinical", label: "Clinical" },
  { value: "practice-manager", label: "Practice Manager" },
] as const;

function GeneratePdfDialog({ tpl, onClose, isBuiltin, builtinId }: {
  tpl?: CustomTemplate;
  isBuiltin?: boolean;
  builtinId?: BuiltinId;
  onClose: () => void;
}) {
  // Task #342 — fetch tenant brand so this rep-facing dialog scrubs Dandy
  // copy out of generated PDFs for non-Dandy tenants.
  const [brand, setBrand] = useState<BrandConfigT>(DEFAULT_BRAND);
  useEffect(() => { fetchBrandConfig().then(setBrand).catch(() => {}); }, []);
  const isDandy = (brand.brandName ?? "").trim().toLowerCase() === "dandy";
  const brandLabel = (brand.brandName || "").trim();
  const brandSlug = (brand.brandName || "report")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]+/g, "") || "report";
  const brandQrFallback = isDandy
    ? "https://meetdandy.com"
    : (brand.defaultCtaUrl && brand.defaultCtaUrl !== "#" ? brand.defaultCtaUrl : "");
  const brandContext: BrandContextT | undefined = isDandy ? undefined : {
    wordmark: brandLabel.toLowerCase(),
    productName: brandLabel || "Our Lab",
    industryLabel: "Group",
    labName: brandLabel || "Our Lab",
    footerUrl: (brand.defaultCtaUrl && brand.defaultCtaUrl !== "#")
      ? brand.defaultCtaUrl.replace(/^https?:\/\//, "")
      : "",
    qrFallbackUrl: brandQrFallback || "",
    agreementName: `${brandLabel || "Partner"} Practice Agreement`,
    agreementUrl: brand.defaultCtaUrl && brand.defaultCtaUrl !== "#" ? brand.defaultCtaUrl : "",
  };
  const oneAssets = resolveOnePagerAssets(brand);

  const isAgreement = builtinId === "agreement-summary";
  const [dsoName, setDsoName] = useState("");
  const [phone, setPhone] = useState("");
  // Start empty so the shared generator falls back to brand.qrFallbackUrl
  // (sourced from brand_settings) for non-Dandy tenants. Seed from brand
  // once it loads, unless the rep has already typed a custom URL.
  const [qrUrl, setQrUrl] = useState("");
  const qrUrlTouched = useRef(false);
  useEffect(() => {
    if (qrUrlTouched.current) return;
    if (brandQrFallback) setQrUrl(brandQrFallback);
  }, [brandQrFallback]);
  const [audience, setAudience] = useState<"executive" | "clinical" | "practice-manager">("executive");
  const [generating, setGenerating] = useState(false);

  // Auto-form for custom templates: collect a value per field marketing
  // marked `editableBySales`, keyed by field.id. Initialize from each field's
  // default value so unchanged inputs ship the marketing default.
  const editableFields = tpl?.fields.filter(f => f.editableBySales) ?? [];
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    editableFields.forEach(f => { init[f.id] = f.defaultValue || ""; });
    return init;
  });
  // If template has no flagged fields, fall back to legacy generic inputs
  // so existing templates (created before the flag existed) still work.
  const hasAnyFlag = editableFields.length > 0;
  const showLegacyInputs = !!tpl && !hasAnyFlag;
  // Agreement-summary editable content. Spread the *full* default so all
  // optional fields (font sizes, footer contacts, header/footer height,
  // headline/sub offsets, divider toggle, footer link) flow through to the
  // PDF — the dialog only exposes a subset of these for editing, but we
  // preserve everything else from the admin-saved layout below.
  const [agreement, setAgreement] = useState<AgreementSummaryContent>(() => ({
    ...defaultAgreementSummaryContent,
    sections: defaultAgreementSummaryContent.sections.map(s => ({ ...s })),
  }));

  // On mount, fetch the admin-saved Template-Editor layout and merge it on
  // top of defaults so reps see the version configured for their tenant
  // (font sizes, footer contacts, footer link, etc.).
  useEffect(() => {
    if (!isAgreement) return;
    let cancelled = false;
    loadLayoutDefault("dandy_agreement_summary_template_layout")
      .then(saved => {
        if (cancelled || !saved) return;
        setAgreement(p => ({ ...p, ...saved }));
      })
      .catch(() => { /* fall back to defaults */ });
    return () => { cancelled = true; };
  }, [isAgreement]);

  const updateAgreementSection = (idx: number, updates: Partial<AgreementSection>) => {
    setAgreement(p => ({
      ...p,
      sections: p.sections.map((s, i) => i === idx ? { ...s, ...updates } : s),
    }));
  };

  const resetAgreementDefaults = () => {
    setAgreement({
      ...defaultAgreementSummaryContent,
      sections: defaultAgreementSummaryContent.sections.map(s => ({ ...s })),
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      if (isBuiltin && builtinId) {
        let doc: jsPDF;
        const groupLabel = brandContext?.industryLabel || "DSO";
        if (builtinId === "roi") doc = await generateROIOnePager(dsoName || groupLabel, 50, undefined, brandContext, oneAssets);
        else if (builtinId === "pilot") doc = await generatePilotOnePager(dsoName || groupLabel, audience, [], phone, null, { w: 0, h: 0 }, defaultAudienceContent[audience], undefined, undefined, undefined, undefined, brandContext, oneAssets);
        else if (builtinId === "comparison") doc = await generateComparisonOnePager(dsoName || groupLabel, [], phone, null, { w: 0, h: 0 }, undefined, undefined, undefined, undefined, brandContext, oneAssets);
        else if (builtinId === "agreement-summary") doc = await generateAgreementSummaryOnePager(agreement, brandContext, oneAssets);
        else doc = await generateNewPartnerOnePager(dsoName || groupLabel, null, { w: 0, h: 0 }, qrUrl, undefined, undefined, brandContext, oneAssets);
        const baseName = isAgreement ? (agreement.headline || "Agreement_Summary") : (dsoName || builtinId);
        doc.save(`${baseName.replace(/\s+/g, "_")}_OnePager.pdf`);
      } else if (tpl) {
        // Build values: per-field-id from auto-generated form, plus legacy
        // generic keys for backward compatibility with templates that haven't
        // flagged any fields editableBySales yet.
        const values: Record<string, string> = { ...customValues };
        if (showLegacyInputs) {
          values.dso_name = dsoName;
          values.phone = phone;
          values.qr_url = qrUrl;
        }
        const doc = await generateCustomTemplatePdf(tpl, values, dandyLogoWhiteUrl);
        // Use a sensible filename: prefer DSO-name-like value, fall back to template name
        const dsoLike = values.dso_name || Object.values(customValues).find(v => v && v.length < 60) || tpl.name;
        doc.save(`${dsoLike.replace(/\s+/g, "_")}_OnePager.pdf`);
      }
      toast({ title: "PDF downloaded" });
      onClose();
    } catch (err) {
      toast({ title: "PDF generation failed", description: String(err), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // ── Agreement Summary form (wider dialog with scrollable section grid)
  if (isAgreement) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 py-6">
        <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold">Generate Agreement Summary PDF</h3>
              <p className="text-xs text-muted-foreground mt-0.5">All text is editable. Defaults match the standard Dandy Agreement.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetAgreementDefaults}
                disabled={generating}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors flex items-center gap-1"
                title="Reset to default text"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Headline</label>
              <input
                type="text"
                value={agreement.headline}
                onChange={e => setAgreement(p => ({ ...p, headline: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Subheadline</label>
              <textarea
                value={agreement.subheadline}
                onChange={e => setAgreement(p => ({ ...p, subheadline: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
              />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sections</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {agreement.sections.map((section, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
                    <input
                      type="text"
                      value={section.label}
                      onChange={e => updateAgreementSection(idx, { label: e.target.value })}
                      placeholder="Section label"
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <textarea
                      value={section.body}
                      onChange={e => updateAgreementSection(idx, { body: e.target.value })}
                      rows={4}
                      placeholder="Section body"
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-snug"
                    />
                    <AgreementNumbersEditor
                      body={section.body}
                      onChange={next => updateAgreementSection(idx, { body: next })}
                      size="xs"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Footer</label>
              <textarea
                value={agreement.footer}
                onChange={e => setAgreement(p => ({ ...p, footer: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 p-6 pt-3 border-t border-border">
            <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Generate PDF</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          {/* Custom templates with explicit editable-by-sales fields:
              auto-render one input per flagged field, keyed by field.id.
              Marketing's salesLabel/salesHelpText surface here. */}
          {tpl && hasAnyFlag && (
            <>
              {editableFields.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No fields are exposed to sales. Click any field in the editor and toggle "Editable by sales".
                </p>
              ) : null}
              {editableFields.map(f => (
                <div key={f.id}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                    {f.salesLabel || f.label}
                  </label>
                  <input
                    type={f.type === "qr_code" || f.type === "link" ? "url" : "text"}
                    value={customValues[f.id] ?? ""}
                    onChange={e => setCustomValues(p => ({ ...p, [f.id]: e.target.value }))}
                    placeholder={f.defaultValue || ""}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  {f.salesHelpText && (
                    <p className="text-[10px] text-muted-foreground mt-1">{f.salesHelpText}</p>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Builtin templates and legacy custom templates (no fields flagged):
              keep the original DSO / Phone / QR inputs so existing templates
              keep working unchanged. */}
          {(isBuiltin || showLegacyInputs) && (
            <>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">DSO / Practice Name</label>
                <input type="text" value={dsoName} onChange={e => setDsoName(e.target.value)} placeholder="e.g. Acme DSO" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              {/* Audience picker — only relevant for Pilot template */}
              {builtinId === "pilot" && (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Audience</label>
                  <div className="inline-flex w-full rounded-lg border border-border overflow-hidden">
                    {PILOT_AUDIENCES.map(a => (
                      <button
                        key={a.value}
                        onClick={() => setAudience(a.value)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${audience === a.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Phone Number</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. (555) 123-4567" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">QR Code URL</label>
                <input type="url" value={qrUrl} onChange={e => { qrUrlTouched.current = true; setQrUrl(e.target.value); }} placeholder={brandQrFallback || "https://example.com"} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleGenerate} disabled={generating} className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TEMPLATE EDITOR
// ════════════════════════════════════════════════════════════════════
function TemplateEditor({ initial, onSave, onCancel }: {
  initial?: CustomTemplate;
  onSave: (tpl: CustomTemplate) => Promise<void>;
  onCancel: () => void;
}) {
  const [tpl, setTpl] = useState<CustomTemplate>(initial ?? { name: "", background_url: "", orientation: "portrait", fields: [], headerHeight: 30 });
  const [bgPreview, setBgPreview] = useState<string | null>(initial?.background_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Index into FIELD_TYPES (not the type string) — multiple entries can share
  // the same underlying type (e.g. "Logo" + "Image" both render via type "logo")
  // so we need the exact entry to pull the right defaults on drop.
  const [dragType, setDragType] = useState<number | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [headerImgUploading, setHeaderImgUploading] = useState(false);
  const [memberPhotoUploading, setMemberPhotoUploading] = useState(false);
  const [pendingPhotoMemberIdx, setPendingPhotoMemberIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const headerImgRef = useRef<HTMLInputElement>(null);
  const memberPhotoRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTokenRef = useRef(0);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // T004 — alignment guides shown while a field is actively being dragged.
  // Children call onDragChange to publish the snap targets; cleared on release.
  const [dragGuides, setDragGuides] = useState<{ x?: number; y?: number } | null>(null);
  // Hide handle chips so marketing can preview the design without label clutter.
  // Selected fields still show their chip so they can be edited/dragged.
  const [labelsHidden, setLabelsHidden] = useState(false);
  // Inline image upload spinner for the Logo / Image properties panel.
  const [logoImgUploading, setLogoImgUploading] = useState(false);
  // Track image-preview load failures keyed by URL so the preview can
  // recover when the user pastes a corrected URL (instead of staying hidden
  // via a one-shot inline style mutation).
  const [logoImgErrorUrl, setLogoImgErrorUrl] = useState<string | null>(null);
  const logoImgInputRef = useRef<HTMLInputElement>(null);

  const selectedField = tpl.fields.find(f => f.id === selectedId) ?? null;

  // Regenerate preset background when orientation changes
  const prevOrientationRef = useRef(tpl.orientation);
  useEffect(() => {
    if (prevOrientationRef.current === tpl.orientation) return;
    prevOrientationRef.current = tpl.orientation;
    if (!activePresetId) return;
    setUploading(true);
    generatePresetBg(activePresetId, tpl.orientation, tpl.headerImageUrl)
      .then(newBg => {
        setBgPreview(newBg);
        setTpl(p => ({ ...p, background_url: newBg }));
      })
      .catch(() => {})
      .finally(() => setUploading(false));
  }, [tpl.orientation, activePresetId, tpl.headerImageUrl]);

  // ── Live PDF preview ─────────────────────────────────────────────────
  // Render the actual jsPDF output via pdf.js inside the editor canvas, so
  // what marketing sees is byte-for-byte what sales will download. Debounced
  // 250ms; uses a render token to discard stale renders if the template
  // changes mid-render.
  useEffect(() => {
    if (!bgPreview && tpl.fields.length === 0) return;
    const token = ++renderTokenRef.current;
    const handle = window.setTimeout(async () => {
      setPdfRendering(true);
      setPdfError(null);
      try {
        // Build placeholder values so empty text fields still show in preview
        const previewValues: Record<string, string> = {};
        for (const f of tpl.fields) {
          const isText = f.type === "heading" || f.type === "footer" || f.type === "custom_text" || f.type === "dso_name" || f.type === "phone" || f.type === "link";
          if (isText && !f.defaultValue) {
            previewValues[f.id] = `{${f.salesLabel || f.label}}`;
          }
        }
        const doc = await generateCustomTemplatePdf(tpl, previewValues, dandyLogoWhiteUrl);
        if (token !== renderTokenRef.current) return;
        const buf = doc.output("arraybuffer");
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
        if (token !== renderTokenRef.current) return;
        const page = await pdfDoc.getPage(1);
        const canvas = pdfCanvasRef.current;
        if (!canvas || token !== renderTokenRef.current) return;
        const containerW = canvas.parentElement?.clientWidth ?? 600;
        const vp1 = page.getViewport({ scale: 1 });
        const dpr = window.devicePixelRatio || 1;
        const cssScale = containerW / vp1.width;
        const vp = page.getViewport({ scale: cssScale * dpr });
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = `${vp1.width * cssScale}px`;
        canvas.style.height = `${vp1.height * cssScale}px`;
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
      } catch (err) {
        if (token === renderTokenRef.current) {
          setPdfError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (token === renderTokenRef.current) setPdfRendering(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [tpl, bgPreview]);

  const updateField = (id: string, updates: Partial<OverlayField>) =>
    setTpl(p => ({ ...p, fields: p.fields.map(f => f.id === id ? { ...f, ...updates } : f) }));
  const removeField = (id: string) => { setTpl(p => ({ ...p, fields: p.fields.filter(f => f.id !== id) })); setSelectedId(null); };
  const duplicateField = (id: string) => {
    const f = tpl.fields.find(ff => ff.id === id); if (!f) return;
    const newF = { ...f, id: crypto.randomUUID(), x: Math.min(f.x + 3, 95), y: Math.min(f.y + 3, 95) };
    setTpl(p => ({ ...p, fields: [...p.fields, newF] }));
    setSelectedId(newF.id);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = ""; // reset so the same file can be re-selected

    // T007 — file size limit. Anything larger than 10MB will either OOM the
    // PDF rasterizer or blow past the upload-bg endpoint's body limit, so
    // reject up-front with a clear message instead of silently failing later.
    const MAX_BG_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BG_BYTES) {
      toast({
        title: "File too large",
        description: `Background must be under 10MB (yours is ${(file.size / 1024 / 1024).toFixed(1)}MB).`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    let uploadFile = file;
    let renderedW = 0;
    let renderedH = 0;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      try {
        // Multi-page PDFs: prompt the user to pick a page (defaults to 1).
        // Using window.prompt keeps this scoped to the importer flow without
        // requiring a full modal — the editor itself will then re-render the
        // chosen page as the background image.
        let pageNum = 1;
        const total = await pdfPageCount(file);
        if (total > 1) {
          const answer = window.prompt(
            `This PDF has ${total} pages. Which page do you want to use as the background?`,
            "1",
          );
          if (answer === null) {
            // user cancelled
            setUploading(false);
            return;
          }
          const parsed = parseInt(answer, 10);
          if (!Number.isFinite(parsed) || parsed < 1 || parsed > total) {
            toast({
              title: "Invalid page",
              description: `Enter a number between 1 and ${total}.`,
              variant: "destructive",
            });
            setUploading(false);
            return;
          }
          pageNum = parsed;
        }
        const { blob, width, height } = await pdfToImageBlob(file, pageNum);
        uploadFile = new File([blob], file.name.replace(/\.pdf$/i, ".png"), { type: "image/png" });
        renderedW = width;
        renderedH = height;
      } catch (err) {
        toast({
          title: "PDF conversion failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
    } else {
      // For images, sniff dimensions so we can still detect orientation mismatch.
      try {
        const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
          img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Could not read image")); };
          img.src = url;
        });
        renderedW = dims.w;
        renderedH = dims.h;
      } catch {
        // Non-fatal: skip the orientation hint if we can't read dimensions.
      }
    }

    // T007 — surface the real upload error instead of silently writing a
    // multi-MB data URL into the database row (which would bloat the saved
    // template, break thumbnails, and hide the actual server problem).
    try {
      const formData = new FormData(); formData.append("file", uploadFile);
      const res = await fetch(`${API_BASE}/sales/one-pager-templates/upload-bg`, { method: "POST", body: formData });
      if (!res.ok) {
        let detail = `${res.status} ${res.statusText}`;
        try {
          const body = await res.text();
          if (body) detail = body.slice(0, 240);
        } catch { /* keep status text */ }
        throw new Error(detail);
      }
      const { url } = await res.json();
      setBgPreview(url); setTpl(p => ({ ...p, background_url: url }));

      // T007 — orientation-mismatch hint. If the source page is clearly
      // landscape but the template is portrait (or vice versa), offer to swap.
      if (renderedW > 0 && renderedH > 0) {
        const sourceLandscape = renderedW > renderedH;
        const templateLandscape = tpl.orientation === "landscape";
        if (sourceLandscape !== templateLandscape) {
          const want = sourceLandscape ? "landscape" : "portrait";
          if (window.confirm(
            `This file is ${want} but the template is ${tpl.orientation}. Switch the template to ${want}?`,
          )) {
            setTpl(p => ({ ...p, orientation: want }));
          }
        }
      }
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleHeaderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    setHeaderImgUploading(true);
    try {
      // Upload to object storage
      let imgUrl: string;
      try {
        const formData = new FormData(); formData.append("file", file);
        const res = await fetch(`${API_BASE}/sales/one-pager-templates/upload-bg`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const { url } = await res.json();
        imgUrl = url;
      } catch {
        // Fallback to local data URL
        imgUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = ev => res(ev.target?.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
      }
      // Composite the image into the split-header background and save
      const presetId = activePresetId ?? "preset:green-split";
      const newBg = await generatePresetBg(presetId, tpl.orientation, imgUrl);
      setBgPreview(newBg);
      setTpl(p => ({ ...p, background_url: newBg, headerImageUrl: imgUrl }));
      toast({ title: "Header photo updated" });
    } catch {
      toast({ title: "Failed to upload header photo", variant: "destructive" });
    } finally {
      setHeaderImgUploading(false);
    }
  };

  const handleMemberPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    if (pendingPhotoMemberIdx === null || !selectedId) return;
    setMemberPhotoUploading(true);
    try {
      let imgUrl: string;
      try {
        const formData = new FormData(); formData.append("file", file);
        const res = await fetch(`${API_BASE}/sales/one-pager-templates/upload-bg`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const { url } = await res.json();
        imgUrl = url;
      } catch {
        imgUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = ev => res(ev.target?.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
      }
      setTpl(p => ({
        ...p,
        fields: p.fields.map(f => {
          if (f.id !== selectedId) return f;
          const members: TeamMember[] = (f.teamMembers ?? []).map((mm: TeamMember, i: number) =>
            i === pendingPhotoMemberIdx ? { ...mm, photoUrl: imgUrl } : mm
          );
          return { ...f, teamMembers: members };
        }),
      }));
      toast({ title: "Photo uploaded" });
    } catch {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    } finally {
      setMemberPhotoUploading(false);
      setPendingPhotoMemberIdx(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragType === null || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const def = FIELD_TYPES[dragType];
    if (!def) { setDragType(null); return; }
    const newId = crypto.randomUUID();
    const newField: OverlayField = {
      id: newId, label: def.label, type: def.type, x: Math.max(0, Math.min(95, x)), y: Math.max(0, Math.min(95, y)),
      fontSize: 14, fontFamily: "helvetica", color: "#FFFFFF", bold: false, italic: false, defaultValue: "",
      ...def.defaultProps,
    };
    setTpl(p => ({ ...p, fields: [...p.fields, newField] }));
    setSelectedId(newId);
    setDragType(null);
  };

  const handleSave = async () => {
    if (!tpl.name.trim()) { toast({ title: "Template name is required", variant: "destructive" }); return; }
    setSaving(true);
    try { await onSave(tpl); } catch (err) { toast({ title: "Save failed", description: String(err), variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const isLandscape = tpl.orientation === "landscape";

  return (
    <div className="h-full flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={tpl.name}
            onChange={e => setTpl(p => ({ ...p, name: e.target.value }))}
            placeholder="Template name…"
            className="w-full bg-transparent text-base font-semibold text-foreground border-b border-transparent focus:border-primary/30 focus:outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-full border border-border overflow-hidden">
            {(["portrait", "landscape"] as const).map(o => (
              <button key={o} onClick={() => setTpl(p => ({ ...p, orientation: o }))}
                className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all ${tpl.orientation === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}>
                {o}
              </button>
            ))}
          </div>
          {tpl.id && (
            <button onClick={() => setPdfOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
              <FileDown className="w-4 h-4" /> PDF
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {pdfOpen && tpl.id && (
        <GeneratePdfDialog tpl={tpl} onClose={() => setPdfOpen(false)} />
      )}

      {/* Editor body: toolbar | preview | properties */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: field type toolbar */}
        <div className="w-44 shrink-0 flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Field Types</p>
          <p className="text-[10px] text-muted-foreground">Drag onto preview to place</p>
          <div className="flex flex-col gap-1.5 mt-1">
            {FIELD_TYPES.map((ft, i) => (
              <ToolbarFieldItem key={`${ft.type}-${ft.label}`} index={i} label={ft.label} icon={ft.icon} onDragStart={idx => setDragType(idx)} />
            ))}
          </div>
          {tpl.fields.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Placed Fields</p>
              <div className="flex flex-col gap-1">
                {tpl.fields.map(f => (
                  <button key={f.id} onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
                    className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-left transition-colors ${f.id === selectedId ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                    <span className="truncate">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: preview canvas */}
        <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
          {!bgPreview ? (
            <div className="w-full flex-1 flex flex-col items-start gap-5 rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 overflow-y-auto">
              {/* Preset starters */}
              <div className="w-full">
                <p className="text-xs font-semibold text-foreground mb-3">Start with a preset layout</p>
                <div className="flex gap-3">
                  {PRESET_BACKGROUNDS.map(preset => (
                    <button
                      key={preset.id}
                      disabled={uploading}
                      onClick={async () => {
                        setUploading(true);
                        try {
                          const dataUrl = await generatePresetBg(preset.id, tpl.orientation);
                          setBgPreview(dataUrl);
                          setActivePresetId(preset.id);
                          setTpl(p => ({ ...p, background_url: dataUrl, headerImageUrl: undefined }));
                        } catch { toast({ title: "Failed to generate background", variant: "destructive" }); }
                        finally { setUploading(false); }
                      }}
                      className="flex-1 max-w-[140px] rounded-lg border border-border bg-background hover:border-primary/60 hover:shadow-md transition-all overflow-hidden disabled:opacity-50 text-left"
                    >
                      {/* Mini visual preview */}
                      <div className="relative overflow-hidden" style={{ aspectRatio: "8.5/11" }}>
                        {/* white body */}
                        <div className="absolute inset-0 bg-white" />
                        {/* green header */}
                        <div className="absolute inset-x-0 top-0 h-[30%]" style={{ backgroundColor: "#002820" }} />
                        {/* right image placeholder for split layout */}
                        {preset.id === "preset:green-split" && (
                          <div className="absolute top-0 right-0 w-[52%] h-[30%] flex items-center justify-center" style={{ backgroundColor: "#143228" }}>
                            <ImageIcon className="w-4 h-4 text-white/30" />
                          </div>
                        )}
                        {/* content lines */}
                        <div className="absolute bottom-0 inset-x-0 top-[32%] p-2 flex flex-col gap-1">
                          {[70, 50, 80, 60, 75, 55, 65].map((w, i) => (
                            <div key={i} className="h-0.5 rounded-full bg-gray-200" style={{ width: `${w}%` }} />
                          ))}
                        </div>
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[11px] font-semibold text-foreground truncate">{preset.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{preset.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Divider */}
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">or upload your own</span>
                <div className="flex-1 border-t border-border" />
              </div>
              {/* Upload */}
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="text-center space-y-1">
                  <Upload className="w-7 h-7 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-muted-foreground">Upload background image or PDF</p>
                  <p className="text-xs text-muted-foreground/70">PNG, JPG, PDF supported</p>
                </div>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Processing…" : "Choose file"}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex-1 w-full">
              <div
                ref={previewRef}
                className="relative rounded-lg overflow-hidden border border-border cursor-crosshair bg-gray-100 mx-auto"
                style={{ aspectRatio: isLandscape ? "11/8.5" : "8.5/11", maxHeight: "calc(100vh - 220px)", width: "auto", maxWidth: "100%" }}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={e => { const tag = (e.target as HTMLElement).tagName; if (e.target === previewRef.current || tag === "CANVAS") setSelectedId(null); }}
              >
                {/* Live PDF preview canvas — same render code as the export */}
                <canvas ref={pdfCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none bg-white" />
                {pdfRendering && (
                  <div className="absolute top-2 left-2 z-40 flex items-center gap-1.5 rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm pointer-events-none">
                    <Loader2 className="w-3 h-3 animate-spin" /> Rendering…
                  </div>
                )}
                {pdfError && (
                  <div className="absolute top-2 left-2 z-40 flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive shadow-sm pointer-events-none">
                    <AlertCircle className="w-3 h-3" /> Preview error: {pdfError}
                  </div>
                )}
                {tpl.fields.map(f => (
                  <DraggableField key={f.id} field={f} containerRef={previewRef as React.RefObject<HTMLDivElement>}
                    selected={selectedId === f.id} onSelect={() => setSelectedId(f.id)}
                    onMove={(x, y) => updateField(f.id, { x, y })}
                    onDuplicate={() => duplicateField(f.id)}
                    onDelete={() => removeField(f.id)}
                    siblings={tpl.fields.filter(s => s.id !== f.id)}
                    onDragChange={setDragGuides}
                    labelsHidden={labelsHidden} />
                ))}

                {/* Hide / show labels toggle — placed left of the
                    clear-background "X" (top-2 right-2) so the two controls
                    don't overlap. When labels are hidden, field chips
                    collapse to small colored dots so the actual PDF design
                    is unobstructed. */}
                <button
                  type="button"
                  onClick={() => setLabelsHidden(h => !h)}
                  className="absolute top-2 right-12 z-50 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground/80 ring-1 ring-border hover:ring-primary/50 hover:text-foreground shadow-sm"
                  title={labelsHidden ? "Show field labels" : "Hide field labels for a cleaner preview"}
                >
                  {labelsHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {labelsHidden ? "Show labels" : "Hide labels"}
                </button>

                {/* T004 — alignment guide lines drawn while dragging.
                    Vertical guide on the snapped X, horizontal on snapped Y. */}
                {dragGuides?.x !== undefined && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-50 border-l border-dashed border-fuchsia-500/80"
                    style={{ left: `${dragGuides.x}%` }}
                  />
                )}
                {dragGuides?.y !== undefined && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none z-50 border-t border-dashed border-fuchsia-500/80"
                    style={{ top: `${dragGuides.y}%` }}
                  />
                )}

                {/* T004 — coordinate rulers (% on the bar, ~inch ticks below).
                    Page is 8.5" wide portrait / 11" wide landscape; height
                    is the inverse. Ticks are evenly spaced at the proper
                    fraction so users can eyeball physical inches. */}
                <Rulers orientation={(tpl.orientation === "landscape" ? "landscape" : "portrait")} hoverPct={dragGuides ?? undefined} />
                {tpl.fields.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="bg-black/40 text-white text-xs px-3 py-1.5 rounded-full">Drag field types from the left panel to place them</p>
                  </div>
                )}
                <button onClick={() => { setBgPreview(null); setTpl(p => ({ ...p, background_url: "" })); }}
                  className="absolute top-2 right-2 rounded-full bg-background/80 p-1 hover:bg-background transition-colors z-40">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1">Drag fields from toolbar to place • Drag placed fields to reposition</p>
            </div>
          )}
          {bgPreview && (
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Upload className="w-3.5 h-3.5" /> Change background
              </button>
              {/* Header image uploader — shown for split preset or when a header image is already set */}
              {(activePresetId === "preset:green-split" || tpl.headerImageUrl) && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => headerImgRef.current?.click()}
                    disabled={headerImgUploading}
                    className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors font-medium"
                  >
                    {headerImgUploading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <ImageIcon className="w-3.5 h-3.5" />}
                    {tpl.headerImageUrl ? "Change header photo" : "Upload header photo →"}
                  </button>
                  {tpl.headerImageUrl && (
                    <button
                      title="Remove header photo"
                      onClick={async () => {
                        const presetId = activePresetId ?? "preset:green-split";
                        const newBg = await generatePresetBg(presetId, tpl.orientation, undefined);
                        setBgPreview(newBg);
                        setTpl(p => ({ ...p, background_url: newBg, headerImageUrl: undefined }));
                      }}
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
          <input ref={headerImgRef} type="file" accept="image/*" onChange={handleHeaderImageUpload} className="hidden" />
          <input ref={memberPhotoRef} type="file" accept="image/*" onChange={handleMemberPhotoUpload} className="hidden" />
        </div>

        {/* Right: properties panel */}
        <div className="w-64 shrink-0 overflow-y-auto">
          {selectedField ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Field Properties</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => duplicateField(selectedField.id)} title="Duplicate" className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeField(selectedField.id)} title="Delete" className="text-destructive/70 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[9px] text-muted-foreground uppercase block mb-1">Label</label>
                <input type="text" value={selectedField.label} onChange={e => updateField(selectedField.id, { label: e.target.value })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>

              <div>
                <label className="text-[9px] text-muted-foreground uppercase block mb-1">Type</label>
                <select value={selectedField.type} onChange={e => updateField(selectedField.id, { type: e.target.value as OverlayField["type"] })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none">
                  <option value="dso_name">DSO Name</option>
                  <option value="phone">Phone</option>
                  <option value="heading">Heading</option>
                  <option value="custom_text">Body Text</option>
                  <option value="footer">Footer</option>
                  <option value="link">Link / URL</option>
                  <option value="divider">Divider Line</option>
                  <option value="meet_the_team">Meet the Team</option>
                  <option value="qr_code">QR Code</option>
                  <option value="logo">Logo</option>
                  <option value="dandy_logo">Dandy Logo</option>
                </select>
              </div>

              {/* Sales-rep editability — when on, this field appears as an
                  input in the sales rep's PDF generation form. */}
              <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Editable by sales</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{selectedField.editableBySales ? "Sales reps can override this field" : "Locked to default value"}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!selectedField.editableBySales}
                    onChange={e => updateField(selectedField.id, { editableBySales: e.target.checked })}
                    className="ml-2 shrink-0"
                  />
                </label>
                {selectedField.editableBySales && (
                  <div className="space-y-1.5 pt-1 border-t border-border/50">
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase block mb-1">Sales label (optional)</label>
                      <input
                        type="text"
                        value={selectedField.salesLabel || ""}
                        onChange={e => updateField(selectedField.id, { salesLabel: e.target.value })}
                        placeholder={selectedField.label}
                        className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase block mb-1">Help text (optional)</label>
                      <input
                        type="text"
                        value={selectedField.salesHelpText || ""}
                        onChange={e => updateField(selectedField.id, { salesHelpText: e.target.value })}
                        placeholder="Shown under the input"
                        className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">X (%)</label>
                  <input type="number" min={0} max={100} value={selectedField.x} onChange={e => updateField(selectedField.id, { x: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">Y (%)</label>
                  <input type="number" min={0} max={100} value={selectedField.y} onChange={e => updateField(selectedField.id, { y: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                </div>
              </div>

              {selectedField.type !== "qr_code" && selectedField.type !== "logo" && selectedField.type !== "dandy_logo" && selectedField.type !== "divider" && selectedField.type !== "meet_the_team" && (
                <>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">Font Family</label>
                    <select value={selectedField.fontFamily || "helvetica"} onChange={e => updateField(selectedField.id, { fontFamily: e.target.value })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none">
                      {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase block mb-1">Font Size</label>
                      <input type="number" min={6} max={96} value={selectedField.fontSize} onChange={e => updateField(selectedField.id, { fontSize: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase block mb-1">Color</label>
                      <div className="flex gap-1">
                        <input type="color" value={selectedField.color} onChange={e => updateField(selectedField.id, { color: e.target.value })} className="w-8 h-[30px] rounded border border-border p-0 cursor-pointer shrink-0" />
                        <input type="text" value={selectedField.color} maxLength={7}
                          onChange={e => { let v = e.target.value; if (!v.startsWith("#")) v = "#" + v; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateField(selectedField.id, { color: v }); }}
                          className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                      <input type="checkbox" checked={selectedField.bold} onChange={e => updateField(selectedField.id, { bold: e.target.checked })} className="rounded" /> Bold
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                      <input type="checkbox" checked={selectedField.italic} onChange={e => updateField(selectedField.id, { italic: e.target.checked })} className="rounded" /> <span className="italic">Italic</span>
                    </label>
                  </div>
                </>
              )}

              {selectedField.type === "dso_name" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase block mb-1">Prefix</label>
                      <input type="text" value={selectedField.prefix || ""} onChange={e => updateField(selectedField.id, { prefix: e.target.value })} placeholder="e.g. Dandy & " className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase block mb-1">Suffix</label>
                      <input type="text" value={selectedField.suffix || ""} onChange={e => updateField(selectedField.id, { suffix: e.target.value })} placeholder="e.g. :" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">Default Value</label>
                    <input type="text" value={selectedField.defaultValue || ""} onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })} placeholder="Fallback DSO name" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                </>
              )}

              {selectedField.type === "phone" && (
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">Default Value</label>
                  <input type="tel" value={selectedField.defaultValue || ""} onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })} placeholder="e.g. 555-123-4567" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
              )}

              {selectedField.type === "custom_text" && (
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">Text Content</label>
                  <textarea rows={3} value={selectedField.defaultValue || ""} onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })} placeholder="Text content" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none" />
                </div>
              )}

              {(selectedField.type === "heading" || selectedField.type === "footer") && (
                <>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">Text Content</label>
                    <input type="text" value={selectedField.defaultValue || ""} onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })} placeholder={selectedField.type === "heading" ? "Section heading…" : "Footer text…"} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  {selectedField.type === "heading" && (
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase block mb-1">
                        Line Height — {(selectedField.lineHeight ?? 1.15).toFixed(2)}×
                      </label>
                      <input
                        type="range"
                        min={0.7}
                        max={2.0}
                        step={0.05}
                        value={selectedField.lineHeight ?? 1.15}
                        onChange={e => updateField(selectedField.id, { lineHeight: Number(e.target.value) })}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span>Tight</span><span>Loose</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedField.type === "link" && (
                <>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">URL</label>
                    <input type="url" value={selectedField.defaultValue || ""} onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })} placeholder="https://meetdandy.com" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                    <input type="checkbox" checked={selectedField.underline !== false} onChange={e => updateField(selectedField.id, { underline: e.target.checked })} className="rounded" /> Show underline
                  </label>
                </>
              )}

              {selectedField.type === "divider" && (
                <>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">Width (%)</label>
                    <input type="number" min={10} max={100} value={selectedField.width ?? 80} onChange={e => updateField(selectedField.id, { width: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">Thickness (pt)</label>
                    <input type="number" min={0.25} max={6} step={0.25} value={selectedField.lineThickness ?? 0.75} onChange={e => updateField(selectedField.id, { lineThickness: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">Color</label>
                    <div className="flex gap-1">
                      <input type="color" value={selectedField.color} onChange={e => updateField(selectedField.id, { color: e.target.value })} className="w-8 h-[30px] rounded border border-border p-0 cursor-pointer shrink-0" />
                      <input type="text" value={selectedField.color} maxLength={7} onChange={e => { let v = e.target.value; if (!v.startsWith("#")) v = "#" + v; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateField(selectedField.id, { color: v }); }} className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none" />
                    </div>
                  </div>
                </>
              )}

              {selectedField.type === "meet_the_team" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">Section Title</label>
                    <input type="text" value={selectedField.sectionTitle || "Meet The Team"} onChange={e => updateField(selectedField.id, { sectionTitle: e.target.value })} placeholder="Meet The Team" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase block mb-1">Width (%)</label>
                      <input type="number" min={20} max={100} value={selectedField.width ?? 80} onChange={e => updateField(selectedField.id, { width: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase block mb-1">Photo Size (%)</label>
                      <input type="number" min={2} max={15} value={selectedField.photoSize ?? 5} onChange={e => updateField(selectedField.id, { photoSize: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">Font Size (pt)</label>
                    <input type="number" min={6} max={36} value={selectedField.fontSize || 13} onChange={e => updateField(selectedField.id, { fontSize: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">Text Color</label>
                    <div className="flex gap-1">
                      <input type="color" value={selectedField.color} onChange={e => updateField(selectedField.id, { color: e.target.value })} className="w-8 h-[30px] rounded border border-border p-0 cursor-pointer shrink-0" />
                      <input type="text" value={selectedField.color} maxLength={7} onChange={e => { let v = e.target.value; if (!v.startsWith("#")) v = "#" + v; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateField(selectedField.id, { color: v }); }} className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none" />
                    </div>
                  </div>
                  {/* Team member list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[9px] text-muted-foreground uppercase">Team Members</label>
                      <button
                        onClick={() => updateField(selectedField.id, { teamMembers: [...(selectedField.teamMembers ?? []), { name: "New Member", title: "Title" }] })}
                        className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {(selectedField.teamMembers ?? []).map((m: TeamMember, idx: number) => (
                        <div key={idx} className="rounded-lg border border-border bg-muted/30 p-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-semibold text-muted-foreground uppercase">Member {idx + 1}</span>
                            <button onClick={() => {
                              const next = (selectedField.teamMembers ?? []).filter((_: TeamMember, i: number) => i !== idx);
                              updateField(selectedField.id, { teamMembers: next });
                            }} className="text-destructive/60 hover:text-destructive transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={m.name}
                            placeholder="Full name"
                            onChange={e => {
                              const next = (selectedField.teamMembers ?? []).map((mm: TeamMember, i: number) => i === idx ? { ...mm, name: e.target.value } : mm);
                              updateField(selectedField.id, { teamMembers: next });
                            }}
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                          <input
                            type="text"
                            value={m.title}
                            placeholder="Job title"
                            onChange={e => {
                              const next = (selectedField.teamMembers ?? []).map((mm: TeamMember, i: number) => i === idx ? { ...mm, title: e.target.value } : mm);
                              updateField(selectedField.id, { teamMembers: next });
                            }}
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                          <div className="flex items-center gap-1.5">
                            {m.photoUrl && (
                              <img src={m.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-border" />
                            )}
                            <input
                              type="url"
                              value={m.photoUrl || ""}
                              placeholder="Photo URL (optional)"
                              onChange={e => {
                                const next = (selectedField.teamMembers ?? []).map((mm: TeamMember, i: number) => i === idx ? { ...mm, photoUrl: e.target.value || undefined } : mm);
                                updateField(selectedField.id, { teamMembers: next });
                              }}
                              className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                            <button
                              onClick={() => { setPendingPhotoMemberIdx(idx); memberPhotoRef.current?.click(); }}
                              disabled={memberPhotoUploading && pendingPhotoMemberIdx === idx}
                              className="shrink-0 rounded border border-border bg-background px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                              title="Upload photo"
                            >
                              {memberPhotoUploading && pendingPhotoMemberIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedField.type === "qr_code" && (
                <>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">QR URL</label>
                    <input type="url" value={selectedField.defaultValue || ""} onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })} placeholder="https://meetdandy.com" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase block mb-1">QR Size (%)</label>
                    <input type="number" min={4} max={40} value={selectedField.qrSize || 12} onChange={e => updateField(selectedField.id, { qrSize: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                  </div>
                </>
              )}

              {(selectedField.type === "logo" || selectedField.type === "dandy_logo") && (
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">Logo Scale (%)</label>
                  <input type="number" min={2} max={50} value={selectedField.logoScale || 15} onChange={e => updateField(selectedField.id, { logoScale: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none" />
                </div>
              )}

              {selectedField.type === "logo" && (
                <div className="space-y-2">
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">Image (upload or URL)</label>
                  <input
                    ref={logoImgInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      e.target.value = "";
                      const MAX = 10 * 1024 * 1024;
                      if (file.size > MAX) {
                        toast({ title: "Image too large", description: "Max 10MB.", variant: "destructive" });
                        return;
                      }
                      setLogoImgUploading(true);
                      try {
                        const fd = new FormData(); fd.append("file", file);
                        const res = await fetch(`${API_BASE}/sales/one-pager-templates/upload-bg`, { method: "POST", body: fd });
                        if (!res.ok) {
                          let detail = `${res.status} ${res.statusText}`;
                          try { const body = await res.text(); if (body) detail = body.slice(0, 240); } catch { /* */ }
                          throw new Error(detail);
                        }
                        const { url } = await res.json();
                        updateField(selectedField.id, { logoUrl: url });
                      } catch (err) {
                        toast({ title: "Image upload failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
                      } finally { setLogoImgUploading(false); }
                    }}
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => logoImgInputRef.current?.click()}
                      disabled={logoImgUploading}
                      className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {logoImgUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {selectedField.logoUrl ? "Replace" : "Upload"}
                    </button>
                    {selectedField.logoUrl && (
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, { logoUrl: "" })}
                        className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40"
                        title="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={selectedField.logoUrl || ""}
                    onChange={e => updateField(selectedField.id, { logoUrl: e.target.value })}
                    placeholder="…or paste image URL"
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  {selectedField.logoUrl && (
                    <div className="rounded border border-border bg-muted/40 p-1.5">
                      {logoImgErrorUrl === selectedField.logoUrl ? (
                        <p className="text-[10px] text-muted-foreground text-center py-2">
                          Could not load preview — check the URL
                        </p>
                      ) : (
                        <img
                          src={selectedField.logoUrl}
                          alt="Image preview"
                          className="max-h-20 w-auto mx-auto object-contain"
                          onError={() => setLogoImgErrorUrl(selectedField.logoUrl ?? null)}
                          onLoad={() => { if (logoImgErrorUrl) setLogoImgErrorUrl(null); }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Template Settings</p>
              <div>
                <label className="text-[9px] text-muted-foreground uppercase block mb-1">
                  Header Height — {tpl.headerHeight ?? 30}mm
                </label>
                <input
                  type="range"
                  min={15}
                  max={80}
                  step={1}
                  value={tpl.headerHeight ?? 30}
                  onChange={e => setTpl(p => ({ ...p, headerHeight: Number(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>15mm</span><span>80mm</span>
                </div>
              </div>
              <div className="text-[9px] text-muted-foreground leading-relaxed">
                Drag a field from the palette onto the canvas, then click it to edit its properties here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════
export default function SalesOnePagerTemplates() {
  const { user, hasPerm } = useAuth();
  const isAdmin = user?.isAdmin || hasPerm("sales_campaigns") || hasPerm("one_pager_templates");

  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "builtin" | "custom">("all");
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    roi: true, pilot: true, comparison: true, "new-partner": false, "agreement-summary": true,
  });
  const [deletedBuiltins, setDeletedBuiltins] = useState<Record<string, boolean>>({});
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmDeleteBuiltin, setConfirmDeleteBuiltin] = useState<string | null>(null);
  const [pdfDialog, setPdfDialog] = useState<{ tpl?: CustomTemplate; builtinId?: BuiltinId } | null>(null);

  // Task #342 — fetch tenant brand so cloned preview PDFs and rendered
  // template labels scrub Dandy/DSO/dental-lab copy for non-Dandy tenants.
  const [previewBrand, setPreviewBrand] = useState<BrandConfigT>(DEFAULT_BRAND);
  useEffect(() => { fetchBrandConfig().then(setPreviewBrand).catch(() => {}); }, []);
  const previewIsDandy = (previewBrand.brandName ?? "").trim().toLowerCase() === "dandy";
  const previewBrandLabel = (previewBrand.brandName || "").trim();
  const previewQrFallback = previewIsDandy
    ? "https://meetdandy.com"
    : (previewBrand.defaultCtaUrl && previewBrand.defaultCtaUrl !== "#" ? previewBrand.defaultCtaUrl : "");
  const previewBrandContext: BrandContextT | undefined = previewIsDandy ? undefined : {
    wordmark: previewBrandLabel.toLowerCase(),
    productName: previewBrandLabel || "Our Lab",
    industryLabel: "Group",
    labName: previewBrandLabel || "Our Lab",
    footerUrl: (previewBrand.defaultCtaUrl && previewBrand.defaultCtaUrl !== "#")
      ? previewBrand.defaultCtaUrl.replace(/^https?:\/\//, "")
      : "",
    qrFallbackUrl: previewQrFallback || "",
    agreementName: `${previewBrandLabel || "Partner"} Practice Agreement`,
    agreementUrl: previewBrand.defaultCtaUrl && previewBrand.defaultCtaUrl !== "#" ? previewBrand.defaultCtaUrl : "",
  };
  const previewOneAssets = resolveOnePagerAssets(previewBrand);
  // Scrub Dandy-only UI labels (e.g. "Dandy Evolution", "Summary of Dandy Agreement")
  // on the template cards so non-Dandy tenants don't see Dandy copy in this page.
  const sLabel = (t: string) => scrubBrand(t, previewBrandContext);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tpls, vis, del] = await Promise.all([
        fetchCustomTemplates(),
        apiLoadLayoutDefault(TEMPLATE_VISIBILITY_KEY),
        apiLoadLayoutDefault(DELETED_BUILTINS_KEY),
      ]);
      setTemplates(tpls);
      if (vis) setVisibility(p => ({ ...p, ...(vis as Record<string, boolean>) }));
      if (del) setDeletedBuiltins(del as Record<string, boolean>);
    } catch (err) {
      toast({ title: "Failed to load templates", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Page-level access guard — rendered after hooks to comply with React rules.
  // `useAuth` returns `AuthUser | null` (never undefined), so we must wait until
  // the user is non-null before deciding to gate; otherwise the page flashes
  // "Access Restricted" before AuthGate has finished hydrating, which reads as
  // a broken/blank page on first navigation.
  if (user && !isAdmin) {
    return (
      <SalesLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground" />
          <div>
            <p className="text-lg font-semibold">Access Restricted</p>
            <p className="text-sm text-muted-foreground">You need admin or sales manager permissions to manage templates.</p>
          </div>
        </div>
      </SalesLayout>
    );
  }

  const toggleVisibility = async (key: string) => {
    const updated = { ...visibility, [key]: !visibility[key] };
    setVisibility(updated);
    await apiSaveLayoutDefault(TEMPLATE_VISIBILITY_KEY, updated);
    toast({ title: updated[key] ? "Template enabled" : "Template disabled" });
  };

  const deleteBuiltin = async (id: string) => {
    const updatedDel = { ...deletedBuiltins, [id]: true };
    const updatedVis = { ...visibility, [id]: false };
    setDeletedBuiltins(updatedDel); setVisibility(updatedVis);
    await Promise.all([
      apiSaveLayoutDefault(DELETED_BUILTINS_KEY, updatedDel),
      apiSaveLayoutDefault(TEMPLATE_VISIBILITY_KEY, updatedVis),
    ]);
    setConfirmDeleteBuiltin(null);
    toast({ title: "Built-in template removed" });
  };

  const restoreBuiltin = async (id: string) => {
    const updatedDel = { ...deletedBuiltins };
    delete updatedDel[id];
    setDeletedBuiltins(updatedDel);
    await apiSaveLayoutDefault(DELETED_BUILTINS_KEY, updatedDel);
    toast({ title: "Template restored" });
  };

  const cloneBuiltin = async (builtinId: BuiltinId) => {
    setCloningId(builtinId);
    try {
      let doc: jsPDF;
      if (builtinId === "roi") doc = await generateROIOnePager(" ", 10, undefined, previewBrandContext, previewOneAssets);
      else if (builtinId === "pilot") doc = await generatePilotOnePager(" ", "executive", [], "", null, { w: 0, h: 0 }, defaultAudienceContent["executive"], undefined, undefined, undefined, undefined, previewBrandContext, previewOneAssets);
      else if (builtinId === "comparison") doc = await generateComparisonOnePager(" ", [], "", null, { w: 0, h: 0 }, undefined, undefined, undefined, undefined, previewBrandContext, previewOneAssets);
      else if (builtinId === "agreement-summary") doc = await generateAgreementSummaryOnePager(defaultAgreementSummaryContent, previewBrandContext, previewOneAssets);
      else doc = await generateNewPartnerOnePager(" ", null, { w: 0, h: 0 }, previewQrFallback, undefined, undefined, previewBrandContext, previewOneAssets);

      const pdfBlob = doc.output("blob");
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const buf = await pdfBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);
      const scale = 2; const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
      const imgBlob: Blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/png"));

      // Upload the snapshot to object storage for persistent URL
      let bgUrl = canvas.toDataURL("image/png"); // fallback
      try {
        const fd = new FormData();
        fd.append("file", new File([imgBlob], `${builtinId}-clone.png`, { type: "image/png" }));
        const uploadRes = await fetch(`${API_BASE}/sales/one-pager-templates/upload-bg`, { method: "POST", body: fd });
        if (uploadRes.ok) bgUrl = (await uploadRes.json()).url;
      } catch { /* keep fallback data URL */ }

      const label = BUILTIN_TEMPLATES.find(t => t.id === builtinId)?.label || builtinId;
      const newTpl: CustomTemplate = {
        name: `${label} (Custom)`,
        background_url: bgUrl,
        orientation: "portrait",
        fields: cloneFieldsForBuiltin(builtinId),
        headerHeight: 30,
      };
      setEditing(newTpl);
      toast({ title: `Cloned "${label}"`, description: "Customize and save to publish." });
    } catch (err) {
      toast({ title: "Clone failed", description: String(err), variant: "destructive" });
    } finally {
      setCloningId(null);
    }
  };

  const cloneCustom = (tpl: CustomTemplate) => {
    setEditing({
      ...tpl,
      id: undefined,
      name: `${tpl.name} (Copy)`,
      fields: tpl.fields.map(f => ({ ...f, id: crypto.randomUUID() })),
    });
  };

  const handleSave = async (tpl: CustomTemplate) => {
    const saved = await saveCustomTemplate(tpl);
    toast({ title: tpl.id ? "Template updated" : "Template saved", description: "Sales reps can now use this template." });
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    await deleteCustomTemplate(id);
    setConfirmDelete(null);
    toast({ title: "Template deleted" });
    await load();
  };

  const handleSoftDeleteCustom = async (tpl: CustomTemplate) => {
    if (!tpl.id) return;
    await saveCustomTemplate({ ...tpl, isDeleted: true });
    toast({ title: "Template removed" });
    await load();
  };

  const handleRestoreCustom = async (tpl: CustomTemplate) => {
    if (!tpl.id) return;
    await saveCustomTemplate({ ...tpl, isDeleted: false });
    toast({ title: "Template restored" });
    await load();
  };

  const filteredBuiltins = typeFilter !== "custom" ? BUILTIN_TEMPLATES.filter(bt =>
    !deletedBuiltins[bt.id] && bt.label.toLowerCase().includes(search.toLowerCase())
  ) : [];
  const deletedBuiltinsList = BUILTIN_TEMPLATES.filter(bt => deletedBuiltins[bt.id]);
  const activeTemplates = typeFilter !== "builtin"
    ? templates
        .filter(t => !t.isDeleted && t.name.toLowerCase().includes(search.toLowerCase()))
        // Newest first. The API already orders by createdAt desc, but sorting
        // here keeps the UI correct if a freshly-saved template is appended
        // to local state without a refetch, or if the field is missing.
        .slice()
        .sort((a, b) => {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (bt !== at) return bt - at;
          return (b.id ?? 0) - (a.id ?? 0);
        })
    : [];
  const deletedTemplates = templates.filter(t => t.isDeleted);

  if (editing !== null) {
    return (
      <SalesLayout>
        <div className="h-[calc(100vh-8rem)]">
          <TemplateEditor
            initial={editing.id || editing.background_url ? editing : undefined}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </div>
      </SalesLayout>
    );
  }

  return (
    <SalesLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">One-Pager Templates</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage which templates sales reps see in the one-pager generator. Toggle visibility, clone built-ins, and create custom templates.</p>
          </div>
          {isAdmin && (
            <button onClick={() => setEditing({ name: "", background_url: "", orientation: "portrait", fields: [], headerHeight: 30 })}
              className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors shrink-0">
              <Plus className="w-4 h-4" /> New Template
            </button>
          )}
        </div>

        {/* Search + type filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
              className="w-64 rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
          <div className="inline-flex rounded-full border border-border overflow-hidden">
            {(["all", "builtin", "custom"] as const).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${typeFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-background"}`}>
                {f === "all" ? "All" : f === "builtin" ? "Built-in" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Built-in templates */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Built-in Templates</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredBuiltins.map(bt => (
                  <TemplateCard
                    key={bt.id}
                    tpl={{
                      id: bt.id,
                      label: sLabel(bt.label),
                      description: sLabel(bt.description),
                      backgroundUrl: "backgroundUrl" in bt ? bt.backgroundUrl : undefined,
                    }}
                    isBuiltin
                    visible={visibility[bt.id] !== false}
                    onToggleVisibility={() => toggleVisibility(bt.id)}
                    onClone={() => cloneBuiltin(bt.id as BuiltinId)}
                    onDelete={() => setConfirmDeleteBuiltin(bt.id)}
                    onGeneratePdf={() => setPdfDialog({ builtinId: bt.id as BuiltinId })}
                    cloning={cloningId === bt.id}
                  />
                ))}
                {filteredBuiltins.length === 0 && !search && (
                  <p className="col-span-full text-sm text-muted-foreground py-4">All built-in templates have been removed.</p>
                )}
              </div>
            </div>

            {/* Custom templates */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Custom Templates
                <span className="ml-2 text-xs text-muted-foreground font-normal">({activeTemplates.length})</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {isAdmin && (
                  <button
                    onClick={() => setEditing({ name: "", background_url: "", orientation: "portrait", fields: [], headerHeight: 30 })}
                    className="rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    style={{ aspectRatio: "8.5/11" }}
                  >
                    <Plus className="w-6 h-6" />
                    <span className="text-xs font-medium">New Template</span>
                  </button>
                )}
                {activeTemplates.map(tpl => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={{
                      id: String(tpl.id),
                      label: tpl.name,
                      backgroundUrl: tpl.background_url || undefined,
                      fieldCount: tpl.fields.length,
                    }}
                    isBuiltin={false}
                    visible={visibility[`custom:${tpl.id}`] !== false}
                    onToggleVisibility={() => toggleVisibility(`custom:${tpl.id}`)}
                    onEdit={isAdmin ? () => setEditing(tpl) : undefined}
                    onClone={() => cloneCustom(tpl)}
                    onDelete={() => isAdmin ? handleSoftDeleteCustom(tpl) : undefined}
                    onGeneratePdf={() => setPdfDialog({ tpl })}
                    cloning={false}
                  />
                ))}
                {activeTemplates.length === 0 && !isAdmin && (
                  <p className="col-span-full text-sm text-muted-foreground py-4">No custom templates yet. Ask an admin to create one.</p>
                )}
              </div>
            </div>

            {/* Deleted / restored section */}
            {(deletedBuiltinsList.length > 0 || deletedTemplates.length > 0) && (
              <div className="space-y-3 pt-2 border-t border-border">
                <h2 className="text-sm font-semibold text-muted-foreground">Removed Templates</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {deletedBuiltinsList.map(bt => (
                    <TemplateCard
                      key={bt.id}
                      tpl={{ id: bt.id, label: sLabel(bt.label), description: sLabel(bt.description), isDeleted: true }}
                      isBuiltin
                      visible={false}
                      onToggleVisibility={() => {}}
                      onClone={() => {}}
                      onDelete={() => {}}
                      onRestore={() => restoreBuiltin(bt.id)}
                    />
                  ))}
                  {deletedTemplates.map(tpl => (
                    <TemplateCard
                      key={tpl.id}
                      tpl={{ id: String(tpl.id), label: tpl.name, backgroundUrl: tpl.background_url || undefined, isDeleted: true }}
                      isBuiltin={false}
                      visible={false}
                      onToggleVisibility={() => {}}
                      onClone={() => {}}
                      onDelete={() => isAdmin && tpl.id ? setConfirmDelete(tpl.id) : undefined}
                      onRestore={isAdmin ? () => handleRestoreCustom(tpl) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm delete built-in dialog */}
      {confirmDeleteBuiltin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xs p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold">Remove built-in template?</h3>
            <p className="text-xs text-muted-foreground">This will hide it from sales reps. You can restore it later.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteBuiltin(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => deleteBuiltin(confirmDeleteBuiltin)} className="flex-1 rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:bg-destructive/90 transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm hard delete dialog */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xs p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold">Delete template permanently?</h3>
            <p className="text-xs text-muted-foreground">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:bg-destructive/90 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF generation dialog */}
      {pdfDialog && (
        <GeneratePdfDialog
          tpl={pdfDialog.tpl}
          isBuiltin={!!pdfDialog.builtinId}
          builtinId={pdfDialog.builtinId}
          onClose={() => setPdfDialog(null)}
        />
      )}
    </SalesLayout>
  );
}
