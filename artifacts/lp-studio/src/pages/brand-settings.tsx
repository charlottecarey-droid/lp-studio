import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Palette, Layout, Link2, Facebook, Instagram, Linkedin, SlidersHorizontal, LayoutGrid } from "lucide-react";
import { DEFAULT_BRAND, fetchBrandConfig, saveBrandConfig, getButtonClasses } from "@/lib/brand-config";
import type { BrandConfig, ButtonRadius, ButtonShadow, ButtonPaddingX, ButtonPaddingY, ButtonFontWeight, ButtonTextCase, ButtonLetterSpacing, SectionPadding } from "@/lib/brand-config";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5 flex-shrink-0"
      />
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-sm h-9" placeholder="#000000" />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; hint?: string;
}) {
  return (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function BrandSettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<BrandConfig>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBrandConfig().then((c) => { setConfig(c); setLoading(false); });
  }, []);

  const update = <K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const updateSocial = (key: keyof BrandConfig["socialUrls"], value: string) =>
    setConfig((prev) => ({ ...prev, socialUrls: { ...prev.socialUrls, [key]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBrandConfig(config);
      toast({ title: "Brand settings saved", description: "All landing pages now reflect the new settings." });
    } catch {
      toast({ title: "Save failed", description: "Could not save brand settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const previewBtnClass = getButtonClasses(config);

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-16">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Brand Settings</h1>
            <p className="text-muted-foreground mt-2 text-lg">Global styles applied consistently across every landing page.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 px-6">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>

        {/* Live preview strip */}
        <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
          <div style={{ backgroundColor: config.navBgColor }} className="px-6 pt-1 pb-[7px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-16 h-3 rounded-full opacity-80" style={{ backgroundColor: config.accentColor }} />
              <span className="text-white/30 text-[10px] font-mono">logo</span>
            </div>
            <div className={previewBtnClass} style={{ backgroundColor: config.accentColor, color: config.primaryColor }}>
              {config.navCtaText}
            </div>
          </div>
          <div style={{ backgroundColor: config.primaryColor }} className="px-6 py-10 text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Hero section</p>
            <div className={previewBtnClass} style={{ backgroundColor: config.accentColor, color: config.primaryColor, display: "inline-block" }}>
              {config.defaultCtaText}
            </div>
          </div>
          <div style={{ backgroundColor: config.accentColor }} className="px-6 py-3 text-center">
            <p className="text-sm font-semibold" style={{ color: config.primaryColor }}>Guarantee bar preview</p>
          </div>
          <div style={{ backgroundColor: config.primaryColor }} className="px-6 py-4 flex items-center justify-between">
            <p className="text-white/30 text-xs">© {new Date().getFullYear()} {config.copyrightName}. All rights reserved.</p>
            <div className="flex gap-3">
              {["f", "ig", "in"].map(s => (
                <div key={s} className="w-6 h-6 rounded border border-white/20 flex items-center justify-center">
                  <span className="text-white/30 text-[9px] font-bold">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Colors */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Colors</h2>
            </div>
            <Separator />
            <ColorField label="Primary Color (nav, hero, footer background)" value={config.primaryColor} onChange={(v) => update("primaryColor", v)} />
            <ColorField label="Accent / Lime (buttons, guarantee bar, highlights)" value={config.accentColor} onChange={(v) => update("accentColor", v)} />
            <ColorField label="Nav Background" value={config.navBgColor} onChange={(v) => update("navBgColor", v)} />
          </Card>

          {/* Header */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Layout className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Header / Nav</h2>
            </div>
            <Separator />
            <TextField label="CTA Button Text" value={config.navCtaText} onChange={(v) => update("navCtaText", v)} placeholder="Get Pricing" hint="Shown in the top nav bar on every page." />
            <TextField label="CTA Button URL" value={config.navCtaUrl} onChange={(v) => update("navCtaUrl", v)} placeholder="https://www.meetdandy.com/get-started/" />
          </Card>

          {/* Default CTA */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Default CTA</h2>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground -mt-2">Fallback for any CTA button without a custom URL or text on a variant.</p>
            <TextField label="Default CTA Text" value={config.defaultCtaText} onChange={(v) => update("defaultCtaText", v)} placeholder="Get Started Free" />
            <TextField label="Default CTA URL" value={config.defaultCtaUrl} onChange={(v) => update("defaultCtaUrl", v)} placeholder="https://www.meetdandy.com/get-started/" />
          </Card>

          {/* Footer */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Facebook className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Footer</h2>
            </div>
            <Separator />
            <TextField label="Copyright Name" value={config.copyrightName} onChange={(v) => update("copyrightName", v)} placeholder="Dandy" hint={`Appears as: © ${new Date().getFullYear()} [Name]. All rights reserved.`} />
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">Social Links</Label>
              <div className="flex items-center gap-2">
                <Facebook className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input value={config.socialUrls.facebook} onChange={(e) => updateSocial("facebook", e.target.value)} placeholder="https://www.facebook.com/meetdandy/" className="h-9 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input value={config.socialUrls.instagram} onChange={(e) => updateSocial("instagram", e.target.value)} placeholder="https://www.instagram.com/meetdandy/" className="h-9 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input value={config.socialUrls.linkedin} onChange={(e) => updateSocial("linkedin", e.target.value)} placeholder="https://www.linkedin.com/company/meetdandy/" className="h-9 text-sm" />
              </div>
            </div>
          </Card>

          {/* Button Styling */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Button Styling</h2>
            </div>
            <Separator />

            {/* Button preview */}
            <div className="flex items-center gap-4 p-5 bg-muted/30 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground flex-shrink-0">Preview:</p>
              <div
                className={previewBtnClass}
                style={{ backgroundColor: config.accentColor, color: config.primaryColor }}
              >
                {config.defaultCtaText}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SelectField
                label="Shape"
                value={config.buttonRadius}
                onChange={(v) => update("buttonRadius", v as ButtonRadius)}
                options={[
                  { value: "pill", label: "Pill (fully round)" },
                  { value: "rounded", label: "Rounded (XL)" },
                  { value: "slight", label: "Slightly rounded" },
                  { value: "square", label: "Square (sharp)" },
                ]}
              />
              <SelectField
                label="Shadow"
                value={config.buttonShadow}
                onChange={(v) => update("buttonShadow", v as ButtonShadow)}
                options={[
                  { value: "none", label: "No shadow" },
                  { value: "sm", label: "Small" },
                  { value: "md", label: "Medium" },
                  { value: "lg", label: "Large" },
                ]}
              />
              <SelectField
                label="Horizontal Padding"
                value={config.buttonPaddingX}
                onChange={(v) => update("buttonPaddingX", v as ButtonPaddingX)}
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "regular", label: "Regular" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
              <SelectField
                label="Vertical Padding"
                value={config.buttonPaddingY}
                onChange={(v) => update("buttonPaddingY", v as ButtonPaddingY)}
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "regular", label: "Regular" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
              <SelectField
                label="Font Weight"
                value={config.buttonFontWeight}
                onChange={(v) => update("buttonFontWeight", v as ButtonFontWeight)}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "medium", label: "Medium" },
                  { value: "semibold", label: "Semibold" },
                  { value: "bold", label: "Bold" },
                ]}
              />
              <SelectField
                label="Text Case"
                value={config.buttonTextCase}
                onChange={(v) => update("buttonTextCase", v as ButtonTextCase)}
                options={[
                  { value: "uppercase", label: "UPPERCASE" },
                  { value: "capitalize", label: "Capitalize" },
                  { value: "normal", label: "normal" },
                ]}
              />
              <SelectField
                label="Letter Spacing"
                value={config.buttonLetterSpacing}
                onChange={(v) => update("buttonLetterSpacing", v as ButtonLetterSpacing)}
                options={[
                  { value: "tight", label: "Tight" },
                  { value: "normal", label: "Normal" },
                  { value: "wide", label: "Wide" },
                  { value: "wider", label: "Wider" },
                ]}
              />
            </div>
          </Card>

          {/* Section Spacing */}
          <Card className="p-6 flex flex-col gap-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Section Spacing</h2>
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SelectField
                label="Section Vertical Padding"
                value={config.sectionPadding}
                onChange={(v) => update("sectionPadding", v as SectionPadding)}
                hint="Controls the top/bottom space inside every content section (benefits, testimonials, comparisons, etc.)."
                options={[
                  { value: "compact", label: "Compact (tight)" },
                  { value: "comfortable", label: "Comfortable (default)" },
                  { value: "spacious", label: "Spacious (open)" },
                ]}
              />
              {/* Visual reference */}
              <div className="md:col-span-2 flex gap-4">
                {(["compact", "comfortable", "spacious"] as SectionPadding[]).map((p) => (
                  <div key={p} className={`flex-1 rounded-xl border-2 overflow-hidden ${config.sectionPadding === p ? "border-primary" : "border-border/40"}`}>
                    <div className="bg-muted/20 text-center">
                      <div className={`${p === "compact" ? "py-3" : p === "comfortable" ? "py-6" : "py-10"} flex flex-col items-center justify-center gap-1`}>
                        <div className="w-12 h-1.5 rounded bg-muted-foreground/30" />
                        <div className="w-8 h-1.5 rounded bg-muted-foreground/20" />
                      </div>
                    </div>
                    <p className="text-[10px] font-medium text-center py-1.5 text-muted-foreground capitalize">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

        </div>

        {/* Sticky save bar */}
        <div className="sticky bottom-4 flex justify-end">
          <div className="bg-background/90 backdrop-blur-md border border-border rounded-2xl px-6 py-3 shadow-lg flex items-center gap-4">
            <p className="text-sm text-muted-foreground">Changes apply to all active landing pages immediately after saving.</p>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
