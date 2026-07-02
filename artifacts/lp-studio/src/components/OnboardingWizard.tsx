import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FONT_CATALOG, toFontFamilyValue } from "@/lib/font-catalog";
import { saveBrandConfig, fetchBrandConfig, type BrandConfig } from "@/lib/brand-config";
import { Upload, Palette, Building2, ArrowRight, ArrowLeft, Check, X, Copy, ExternalLink, PartyPopper, Globe, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useBrandConfig } from "@/context/BrandConfigContext";
import {
  streamBrandImportFromUrl,
  recordBrandImportSource,
  type BrandImportDimensionName,
  type BrandImportDimensionStatus,
} from "@/lib/brand-import-client";
import {
  buildOnboardingBrandConfig,
  computeImportPrefill,
  isFullHex,
} from "@/lib/onboarding-brand-import";

const IMPORT_DIMENSIONS: { id: BrandImportDimensionName; label: string }[] = [
  { id: "logos", label: "Logo" },
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Fonts" },
  { id: "buttons", label: "Buttons" },
  { id: "photography", label: "Photography" },
  { id: "voice", label: "Brand voice" },
  { id: "content", label: "Messaging" },
  { id: "structure", label: "Products & audience" },
];

function DimensionStatusIcon({ status }: { status: BrandImportDimensionStatus }) {
  if (status === "loading") {
    return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
  }
  if (status === "ok") return <Check className="w-4 h-4 text-green-600" />;
  if (status === "partial") return <Check className="w-4 h-4 text-amber-500" />;
  if (status === "failed") return <X className="w-4 h-4 text-destructive" />;
  return <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />;
}

interface OnboardingWizardProps {
  onComplete: () => Promise<void>;
}

const STEPS = [
  { id: "name", label: "Your brand", icon: Building2 },
  { id: "logo", label: "Logo", icon: Upload },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "welcome", label: "All set", icon: PartyPopper },
];

// Pick a readable foreground (near-black or white) for text placed on top of
// `bg`, using WCAG relative luminance. Derived from the element's *own*
// background so the preview never pairs the two brand colors against each
// other (which can render unreadably when both are dark or both light).
function readableOn(bg: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(bg.trim());
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(channels[0]) + 0.7152 * lin(channels[1]) + 0.0722 * lin(channels[2]);
  return L > 0.5 ? "#0F172A" : "#FFFFFF";
}

function ColorSwatch({ color, accent }: { color: string; accent: string }) {
  const onPrimary = readableOn(color);
  const onAccent = readableOn(accent);
  return (
    <div
      className="rounded-xl overflow-hidden border border-border/60 shadow-sm"
      style={{ background: "#fff" }}
    >
      <div className="px-5 py-4" style={{ background: color }}>
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: onPrimary, opacity: 0.7 }}
        >
          Your brand
        </p>
        <p className="text-lg font-bold mt-0.5" style={{ color: onPrimary }}>
          Welcome to LP Studio
        </p>
      </div>
      <div className="px-5 py-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Live preview</p>
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: accent, color: onAccent }}
        >
          Get started
        </span>
      </div>
    </div>
  );
}

// Sentinel select value for "use the LP Studio default font" (stored as an
// empty family). Kept distinct from the empty string so the dropdown always
// has a concrete selected option.
const FONT_DEFAULT_VALUE = "__default__";
// Sentinel for the imported custom family that isn't in the catalog, so it
// stays selectable/visible after import without polluting the catalog list.
const FONT_CUSTOM_VALUE = "__custom__";

/**
 * Compact font picker for the onboarding wizard. Shows the catalog of standard
 * fonts plus, when present, the family the importer detected from the user's
 * site (so they can see what was matched and keep or change it). Picking a
 * catalog font or the default clears any imported custom URL so
 * `BrandFontLoader` resolves the font deterministically.
 */
