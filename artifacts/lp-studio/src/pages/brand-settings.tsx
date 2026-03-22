import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Palette, Layout, Link2, Facebook, Instagram, Linkedin } from "lucide-react";
import { DEFAULT_BRAND, fetchBrandConfig, saveBrandConfig } from "@/lib/brand-config";
import type { BrandConfig } from "@/lib/brand-config";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
        />
      </div>
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm h-9"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9" />
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

  const update = (key: keyof BrandConfig, value: unknown) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const updateSocial = (key: keyof BrandConfig["socialUrls"], value: string) =>
    setConfig((prev) => ({ ...prev, socialUrls: { ...prev.socialUrls, [key]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBrandConfig(config);
      toast({ title: "Brand settings saved", description: "All landing pages will reflect the new settings." });
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

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-16">

        {/* Page header */}
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
              <div className="w-16 h-3 rounded-full" style={{ backgroundColor: config.accentColor, opacity: 0.8 }} />
              <span className="text-white/30 text-[10px] font-mono">logo</span>
            </div>
            <div
              className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase"
              style={{ backgroundColor: config.accentColor, color: config.primaryColor }}
            >
              {config.navCtaText}
            </div>
          </div>
          <div style={{ backgroundColor: config.primaryColor }} className="px-6 py-8 text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Hero section</p>
            <div
              className="inline-block px-6 py-3 rounded-full text-sm font-semibold tracking-wider uppercase mx-auto"
              style={{ backgroundColor: config.accentColor, color: config.primaryColor }}
            >
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
            <ColorField
              label="Primary Color (nav, hero, footer background)"
              value={config.primaryColor}
              onChange={(v) => update("primaryColor", v)}
            />
            <ColorField
              label="Accent / Lime (buttons, guarantee bar, highlights)"
              value={config.accentColor}
              onChange={(v) => update("accentColor", v)}
            />
            <ColorField
              label="Nav Background"
              value={config.navBgColor}
              onChange={(v) => update("navBgColor", v)}
            />
          </Card>

          {/* Header */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Layout className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Header / Nav</h2>
            </div>
            <Separator />
            <TextField
              label="CTA Button Text"
              value={config.navCtaText}
              onChange={(v) => update("navCtaText", v)}
              placeholder="Get Pricing"
              hint="Shown in the top navigation bar on every page."
            />
            <TextField
              label="CTA Button URL"
              value={config.navCtaUrl}
              onChange={(v) => update("navCtaUrl", v)}
              placeholder="https://www.meetdandy.com/get-started/"
            />
          </Card>

          {/* Default CTA */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Default CTA</h2>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground -mt-2">
              Used as the fallback for any CTA button that doesn't have a custom URL or text configured on a variant.
            </p>
            <TextField
              label="Default CTA Text"
              value={config.defaultCtaText}
              onChange={(v) => update("defaultCtaText", v)}
              placeholder="Get Started Free"
            />
            <TextField
              label="Default CTA URL"
              value={config.defaultCtaUrl}
              onChange={(v) => update("defaultCtaUrl", v)}
              placeholder="https://www.meetdandy.com/get-started/"
            />
          </Card>

          {/* Footer */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Facebook className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-lg">Footer</h2>
            </div>
            <Separator />
            <TextField
              label="Copyright Name"
              value={config.copyrightName}
              onChange={(v) => update("copyrightName", v)}
              placeholder="Dandy"
              hint={`Appears as: © ${new Date().getFullYear()} [Name]. All rights reserved.`}
            />
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">Social Links</Label>
              <div className="flex items-center gap-2">
                <Facebook className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={config.socialUrls.facebook}
                  onChange={(e) => updateSocial("facebook", e.target.value)}
                  placeholder="https://www.facebook.com/meetdandy/"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={config.socialUrls.instagram}
                  onChange={(e) => updateSocial("instagram", e.target.value)}
                  placeholder="https://www.instagram.com/meetdandy/"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={config.socialUrls.linkedin}
                  onChange={(e) => updateSocial("linkedin", e.target.value)}
                  placeholder="https://www.linkedin.com/company/meetdandy/"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Save bar */}
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
