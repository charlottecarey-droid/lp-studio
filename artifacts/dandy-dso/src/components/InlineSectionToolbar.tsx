import { useState } from "react";
import { Palette, Type, ArrowsUpFromLine, RotateCcw, Bold } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionStyleOverrides } from "@/lib/microsite-skin-config";

interface InlineSectionToolbarProps {
  sectionId: string;
  sectionLabel?: string;
  styles?: SectionStyleOverrides;
  onUpdate: (patch: Partial<SectionStyleOverrides>) => void;
  onReset: () => void;
}

const SIZE_OPTIONS: { value: "small" | "medium" | "large"; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

const InlineSectionToolbar = ({ sectionId, sectionLabel, styles, onUpdate, onReset }: InlineSectionToolbarProps) => {
  const [activePanel, setActivePanel] = useState<"colors" | "type" | "spacing" | null>(null);

  const togglePanel = (panel: typeof activePanel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const hasOverrides = styles && Object.keys(styles).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="absolute top-2 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Main toolbar bar */}
      <div className="flex items-center gap-1 rounded-full bg-[hsl(220,15%,13%)] border border-white/10 px-2 py-1 shadow-xl backdrop-blur-xl">
        <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider px-2 select-none">
          {sectionLabel || sectionId}
        </span>
        <div className="w-px h-4 bg-card/10" />

        {/* Colors */}
        <button
          onClick={() => togglePanel("colors")}
          className={`p-1.5 rounded-full transition-colors ${activePanel === "colors" ? "bg-card/15 text-white" : "text-white/50 hover:text-white/80 hover:bg-card/5"}`}
          title="Colors"
        >
          <Palette className="w-3.5 h-3.5" />
        </button>

        {/* Typography */}
        <button
          onClick={() => togglePanel("type")}
          className={`p-1.5 rounded-full transition-colors ${activePanel === "type" ? "bg-card/15 text-white" : "text-white/50 hover:text-white/80 hover:bg-card/5"}`}
          title="Typography"
        >
          <Type className="w-3.5 h-3.5" />
        </button>

        {/* Spacing */}
        <button
          onClick={() => togglePanel("spacing")}
          className={`p-1.5 rounded-full transition-colors ${activePanel === "spacing" ? "bg-card/15 text-white" : "text-white/50 hover:text-white/80 hover:bg-card/5"}`}
          title="Spacing"
        >
          <ArrowsUpFromLine className="w-3.5 h-3.5" />
        </button>

        {/* Reset */}
        {hasOverrides && (
          <>
            <div className="w-px h-4 bg-card/10" />
            <button
              onClick={onReset}
              className="p-1.5 rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Reset to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Sub-panels */}
      <AnimatePresence>
        {activePanel === "colors" && (
          <motion.div
            key="colors"
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="rounded-xl bg-[hsl(220,15%,13%)] border border-white/10 px-3 py-2.5 shadow-xl flex items-center gap-3"
          >
            <ColorField label="BG" value={styles?.bgColor || ""} onChange={(v) => onUpdate({ bgColor: v || undefined })} />
            <ColorField label="Text" value={styles?.textColor || ""} onChange={(v) => onUpdate({ textColor: v || undefined })} />
            <ColorField label="Accent" value={styles?.accentColor || ""} onChange={(v) => onUpdate({ accentColor: v || undefined })} />
          </motion.div>
        )}
        {activePanel === "type" && (
          <motion.div
            key="type"
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="rounded-xl bg-[hsl(220,15%,13%)] border border-white/10 px-3 py-2.5 shadow-xl flex items-center gap-3"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-white/40 uppercase tracking-wider">Size</span>
              <div className="flex gap-0.5">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onUpdate({ headlineSize: opt.value })}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      (styles?.headlineSize || "medium") === opt.value
                        ? "bg-card/20 text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-card/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-px h-8 bg-card/10" />
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-white/40 uppercase tracking-wider">Bold</span>
              <button
                onClick={() => onUpdate({ headlineBold: !styles?.headlineBold })}
                className={`p-1 rounded transition-colors ${
                  styles?.headlineBold ? "bg-card/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-card/5"
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-px h-8 bg-card/10" />
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-white/40 uppercase tracking-wider">Font</span>
              <select
                value={styles?.fontFamily || ""}
                onChange={(e) => onUpdate({ fontFamily: e.target.value || undefined })}
                className="bg-card/5 border border-white/10 rounded text-[10px] text-white/70 px-1.5 py-0.5 outline-none"
              >
                <option value="">Default</option>
                <option value="'Inter', sans-serif">Inter</option>
                <option value="'Georgia', serif">Georgia</option>
                <option value="'Arimo', sans-serif">Arimo</option>
                <option value="system-ui, sans-serif">System</option>
              </select>
            </div>
          </motion.div>
        )}
        {activePanel === "spacing" && (
          <motion.div
            key="spacing"
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="rounded-xl bg-[hsl(220,15%,13%)] border border-white/10 px-3 py-2.5 shadow-xl flex items-center gap-3 min-w-[200px]"
          >
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40 uppercase tracking-wider">Padding Y</span>
                <span className="text-[10px] text-white/60 font-mono">{styles?.paddingY ?? 5}rem</span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={0.5}
                value={styles?.paddingY ?? 5}
                onChange={(e) => onUpdate({ paddingY: parseFloat(e.target.value) })}
                className="w-full h-1 bg-card/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-card/80"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ── Compact color field ── */
const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[9px] text-white/40 uppercase tracking-wider">{label}</span>
    <div className="flex items-center gap-1.5">
      <div className="relative w-5 h-5 rounded border border-white/15 overflow-hidden">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
        />
        <div className="w-full h-full" style={{ background: value || "transparent" }}>
          {!value && <div className="w-full h-full bg-card/5 flex items-center justify-center text-white/30 text-[8px]">—</div>}
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#hex"
        className="w-[56px] bg-card/5 border border-white/10 rounded text-[10px] text-white/70 px-1.5 py-0.5 outline-none placeholder:text-white/20 font-mono"
      />
    </div>
  </div>
);

export default InlineSectionToolbar;