function FontSelect({ label, hint, value, detected, onPick }: {
  label: string;
  hint: string;
  value: string;
  detected: boolean;
  onPick: (family: string) => void;
}) {
  const inCatalog = !!value && FONT_CATALOG.some((f) => f.family === value);
  const selectValue = !value ? FONT_DEFAULT_VALUE : inCatalog ? value : FONT_CUSTOM_VALUE;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Label>{label}</Label>
        {detected && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
            <Check className="w-3 h-3" /> From your site
          </span>
        )}
      </div>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === FONT_CUSTOM_VALUE) return;
          onPick(v === FONT_DEFAULT_VALUE ? "" : v);
        }}
      >
        <SelectTrigger className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FONT_DEFAULT_VALUE}>LP Studio default</SelectItem>
          {!inCatalog && value ? (
            <SelectItem value={FONT_CUSTOM_VALUE}>
              <span style={{ fontFamily: `"${value}", sans-serif` }}>{value}</span>
              <span className="text-xs text-muted-foreground ml-2">(detected)</span>
            </SelectItem>
          ) : null}
          {FONT_CATALOG.map((f) => (
            <SelectItem key={f.family} value={f.family}>
              <span style={{ fontFamily: toFontFamilyValue(f.family, f.category === "serif" ? "display" : "sans") }}>
                {f.label ?? f.family}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { domainContext } = useAuth();
  const { refreshBrand } = useBrandConfig();
  const [step, setStep] = useState(0);
  const [brandName, setBrandName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#1a1a2e");
  const [accentColor, setAccentColor] = useState("#4f46e5");
  // Fonts shown beside the colors in the wizard. Empty family => LP Studio
  // default. Seeded from the import (so the user sees what was matched) and
  // editable. The optional URLs carry an imported custom font's CSS link.
  const [displayFont, setDisplayFont] = useState("");
  const [displayFontUrl, setDisplayFontUrl] = useState<string | undefined>(undefined);
  const [bodyFont, setBodyFont] = useState("");
  const [bodyFontUrl, setBodyFontUrl] = useState<string | undefined>(undefined);
  // True once an import surfaced at least one font, so the controls can label
  // themselves "from your site".
  const [fontImportDetected, setFontImportDetected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Task #132 — populated after complete-onboarding so we can show the
  // welcome step with the user's tenant URL + Open my workspace handoff.
  const [tenantHost, setTenantHost] = useState<string | null>(null);
  const [tenantLoginUrl, setTenantLoginUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  // Import-from-website step — shown first so a new tenant can auto-fill their
  // brand from an existing site, then review the prefilled steps below.
  const [showImport, setShowImport] = useState(true);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importDims, setImportDims] = useState<Record<BrandImportDimensionName, BrandImportDimensionStatus> | null>(null);
  // Full proposed field map from the importer, persisted at finish so the
  // richer extracted fields (fonts, voice, messaging, products) are saved too.
  const [importedProposed, setImportedProposed] = useState<Record<string, unknown> | null>(null);
  const [importSourceUrl, setImportSourceUrl] = useState("");
  // Honest-failure signal for the Colors step: true once an import has run but
  // the extractor couldn't determine any colors, so the step still shows the
  // hardcoded navy/indigo defaults. We surface this instead of pretending the
  // defaults were imported. Reset whenever colors do come through.
  const [colorImportFailed, setColorImportFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  // True once an import has been attempted this session; retries force-refresh
  // the server cache (see handleImport).
  const importAttemptedRef = useRef(false);

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

  async function handleImport() {
    const url = importUrl.trim();
    if (!url || importing) return;
    // A retry after a failed/partial run must bypass the server's 24h cache —
    // partial payloads (e.g. only logos succeeded during an AI-proxy blip) are
    // cached and would otherwise replay the same failures all day.
    const isRetry = importAttemptedRef.current;
    importAttemptedRef.current = true;
    setImporting(true);
    setImportError("");
    setImportDims({
      logos: "loading",
      colors: "loading",
      typography: "loading",
      buttons: "loading",
      photography: "loading",
      voice: "loading",
      content: "loading",
      structure: "loading",
    });

    try {
      const imported = await streamBrandImportFromUrl(url, (dim, r) => {
        setImportDims((prev) => (prev ? { ...prev, [dim]: r.status } : prev));
      }, { forceRefresh: isRetry });

      // Derive the prefill (reviewed-field seeds + the proposed map to persist)
      // from the raw import result. Setters fire only for fields the importer
      // actually produced, so untouched defaults are preserved.
      const prefill = computeImportPrefill(imported, url);

      if (prefill.brandName !== undefined) setBrandName(prefill.brandName);
      if (prefill.tagline !== undefined) setTagline(prefill.tagline);
      if (prefill.logoUrl !== undefined) {
        setLogoUrl(prefill.logoUrl);
        setLogoPreview(prefill.logoUrl);
      }
      if (prefill.primaryColor !== undefined) setPrimaryColor(prefill.primaryColor);
      if (prefill.accentColor !== undefined) setAccentColor(prefill.accentColor);
      // Honest failure: if the extractor returned no usable colors, flag the
      // Colors step so it tells the user to pick colors rather than silently
      // presenting the navy/indigo defaults as if they were imported.
      setColorImportFailed(prefill.colorImportFailed);

      // Surface the matched fonts so the user can see and adjust them next to
      // the colors. Only overwrite when the importer actually returned a family.
      if (prefill.displayFont !== undefined) {
        setDisplayFont(prefill.displayFont);
        setDisplayFontUrl(prefill.displayFontUrl);
      }
      if (prefill.bodyFont !== undefined) {
        setBodyFont(prefill.bodyFont);
        setBodyFontUrl(prefill.bodyFontUrl);
      }
      setFontImportDetected(prefill.fontImportDetected);

      setImportedProposed(prefill.proposedForSave);
      setImportSourceUrl(prefill.sourceUrl);
      setShowImport(false);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Import failed. Check the URL and try again.",
      );
      // Dimensions that never received a stream event would otherwise keep
      // spinning next to the error message forever.
      setImportDims((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        for (const key of Object.keys(next) as Array<keyof typeof next>) {
          if (next[key] === "loading") next[key] = "failed";
        }
        return next;
      });
    } finally {
      setImporting(false);
    }
  }

  async function handleFinish() {
    setSaving(true);
    setError("");

    try {
      const existing = await fetchBrandConfig();

      // Merge the imported brand fields (fonts, voice, messaging, products,
      // etc.) under the user's reviewed name/logo/colors. salesConsole merges
      // into the existing block so we don't drop its other fields; the UI-only
      // logoAlternates list is stripped; tagline falls back to imported/existing
      // only when the user left it blank. See onboarding-brand-import.ts.
      await saveBrandConfig(
        buildOnboardingBrandConfig(existing, importedProposed, {
          brandName,
          tagline,
          logoUrl,
          primaryColor,
          accentColor,
          displayFont,
          displayFontUrl,
          bodyFont,
          bodyFontUrl,
        }),
      );

      // Best-effort provenance so Brand Settings shows the import source.
      const importedKeys = importedProposed
        ? Object.keys(importedProposed).filter((k) => k !== "logoAlternates")
        : [];
      if (importSourceUrl && importedKeys.length > 0) {
        void recordBrandImportSource(importSourceUrl, importedKeys);
      }

      const completeRes = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        credentials: "include",
      });
      if (!completeRes.ok) {
        throw new Error("Failed to complete onboarding");
      }

      // Task #132 — push the new brand into the shared provider so the
      // sidebar logo / brand name / colors update immediately, with no
      // hard refresh required (and so they're already correct on the
      // welcome step we may render below).
      await refreshBrand();

      // Task #132 — when the user signed up on the open domain, fetch
      // the canonical tenant login URL from /me and show the welcome
      // step instead of dropping them straight into app.lpstudio.ai.
      // We deliberately do NOT call onComplete() yet, because that
      // calls AuthContext.refresh() which would flip onboardingCompleted
      // to true and unmount this wizard before the user sees the URL.
      // If the user just closes the tab, the next open-domain sign-in
      // will hit the AuthGate auto-redirect and land them on the
      // tenant subdomain anyway.
      if (domainContext?.mode === "open") {
        try {
          const meRes = await fetch("/api/auth/me", { credentials: "include" });
          if (meRes.ok) {
            const me = await meRes.json();
            if (me?.tenantHost && me?.tenantLoginUrl) {
              setTenantHost(me.tenantHost as string);
              setTenantLoginUrl(me.tenantLoginUrl as string);
              setSaving(false);
              setStep(3);
              return;
            }
          }
        } catch { /* fall through to default onComplete */ }
      }

      await onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  async function copyTenantUrl() {
    if (!tenantLoginUrl) return;
    try {
      await navigator.clipboard.writeText(tenantLoginUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — user can still select manually */ }
  }

  async function openWorkspace() {
    if (!tenantHost) return;
    setOpening(true);
    try {
      const res = await fetch("/api/auth/handoff-code", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          window.location.href = data.url as string;
          return;
        }
      }
    } catch { /* fall through to plain redirect */ }
    // Fallback: navigate to the subdomain's normal sign-in page.
    window.location.href = `https://${tenantHost}/`;
  }

  const canAdvanceStep0 = brandName.trim().length > 0;

  // Import-from-website screen — the entry point of onboarding. Lets a new
  // tenant auto-fill their brand from an existing site, then drops into the
  // prefilled steps below. Skippable for users who'd rather set up manually.
  if (showImport) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Let's build your brand</h1>
            <p className="text-sm text-muted-foreground">
              Have a website? Paste it in and we'll pull your logo, colors, fonts, and
              messaging automatically. You can review and tweak everything next.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="import-url">Your website</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="import-url"
                    placeholder="yourcompany.com"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    disabled={importing}
                    autoFocus
                    className="pl-9"
                    onKeyDown={(e) => { if (e.key === "Enter" && importUrl.trim() && !importing) handleImport(); }}
                  />
                </div>
                <Button onClick={handleImport} disabled={importing || !importUrl.trim()} className="gap-2 shrink-0">
                  {importing ? (
                    <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Importing…</>
                  ) : (
                    <>Import <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </div>
            </div>

            {importDims && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1">
                {IMPORT_DIMENSIONS.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm">
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      <DimensionStatusIcon status={importDims[d.id]} />
                    </span>
                    <span className="text-muted-foreground">{d.label}</span>
                  </div>
                ))}
              </div>
            )}

            {importError && <p className="text-sm text-destructive">{importError}</p>}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setShowImport(false); setImportError(""); }}
              disabled={importing}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Skip — I'll set it up manually
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            You can import or change any of this later in Brand Settings.
          </p>
        </div>
      </div>
    );
  }

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
                  placeholder="Acme Inc"
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
                  placeholder="Your company's one-line promise"
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

            {colorImportFailed && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <X className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                <span>
                  We couldn't detect your site's colors automatically — the
                  defaults below are just a starting point. Pick your real brand
                  colors here.
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary color</Label>
                  <div className="flex items-center gap-2">
                    <label className="w-10 h-10 rounded-lg border border-border cursor-pointer overflow-hidden shrink-0">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => { setPrimaryColor(e.target.value); setColorImportFailed(false); }}
                        className="w-full h-full cursor-pointer border-none p-0"
                        style={{ appearance: "none", WebkitAppearance: "none" } as React.CSSProperties}
                      />
                    </label>
                    <Input
                      value={primaryColor}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) { setPrimaryColor(v); setColorImportFailed(false); }
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
                        onChange={(e) => { setAccentColor(e.target.value); setColorImportFailed(false); }}
                        className="w-full h-full cursor-pointer border-none p-0"
                        style={{ appearance: "none", WebkitAppearance: "none" } as React.CSSProperties}
                      />
                    </label>
                    <Input
                      value={accentColor}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) { setAccentColor(v); setColorImportFailed(false); }
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

            <div className="space-y-4 pt-6 border-t border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Fonts</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {fontImportDetected
                    ? "We matched these from your site. Change them if they're not right."
                    : "Pick the fonts for your pages, or keep the LP Studio default."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FontSelect
                  label="Heading font"
                  hint="Titles and headlines"
                  value={displayFont}
                  detected={fontImportDetected && !!displayFont}
                  onPick={(family) => { setDisplayFont(family); setDisplayFontUrl(undefined); }}
                />
                <FontSelect
                  label="Body font"
                  hint="Paragraphs and labels"
                  value={bodyFont}
                  detected={fontImportDetected && !!bodyFont}
                  onPick={(family) => { setBodyFont(family); setBodyFontUrl(undefined); }}
                />
              </div>
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

        {/* Step 3: Welcome — task #132. Only reached on the open domain
            after complete-onboarding succeeds. Surfaces the canonical
            tenant URL so the user learns "this is where I sign in", with
            a one-click handoff that uses /auth/handoff-code → /auth/accept
            to set the session cookie on the subdomain. */}
        {step === 3 && tenantHost && tenantLoginUrl && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">You're all set!</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Your workspace lives at its own address. Bookmark it — that's where you'll sign in from now on.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Your workspace URL</Label>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 min-w-0 font-mono text-sm text-foreground bg-background/60 border border-border/60 rounded-md px-3 py-2 truncate select-all"
                  title={tenantLoginUrl}
                >
                  {tenantLoginUrl}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyTenantUrl}
                  title="Copy URL"
                  className="shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                To log in next time, enter this URL into your browser. Future logins from{" "}
                <span className="font-mono">{window.location.host}</span> will redirect here automatically.
              </p>
            </div>

            <Button
              className="gap-2 w-full"
              onClick={openWorkspace}
              disabled={opening}
            >
              {opening ? (
                <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Opening…</>
              ) : (
                <><ExternalLink className="w-4 h-4" /> Open my workspace</>
              )}
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          All of this can be changed later in Brand Settings.
        </p>
      </div>
    </div>
  );
}
