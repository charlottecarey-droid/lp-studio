import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  GripVertical, Eye, EyeOff, ChevronDown, ChevronRight, Save, RotateCcw, 
  Plus, Trash2, Palette, Type, Layout, FileText, BarChart3, Pencil,
  Calculator, SlidersHorizontal, Search, Globe, Image as ImageIcon, PanelLeftClose, PanelLeft,
  Upload, X, Users, Gift, BookOpen, Phone, Layers, ShieldCheck, Quote, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import { toast } from "@/hooks/use-toast";
import {
  MicrositeSkinConfig, SkinSection, SkinCaseStudy, SkinComparisonRow, SkinStat, SkinChallenge,
  DEFAULT_EXECUTIVE_CONFIG, DEFAULT_SOLUTIONS_CONFIG, DEFAULT_EXPANSION_CONFIG, DEFAULT_FLAGSHIP_CONFIG, DEFAULT_FLAGSHIP_DARK_CONFIG, DEFAULT_DANDY_CONFIG, DEFAULT_HEARTLAND_CONFIG,
  ExpansionSkinConfig, ExpansionTeamMember, ExpansionPerk, ExpansionPromo, ExpansionContentLink, ExpansionFeatureBlock,
  ExpansionProduct, ExpansionPromise, ExpansionTestimonial,
  loadSkinConfig, saveSkinConfig,
} from "@/lib/microsite-skin-config";
import MicrositeLivePreview from "@/components/MicrositeLivePreview";
import MicrositeDandySkin from "@/components/MicrositeDandySkin";
import MicrositeHeartlandSkin from "@/components/MicrositeHeartlandSkin";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

/* ── Image upload field ── */
const ImageUploadField = ({ label, value, onChange }: { label: string; value?: string; onChange: (url: string) => void }) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("skin-images").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("skin-images").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  };

  return (
    <Field label={label}>
      <div className="flex gap-1">
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste URL or upload…"
          className="h-6 text-[10px] bg-white/5 border-white/10 text-white flex-1"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="h-6 px-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1 text-[10px] text-white/70 disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          {uploading ? "…" : ""}
        </button>
        {value && (
          <button onClick={() => onChange("")} className="h-6 px-1 rounded bg-white/10 hover:bg-red-500/30 transition-colors text-white/50 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
      {value && <img src={value} alt="Preview" className="mt-1 h-16 w-full object-cover rounded-md border border-white/10" />}
    </Field>
  );
};

type SkinType = "executive" | "solutions" | "expansion" | "flagship" | "flagship-dark" | "dandy" | "heartland";

/* ── Drag state ── */
let dragIdx: number | null = null;
let dragOverIdx: number | null = null;

/* ── Collapsible panel ── */
const Panel = ({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden mb-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left">
        <Icon className="w-3.5 h-3.5 text-[#2ecc71]" />
        <span className="text-xs font-semibold text-white flex-1">{title}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3">{children}</div>}
    </div>
  );
};

/* ── Field row ── */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

/* ── Color input ── */
const ColorInput = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
  <div className="flex items-center gap-2">
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-white/20 bg-transparent" />
    <div className="flex-1">
      <p className="text-[10px] text-white/50">{label}</p>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white mt-0.5" />
    </div>
  </div>
);

