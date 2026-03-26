import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Eye, Loader2, Type, Target, BarChart3,
  Lightbulb, MapPin, Building2, Zap, Layout, GripVertical, Users,
  Calculator, FileText, SlidersHorizontal, Search, Globe, Palette, TrendingUp
} from "lucide-react";
import dandyLogoWhite from "@/assets/dandy-logo-white.svg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SkinCaseStudy, SkinStat, DEFAULT_EXECUTIVE_CONFIG, DEFAULT_SOLUTIONS_CONFIG, DEFAULT_EXPANSION_CONFIG, DEFAULT_DANDY_CONFIG, loadSkinConfig, ExpansionTeamMember, ExpansionPerk, ExpansionPromo, ExpansionContentLink, ExpansionSkinConfig, SkinId } from "@/lib/microsite-skin-config";
import { ChevronDown, Trash2, Plus, Gift, BookOpen, Image as ImageIcon, Upload, X } from "lucide-react";

type BriefingData = {
  companyName: string;
  overview: string;
  tier: string;
  tierRationale?: string;
  organizationalModel?: string;
  dandyFitAnalysis: {
    primaryValueProp: string;
    keyPainPoints: string[];
    relevantProofPoints: string[];
    potentialObjections?: string[];
    recommendedPilotApproach: string;
  };
  micrositeRecommendations: {
    headline: string;
    keyMetrics: string[];
    contentFocus: string;
  };
  sizeAndLocations?: {
    practiceCount: string;
    states: string[];
    headquarters: string;
    estimatedRevenue?: string | null;
  };
  [key: string]: any;
};

type MicrositeRecord = {
  id: string;
  slug: string;
  company_name: string;
  tier: string | null;
  skin: string;
  briefing_data: BriefingData;
};

const MicrositeEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<MicrositeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<BriefingData | null>(null);
  const [skin, setSkin] = useState<"executive" | "solutions" | "expansion" | "heartland" | "dandy">("executive");
  const [activeTab, setActiveTab] = useState<"content" | "fit" | "microsite">("content");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: row, error } = await supabase
        .from("microsites" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error || !row) {
        toast.error("Microsite not found");
        navigate("/");
        return;
      }
      const r = row as any as MicrositeRecord;
      setRecord(r);
      setData(r.briefing_data);
      setSkin(r.skin as "executive" | "solutions");
      setLoading(false);
    })();
  }, [id]);

  const updateField = (path: string, value: any) => {
    if (!data) return;
    const keys = path.split(".");
    const updated = JSON.parse(JSON.stringify(data));
    let obj = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    setData(updated);
  };

  const updateArrayItem = (path: string, index: number, value: string) => {
    if (!data) return;
    const keys = path.split(".");
    const updated = JSON.parse(JSON.stringify(data));
    let obj = updated;
    for (const k of keys) obj = obj[k];
    (obj as string[])[index] = value;
    setData(updated);
  };

  const addArrayItem = (path: string) => {
    if (!data) return;
    const keys = path.split(".");
    const updated = JSON.parse(JSON.stringify(data));
    let obj = updated;
    for (const k of keys) obj = obj[k];
    (obj as string[]).push("");
    setData(updated);
  };

  const removeArrayItem = (path: string, index: number) => {
    if (!data) return;
    const keys = path.split(".");
    const updated = JSON.parse(JSON.stringify(data));
    let obj = updated;
    for (const k of keys) obj = obj[k];
    (obj as string[]).splice(index, 1);
    setData(updated);
  };

  const reorderArrayItem = (path: string, fromIndex: number, toIndex: number) => {
    if (!data || fromIndex === toIndex) return;
    const keys = path.split(".");
    const updated = JSON.parse(JSON.stringify(data));
    let obj = updated;
    for (const k of keys) obj = obj[k];
    const arr = obj as string[];
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    setData(updated);
  };

  const save = async () => {
    if (!record || !data) return;
    setSaving(true);
    const { error } = await supabase
      .from("microsites" as any)
      .update({
        briefing_data: data as any,
        skin,
        company_name: data.companyName,
        tier: data.tier || null,
      } as any)
      .eq("id", record.id);
    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Microsite saved!");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !record) return null;

  const fit = data.dandyFitAnalysis;
  const micro = data.micrositeRecommendations;
  const size = data.sizeAndLocations;

  const TABS = [
    { key: "content" as const, label: "Company & Content", icon: Building2 },
    { key: "fit" as const, label: "Dandy Fit Analysis", icon: Target },
    { key: "microsite" as const, label: "Microsite Config", icon: Layout },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar with secret dot */}
      <nav className="sticky top-0 z-50 bg-primary shadow-lg">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 flex items-center h-[56px]">
          <div className="flex items-center gap-4">
            <img src={dandyLogoWhite} alt="Dandy" className="h-[18px] w-auto" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/40">
              Enterprise Sales
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
                    { label: "Skin Editor", icon: Palette, action: () => { navigate("/skin-editor"); setMenuOpen(false); } },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="flex items-center gap-2 w-full px-4 py-3 text-[12px] font-semibold uppercase tracking-wider transition-all text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/5"
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Editor toolbar */}
      <div className="sticky top-[56px] z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-sm font-semibold text-foreground truncate">{data.companyName}</h1>
            <span className="text-xs text-muted-foreground">/ Edit</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/dso/${record.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </a>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Skin selector */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Skin</label>
          <div className="flex gap-2">
          {(["executive", "solutions", "expansion", "heartland", "dandy"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSkin(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  skin === s
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/30 text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
                }`}
              >
                {s === "executive" ? "Executive" : s === "solutions" ? "Solutions" : s === "expansion" ? "Expansion" : s === "heartland" ? "Heartland" : "Dandy"}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content tab */}
        {activeTab === "content" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <FieldGroup label="Company Name">
              <input
                value={data.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </FieldGroup>

            <FieldGroup label="Tier">
              <input
                value={data.tier || ""}
                onChange={(e) => updateField("tier", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </FieldGroup>

            <FieldGroup label="Overview">
              <textarea
                value={data.overview}
                onChange={(e) => updateField("overview", e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </FieldGroup>

            <FieldGroup label="Organizational Model">
              <input
                value={data.organizationalModel || ""}
                onChange={(e) => updateField("organizationalModel", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </FieldGroup>

            {size && (
              <>
                <FieldGroup label="Practice Count">
                  <input
                    value={size.practiceCount}
                    onChange={(e) => updateField("sizeAndLocations.practiceCount", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </FieldGroup>
                <FieldGroup label="Headquarters">
                  <input
                    value={size.headquarters}
                    onChange={(e) => updateField("sizeAndLocations.headquarters", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </FieldGroup>
                <FieldGroup label="Estimated Revenue">
                  <input
                    value={size.estimatedRevenue || ""}
                    onChange={(e) => updateField("sizeAndLocations.estimatedRevenue", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </FieldGroup>
                <ArrayEditor
                  label="States"
                  items={size.states}
                  onUpdate={(i, v) => updateArrayItem("sizeAndLocations.states", i, v)}
                  onAdd={() => addArrayItem("sizeAndLocations.states")}
                  onRemove={(i) => removeArrayItem("sizeAndLocations.states", i)}
                  onReorder={(from, to) => reorderArrayItem("sizeAndLocations.states", from, to)}
                />
              </>
            )}
          </motion.div>
        )}

        {/* Fit Analysis tab */}
        {activeTab === "fit" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <FieldGroup label="Primary Value Prop">
              <textarea
                value={fit.primaryValueProp}
                onChange={(e) => updateField("dandyFitAnalysis.primaryValueProp", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </FieldGroup>

            <ArrayEditor
              label="Key Pain Points"
              items={fit.keyPainPoints}
              onUpdate={(i, v) => updateArrayItem("dandyFitAnalysis.keyPainPoints", i, v)}
              onAdd={() => addArrayItem("dandyFitAnalysis.keyPainPoints")}
              onRemove={(i) => removeArrayItem("dandyFitAnalysis.keyPainPoints", i)}
              onReorder={(from, to) => reorderArrayItem("dandyFitAnalysis.keyPainPoints", from, to)}
            />

            <ArrayEditor
              label="Relevant Proof Points"
              items={fit.relevantProofPoints}
              onUpdate={(i, v) => updateArrayItem("dandyFitAnalysis.relevantProofPoints", i, v)}
              onAdd={() => addArrayItem("dandyFitAnalysis.relevantProofPoints")}
              onRemove={(i) => removeArrayItem("dandyFitAnalysis.relevantProofPoints", i)}
              onReorder={(from, to) => reorderArrayItem("dandyFitAnalysis.relevantProofPoints", from, to)}
            />

            <ArrayEditor
              label="Potential Objections"
              items={fit.potentialObjections || []}
              onUpdate={(i, v) => updateArrayItem("dandyFitAnalysis.potentialObjections", i, v)}
              onAdd={() => {
                if (!fit.potentialObjections) {
                  updateField("dandyFitAnalysis.potentialObjections", [""]);
                } else {
                  addArrayItem("dandyFitAnalysis.potentialObjections");
                }
              }}
              onRemove={(i) => removeArrayItem("dandyFitAnalysis.potentialObjections", i)}
              onReorder={(from, to) => reorderArrayItem("dandyFitAnalysis.potentialObjections", from, to)}
            />

            <FieldGroup label="Recommended Pilot Approach">
              <textarea
                value={fit.recommendedPilotApproach}
                onChange={(e) => updateField("dandyFitAnalysis.recommendedPilotApproach", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </FieldGroup>
          </motion.div>
        )}

        {/* Microsite Config tab */}
        {activeTab === "microsite" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* CTA & font overrides — Executive/Solutions only */}
            {skin !== "expansion" && (
              <>
                <FieldGroup label="CTA Modal URL Override">
                  <input
                    value={data.ctaUrlOverride || ""}
                    onChange={(e) => updateField("ctaUrlOverride", e.target.value || undefined)}
                    placeholder="Leave blank to use skin default (ChiliPiper)"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Override the CTA modal URL for this microsite only. Supports ChiliPiper, Marketo, or any embeddable URL.</p>
                </FieldGroup>

                <FieldGroup label="CTA Open Mode">
                  <select
                    value={(data as any).ctaOpenMode || "iframe"}
                    onChange={(e) => updateField("ctaOpenMode", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="iframe">Iframe embed (opens in modal)</option>
                    <option value="redirect">New tab redirect (for Marketo, external forms)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Choose how the CTA link opens. Use "New tab redirect" for pages that don't support iframe embedding.</p>
                </FieldGroup>

                <FieldGroup label="Heading Font">
                  <select
                    value={(data as any).fontOverride || ""}
                    onChange={(e) => updateField("fontOverride", e.target.value || undefined)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Skin default</option>
                    <option value="Arimo">Arimo (Dandy Brand)</option>
                    <option value="Inter">Inter</option>
                    <option value="DM Sans">DM Sans</option>
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="Playfair Display">Playfair Display</option>
                    <option value="Sora">Sora</option>
                    <option value="Outfit">Outfit</option>
                    <option value="Space Grotesk">Space Grotesk</option>
                    <option value="Manrope">Manrope</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Override the heading font. Leave as "Skin default" to use the global skin typography.</p>
                  {(data as any).fontOverride && (
                    <p className="text-sm mt-2 font-semibold" style={{ fontFamily: `'${(data as any).fontOverride}', sans-serif` }}>
                      Preview: The quick brown fox jumps over the lazy dog
                    </p>
                  )}
                </FieldGroup>
                <FieldGroup label="Body Font">
                  <select
                    value={(data as any).bodyFontOverride || ""}
                    onChange={(e) => updateField("bodyFontOverride", e.target.value || undefined)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Default (Inter)</option>
                    <option value="Arimo">Arimo (Dandy Brand)</option>
                    <option value="Inter">Inter</option>
                    <option value="DM Sans">DM Sans</option>
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="Sora">Sora</option>
                    <option value="Outfit">Outfit</option>
                    <option value="Space Grotesk">Space Grotesk</option>
                    <option value="Manrope">Manrope</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Override the body/paragraph font for this microsite.</p>
                  {(data as any).bodyFontOverride && (
                    <p className="text-sm mt-2" style={{ fontFamily: `'${(data as any).bodyFontOverride}', sans-serif` }}>
                      Preview: The quick brown fox jumps over the lazy dog. 0123456789
                    </p>
                  )}
                </FieldGroup>

                <FieldGroup label="Headline">
                  <input
                    value={micro.headline}
                    onChange={(e) => updateField("micrositeRecommendations.headline", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </FieldGroup>
              </>
            )}

            {/* Per-section headline & subheadline overrides */}
            {skin !== "expansion" && (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Section Headlines & Subheadlines</h3>
                <p className="text-xs text-muted-foreground">Override the headline and subheadline for each section on this microsite. Leave blank to use the skin defaults. Use <code className="bg-muted px-1 rounded">{'{company}'}</code> for the company name.</p>
              </div>
              {[
                { id: "hero", label: "Hero" },
                { id: "hiddenCost", label: "Hidden Cost" },
                { id: "comparison", label: "Comparison Table" },
                { id: "dashboard", label: "Executive Dashboard" },
                { id: "aiScanReview", label: "AI Scan Review" },
                { id: "successStories", label: "Success Stories" },
                { id: "pilotApproach", label: "Pilot Approach" },
                { id: "labTour", label: "Lab Tour" },
                { id: "calculator", label: "ROI Calculator" },
                { id: "finalCTA", label: "Final CTA" },
              ].map(({ id, label }) => (
                <div key={id} className="space-y-1.5 pb-3 border-b border-border last:border-0 last:pb-0">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                  <input
                    value={(data as any).sectionHeadlineOverrides?.[id] || ""}
                    onChange={(e) => {
                      const overrides = { ...((data as any).sectionHeadlineOverrides || {}), [id]: e.target.value || undefined };
                      updateField("sectionHeadlineOverrides", overrides);
                    }}
                    placeholder="Headline override…"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <textarea
                    value={(data as any).sectionSubheadlines?.[id] || ""}
                    onChange={(e) => {
                      const subs = { ...((data as any).sectionSubheadlines || {}), [id]: e.target.value || undefined };
                      updateField("sectionSubheadlines", subs);
                    }}
                    placeholder="Subheadline override…"
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                  />
              </div>
              ))}
            </div>
            )}

            {/* Expansion section headline overrides */}
            {skin === "expansion" && (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Section Headlines & Subheadlines</h3>
                <p className="text-xs text-muted-foreground">Override the headline and subheadline for each section. Leave blank to use skin defaults. Use <code className="bg-muted px-1 rounded">{'{company}'}</code> for the company name.</p>
              </div>
              {[
                { id: "hero", label: "Hero" },
                { id: "features", label: "Why Dandy" },
                { id: "activate", label: "Activation Steps" },
                { id: "team", label: "Meet Your Team" },
                { id: "perks", label: "Partnership Perks" },
                { id: "promos", label: "Promotions" },
                { id: "resources", label: "Resources" },
                { id: "signup", label: "Signup Form" },
                { id: "finalCTA", label: "Final CTA" },
              ].map(({ id, label }) => (
                <div key={id} className="space-y-1.5 pb-3 border-b border-border last:border-0 last:pb-0">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                  <input
                    value={(data as any).sectionHeadlineOverrides?.[id] || ""}
                    onChange={(e) => {
                      const overrides = { ...((data as any).sectionHeadlineOverrides || {}), [id]: e.target.value || undefined };
                      updateField("sectionHeadlineOverrides", overrides);
                    }}
                    placeholder="Headline override…"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <textarea
                    value={(data as any).sectionSubheadlines?.[id] || ""}
                    onChange={(e) => {
                      const subs = { ...((data as any).sectionSubheadlines || {}), [id]: e.target.value || undefined };
                      updateField("sectionSubheadlines", subs);
                    }}
                    placeholder="Subheadline override…"
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                  />
              </div>
              ))}
            </div>
            )}

            {/* Per-section custom buttons */}
            {skin !== "expansion" && (
            <CustomButtonsEditor
              buttons={(data as any).customButtons || []}
              onUpdate={(buttons) => updateField("customButtons", buttons)}
            />
            )}

            {skin !== "expansion" && (
              <>
                <ArrayEditor
                  label="Key Metrics"
                  items={micro.keyMetrics}
                  onUpdate={(i, v) => updateArrayItem("micrositeRecommendations.keyMetrics", i, v)}
                  onAdd={() => addArrayItem("micrositeRecommendations.keyMetrics")}
                  onRemove={(i) => removeArrayItem("micrositeRecommendations.keyMetrics", i)}
                  onReorder={(from, to) => reorderArrayItem("micrositeRecommendations.keyMetrics", from, to)}
                />

                <FieldGroup label="Content Focus">
                  <textarea
                    value={micro.contentFocus}
                    onChange={(e) => updateField("micrositeRecommendations.contentFocus", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                  />
                </FieldGroup>
              </>
            )}

            {/* Case Study & Stats — Executive/Solutions only */}
            {skin !== "expansion" && skin !== "heartland" && skin !== "dandy" && (
              <>
                <CaseStudyMatcher
                  skin={skin}
                  overrides={(data as any).caseStudyOverrides}
                  onUpdate={(overrides) => updateField("caseStudyOverrides", overrides)}
                  dsoPracticeCount={parseInt(size?.practiceCount || "0", 10) || null}
                />
                <StatsBarMatcher
                  skin={skin}
                  overrides={(data as any).statsBarOverrides}
                  onUpdate={(overrides) => updateField("statsBarOverrides", overrides)}
                  dsoPracticeCount={parseInt(size?.practiceCount || "0", 10) || null}
                />
              </>
            )}

            {/* ═══ EXPANSION-ONLY: Team, Perks, Promos, Resources ═══ */}
            {skin === "expansion" && (
              <ExpansionContentEditor
                data={data}
                onUpdate={updateField}
              />
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

/* ── Reusable field components ── */

const FieldGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</label>
    {children}
  </div>
);

const ArrayEditor = ({
  label,
  items,
  onUpdate,
  onAdd,
  onRemove,
  onReorder,
}: {
  label: string;
  items: string[];
  onUpdate: (i: number, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onReorder: (from: number, to: number) => void;
}) => {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
    setDraggingIdx(index);
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
    setDragOverIdx(index);
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      onReorder(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</label>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragEnter={() => handleDragEnter(i)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`flex gap-2 items-center rounded-lg transition-all ${
              draggingIdx === i ? "opacity-40" : ""
            } ${dragOverIdx === i && draggingIdx !== i ? "border-t-2 border-primary" : ""}`}
          >
            <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors">
              <GripVertical className="w-4 h-4" />
            </div>
            <input
              value={item}
              onChange={(e) => onUpdate(i, e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={() => onRemove(i)}
              className="px-2 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={onAdd}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors ml-7"
        >
          + Add item
        </button>
      </div>
    </div>
  );
};

/* ── Case Study Practice Count Matcher ── */
const CaseStudyMatcher = ({
  skin,
  overrides,
  onUpdate,
  dsoPracticeCount,
}: {
  skin: "executive" | "solutions" | "expansion";
  overrides?: SkinCaseStudy[];
  onUpdate: (v: SkinCaseStudy[]) => void;
  dsoPracticeCount: number | null;
}) => {
  const defaults = skin === "executive" ? DEFAULT_EXECUTIVE_CONFIG.caseStudies : DEFAULT_SOLUTIONS_CONFIG.caseStudies;
  const studies = overrides || defaults;
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [libraryStudies, setLibraryStudies] = useState<SkinCaseStudy[]>(defaults);
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    loadSkinConfig(skin).then((cfg) => setLibraryStudies(cfg.caseStudies));
  }, [skin]);

  const updateStudy = (index: number, field: keyof SkinCaseStudy, value: any) => {
    const updated = studies.map((s, i) => i === index ? { ...s, [field]: value } : s);
    onUpdate(updated);
  };

  const removeStudy = (index: number) => {
    onUpdate(studies.filter((_, i) => i !== index));
  };

  const addStudy = () => {
    onUpdate([...studies, { name: "New Case Study", stat: "0%", label: "metric label", quote: "", author: "" }]);
  };

  const addFromLibrary = (study: SkinCaseStudy) => {
    onUpdate([...studies, { ...study }]);
    setShowLibrary(false);
  };

  const handleDragStart = (index: number) => { dragItem.current = index; setDraggingIdx(index); };
  const handleDragEnter = (index: number) => { dragOverItem.current = index; setDragOverIdx(index); };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const arr = [...studies];
      const [moved] = arr.splice(dragItem.current, 1);
      arr.splice(dragOverItem.current, 0, moved);
      onUpdate(arr);
    }
    dragItem.current = null; dragOverItem.current = null; setDraggingIdx(null); setDragOverIdx(null);
  };

  const isMatch = (s: SkinCaseStudy) => {
    if (!dsoPracticeCount) return true;
    const min = s.minPractices ?? 0;
    const max = s.maxPractices ?? Infinity;
    return dsoPracticeCount >= min && dsoPracticeCount <= max;
  };

  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
        <Users className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
        Case Studies — Practice Count Matching
      </label>
      <p className="text-xs text-muted-foreground mb-4">
        Add, remove, or edit case studies. Cards matching the DSO's size{dsoPracticeCount ? ` (${dsoPracticeCount} practices)` : ""} will be shown automatically.
      </p>
      <div className="space-y-3">
        {studies.map((s, i) => {
          const matched = isMatch(s);
          return (
            <div
              key={i}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`rounded-xl border p-4 transition-all ${
                matched ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-card"
              } ${draggingIdx === i ? "opacity-40" : ""} ${dragOverIdx === i && draggingIdx !== i ? "ring-2 ring-primary/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  {matched && dsoPracticeCount && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Match
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeStudy(i)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                >
                  ✕ Remove
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Name</label>
                  <input
                    value={s.name}
                    onChange={(e) => updateStudy(i, "name", e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Author</label>
                  <input
                    value={s.author}
                    onChange={(e) => updateStudy(i, "author", e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Stat</label>
                  <input
                    value={s.stat}
                    onChange={(e) => updateStudy(i, "stat", e.target.value)}
                    placeholder="e.g. 96%"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Stat Label</label>
                  <input
                    value={s.label}
                    onChange={(e) => updateStudy(i, "label", e.target.value)}
                    placeholder="e.g. reduction in remakes"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Quote</label>
                <textarea
                  value={s.quote}
                  onChange={(e) => updateStudy(i, "quote", e.target.value)}
                  rows={2}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                />
              </div>

              <div className="mb-3">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Case Study URL (optional)</label>
                <input
                  value={s.url || ""}
                  onChange={(e) => updateStudy(i, "url", e.target.value || undefined)}
                  placeholder="https://example.com/case-study"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[10px] text-muted-foreground mt-1">If set, a "Read Case Study" link will appear on the card.</p>
              </div>

              {(s.minPractices !== undefined || s.maxPractices !== undefined) && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    Target: {s.minPractices ?? 0}–{s.maxPractices ?? "∞"} practices
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button onClick={addStudy} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          + Add blank
        </button>
        <div className="relative">
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
          >
            + Pick from library <ChevronDown className={`w-3 h-3 transition-transform ${showLibrary ? "rotate-180" : ""}`} />
          </button>
          {showLibrary && (
            <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-popover shadow-lg p-2 space-y-1">
              {libraryStudies.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">No case studies in skin library.</p>
              )}
              {libraryStudies.map((ls, i) => {
                const alreadyAdded = studies.some((s) => s.name === ls.name && s.stat === ls.stat);
                return (
                  <button
                    key={i}
                    onClick={() => !alreadyAdded && addFromLibrary(ls)}
                    disabled={alreadyAdded}
                    className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                      alreadyAdded
                        ? "opacity-40 cursor-not-allowed bg-muted/50"
                        : "hover:bg-accent/50 cursor-pointer"
                    }`}
                  >
                    <span className="font-semibold text-foreground">{ls.name}</span>
                    <span className="text-muted-foreground ml-1.5">— {ls.stat} {ls.label}</span>
                    {alreadyAdded && <span className="ml-1 text-muted-foreground">(added)</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {overrides && (
          <button onClick={() => onUpdate(defaults)} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            ↺ Reset to defaults
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Stats Bar Practice Count Matcher ── */
const StatsBarMatcher = ({
  skin,
  overrides,
  onUpdate,
  dsoPracticeCount,
}: {
  skin: "executive" | "solutions" | "expansion";
  overrides?: SkinStat[];
  onUpdate: (v: SkinStat[]) => void;
  dsoPracticeCount: number | null;
}) => {
  const defaults = skin === "executive" ? DEFAULT_EXECUTIVE_CONFIG.statsBar : DEFAULT_SOLUTIONS_CONFIG.statsBar;
  const stats = overrides || defaults;
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const updateStat = (index: number, field: keyof SkinStat, value: any) => {
    const updated = stats.map((s, i) => i === index ? { ...s, [field]: value } : s);
    onUpdate(updated);
  };

  const removeStat = (index: number) => {
    onUpdate(stats.filter((_, i) => i !== index));
  };

  const addStat = () => {
    onUpdate([...stats, { value: "0", label: "New stat" }]);
  };

  const handleDragStart = (index: number) => { dragItem.current = index; setDraggingIdx(index); };
  const handleDragEnter = (index: number) => { dragOverItem.current = index; setDragOverIdx(index); };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const arr = [...stats];
      const [moved] = arr.splice(dragItem.current, 1);
      arr.splice(dragOverItem.current, 0, moved);
      onUpdate(arr);
    }
    dragItem.current = null; dragOverItem.current = null; setDraggingIdx(null); setDragOverIdx(null);
  };

  const isMatch = (s: SkinStat) => {
    if (!dsoPracticeCount) return true;
    const min = s.minPractices ?? 0;
    const max = s.maxPractices ?? Infinity;
    return dsoPracticeCount >= min && dsoPracticeCount <= max;
  };

  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
        <BarChart3 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
        Stats Bar — Practice Count Matching
      </label>
      <p className="text-xs text-muted-foreground mb-4">
        Add, remove, or edit stats. Drag to reorder. Only matching stats will appear on the microsite.
      </p>
      <div className="space-y-3">
        {stats.map((s, i) => {
          const matched = isMatch(s);
          return (
            <div
              key={i}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`rounded-xl border p-4 transition-all ${
                matched ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-card"
              } ${draggingIdx === i ? "opacity-40" : ""} ${dragOverIdx === i && draggingIdx !== i ? "ring-2 ring-primary/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  {matched && dsoPracticeCount && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Match
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeStat(i)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                >
                  ✕ Remove
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Value</label>
                  <input
                    value={s.value}
                    onChange={(e) => updateStat(i, "value", e.target.value)}
                    placeholder="e.g. 96%"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Label</label>
                  <input
                    value={s.label}
                    onChange={(e) => updateStat(i, "label", e.target.value)}
                    placeholder="e.g. First-time right rate"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {(s.minPractices !== undefined || s.maxPractices !== undefined) && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    Target: {s.minPractices ?? 0}–{s.maxPractices ?? "∞"} practices
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={addStat} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          + Add stat
        </button>
        {overrides && (
          <button onClick={() => onUpdate(defaults)} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            ↺ Reset to defaults
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Custom Buttons Editor ── */
type CustomButton = {
  id: string;
  sectionId: string;
  label: string;
  url: string;
  style: "primary" | "outline" | "ghost";
};

const SECTION_OPTIONS = [
  { id: "hero", label: "Hero" },
  { id: "hiddenCost", label: "Hidden Cost" },
  { id: "comparison", label: "Comparison Table" },
  { id: "dashboard", label: "Executive Dashboard" },
  { id: "aiScanReview", label: "AI Scan Review" },
  { id: "successStories", label: "Success Stories" },
  { id: "pilotApproach", label: "Pilot Approach" },
  { id: "labTour", label: "Lab Tour" },
  { id: "calculator", label: "ROI Calculator" },
  { id: "finalCTA", label: "Final CTA" },
];

const CustomButtonsEditor = ({
  buttons,
  onUpdate,
}: {
  buttons: CustomButton[];
  onUpdate: (buttons: CustomButton[]) => void;
}) => {
  const addButton = () => {
    onUpdate([...buttons, { id: crypto.randomUUID(), sectionId: "hero", label: "Learn More", url: "", style: "outline" }]);
  };

  const updateButton = (index: number, field: keyof CustomButton, value: string) => {
    const updated = buttons.map((b, i) => i === index ? { ...b, [field]: value } : b);
    onUpdate(updated);
  };

  const removeButton = (index: number) => {
    onUpdate(buttons.filter((_, i) => i !== index));
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Custom Buttons</h3>
        <p className="text-xs text-muted-foreground">Add extra CTA buttons to any section. URL supports external links, anchor links (#calculator), or video URLs.</p>
      </div>
      {buttons.map((btn, i) => (
        <div key={btn.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Button {i + 1}</span>
            <button onClick={() => removeButton(i)} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10">
              ✕ Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Label</label>
              <input
                value={btn.label}
                onChange={(e) => updateButton(i, "label", e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Section</label>
              <select
                value={btn.sectionId}
                onChange={(e) => updateButton(i, "sectionId", e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {SECTION_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">URL / Anchor / Video</label>
            <input
              value={btn.url}
              onChange={(e) => updateButton(i, "url", e.target.value)}
              placeholder="https://... or #calculator or YouTube URL"
              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Style</label>
            <div className="flex gap-2">
              {(["primary", "outline", "ghost"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateButton(i, "style", s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    btn.style === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button onClick={addButton} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
        + Add button
      </button>
    </div>
  );
};

/* ── Image Upload Input for Microsite Editor ── */
const ImageUploadInput = ({ value, onChange, placeholder = "Paste URL or upload…" }: { value?: string; onChange: (url: string) => void; placeholder?: string }) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("skin-images").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data } = supabase.storage.from("skin-images").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  };

  return (
    <div className="flex gap-2 items-center">
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
        <Upload className="w-3.5 h-3.5" />
      </button>
      {value && <button onClick={() => onChange("")} className="px-1 py-1.5 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
    </div>
  );
};

/* ── Expansion Content Editor (per-site overrides for team, perks, promos, resources) ── */
const ExpansionContentEditor = ({ data, onUpdate }: { data: BriefingData; onUpdate: (path: string, value: any) => void }) => {
  const [libraryConfig, setLibraryConfig] = useState<ExpansionSkinConfig | null>(null);
  const [showTeamLibrary, setShowTeamLibrary] = useState(false);
  const [showPerkLibrary, setShowPerkLibrary] = useState(false);
  const [showPromoLibrary, setShowPromoLibrary] = useState(false);
  const [showResourceLibrary, setShowResourceLibrary] = useState(false);

  useEffect(() => {
    loadSkinConfig("expansion").then((cfg) => setLibraryConfig(cfg as ExpansionSkinConfig));
  }, []);

  const team: ExpansionTeamMember[] = (data as any).teamOverrides || [];
  const perks: ExpansionPerk[] = (data as any).perksOverrides || [];
  const promos: ExpansionPromo[] = (data as any).promosOverrides || [];
  const resources: ExpansionContentLink[] = (data as any).resourcesOverrides || [];

  const libraryTeam = libraryConfig?.teamMembers || DEFAULT_EXPANSION_CONFIG.teamMembers;
  const libraryPerks = libraryConfig?.perks || DEFAULT_EXPANSION_CONFIG.perks;
  const libraryPromos = libraryConfig?.promos || DEFAULT_EXPANSION_CONFIG.promos;
  const libraryResources = libraryConfig?.contentLinks || DEFAULT_EXPANSION_CONFIG.contentLinks;

  const PERK_ICON_OPTIONS = ["star", "zap", "shield", "trending", "award", "gift", "users", "sparkles"];
  const RESOURCE_TYPE_OPTIONS = ["video", "pdf", "article", "webinar"];

  const inputCls = "w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-6">
      {/* ── Stats Bar ── */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Stats Bar</h3>
          <p className="text-xs text-muted-foreground">Override the stats between Why Dandy and Activation Steps. Leave empty to use skin defaults.</p>
        </div>
        {((data as any).expansionStatsBarOverrides || []).map((s: { value: string; label: string }, i: number) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stat {i + 1}</span>
              <button onClick={() => onUpdate("expansionStatsBarOverrides", ((data as any).expansionStatsBarOverrides || []).filter((_: any, j: number) => j !== i))} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10">✕ Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Value</label><input value={s.value} onChange={(e) => { const a = [...((data as any).expansionStatsBarOverrides || [])]; a[i] = { ...a[i], value: e.target.value }; onUpdate("expansionStatsBarOverrides", a); }} placeholder="e.g. 96%" className={inputCls} /></div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Label</label><input value={s.label} onChange={(e) => { const a = [...((data as any).expansionStatsBarOverrides || [])]; a[i] = { ...a[i], label: e.target.value }; onUpdate("expansionStatsBarOverrides", a); }} placeholder="e.g. first-time fit rate" className={inputCls} /></div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => onUpdate("expansionStatsBarOverrides", [...((data as any).expansionStatsBarOverrides || []), { value: "", label: "" }])} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">+ Add stat</button>
          {((data as any).expansionStatsBarOverrides || []).length > 0 && <button onClick={() => onUpdate("expansionStatsBarOverrides", [])} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">↺ Clear overrides</button>}
        </div>
      </div>

      {/* ── Team Members ── */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Team Members</h3>
          <p className="text-xs text-muted-foreground">Choose up to 3 team members to display. Leave empty to use skin defaults.</p>
          {team.length >= 3 && <p className="text-xs font-medium text-amber-600">Maximum of 3 team members reached.</p>}
        </div>
        {team.map((m, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member {i + 1}</span>
              <button onClick={() => onUpdate("teamOverrides", team.filter((_, j) => j !== i))} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10">✕ Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Name</label><input value={m.name} onChange={(e) => { const a = [...team]; a[i] = { ...a[i], name: e.target.value }; onUpdate("teamOverrides", a); }} className={inputCls} /></div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Role</label><input value={m.role} onChange={(e) => { const a = [...team]; a[i] = { ...a[i], role: e.target.value }; onUpdate("teamOverrides", a); }} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Email</label><input value={m.email || ""} onChange={(e) => { const a = [...team]; a[i] = { ...a[i], email: e.target.value || undefined }; onUpdate("teamOverrides", a); }} className={inputCls} /></div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Calendar URL</label><input value={m.calendlyUrl || ""} onChange={(e) => { const a = [...team]; a[i] = { ...a[i], calendlyUrl: e.target.value || undefined }; onUpdate("teamOverrides", a); }} className={inputCls} /></div>
            </div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Photo</label><ImageUploadInput value={m.photo} onChange={(url) => { const a = [...team]; a[i] = { ...a[i], photo: url || undefined }; onUpdate("teamOverrides", a); }} /></div>
            {m.photo && <img src={m.photo} alt="" className="h-16 w-16 rounded-full object-cover border border-border" />}
          </div>
        ))}
        <div className="flex items-center gap-3 flex-wrap">
          <button disabled={team.length >= 3} onClick={() => onUpdate("teamOverrides", [...team, { name: "", role: "" }])} className={`text-xs font-medium transition-colors ${team.length >= 3 ? "text-muted-foreground/50 cursor-not-allowed" : "text-primary hover:text-primary/80"}`}>+ Add blank</button>
          <div className="relative">
            <button onClick={() => setShowTeamLibrary(!showTeamLibrary)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
              + Pick from library <ChevronDown className={`w-3 h-3 transition-transform ${showTeamLibrary ? "rotate-180" : ""}`} />
            </button>
            {showTeamLibrary && (
              <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-popover shadow-lg p-2 space-y-1 max-h-60 overflow-y-auto">
                {libraryTeam.length === 0 && <p className="text-xs text-muted-foreground p-2">No team members in library.</p>}
                {libraryTeam.map((lt, i) => {
                  const alreadyAdded = team.some((t) => t.name === lt.name);
                  return (
                    <button key={i} onClick={() => { if (!alreadyAdded && team.length < 3) { onUpdate("teamOverrides", [...team, { ...lt }]); setShowTeamLibrary(false); } }} disabled={alreadyAdded || team.length >= 3}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${alreadyAdded ? "opacity-40 cursor-not-allowed bg-muted/50" : "hover:bg-accent/50 cursor-pointer"}`}>
                      <span className="font-semibold text-foreground">{lt.name}</span><span className="text-muted-foreground ml-1.5">— {lt.role}</span>
                      {alreadyAdded && <span className="ml-1 text-muted-foreground">(added)</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {team.length > 0 && <button onClick={() => onUpdate("teamOverrides", [])} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">↺ Clear overrides</button>}
        </div>
      </div>

      {/* ── Partnership Perks ── */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" /> Partnership Perks</h3>
          <p className="text-xs text-muted-foreground">Override the perks shown on this microsite. Leave empty to use skin defaults.</p>
        </div>
        {perks.map((p, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <select value={p.icon} onChange={(e) => { const a = [...perks]; a[i] = { ...a[i], icon: e.target.value }; onUpdate("perksOverrides", a); }}
                  className="px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground">
                  {PERK_ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perk {i + 1}</span>
              </div>
              <button onClick={() => onUpdate("perksOverrides", perks.filter((_, j) => j !== i))} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10">✕ Remove</button>
            </div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Title</label><input value={p.title} onChange={(e) => { const a = [...perks]; a[i] = { ...a[i], title: e.target.value }; onUpdate("perksOverrides", a); }} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Description</label><textarea value={p.desc} onChange={(e) => { const a = [...perks]; a[i] = { ...a[i], desc: e.target.value }; onUpdate("perksOverrides", a); }} rows={2} className={inputCls + " resize-y"} /></div>
          </div>
        ))}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => onUpdate("perksOverrides", [...perks, { icon: "star", title: "", desc: "" }])} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">+ Add blank</button>
          <div className="relative">
            <button onClick={() => setShowPerkLibrary(!showPerkLibrary)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
              + Pick from library <ChevronDown className={`w-3 h-3 transition-transform ${showPerkLibrary ? "rotate-180" : ""}`} />
            </button>
            {showPerkLibrary && (
              <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-popover shadow-lg p-2 space-y-1 max-h-60 overflow-y-auto">
                {libraryPerks.length === 0 && <p className="text-xs text-muted-foreground p-2">No perks in library.</p>}
                {libraryPerks.map((lp, i) => {
                  const alreadyAdded = perks.some((p) => p.title === lp.title);
                  return (
                    <button key={i} onClick={() => { if (!alreadyAdded) { onUpdate("perksOverrides", [...perks, { ...lp }]); setShowPerkLibrary(false); } }} disabled={alreadyAdded}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${alreadyAdded ? "opacity-40 cursor-not-allowed bg-muted/50" : "hover:bg-accent/50 cursor-pointer"}`}>
                      <span className="font-semibold text-foreground">{lp.title}</span>
                      {alreadyAdded && <span className="ml-1 text-muted-foreground">(added)</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {perks.length > 0 && <button onClick={() => onUpdate("perksOverrides", [])} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">↺ Clear overrides</button>}
        </div>
      </div>

      {/* ── Promotions ── */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" /> Promotions</h3>
          <p className="text-xs text-muted-foreground">Override the promotions shown on this microsite. Leave empty to use skin defaults.</p>
        </div>
        {promos.map((p, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Promo {i + 1}</span>
              <button onClick={() => onUpdate("promosOverrides", promos.filter((_, j) => j !== i))} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10">✕ Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Title</label><input value={p.title} onChange={(e) => { const a = [...promos]; a[i] = { ...a[i], title: e.target.value }; onUpdate("promosOverrides", a); }} className={inputCls} /></div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Badge</label><input value={p.badge || ""} onChange={(e) => { const a = [...promos]; a[i] = { ...a[i], badge: e.target.value || undefined }; onUpdate("promosOverrides", a); }} placeholder="e.g. LIMITED TIME" className={inputCls} /></div>
            </div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Description</label><textarea value={p.desc} onChange={(e) => { const a = [...promos]; a[i] = { ...a[i], desc: e.target.value }; onUpdate("promosOverrides", a); }} rows={2} className={inputCls + " resize-y"} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">CTA Text</label><input value={p.ctaText || ""} onChange={(e) => { const a = [...promos]; a[i] = { ...a[i], ctaText: e.target.value || undefined }; onUpdate("promosOverrides", a); }} className={inputCls} /></div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">CTA URL</label><input value={p.ctaUrl || ""} onChange={(e) => { const a = [...promos]; a[i] = { ...a[i], ctaUrl: e.target.value || undefined }; onUpdate("promosOverrides", a); }} className={inputCls} /></div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => onUpdate("promosOverrides", [...promos, { title: "", desc: "" }])} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">+ Add blank</button>
          <div className="relative">
            <button onClick={() => setShowPromoLibrary(!showPromoLibrary)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
              + Pick from library <ChevronDown className={`w-3 h-3 transition-transform ${showPromoLibrary ? "rotate-180" : ""}`} />
            </button>
            {showPromoLibrary && (
              <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-popover shadow-lg p-2 space-y-1 max-h-60 overflow-y-auto">
                {libraryPromos.length === 0 && <p className="text-xs text-muted-foreground p-2">No promos in library.</p>}
                {libraryPromos.map((lp, i) => {
                  const alreadyAdded = promos.some((p) => p.title === lp.title);
                  return (
                    <button key={i} onClick={() => { if (!alreadyAdded) { onUpdate("promosOverrides", [...promos, { ...lp }]); setShowPromoLibrary(false); } }} disabled={alreadyAdded}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${alreadyAdded ? "opacity-40 cursor-not-allowed bg-muted/50" : "hover:bg-accent/50 cursor-pointer"}`}>
                      <span className="font-semibold text-foreground">{lp.title}</span>
                      {alreadyAdded && <span className="ml-1 text-muted-foreground">(added)</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {promos.length > 0 && <button onClick={() => onUpdate("promosOverrides", [])} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">↺ Clear overrides</button>}
        </div>
      </div>

      {/* ── Resources ── */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Resources</h3>
          <p className="text-xs text-muted-foreground">Override the resources shown on this microsite. Leave empty to use skin defaults.</p>
        </div>
        {resources.map((r, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <select value={r.type} onChange={(e) => { const a = [...resources]; a[i] = { ...a[i], type: e.target.value as any }; onUpdate("resourcesOverrides", a); }}
                  className="px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground">
                  {RESOURCE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resource {i + 1}</span>
              </div>
              <button onClick={() => onUpdate("resourcesOverrides", resources.filter((_, j) => j !== i))} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10">✕ Remove</button>
            </div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Title</label><input value={r.title} onChange={(e) => { const a = [...resources]; a[i] = { ...a[i], title: e.target.value }; onUpdate("resourcesOverrides", a); }} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Description</label><input value={r.desc} onChange={(e) => { const a = [...resources]; a[i] = { ...a[i], desc: e.target.value }; onUpdate("resourcesOverrides", a); }} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">URL</label><input value={r.url} onChange={(e) => { const a = [...resources]; a[i] = { ...a[i], url: e.target.value }; onUpdate("resourcesOverrides", a); }} className={inputCls} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Card Image</label><ImageUploadInput value={r.imageUrl} onChange={(url) => { const a = [...resources]; a[i] = { ...a[i], imageUrl: url || undefined }; onUpdate("resourcesOverrides", a); }} /></div>
            {r.imageUrl && <img src={r.imageUrl} alt="" className="h-20 w-full rounded-lg object-cover border border-border" />}
          </div>
        ))}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => onUpdate("resourcesOverrides", [...resources, { title: "", desc: "", url: "", type: "article" as const }])} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">+ Add blank</button>
          <div className="relative">
            <button onClick={() => setShowResourceLibrary(!showResourceLibrary)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
              + Pick from library <ChevronDown className={`w-3 h-3 transition-transform ${showResourceLibrary ? "rotate-180" : ""}`} />
            </button>
            {showResourceLibrary && (
              <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-popover shadow-lg p-2 space-y-1 max-h-60 overflow-y-auto">
                {libraryResources.length === 0 && <p className="text-xs text-muted-foreground p-2">No resources in library.</p>}
                {libraryResources.map((lr, i) => {
                  const alreadyAdded = resources.some((r) => r.title === lr.title);
                  return (
                    <button key={i} onClick={() => { if (!alreadyAdded) { onUpdate("resourcesOverrides", [...resources, { ...lr }]); setShowResourceLibrary(false); } }} disabled={alreadyAdded}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${alreadyAdded ? "opacity-40 cursor-not-allowed bg-muted/50" : "hover:bg-accent/50 cursor-pointer"}`}>
                      <span className="font-semibold text-foreground">{lr.title}</span><span className="text-muted-foreground ml-1.5">({lr.type})</span>
                      {alreadyAdded && <span className="ml-1 text-muted-foreground">(added)</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {resources.length > 0 && <button onClick={() => onUpdate("resourcesOverrides", [])} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">↺ Clear overrides</button>}
        </div>
      </div>
    </div>
  );
};

export default MicrositeEditor;
