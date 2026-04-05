import { useState, useRef, useCallback, useEffect } from "react";
import dandyLogoWhiteUrl from "@/assets/dandy-logo-white.svg?url";
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
import {
  generatePilotOnePager,
  generateComparisonOnePager,
  generateNewPartnerOnePager,
  generateROIOnePager,
  defaultAudienceContent,
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

const pdfToImageBlob = async (file: File): Promise<Blob> => {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
  return new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/png"));
};

// ── Built-in templates ─────────────────────────────────────────────────
const BUILTIN_TEMPLATES = [
  { id: "roi", label: "ROI One-Pager", description: "Financial ROI summary" },
  { id: "pilot", label: "90-Day Pilot", description: "Pilot program overview" },
  { id: "comparison", label: "Dandy Evolution", description: "Before/after comparison" },
  { id: "new-partner", label: "Partner Practices", description: "Partner onboarding" },
  { id: "partner2", label: "Partner 2", description: "Alternative partner template" },
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
  { type: "dandy_logo", label: "Dandy Logo", icon: <FileText className="w-3.5 h-3.5" />, defaultProps: { fontSize: 18, color: "#FFFFFF", logoScale: 13, bold: true } },
];

// ── Draggable field overlay ───────────────────────────────────────────
function DraggableField({ field, containerRef, selected, onSelect, onMove, onDuplicate, onDelete }: {
  field: OverlayField;
  containerRef: React.RefObject<HTMLDivElement>;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); onSelect(); setDragging(true);
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); onSelect();
    setCtx({ x: e.clientX, y: e.clientY });
  };

  const displayText =
    field.type === "dso_name" ? `${field.prefix || ""}{DSO Name}${field.suffix || ""}` :
    field.type === "phone" ? "{Phone}" :
    field.type === "qr_code" ? "{QR}" :
    field.type === "logo" ? "{Logo}" :
    field.type === "dandy_logo" ? "{Dandy Logo}" :
    field.type === "divider" ? `— divider (${field.width ?? 80}% wide) —` :
    field.type === "meet_the_team" ? `👥 ${field.sectionTitle || "Meet The Team"} (${field.teamMembers?.length ?? 0} members)` :
    (field.defaultValue || field.label || "{Text}");

  const scaledSize = Math.max(10, (field.fontSize / 612) * 500);

  const fieldIcon =
    field.type === "qr_code" ? <QrCode className="w-3 h-3 shrink-0" style={{ color: field.color }} /> :
    (field.type === "logo" || field.type === "dandy_logo") ? <ImageIcon className="w-3 h-3 shrink-0" style={{ color: field.color }} /> :
    field.type === "divider" ? <Minus className="w-3 h-3 shrink-0" style={{ color: field.color }} /> :
    field.type === "meet_the_team" ? <Users className="w-3 h-3 shrink-0" style={{ color: field.color }} /> :
    field.type === "link" ? <Link className="w-3 h-3 shrink-0" style={{ color: field.color }} /> :
    field.type === "heading" ? <Heading1 className="w-3 h-3 shrink-0" style={{ color: field.color }} /> :
    field.type === "footer" ? <AlignJustify className="w-3 h-3 shrink-0" style={{ color: field.color }} /> :
    <Move className="w-3 h-3 shrink-0" style={{ color: field.color }} />;

  return (
    <>
      <div
        className={`absolute select-none touch-none ${dragging ? "z-30" : "z-20"}`}
        style={{ left: `${field.x}%`, top: `${field.y}%`, transform: "translate(-4px, -50%)" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
      >
        <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 cursor-grab active:cursor-grabbing whitespace-nowrap ${selected ? "ring-2 ring-primary shadow-lg" : "hover:ring-1 hover:ring-primary/50"} ${dragging ? "opacity-80 scale-105" : ""}`}
          style={{ backgroundColor: selected ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)" }}>
          {fieldIcon}
          <span style={{ color: field.color, fontSize: `${Math.min(scaledSize, 18)}px`, fontWeight: field.bold ? 700 : 400, fontStyle: field.italic ? "italic" : "normal", fontFamily: getFontCss(field.fontFamily), lineHeight: 1.2 }}>{displayText}</span>
        </div>
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
function ToolbarFieldItem({ type, label, icon, onDragStart }: {
  type: OverlayField["type"]; label: string; icon: React.ReactNode;
  onDragStart: (type: OverlayField["type"]) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(type)}
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
  const [dsoName, setDsoName] = useState("");
  const [phone, setPhone] = useState("");
  const [qrUrl, setQrUrl] = useState("https://meetdandy.com");
  const [audience, setAudience] = useState<"executive" | "clinical" | "practice-manager">("executive");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      if (isBuiltin && builtinId) {
        let doc: jsPDF;
        if (builtinId === "roi") doc = await generateROIOnePager(dsoName || "DSO", 50);
        else if (builtinId === "pilot") doc = await generatePilotOnePager(dsoName || "DSO", audience, [], phone, null, { w: 0, h: 0 }, defaultAudienceContent[audience], undefined, undefined);
        else if (builtinId === "comparison") doc = await generateComparisonOnePager(dsoName || "DSO", [], phone, null, { w: 0, h: 0 }, undefined, undefined);
        else doc = await generateNewPartnerOnePager(dsoName || "DSO", null, { w: 0, h: 0 }, qrUrl, {});
        doc.save(`${(dsoName || builtinId).replace(/\s+/g, "_")}_OnePager.pdf`);
      } else if (tpl) {
        const values: Record<string, string> = { dso_name: dsoName, phone, qr_url: qrUrl };
        const doc = await generateCustomTemplatePdf(tpl, values, dandyLogoWhiteUrl);
        doc.save(`${(dsoName || tpl.name).replace(/\s+/g, "_")}_OnePager.pdf`);
      }
      toast({ title: "PDF downloaded" });
      onClose();
    } catch (err) {
      toast({ title: "PDF generation failed", description: String(err), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Generate PDF</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
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
            <input type="url" value={qrUrl} onChange={e => setQrUrl(e.target.value)} placeholder="https://meetdandy.com" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
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
  const [dragType, setDragType] = useState<OverlayField["type"] | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [headerImgUploading, setHeaderImgUploading] = useState(false);
  const [memberPhotoUploading, setMemberPhotoUploading] = useState(false);
  const [pendingPhotoMemberIdx, setPendingPhotoMemberIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const headerImgRef = useRef<HTMLInputElement>(null);
  const memberPhotoRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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
    setUploading(true);
    let uploadFile = file;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      try {
        const blob = await pdfToImageBlob(file);
        uploadFile = new File([blob], file.name.replace(/\.pdf$/i, ".png"), { type: "image/png" });
      } catch {
        toast({ title: "PDF conversion failed", variant: "destructive" }); setUploading(false); return;
      }
    }
    try {
      const formData = new FormData(); formData.append("file", uploadFile);
      const res = await fetch(`${API_BASE}/sales/one-pager-templates/upload-bg`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setBgPreview(url); setTpl(p => ({ ...p, background_url: url }));
    } catch {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        setBgPreview(dataUrl); setTpl(p => ({ ...p, background_url: dataUrl }));
      };
      reader.readAsDataURL(uploadFile);
    }
    setUploading(false);
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
    if (!dragType || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const def = FIELD_TYPES.find(f => f.type === dragType);
    const newId = crypto.randomUUID();
    const newField: OverlayField = {
      id: newId, label: def?.label || dragType, type: dragType, x: Math.max(0, Math.min(95, x)), y: Math.max(0, Math.min(95, y)),
      fontSize: 14, fontFamily: "helvetica", color: "#FFFFFF", bold: false, italic: false, defaultValue: "",
      ...(def?.defaultProps || {}),
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
            {FIELD_TYPES.map(ft => (
              <ToolbarFieldItem key={ft.type} type={ft.type} label={ft.label} icon={ft.icon} onDragStart={t => setDragType(t)} />
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
                onClick={e => { if (e.target === previewRef.current || (e.target as HTMLElement).tagName === "IMG") setSelectedId(null); }}
              >
                <img src={bgPreview} alt="Background" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                {tpl.fields.map(f => (
                  <DraggableField key={f.id} field={f} containerRef={previewRef as React.RefObject<HTMLDivElement>}
                    selected={selectedId === f.id} onSelect={() => setSelectedId(f.id)}
                    onMove={(x, y) => updateField(f.id, { x, y })}
                    onDuplicate={() => duplicateField(f.id)}
                    onDelete={() => removeField(f.id)} />
                ))}
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
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">Text Content</label>
                  <input type="text" value={selectedField.defaultValue || ""} onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })} placeholder={selectedField.type === "heading" ? "Section heading…" : "Footer text…"} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
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
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-1">Logo URL (optional)</label>
                  <input type="url" value={selectedField.logoUrl || ""} onChange={e => updateField(selectedField.id, { logoUrl: e.target.value })} placeholder="https://…" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
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
  const isAdmin = user?.isAdmin || hasPerm("sales_campaigns");

  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "builtin" | "custom">("all");
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    roi: true, pilot: true, comparison: true, "new-partner": false,
  });
  const [deletedBuiltins, setDeletedBuiltins] = useState<Record<string, boolean>>({});
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmDeleteBuiltin, setConfirmDeleteBuiltin] = useState<string | null>(null);
  const [pdfDialog, setPdfDialog] = useState<{ tpl?: CustomTemplate; builtinId?: BuiltinId } | null>(null);

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

  // Page-level access guard — rendered after hooks to comply with React rules
  if (user !== undefined && !isAdmin) {
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
      if (builtinId === "roi") doc = await generateROIOnePager(" ", 10);
      else if (builtinId === "pilot") doc = await generatePilotOnePager(" ", "executive", [], "", null, { w: 0, h: 0 }, defaultAudienceContent["executive"], undefined, undefined);
      else if (builtinId === "comparison") doc = await generateComparisonOnePager(" ", [], "", null, { w: 0, h: 0 }, undefined, undefined);
      else doc = await generateNewPartnerOnePager(" ", null, { w: 0, h: 0 }, "https://meetdandy.com", {});

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
  const activeTemplates = typeFilter !== "builtin" ? templates.filter(t => !t.isDeleted && t.name.toLowerCase().includes(search.toLowerCase())) : [];
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
                    tpl={{ id: bt.id, label: bt.label, description: bt.description }}
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
                      tpl={{ id: bt.id, label: bt.label, description: bt.description, isDeleted: true }}
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