const MicrositeSkinEditor = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [skin, setSkin] = useState<SkinType>("executive");
  const [config, setConfig] = useState<MicrositeSkinConfig>(DEFAULT_EXECUTIVE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [zoom, setZoom] = useState(100);
  const [panX, setPanX] = useState(0);
  const [saving, setSaving] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const load = useCallback(async (s: SkinType) => {
    setLoading(true);
    const c = await loadSkinConfig(s);
    setConfig(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => { load(skin); }, [skin, load]);

  const update = <K extends keyof MicrositeSkinConfig>(key: K, val: MicrositeSkinConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  const handleUpdateSectionStyle = (sectionId: string, patch: Record<string, any>) => {
    setConfig(prev => {
      const current = prev.sectionStyles || {};
      // If patch is empty-ish (reset), remove the section key
      if (Object.keys(patch).length === 0) {
        const { [sectionId]: _, ...rest } = current;
        return { ...prev, sectionStyles: Object.keys(rest).length > 0 ? rest : undefined };
      }
      return {
        ...prev,
        sectionStyles: {
          ...current,
          [sectionId]: { ...(current[sectionId] || {}), ...patch },
        },
      };
    });
  };

  const updateSection = (idx: number, patch: Partial<SkinSection>) => {
    const sections = [...config.sections];
    sections[idx] = { ...sections[idx], ...patch };
    update("sections", sections);
  };

  const updateSectionByIdHeadline = (sectionId: string, headline: string) => {
    const idx = config.sections.findIndex(s => s.id === sectionId);
    if (idx >= 0) updateSection(idx, { headline });
  };

  const updateSectionByIdSubheadline = (sectionId: string, subheadline: string) => {
    const idx = config.sections.findIndex(s => s.id === sectionId);
    if (idx >= 0) updateSection(idx, { subheadline });
  };

  const reorderSections = (from: number, to: number) => {
    if (from === to) return;
    const sections = [...config.sections];
    const [moved] = sections.splice(from, 1);
    sections.splice(to, 0, moved);
    update("sections", sections);
  };

  const updateSectionImage = (key: string, value: string) => {
    update("sectionImages", { ...(config.sectionImages || {}), [key]: value || undefined } as any);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSkinConfig(skin, config);
    setSaving(false);
    toast({ title: "Skin config saved", description: `${skin === "executive" ? "Executive" : "Solutions"} template updated.` });
  };

  const handleReset = () => {
    const defaults: Record<SkinType, MicrositeSkinConfig> = { executive: DEFAULT_EXECUTIVE_CONFIG, solutions: DEFAULT_SOLUTIONS_CONFIG, expansion: DEFAULT_EXPANSION_CONFIG as any, flagship: DEFAULT_FLAGSHIP_CONFIG, "flagship-dark": DEFAULT_FLAGSHIP_DARK_CONFIG, dandy: DEFAULT_DANDY_CONFIG, heartland: DEFAULT_HEARTLAND_CONFIG };
    setConfig({ ...defaults[skin] });
    toast({ title: "Reset to defaults" });
  };

  if (loading) return <div className="p-10 text-white/50 text-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-primary shadow-lg">
        <div className="max-w-[1920px] mx-auto px-4 md:px-6 flex items-center h-[48px]">
          <div className="flex items-center gap-3">
            <img src={dandyLogoWhite} alt="Dandy" className="h-[16px] w-auto" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/40">
              Skin Editor
            </span>
          </div>
          <div className="flex-1 flex justify-center" ref={menuRef}>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center justify-center w-6 h-6 cursor-default"
                aria-label="Menu"
              >
                <span className="block w-[5px] h-[5px] rounded-full bg-primary-foreground/10 transition-all duration-300 hover:bg-primary-foreground/30 hover:shadow-[0_0_6px_2px_hsl(var(--primary-foreground)/0.15)]" />
              </button>
              {menuOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-52 rounded-lg bg-primary border border-primary-foreground/15 shadow-xl overflow-hidden">
                  {[
                    { label: "ROI Calculator", icon: Calculator, action: () => { navigate("/"); setMenuOpen(false); } },
                    { label: "Content Generator", icon: FileText, action: () => { navigate("/"); setMenuOpen(false); } },
                    { label: "Template Editor", icon: SlidersHorizontal, action: () => { navigate("/"); setMenuOpen(false); } },
                    { label: "Account Briefing", icon: Search, action: () => { navigate("/"); setMenuOpen(false); } },
                    { label: "Microsites", icon: Globe, action: () => { navigate("/"); setMenuOpen(false); } },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/5"
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  ))}
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all bg-accent-warm text-accent-warm-foreground"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    Skin Editor
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="border-white/10 text-white/60 hover:text-white bg-transparent hover:bg-white/5 h-7 text-[10px]">
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#2ecc71] text-[#0a0f0d] hover:bg-[#27ae60] h-7 text-[10px]">
              <Save className="w-3 h-3 mr-1" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </nav>

      {/* Skin switcher bar */}
      <div className="border-b border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-[1920px] mx-auto px-4 md:px-6 h-10 flex items-center gap-3">
          <button
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors"
            title={panelCollapsed ? "Show editor panel" : "Hide editor panel"}
          >
            {panelCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
          <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
            {(["executive", "solutions", "expansion", "flagship", "flagship-dark", "dandy", "heartland"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSkin(s)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${skin === s ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
              >
                {{ executive: "Executive", solutions: "Solutions", expansion: "Expansion", flagship: "Flagship", "flagship-dark": "Flag. Dark", dandy: "Dandy", heartland: "Heartland" }[s]}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/30 ml-2">Click any headline in the preview to edit inline</p>
        </div>
      </div>

      {/* ═══ SPLIT PANE ═══ */}
      <div className="flex" style={{ height: "calc(100vh - 98px)" }}>
        {/* LEFT — Editor panels */}
        {!panelCollapsed && (
          <div className="w-[380px] shrink-0 border-r border-white/[0.06] bg-[#0a0f0d]">
            <ScrollArea className="h-full">
              <div className="p-4">
                {/* ═══ SECTIONS ═══ */}
                <Panel title="Section Visibility & Order" icon={Layout} defaultOpen>
                  <p className="text-[10px] text-white/30 mb-2">Drag to reorder. Toggle visibility.</p>
                  <div className="space-y-1">
                    {config.sections.map((sec, i) => (
                      <div
                        key={sec.id}
                        draggable
                        onDragStart={() => { dragIdx = i; }}
                        onDragEnter={() => { dragOverIdx = i; }}
                        onDragEnd={() => { if (dragIdx !== null && dragOverIdx !== null) reorderSections(dragIdx, dragOverIdx); dragIdx = null; dragOverIdx = null; }}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-white/20 mt-0.5 shrink-0" />
                        <button onClick={() => updateSection(i, { visible: !sec.visible })} className="mt-0.5 shrink-0">
                          {sec.visible ? <Eye className="w-3.5 h-3.5 text-[#2ecc71]" /> : <EyeOff className="w-3.5 h-3.5 text-white/20" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-medium ${sec.visible ? "text-white" : "text-white/30 line-through"}`}>{sec.label}</p>
                          {sec.headline !== undefined && (
                            <Input
                              value={(sec.id === "hero" && (skin === "dandy" || skin === "heartland")) ? (config.heroHeadlinePattern || "") : (sec.headline || "")}
                              onChange={(e) => {
                                if (sec.id === "hero" && (skin === "dandy" || skin === "heartland")) {
                                  update("heroHeadlinePattern", e.target.value);
                                } else {
                                  updateSection(i, { headline: e.target.value });
                                }
                              }}
                              placeholder="Section headline…"
                              className="mt-1 h-6 text-[10px] bg-white/5 border-white/10 text-white"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                {/* ═══ COLORS ═══ */}
                {skin !== "dandy" && skin !== "heartland" && (
                <Panel title="Colors & Palette" icon={Palette}>
                  <div className="grid grid-cols-1 gap-3">
                    <ColorInput label="Primary / Dark" value={config.colors.primary} onChange={(v) => update("colors", { ...config.colors, primary: v })} />
                    <ColorInput label="Accent" value={config.colors.accent} onChange={(v) => update("colors", { ...config.colors, accent: v })} />
                    <ColorInput label="Background" value={config.colors.background} onChange={(v) => update("colors", { ...config.colors, background: v })} />
                    <ColorInput label="Text Primary" value={config.colors.textPrimary} onChange={(v) => update("colors", { ...config.colors, textPrimary: v })} />
                    <ColorInput label="Text Secondary" value={config.colors.textSecondary} onChange={(v) => update("colors", { ...config.colors, textSecondary: v })} />
                  </div>
                </Panel>
                )}

                {/* ═══ TYPOGRAPHY ═══ */}
                {skin !== "dandy" && skin !== "heartland" && (
                <Panel title="Typography" icon={Type}>
                  <div className="space-y-3">
                    <Field label="Heading Font">
                      <select
                        value={config.typography.headingFont}
                        onChange={(e) => update("typography", { ...config.typography, headingFont: e.target.value })}
                        className="h-7 rounded-md bg-white/5 border border-white/10 text-white text-[11px] px-2 w-full"
                      >
                        {["Bagoss Standard", "system-ui", "Georgia", "Inter", "Playfair Display", "DM Sans", "Sora", "Space Grotesk"].map((f) => (
                          <option key={f} value={f} className="bg-[#0a0f0d]">{f}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Body Font">
                      <select
                        value={config.typography.bodyFont}
                        onChange={(e) => update("typography", { ...config.typography, bodyFont: e.target.value })}
                        className="h-7 rounded-md bg-white/5 border border-white/10 text-white text-[11px] px-2 w-full"
                      >
                        {["system-ui", "Georgia", "Inter", "DM Sans", "Sora", "Space Grotesk"].map((f) => (
                          <option key={f} value={f} className="bg-[#0a0f0d]">{f}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Headline Size">
                      <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
                        {(["small", "medium", "large"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => update("typography", { ...config.typography, headlineSize: s })}
                            className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-colors ${(config.typography.headlineSize || "medium") === s ? "bg-white/10 text-white" : "text-white/40"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Headline Weight">
                      <button
                        onClick={() => update("typography", { ...config.typography, headlineBold: !config.typography.headlineBold })}
                        className={`h-7 w-full rounded-md text-[11px] font-medium transition-colors border ${config.typography.headlineBold ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/10 text-white/40"}`}
                      >
                        {config.typography.headlineBold ? "Bold" : "Normal"}
                      </button>
                    </Field>
                  </div>
                </Panel>
                )}

                {/* ═══ SECTION IMAGES ═══ */}
                {skin !== "expansion" && (
                <Panel title="Section Images" icon={ImageIcon}>
                  <p className="text-[10px] text-white/30 mb-2">Upload images or paste URLs to customize section visuals.</p>
                  <div className="space-y-3">
                    <ImageUploadField label="Hero Background" value={config.sectionImages?.heroImage} onChange={(v) => updateSectionImage("heroImage", v)} />
                    <ImageUploadField label="AI Scan Review Image" value={config.sectionImages?.aiScanReviewImage} onChange={(v) => updateSectionImage("aiScanReviewImage", v)} />
                    <ImageUploadField label="Lab Tour Image" value={config.sectionImages?.labTourImage} onChange={(v) => updateSectionImage("labTourImage", v)} />
                    <Field label="Lab Tour Video URL (replaces image)">
                      <Input
                        value={config.sectionImages?.labTourVideoUrl || ""}
                        onChange={(e) => updateSectionImage("labTourVideoUrl", e.target.value)}
                        placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                        className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                      />
                    </Field>
                    <ImageUploadField label="Final CTA Background" value={config.sectionImages?.finalCTAImage} onChange={(v) => updateSectionImage("finalCTAImage", v)} />
                    <Field label="Case Study Images (comma-separated URLs)">
                      <Input
                        value={(config.sectionImages?.caseStudyImages || []).join(", ")}
                        onChange={(e) => {
                          const urls = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                          update("sectionImages", { ...(config.sectionImages || {}), caseStudyImages: urls.length > 0 ? urls : undefined } as any);
                        }}
                        placeholder="url1, url2, url3"
                        className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                      />
                    </Field>
                  </div>
                </Panel>
                )}

                {/* ═══ COPY & CTAs ═══ */}
                <Panel title="Headlines & CTAs" icon={FileText}>
                  <Field label="Hero Headline Pattern (use {company})">
                    <Input value={config.heroHeadlinePattern} onChange={(e) => update("heroHeadlinePattern", e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                  </Field>
                  <Field label="Default CTA URL (fallback for all buttons)">
                    <Input value={config.ctaUrl} onChange={(e) => update("ctaUrl", e.target.value)} placeholder="https://..." className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                  </Field>

                  {/* ── Per-button CTA config ── */}
                  <p className="text-[10px] text-white/30 mt-2 mb-1">Per-button destinations — leave blank to use the default above. Use <code className="text-white/50">#sectionId</code> for anchor scroll, a video URL for a video modal, or any URL for iframe/redirect.</p>

                  {([
                    { key: "hero", label: "Hero CTA", textKey: "heroCTAText" as const, urlKey: "heroCTAUrl" as const, videoKey: "heroCTAVideoUrl" as const },
                    { key: "secondary", label: "Secondary CTA", textKey: "secondaryCTAText" as const, urlKey: "secondaryCTAUrl" as const, videoKey: "secondaryCTAVideoUrl" as const },
                    { key: "nav", label: "Nav CTA", textKey: "navCTAText" as const, urlKey: "navCTAUrl" as const, videoKey: "navCTAVideoUrl" as const },
                    { key: "final", label: "Final CTA", textKey: "finalCTAUrl" as const, urlKey: "finalCTAUrl" as const, videoKey: "finalCTAVideoUrl" as const },
                  ] as const).map(({ key, label, textKey, urlKey, videoKey }) => {
                    const currentUrl = (config as any)[urlKey] || "";
                    const currentVideoUrl = (config as any)[videoKey] || "";
                    const isAnchor = currentUrl.startsWith("#");
                    const isVideo = !!currentVideoUrl || /youtube\.com|youtu\.be|vimeo\.com|loom\.com|wistia\.com/i.test(currentUrl);
                    const mode = isAnchor ? "anchor" : isVideo ? "video" : "link";

                    return (
                      <div key={key} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider flex-1">{label}</span>
                          <div className="flex gap-0.5 bg-white/[0.03] rounded p-0.5">
                            {(["link", "anchor", "video"] as const).map((m) => (
                              <button
                                key={m}
                                onClick={() => {
                                  if (m === "anchor") {
                                    update(urlKey as any, currentUrl.startsWith("#") ? currentUrl : "#calculator");
                                    update(videoKey as any, "");
                                  } else if (m === "video") {
                                    update(videoKey as any, currentVideoUrl || "https://youtube.com/watch?v=");
                                    if (currentUrl.startsWith("#")) update(urlKey as any, "");
                                  } else {
                                    update(videoKey as any, "");
                                    if (currentUrl.startsWith("#")) update(urlKey as any, "");
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${mode === m ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"}`}
                              >
                                {m === "link" ? "Link" : m === "anchor" ? "Anchor" : "Video"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Field label="Button Text">
                          <Input
                            value={(config as any)[textKey] || ""}
                            onChange={(e) => update(textKey as any, e.target.value)}
                            placeholder="Button label…"
                            className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                          />
                        </Field>
                        {mode === "anchor" ? (
                          <Field label="Anchor ID (e.g. #calculator, #platform)">
                            <Input
                              value={currentUrl}
                              onChange={(e) => {
                                let v = e.target.value;
                                if (v && !v.startsWith("#")) v = "#" + v;
                                update(urlKey as any, v);
                              }}
                              placeholder="#calculator"
                              className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                            />
                          </Field>
                        ) : mode === "video" ? (
                          <Field label="Video URL (YouTube, Vimeo, Loom, Wistia)">
                            <Input
                              value={currentVideoUrl}
                              onChange={(e) => update(videoKey as any, e.target.value)}
                              placeholder="https://youtube.com/watch?v=..."
                              className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                            />
                          </Field>
                        ) : (
                          <Field label="Destination URL">
                            <Input
                              value={currentUrl}
                              onChange={(e) => update(urlKey as any, e.target.value)}
                              placeholder="https://... (leave blank for default)"
                              className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                            />
                          </Field>
                        )}
                      </div>
                    );
                  })}

                  <Field label="Final CTA Headline">
                    <Input value={config.finalCTAHeadline} onChange={(e) => update("finalCTAHeadline", e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                  </Field>
                  <Field label="Final CTA Subheadline">
                    <Input value={config.finalCTASubheadline} onChange={(e) => update("finalCTASubheadline", e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                  </Field>
                  <Field label="Footer Text">
                    <Input value={config.footerText} onChange={(e) => update("footerText", e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                  </Field>
                </Panel>

                {/* ═══ STATS BAR ═══ */}
                {skin !== "expansion" && (
                <Panel title="Stats Bar" icon={BarChart3}>
                  {config.statsBar.map((stat, i) => (
                    <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1">
                      <div className="flex items-center gap-2">
                        <Input value={stat.value} onChange={(e) => { const s = [...config.statsBar]; s[i] = { ...s[i], value: e.target.value }; update("statsBar", s); }} placeholder="Value" className="w-20 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                        <Input value={stat.label} onChange={(e) => { const s = [...config.statsBar]; s[i] = { ...s[i], label: e.target.value }; update("statsBar", s); }} placeholder="Label" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                        <button onClick={() => { const s = config.statsBar.filter((_, j) => j !== i); update("statsBar", s); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => update("statsBar", [...config.statsBar, { value: "", label: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                    <Plus className="w-3 h-3 mr-1" /> Add Stat
                  </Button>
                </Panel>
                )}

                {/* ═══ CHALLENGES ═══ */}
                {skin !== "expansion" && (
                <Panel title="Challenge Cards" icon={Pencil}>
                  {config.challenges.map((ch, i) => (
                    <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1">
                      <div className="flex items-center gap-2">
                        <Input value={ch.title} onChange={(e) => { const c = [...config.challenges]; c[i] = { ...c[i], title: e.target.value }; update("challenges", c); }} placeholder="Title" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                        <button onClick={() => update("challenges", config.challenges.filter((_, j) => j !== i))} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <textarea
                        value={ch.desc}
                        onChange={(e) => { const c = [...config.challenges]; c[i] = { ...c[i], desc: e.target.value }; update("challenges", c); }}
                        placeholder="Description"
                        className="w-full h-12 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none"
                      />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => update("challenges", [...config.challenges, { title: "", desc: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                    <Plus className="w-3 h-3 mr-1" /> Add Challenge
                  </Button>
                </Panel>
                )}

                {/* ═══ COMPARISON TABLE ═══ */}
                {skin !== "expansion" && (
                <Panel title="Comparison Table Rows" icon={Layout}>
                  {config.comparisonRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 items-start">
                      <Input value={row.need} onChange={(e) => { const r = [...config.comparisonRows]; r[i] = { ...r[i], need: e.target.value }; update("comparisonRows", r); }} placeholder="Need" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      <Input value={row.dandy} onChange={(e) => { const r = [...config.comparisonRows]; r[i] = { ...r[i], dandy: e.target.value }; update("comparisonRows", r); }} placeholder="Dandy" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      <Input value={row.traditional} onChange={(e) => { const r = [...config.comparisonRows]; r[i] = { ...r[i], traditional: e.target.value }; update("comparisonRows", r); }} placeholder="Traditional" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      <button onClick={() => update("comparisonRows", config.comparisonRows.filter((_, j) => j !== i))} className="p-0.5 mt-1 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => update("comparisonRows", [...config.comparisonRows, { need: "", dandy: "", traditional: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                    <Plus className="w-3 h-3 mr-1" /> Add Row
                  </Button>
                </Panel>
                )}

                {/* ═══ CASE STUDIES ═══ */}
                {skin !== "expansion" && (
                <Panel title="Case Studies" icon={FileText}>
                  <p className="text-[10px] text-white/30 mb-2">Practice count ranges auto-match per microsite.</p>
                  {config.caseStudies.map((cs, i) => (
                    <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1">
                      <div className="flex items-center gap-1">
                        <Input value={cs.name} onChange={(e) => { const c = [...config.caseStudies]; c[i] = { ...c[i], name: e.target.value }; update("caseStudies", c); }} placeholder="Name" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                        <button onClick={() => update("caseStudies", config.caseStudies.filter((_, j) => j !== i))} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <Input value={cs.stat} onChange={(e) => { const c = [...config.caseStudies]; c[i] = { ...c[i], stat: e.target.value }; update("caseStudies", c); }} placeholder="Stat" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                        <Input value={cs.label} onChange={(e) => { const c = [...config.caseStudies]; c[i] = { ...c[i], label: e.target.value }; update("caseStudies", c); }} placeholder="Label" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </div>
                      <textarea
                        value={cs.quote}
                        onChange={(e) => { const c = [...config.caseStudies]; c[i] = { ...c[i], quote: e.target.value }; update("caseStudies", c); }}
                        placeholder="Quote"
                        className="w-full h-10 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none"
                      />
                      <Input value={cs.author} onChange={(e) => { const c = [...config.caseStudies]; c[i] = { ...c[i], author: e.target.value }; update("caseStudies", c); }} placeholder="Author" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      <div className="flex items-center gap-1">
                        <Input type="number" min={0} value={cs.minPractices ?? ""} onChange={(e) => { const c = [...config.caseStudies]; c[i] = { ...c[i], minPractices: e.target.value ? Number(e.target.value) : undefined }; update("caseStudies", c); }} placeholder="Min" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                        <span className="text-white/20 text-[10px]">–</span>
                        <Input type="number" min={0} value={cs.maxPractices ?? ""} onChange={(e) => { const c = [...config.caseStudies]; c[i] = { ...c[i], maxPractices: e.target.value ? Number(e.target.value) : undefined }; update("caseStudies", c); }} placeholder="Max" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => update("caseStudies", [...config.caseStudies, { name: "", stat: "", label: "", quote: "", author: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                    <Plus className="w-3 h-3 mr-1" /> Add Case Study
                  </Button>
                </Panel>
                )}

                {/* ═══ CUSTOM SECTIONS ═══ */}
                <Panel title="Custom Sections" icon={Plus}>
                  <p className="text-[10px] text-white/30 mb-2">Add custom content blocks between the built-in sections.</p>
                  {(config.customSections || []).map((sec, i) => (
                    <div key={sec.id} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-white/60">Section {i + 1}</span>
                        <button
                          onClick={() => {
                            const arr = [...(config.customSections || [])];
                            arr.splice(i, 1);
                            update("customSections", arr);
                          }}
                          className="text-white/30 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <Input
                        value={sec.headline}
                        onChange={(e) => { const arr = [...(config.customSections || [])]; arr[i] = { ...arr[i], headline: e.target.value }; update("customSections", arr); }}
                        placeholder="Headline"
                        className="h-6 text-[10px] bg-white/5 border-white/10 text-white font-semibold"
                      />
                      <textarea
                        value={sec.body}
                        onChange={(e) => { const arr = [...(config.customSections || [])]; arr[i] = { ...arr[i], body: e.target.value }; update("customSections", arr); }}
                        placeholder="Body text…"
                        className="w-full h-14 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input
                          value={sec.buttonText || ""}
                          onChange={(e) => { const arr = [...(config.customSections || [])]; arr[i] = { ...arr[i], buttonText: e.target.value || undefined }; update("customSections", arr); }}
                          placeholder="Button text"
                          className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                        />
                        <Input
                          value={sec.buttonUrl || ""}
                          onChange={(e) => { const arr = [...(config.customSections || [])]; arr[i] = { ...arr[i], buttonUrl: e.target.value || undefined }; update("customSections", arr); }}
                          placeholder="Button URL"
                          className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                        />
                      </div>
                      <Input
                        value={sec.buttonVideoUrl || ""}
                        onChange={(e) => { const arr = [...(config.customSections || [])]; arr[i] = { ...arr[i], buttonVideoUrl: e.target.value || undefined }; update("customSections", arr); }}
                        placeholder="Video URL (button opens modal)"
                        className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                      />
                      <Input
                        value={sec.imageUrl || ""}
                        onChange={(e) => { const arr = [...(config.customSections || [])]; arr[i] = { ...arr[i], imageUrl: e.target.value || undefined }; update("customSections", arr); }}
                        placeholder="Image URL (optional)"
                        className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
                      />
                      <select
                        value={sec.layout}
                        onChange={(e) => { const arr = [...(config.customSections || [])]; arr[i] = { ...arr[i], layout: e.target.value as any }; update("customSections", arr); }}
                        className="w-full h-6 rounded-md bg-white/5 border border-white/10 text-white text-[10px] px-1"
                      >
                        <option value="centered">Centered</option>
                        <option value="left-image">Image Left</option>
                        <option value="right-image">Image Right</option>
                      </select>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => update("customSections", [...(config.customSections || []), { id: `custom-${Date.now()}`, headline: "New Section", body: "Add your content here.", layout: "centered" }])}
                    className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Custom Section
                  </Button>
                </Panel>

                {/* ═══ EXPANSION-ONLY PANELS ═══ */}
                {skin === "expansion" && (
                  <>
                    {/* ── Why Dandy Feature Blocks ── */}
                    <Panel title="Why Dandy Blocks" icon={Layers}>
                      <Field label="Section Headline">
                        <Input value={(config as any).whyDandyHeadline || ""} onChange={(e) => update("whyDandyHeadline" as any, e.target.value)} placeholder="Better outcomes. Less chair time." className="h-6 text-[10px] bg-white/5 border-white/10 text-white font-semibold" />
                      </Field>
                      <Field label="Section Subheadline">
                        <textarea
                          value={(config as any).whyDandySubheadline || ""}
                          onChange={(e) => update("whyDandySubheadline" as any, e.target.value)}
                          placeholder="Description under the headline…"
                          className="w-full h-12 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none"
                        />
                      </Field>
                      <p className="text-[10px] text-white/30 mb-2 mt-3">Alternating feature blocks below the headline.</p>
                      {((config as any).featureBlocks || []).map((b: ExpansionFeatureBlock, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <Input value={b.label} onChange={(e) => { const arr = [...((config as any).featureBlocks || [])]; arr[i] = { ...arr[i], label: e.target.value }; update("featureBlocks" as any, arr); }} placeholder="Label (e.g. CASE ACCEPTANCE)" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white uppercase" />
                            <button onClick={() => { const arr = ((config as any).featureBlocks || []).filter((_: any, j: number) => j !== i); update("featureBlocks" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <Input value={b.title} onChange={(e) => { const arr = [...((config as any).featureBlocks || [])]; arr[i] = { ...arr[i], title: e.target.value }; update("featureBlocks" as any, arr); }} placeholder="Headline" className="h-6 text-[10px] bg-white/5 border-white/10 text-white font-semibold" />
                          <textarea
                            value={b.desc}
                            onChange={(e) => { const arr = [...((config as any).featureBlocks || [])]; arr[i] = { ...arr[i], desc: e.target.value }; update("featureBlocks" as any, arr); }}
                            placeholder="Description text"
                            className="w-full h-12 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none"
                          />
                          <ImageUploadField
                            label="Block Image"
                            value={b.imageUrl}
                            onChange={(url) => { const arr = [...((config as any).featureBlocks || [])]; arr[i] = { ...arr[i], imageUrl: url || undefined }; update("featureBlocks" as any, arr); }}
                          />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("featureBlocks" as any, [...((config as any).featureBlocks || []), { label: "NEW FEATURE", title: "Feature headline", desc: "Description" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Feature Block
                      </Button>
                    </Panel>

                    {/* ── Expansion Stats Bar ── */}
                    <Panel title="Stats Bar" icon={BarChart3}>
                      <p className="text-[10px] text-white/30 mb-2">Stats displayed between Why Dandy and Activation Steps.</p>
                      {((config as any).expansionStatsBar || []).map((stat: { value: string; label: string }, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <Input value={stat.value} onChange={(e) => { const arr = [...((config as any).expansionStatsBar || [])]; arr[i] = { ...arr[i], value: e.target.value }; update("expansionStatsBar" as any, arr); }} placeholder="e.g. 96%" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white font-bold" />
                            <Input value={stat.label} onChange={(e) => { const arr = [...((config as any).expansionStatsBar || [])]; arr[i] = { ...arr[i], label: e.target.value }; update("expansionStatsBar" as any, arr); }} placeholder="e.g. first-time fit rate" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <button onClick={() => { const arr = ((config as any).expansionStatsBar || []).filter((_: any, j: number) => j !== i); update("expansionStatsBar" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("expansionStatsBar" as any, [...((config as any).expansionStatsBar || []), { value: "", label: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Stat
                      </Button>
                    </Panel>

                    <Panel title="Hero Content" icon={Type}>
                      <Field label="Hero Headline (use {company})">
                        <Input value={(config as any).welcomeHeadline || ""} onChange={(e) => update("welcomeHeadline" as any, e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      <Field label="Hero Subheadline (use {company})">
                        <textarea
                          value={(config as any).welcomeSubtext || ""}
                          onChange={(e) => update("welcomeSubtext" as any, e.target.value)}
                          placeholder="Describe the partnership value prop shown under the hero headline…"
                          className="w-full h-14 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none"
                        />
                      </Field>
                      <Field label="Hero Video Size">
                        <div className="flex gap-1">
                          {(["small", "medium", "large"] as const).map((sz) => (
                            <button
                              key={sz}
                              onClick={() => update("heroVideoSize" as any, sz)}
                              className={`flex-1 h-6 rounded text-[10px] font-medium capitalize transition-colors ${
                                ((config as any).heroVideoSize || "medium") === sz
                                  ? "bg-[#2ecc71] text-white"
                                  : "bg-white/5 text-white/50 hover:bg-white/10"
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </Panel>

                    {/* ── Rep / Calendly ── */}
                    <Panel title="Rep & Booking" icon={Phone}>
                      <Field label="Rep Name">
                        <Input value={(config as any).repName || ""} onChange={(e) => update("repName" as any, e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      <Field label="Rep Title">
                        <Input value={(config as any).repTitle || ""} onChange={(e) => update("repTitle" as any, e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      <Field label="Booking URL (Calendly, ChiliPiper, etc.)">
                        <Input value={(config as any).repCalendlyUrl || ""} onChange={(e) => update("repCalendlyUrl" as any, e.target.value)} placeholder="https://..." className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                    </Panel>

                    {/* ── Signup Section ── */}
                    <Panel title="Signup Section" icon={FileText}>
                      <Field label="Section Label">
                        <Input value={(config as any).signupLabel || ""} onChange={(e) => update("signupLabel" as any, e.target.value)} placeholder="ACTIVATE YOUR PRACTICE" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      <Field label="Headline">
                        <Input value={(config as any).signupHeadline || ""} onChange={(e) => update("signupHeadline" as any, e.target.value)} placeholder="Get Started With Dandy" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      <Field label="Subheadline">
                        <textarea
                          value={(config as any).signupSubheadline || ""}
                          onChange={(e) => update("signupSubheadline" as any, e.target.value)}
                          placeholder="Behind every great dentist, is a great lab..."
                          className="w-full h-14 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none"
                        />
                      </Field>
                      <Field label="Bullet Points">
                        {((config as any).signupBullets || ["", "", ""]).map((bullet: string, i: number) => (
                          <div key={i} className="flex items-center gap-1 mb-1">
                            <Input
                              value={bullet}
                              onChange={(e) => {
                                const arr = [...((config as any).signupBullets || ["", "", ""])];
                                arr[i] = e.target.value;
                                update("signupBullets" as any, arr);
                              }}
                              placeholder={`Bullet ${i + 1}`}
                              className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white"
                            />
                            {((config as any).signupBullets || []).length > 1 && (
                              <button onClick={() => { const arr = ((config as any).signupBullets || []).filter((_: any, j: number) => j !== i); update("signupBullets" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => { const arr = [...((config as any).signupBullets || []), ""]; update("signupBullets" as any, arr); }} className="text-[10px] text-white/40 hover:text-white/70 flex items-center gap-1 mt-1"><Plus className="w-3 h-3" /> Add Bullet</button>
                      </Field>
                      <Field label="Form Title">
                        <Input value={(config as any).signupFormTitle || ""} onChange={(e) => update("signupFormTitle" as any, e.target.value)} placeholder="Book a Meeting" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      <Field label="Form Subtitle">
                        <Input value={(config as any).signupFormSubtitle || ""} onChange={(e) => update("signupFormSubtitle" as any, e.target.value)} placeholder="Enter your email to get started" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      <Field label="Button Text">
                        <Input value={(config as any).signupButtonText || ""} onChange={(e) => update("signupButtonText" as any, e.target.value)} placeholder="Book a Time" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                    </Panel>

                    {/* ── Team Members ── */}
                    <Panel title="Team Members" icon={Users}>
                      <p className="text-[10px] text-white/30 mb-2">Add the dedicated team for this partnership.</p>
                      {((config as any).teamMembers || []).map((m: ExpansionTeamMember, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <Input value={m.name} onChange={(e) => { const arr = [...((config as any).teamMembers || [])]; arr[i] = { ...arr[i], name: e.target.value }; update("teamMembers" as any, arr); }} placeholder="Name" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <button onClick={() => { const arr = ((config as any).teamMembers || []).filter((_: any, j: number) => j !== i); update("teamMembers" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <Input value={m.role} onChange={(e) => { const arr = [...((config as any).teamMembers || [])]; arr[i] = { ...arr[i], role: e.target.value }; update("teamMembers" as any, arr); }} placeholder="Role / Title" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                          <ImageUploadField
                            label="Photo"
                            value={m.photo}
                            onChange={(url) => { const arr = [...((config as any).teamMembers || [])]; arr[i] = { ...arr[i], photo: url || undefined }; update("teamMembers" as any, arr); }}
                          />
                          <div className="grid grid-cols-2 gap-1">
                            <Input value={m.email || ""} onChange={(e) => { const arr = [...((config as any).teamMembers || [])]; arr[i] = { ...arr[i], email: e.target.value || undefined }; update("teamMembers" as any, arr); }} placeholder="Email" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <Input value={m.calendlyUrl || ""} onChange={(e) => { const arr = [...((config as any).teamMembers || [])]; arr[i] = { ...arr[i], calendlyUrl: e.target.value || undefined }; update("teamMembers" as any, arr); }} placeholder="Calendar URL" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("teamMembers" as any, [...((config as any).teamMembers || []), { name: "", role: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Team Member
                      </Button>
                    </Panel>

                    {/* ── Partnership Perks ── */}
                    <Panel title="Partnership Perks" icon={Gift}>
                      {((config as any).perks || []).map((p: ExpansionPerk, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <select
                              value={p.icon}
                              onChange={(e) => { const arr = [...((config as any).perks || [])]; arr[i] = { ...arr[i], icon: e.target.value }; update("perks" as any, arr); }}
                              className="h-6 w-20 rounded-md bg-white/5 border border-white/10 text-white text-[10px] px-1"
                            >
                              {["star", "zap", "shield", "trending", "award", "gift", "users", "sparkles"].map(ic => (
                                <option key={ic} value={ic} className="bg-[#0a0f0d]">{ic}</option>
                              ))}
                            </select>
                            <Input value={p.title} onChange={(e) => { const arr = [...((config as any).perks || [])]; arr[i] = { ...arr[i], title: e.target.value }; update("perks" as any, arr); }} placeholder="Title" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <button onClick={() => { const arr = ((config as any).perks || []).filter((_: any, j: number) => j !== i); update("perks" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <textarea
                            value={p.desc}
                            onChange={(e) => { const arr = [...((config as any).perks || [])]; arr[i] = { ...arr[i], desc: e.target.value }; update("perks" as any, arr); }}
                            placeholder="Description"
                            className="w-full h-10 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none"
                          />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("perks" as any, [...((config as any).perks || []), { icon: "star", title: "", desc: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Perk
                      </Button>
                    </Panel>

                    {/* ── Promotions ── */}
                    <Panel title="Promotions" icon={Gift}>
                      {((config as any).promos || []).map((p: ExpansionPromo, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <Input value={p.title} onChange={(e) => { const arr = [...((config as any).promos || [])]; arr[i] = { ...arr[i], title: e.target.value }; update("promos" as any, arr); }} placeholder="Title" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <Input value={p.badge || ""} onChange={(e) => { const arr = [...((config as any).promos || [])]; arr[i] = { ...arr[i], badge: e.target.value || undefined }; update("promos" as any, arr); }} placeholder="Badge" className="w-24 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <button onClick={() => { const arr = ((config as any).promos || []).filter((_: any, j: number) => j !== i); update("promos" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <textarea
                            value={p.desc}
                            onChange={(e) => { const arr = [...((config as any).promos || [])]; arr[i] = { ...arr[i], desc: e.target.value }; update("promos" as any, arr); }}
                            placeholder="Description"
                            className="w-full h-10 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none"
                          />
                          <div className="grid grid-cols-2 gap-1">
                            <Input value={p.ctaText || ""} onChange={(e) => { const arr = [...((config as any).promos || [])]; arr[i] = { ...arr[i], ctaText: e.target.value || undefined }; update("promos" as any, arr); }} placeholder="CTA Text" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <Input value={p.ctaUrl || ""} onChange={(e) => { const arr = [...((config as any).promos || [])]; arr[i] = { ...arr[i], ctaUrl: e.target.value || undefined }; update("promos" as any, arr); }} placeholder="CTA URL" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("promos" as any, [...((config as any).promos || []), { title: "", desc: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Promo
                      </Button>
                    </Panel>

                    {/* ── Content Links ── */}
                    <Panel title="Content Links / Resources" icon={BookOpen}>
                      {((config as any).contentLinks || []).map((l: ExpansionContentLink, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <select
                              value={l.type}
                              onChange={(e) => { const arr = [...((config as any).contentLinks || [])]; arr[i] = { ...arr[i], type: e.target.value }; update("contentLinks" as any, arr); }}
                              className="h-6 w-20 rounded-md bg-white/5 border border-white/10 text-white text-[10px] px-1"
                            >
                              {["video", "pdf", "article", "webinar"].map(t => (
                                <option key={t} value={t} className="bg-[#0a0f0d]">{t}</option>
                              ))}
                            </select>
                            <Input value={l.title} onChange={(e) => { const arr = [...((config as any).contentLinks || [])]; arr[i] = { ...arr[i], title: e.target.value }; update("contentLinks" as any, arr); }} placeholder="Title" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <button onClick={() => { const arr = ((config as any).contentLinks || []).filter((_: any, j: number) => j !== i); update("contentLinks" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <Input value={l.desc} onChange={(e) => { const arr = [...((config as any).contentLinks || [])]; arr[i] = { ...arr[i], desc: e.target.value }; update("contentLinks" as any, arr); }} placeholder="Description" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                          <Input value={l.url} onChange={(e) => { const arr = [...((config as any).contentLinks || [])]; arr[i] = { ...arr[i], url: e.target.value }; update("contentLinks" as any, arr); }} placeholder="URL" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                          <ImageUploadField label="Card Image" value={(l as any).imageUrl} onChange={(url) => { const arr = [...((config as any).contentLinks || [])]; arr[i] = { ...arr[i], imageUrl: url || undefined }; update("contentLinks" as any, arr); }} />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("contentLinks" as any, [...((config as any).contentLinks || []), { title: "", desc: "", url: "", type: "article" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Resource
                      </Button>
                    </Panel>

                    {/* ── Activation Steps ── */}
                    <Panel title="Activation Steps" icon={Layout}>
                      {((config as any).activationSteps || []).map((s: any, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <Input value={s.step} onChange={(e) => { const arr = [...((config as any).activationSteps || [])]; arr[i] = { ...arr[i], step: e.target.value }; update("activationSteps" as any, arr); }} placeholder="#" className="w-10 h-6 text-[10px] bg-white/5 border-white/10 text-white text-center" />
                            <Input value={s.title} onChange={(e) => { const arr = [...((config as any).activationSteps || [])]; arr[i] = { ...arr[i], title: e.target.value }; update("activationSteps" as any, arr); }} placeholder="Title" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <button onClick={() => { const arr = ((config as any).activationSteps || []).filter((_: any, j: number) => j !== i); update("activationSteps" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <Input value={s.desc} onChange={(e) => { const arr = [...((config as any).activationSteps || [])]; arr[i] = { ...arr[i], desc: e.target.value }; update("activationSteps" as any, arr); }} placeholder="Description" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("activationSteps" as any, [...((config as any).activationSteps || []), { step: String(((config as any).activationSteps || []).length + 1), title: "", desc: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Step
                      </Button>
                    </Panel>

                    {/* ── Paradigm Shift (Old vs New) ── */}
                    <Panel title="Old Way vs New Way" icon={Layout}>
                      <Field label="Section Headline">
                        <textarea value={(config as any).paradigmShiftHeadline || ""} onChange={(e) => update("paradigmShiftHeadline" as any, e.target.value)} className="w-full h-14 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none font-semibold" />
                      </Field>
                      <Field label="Section Subheadline">
                        <textarea value={(config as any).paradigmShiftSubheadline || ""} onChange={(e) => update("paradigmShiftSubheadline" as any, e.target.value)} className="w-full h-16 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none" />
                      </Field>
                      <p className="text-[10px] text-white/30 mt-2 mb-1">Old Way items (Traditional Lab)</p>
                      {((config as any).oldWayItems || []).map((item: string, i: number) => (
                        <div key={i} className="flex items-center gap-1 mb-1">
                          <Input value={item} onChange={(e) => { const arr = [...((config as any).oldWayItems || [])]; arr[i] = e.target.value; update("oldWayItems" as any, arr); }} className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                          <button onClick={() => { const arr = ((config as any).oldWayItems || []).filter((_: any, j: number) => j !== i); update("oldWayItems" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <button onClick={() => update("oldWayItems" as any, [...((config as any).oldWayItems || []), ""])} className="text-[10px] text-white/40 hover:text-white/70 flex items-center gap-1 mt-1"><Plus className="w-3 h-3" /> Add Item</button>

                      <p className="text-[10px] text-white/30 mt-3 mb-1">New Way items (Dandy)</p>
                      {((config as any).newWayItems || []).map((item: string, i: number) => (
                        <div key={i} className="flex items-center gap-1 mb-1">
                          <Input value={item} onChange={(e) => { const arr = [...((config as any).newWayItems || [])]; arr[i] = e.target.value; update("newWayItems" as any, arr); }} className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                          <button onClick={() => { const arr = ((config as any).newWayItems || []).filter((_: any, j: number) => j !== i); update("newWayItems" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <button onClick={() => update("newWayItems" as any, [...((config as any).newWayItems || []), ""])} className="text-[10px] text-white/40 hover:text-white/70 flex items-center gap-1 mt-1"><Plus className="w-3 h-3" /> Add Item</button>
                    </Panel>

                    {/* ── Products ── */}
                    <Panel title="Products" icon={Crown}>
                      <Field label="Section Headline">
                        <Input value={(config as any).productsHeadline || ""} onChange={(e) => update("productsHeadline" as any, e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white font-semibold" />
                      </Field>
                      <Field label="Section Subheadline">
                        <Input value={(config as any).productsSubheadline || ""} onChange={(e) => update("productsSubheadline" as any, e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      {((config as any).products || []).map((p: ExpansionProduct, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <select value={p.icon} onChange={(e) => { const arr = [...((config as any).products || [])]; arr[i] = { ...arr[i], icon: e.target.value }; update("products" as any, arr); }} className="h-6 w-24 rounded-md bg-white/5 border border-white/10 text-white text-[10px] px-1">
                              {["crown", "smile", "stethoscope", "target", "scan", "sparkles", "moon", "shield"].map(ic => <option key={ic} value={ic} className="bg-[#0a0f0d]">{ic}</option>)}
                            </select>
                            <Input value={p.name} onChange={(e) => { const arr = [...((config as any).products || [])]; arr[i] = { ...arr[i], name: e.target.value }; update("products" as any, arr); }} placeholder="Name" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <button onClick={() => { const arr = ((config as any).products || []).filter((_: any, j: number) => j !== i); update("products" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <Input value={p.detail} onChange={(e) => { const arr = [...((config as any).products || [])]; arr[i] = { ...arr[i], detail: e.target.value }; update("products" as any, arr); }} placeholder="Detail" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                          <Input value={p.price} onChange={(e) => { const arr = [...((config as any).products || [])]; arr[i] = { ...arr[i], price: e.target.value }; update("products" as any, arr); }} placeholder="Price" className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("products" as any, [...((config as any).products || []), { icon: "crown", name: "", detail: "", price: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Product
                      </Button>
                    </Panel>

                    {/* ── Promises ── */}
                    <Panel title="Promises & Guarantees" icon={ShieldCheck}>
                      <Field label="Section Headline">
                        <Input value={(config as any).promisesHeadline || ""} onChange={(e) => update("promisesHeadline" as any, e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white font-semibold" />
                      </Field>
                      <Field label="Section Subheadline">
                        <Input value={(config as any).promisesSubheadline || ""} onChange={(e) => update("promisesSubheadline" as any, e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      {((config as any).promises || []).map((p: ExpansionPromise, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <select value={p.icon} onChange={(e) => { const arr = [...((config as any).promises || [])]; arr[i] = { ...arr[i], icon: e.target.value }; update("promises" as any, arr); }} className="h-6 w-24 rounded-md bg-white/5 border border-white/10 text-white text-[10px] px-1">
                              {["ban", "rotate", "shieldCheck", "star", "zap", "shield"].map(ic => <option key={ic} value={ic} className="bg-[#0a0f0d]">{ic}</option>)}
                            </select>
                            <Input value={p.title} onChange={(e) => { const arr = [...((config as any).promises || [])]; arr[i] = { ...arr[i], title: e.target.value }; update("promises" as any, arr); }} placeholder="Title" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <button onClick={() => { const arr = ((config as any).promises || []).filter((_: any, j: number) => j !== i); update("promises" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <textarea value={p.desc} onChange={(e) => { const arr = [...((config as any).promises || [])]; arr[i] = { ...arr[i], desc: e.target.value }; update("promises" as any, arr); }} placeholder="Description" className="w-full h-10 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none" />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("promises" as any, [...((config as any).promises || []), { icon: "shield", title: "", desc: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Promise
                      </Button>
                    </Panel>

                    {/* ── Testimonials ── */}
                    <Panel title="Testimonials" icon={Quote}>
                      <Field label="Section Headline">
                        <Input value={(config as any).testimonialsHeadline || ""} onChange={(e) => update("testimonialsHeadline" as any, e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white font-semibold" />
                      </Field>
                      <Field label="Section Subheadline">
                        <Input value={(config as any).testimonialsSubheadline || ""} onChange={(e) => update("testimonialsSubheadline" as any, e.target.value)} className="h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                      </Field>
                      {((config as any).testimonials || []).map((t: ExpansionTestimonial, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1 mb-2">
                          <div className="flex items-center gap-1">
                            <Input value={t.author} onChange={(e) => { const arr = [...((config as any).testimonials || [])]; arr[i] = { ...arr[i], author: e.target.value }; update("testimonials" as any, arr); }} placeholder="Author" className="flex-1 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <Input value={t.location} onChange={(e) => { const arr = [...((config as any).testimonials || [])]; arr[i] = { ...arr[i], location: e.target.value }; update("testimonials" as any, arr); }} placeholder="Location" className="w-32 h-6 text-[10px] bg-white/5 border-white/10 text-white" />
                            <button onClick={() => { const arr = ((config as any).testimonials || []).filter((_: any, j: number) => j !== i); update("testimonials" as any, arr); }} className="p-0.5 text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <textarea value={t.quote} onChange={(e) => { const arr = [...((config as any).testimonials || [])]; arr[i] = { ...arr[i], quote: e.target.value }; update("testimonials" as any, arr); }} placeholder="Quote text" className="w-full h-14 rounded-md bg-white/5 border border-white/10 text-white text-[10px] p-1.5 resize-none" />
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => update("testimonials" as any, [...((config as any).testimonials || []), { quote: "", author: "", location: "" }])} className="border-white/10 text-white/50 bg-transparent hover:bg-white/5 h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Testimonial
                      </Button>
                    </Panel>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* RIGHT — Live Preview */}
        <div className="flex-1 overflow-hidden bg-[#141a17] flex flex-col">
          {/* Viewport toggle bar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-white/[0.02]">
            <span className="text-[10px] text-white/40 mr-2 uppercase tracking-wider font-medium">Viewport</span>
            {([
              { key: "desktop", label: "Desktop", width: "100%", icon: "🖥" },
              { key: "tablet", label: "Tablet", width: "768px", icon: "📱" },
              { key: "mobile", label: "Mobile", width: "375px", icon: "📲" },
            ] as const).map((vp) => (
              <button
                key={vp.key}
                onClick={() => setViewport(vp.key)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  viewport === vp.key
                    ? "bg-[#2ecc71]/20 text-[#2ecc71] border border-[#2ecc71]/30"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent"
                }`}
              >
                {vp.icon} {vp.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] text-white/40 mr-1 uppercase tracking-wider font-medium">Pan</span>
              <button onClick={() => setPanX(x => x - 100)} className="px-2 py-1 rounded text-[10px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent">←</button>
              <button onClick={() => setPanX(0)} className="px-2 py-1 rounded text-[10px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent">⊙</button>
              <button onClick={() => setPanX(x => x + 100)} className="px-2 py-1 rounded text-[10px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent">→</button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <span className="text-[10px] text-white/40 mr-1 uppercase tracking-wider font-medium">Zoom</span>
              <button onClick={() => setZoom(z => Math.max(25, z - 25))} className="px-2 py-1 rounded text-[10px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent">−</button>
              <button onClick={() => { setZoom(100); setPanX(0); }} className="px-2 py-1 rounded text-[10px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent min-w-[40px] text-center">{zoom}%</button>
              <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="px-2 py-1 rounded text-[10px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent">+</button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 md:p-6 flex justify-center">
              <div
                className="transition-all duration-300 ease-in-out origin-top"
                style={{
                  width: viewport === "desktop" ? "100%" : viewport === "tablet" ? "768px" : "375px",
                  maxWidth: "100%",
                  transform: `scale(${zoom / 100}) translateX(${panX}px)`,
                }}
              >
                {(skin === "dandy" || skin === "heartland") ? (
                  <div className="relative" style={{ isolation: "isolate" }}>
                    {/* Override the skin's fixed/sticky navbar so it stays inside the preview */}
                    <style>{`
                      .skin-preview-container [class*="fixed"] {
                        position: absolute !important;
                      }
                      .skin-preview-container nav[class*="fixed"],
                      .skin-preview-container header[class*="fixed"] {
                        position: absolute !important;
                      }
                    `}</style>
                    <div className="skin-preview-container">
                  {(() => {
                    const mockBriefing = {
                      companyName: "Acme Dental Group",
                      overview: "A growing DSO with 50+ locations across the midwest.",
                      tier: skin === "heartland" ? "Tier 1" : "Tier 2",
                      dandyFitAnalysis: {
                        primaryValueProp: "Unified lab partnership to drive same-store growth and operational consistency.",
                        keyPainPoints: ["Fragmented lab relationships", "Inconsistent quality across locations", "No centralized visibility"],
                        relevantProofPoints: ["30% case acceptance lift", "96% first-time right rate", "50% denture appointments saved"],
                        recommendedPilotApproach: "Start with 3-5 high-volume locations over 90 days.",
                      },
                      micrositeRecommendations: {
                        headline: "The lab partner built for {company} growth",
                        keyMetrics: ["30% case acceptance lift", "96% first-time right rate", "$0 CAPEX"],
                        contentFocus: "operational efficiency",
                      },
                      sizeAndLocations: { practiceCount: "50+", states: ["TX", "FL", "OH"], headquarters: "Dallas, TX" },
                    };
                    const noop = () => {};
                    return skin === "dandy" ? (
                      <MicrositeDandySkin data={mockBriefing} skinConfig={config} onOpenDemo={noop} onTrackCTA={noop}
                        editorMode sectionStyles={config.sectionStyles} onUpdateSectionStyle={handleUpdateSectionStyle} />
                    ) : (
                      <MicrositeHeartlandSkin data={mockBriefing} skinConfig={config} onOpenDemo={noop} onTrackCTA={noop}
                        editorMode sectionStyles={config.sectionStyles} onUpdateSectionStyle={handleUpdateSectionStyle} />
                    );
                  })()}
                    </div>
                  </div>
                ) : (
                  <MicrositeLivePreview
                    config={config}
                    skin={skin}
                    onUpdateHeadline={updateSectionByIdHeadline}
                    onUpdateSubheadline={updateSectionByIdSubheadline}
                    onUpdateHeroPattern={(v) => update("heroHeadlinePattern", v)}
                    onUpdateHeroSubtext={(v) => update("heroSubtext", v)}
                    onUpdateFinalCTAHeadline={(v) => update("finalCTAHeadline", v)}
                    onUpdateFinalCTASubheadline={(v) => update("finalCTASubheadline", v)}
                    onUpdateButtonText={(key, v) => update(key, v)}
                    onUpdateCtaUrl={(v) => update("ctaUrl", v)}
                    onUpdateButtonUrl={(key, v) => update(key, v)}
                    onUpdateVideoUrl={(key, v) => update(key, v)}
                    onUpdateCustomSections={(sections) => update("customSections", sections)}
                  />
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default MicrositeSkinEditor;