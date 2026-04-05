import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBrandConfig, fetchBrandConfig } from "@/lib/brand-config";
import { Upload, Palette, Building2, ArrowRight, ArrowLeft, Check, X } from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => Promise<void>;
}

const STEPS = [
  { id: "name", label: "Your brand", icon: Building2 },
  { id: "logo", label: "Logo", icon: Upload },
  { id: "colors", label: "Colors", icon: Palette },
];

function ColorSwatch({ color, accent }: { color: string; accent: string }) {
  return (
    <div
      className="rounded-xl overflow-hidden border border-border/60 shadow-sm"
      style={{ background: "#fff" }}
    >
      <div className="px-5 py-4" style={{ background: color }}>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-60" style={{ color: accent }}>
          Your brand
        </p>
        <p className="text-lg font-bold mt-0.5" style={{ color: "#fff" }}>
          Welcome to LP Studio
        </p>
      </div>
      <div className="px-5 py-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Live preview</p>
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: accent, color: color }}
        >
          Get started
        </span>
      </div>
    </div>
  );
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [brandName, setBrandName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#1a1a2e");
  const [accentColor, setAccentColor] = useState("#4f46e5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const uploadLogo = useCallback(async (file: File) => {
    setUploadingLogo(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/lp/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = `/api/storage${data.url}`;
      setLogoUrl(url);
      setLogoPreview(url);
    } catch {
      setError("Logo upload failed. You can skip this step.");
    } finally {
      setUploadingLogo(false);
    }
  }, []);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadLogo(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) uploadLogo(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  const isFullHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

  async function handleFinish() {
    setSaving(true);
    setError("");

    const safeColor = (v: string, fallback: string) => isFullHex(v) ? v : fallback;
    const safePrimary = safeColor(primaryColor, "#1a1a2e");
    const safeAccent = safeColor(accentColor, "#4f46e5");

    try {
      const existing = await fetchBrandConfig();
      await saveBrandConfig({
        ...existing,
        brandName: brandName.trim(),
        taglines: tagline.trim() ? [tagline.trim()] : existing.taglines,
        logoUrl: logoUrl || existing.logoUrl,
        primaryColor: safePrimary,
        accentColor: safeAccent,
        ctaBackground: safeAccent,
        ctaText: safePrimary,
      });

      const completeRes = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        credentials: "include",
      });
      if (!completeRes.ok) {
        throw new Error("Failed to complete onboarding");
      }

      await onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  const canAdvanceStep0 = brandName.trim().length > 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-all
                  ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                `}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full mx-1 ${i < step ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${((step) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 0: Brand name */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">What's your company called?</h1>
              <p className="text-sm text-muted-foreground mt-1">This sets up your brand identity across all pages.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand-name">Company name <span className="text-destructive">*</span></Label>
                <Input
                  id="brand-name"
                  placeholder="Acme Dental"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvanceStep0) setStep(1); }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tagline">Tagline <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="tagline"
                  placeholder="Smarter dental care for modern practices"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvanceStep0) setStep(1); }}
                />
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => setStep(1)}
              disabled={!canAdvanceStep0}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 1: Logo */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Upload your logo</h1>
              <p className="text-sm text-muted-foreground mt-1">Appears in the navigation bar on all your pages. You can change this later.</p>
            </div>

            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !logoPreview && fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all
                ${logoPreview ? "border-primary/40 bg-primary/3 p-6" : "border-border hover:border-primary/40 hover:bg-muted/30 cursor-pointer p-12"}
              `}
            >
              {logoPreview ? (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-h-24 max-w-[280px] object-contain"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Replace
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLogoUrl(""); setLogoPreview(""); }}
                      className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                    {uploadingLogo ? (
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground">Drop your logo here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse · PNG, SVG, JPG</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFilePick}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <Button variant="outline" className="gap-2 flex-1" onClick={() => setStep(0)}>
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                className="gap-2 flex-1"
                onClick={() => setStep(2)}
                disabled={uploadingLogo}
              >
                {logoPreview ? "Continue" : "Skip for now"} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Colors */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Choose your brand colors</h1>
              <p className="text-sm text-muted-foreground mt-1">These fill your pages automatically. Fine-tune anytime in Brand Settings.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary color</Label>
                  <div className="flex items-center gap-2">
                    <label className="w-10 h-10 rounded-lg border border-border cursor-pointer overflow-hidden shrink-0">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-full h-full cursor-pointer border-none p-0"
                        style={{ appearance: "none", WebkitAppearance: "none" } as React.CSSProperties}
                      />
                    </label>
                    <Input
                      value={primaryColor}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPrimaryColor(v);
                      }}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Backgrounds, headings</p>
                </div>

                <div className="space-y-2">
                  <Label>Accent color</Label>
                  <div className="flex items-center gap-2">
                    <label className="w-10 h-10 rounded-lg border border-border cursor-pointer overflow-hidden shrink-0">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-full h-full cursor-pointer border-none p-0"
                        style={{ appearance: "none", WebkitAppearance: "none" } as React.CSSProperties}
                      />
                    </label>
                    <Input
                      value={accentColor}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setAccentColor(v);
                      }}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Buttons, highlights</p>
                </div>
              </div>

              <ColorSwatch color={primaryColor} accent={accentColor} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <Button variant="outline" className="gap-2 flex-1" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                className="gap-2 flex-1"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving…</>
                ) : (
                  <><Check className="w-4 h-4" /> Finish setup</>
                )}
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          All of this can be changed later in Brand Settings.
        </p>
      </div>
    </div>
  );
}
