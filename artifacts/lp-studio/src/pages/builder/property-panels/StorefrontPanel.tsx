import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { FontSelect } from "@/components/FontSelect";
import { suggestCopy } from "@/lib/copy-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  StorefrontBlockProps,
  StorefrontTheme,
  StorefrontProduct,
  StorefrontCollection,
  StorefrontValueProp,
  StorefrontReview,
  StorefrontVariant,
  StorefrontNavLink,
  StorefrontFooterColumn,
} from "@/lib/block-types";

const THEME_DEFAULTS: Required<StorefrontTheme> = {
  bg: "#fbf7f0",
  altBg: "#f6f0e6",
  cardBg: "#ffffff",
  darkBg: "#211a14",
  fg: "#211a14",
  headingColor: "#211a14",
  primary: "#c2603a",
  muted: "#7a6f63",
  border: "#211a14",
  navBg: "#fbf7f0",
  navBgOpacity: 0.9,
  navText: "#211a14",
  displayFontFamily: "Fraunces",
  bodyFontFamily: "Inter",
};

const ICON_OPTIONS = ["leaf", "returns", "truck", "coffee", "shield", "star"];

function ColorRow({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (v: string) => void }) {
  const v = (value && value.trim()) || fallback;
  return (
    <div className="flex items-center gap-1.5">
      <Input type="color" value={v} onChange={e => onChange(e.target.value)} className="h-6 w-7 p-0.5 cursor-pointer shrink-0 rounded" />
      <Label className="text-xs min-w-0 truncate shrink-0" style={{ maxWidth: "5rem" }}>{label}</Label>
      <Input value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={fallback} className="text-[11px] h-6 flex-1 font-mono min-w-0" />
      <BrandSwatches className="shrink-0 flex-nowrap" current={value} onPick={onChange} />
    </div>
  );
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border hover:text-foreground transition-colors"
    >
      {label}
      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function IconSelect({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  return (
    <Select value={value ?? "coffee"} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {ICON_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

interface Props {
  props: StorefrontBlockProps;
  onChange: (props: StorefrontBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function StorefrontPanel({ props: p, onChange, brandVoiceSet }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    visibility: false,
    theme: false,
    brand: true,
    announcement: false,
    nav: false,
    hero: false,
    valueProps: false,
    collections: false,
    products: false,
    social: false,
    bundle: false,
    footer: false,
  });
  const [openIdx, setOpenIdx] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));
  const set = (patch: Partial<StorefrontBlockProps>) => onChange({ ...p, ...patch });

  const theme: StorefrontTheme = p.theme ?? {};
  const setTheme = (patch: Partial<StorefrontTheme>) => set({ theme: { ...theme, ...patch } });
  const resetTheme = () => set({ theme: { ...THEME_DEFAULTS } });

  // ── Nav links ──
  const navLinks = p.navLinks ?? [];
  const updateNavLink = (i: number, patch: Partial<StorefrontNavLink>) =>
    set({ navLinks: navLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l) });
  const addNavLink = () => set({ navLinks: [...navLinks, { label: "Section", href: "#section" }] });
  const removeNavLink = (i: number) => set({ navLinks: navLinks.filter((_, idx) => idx !== i) });

  // ── Hero variants ──
  const heroVariants = p.heroVariants ?? [];
  const updateVariant = (i: number, patch: Partial<StorefrontVariant>) =>
    set({ heroVariants: heroVariants.map((v, idx) => idx === i ? { ...v, ...patch } : v) });
  const addVariant = () => set({ heroVariants: [...heroVariants, { label: "New" }] });
  const removeVariant = (i: number) => set({ heroVariants: heroVariants.filter((_, idx) => idx !== i) });

  // ── Hero trust badges ──
  const heroTrustBadges = p.heroTrustBadges ?? [];
  const updateBadge = (i: number, patch: Partial<{ icon?: string; text: string }>) =>
    set({ heroTrustBadges: heroTrustBadges.map((b, idx) => idx === i ? { ...b, ...patch } : b) });
  const addBadge = () => set({ heroTrustBadges: [...heroTrustBadges, { icon: "shield", text: "New badge" }] });
  const removeBadge = (i: number) => set({ heroTrustBadges: heroTrustBadges.filter((_, idx) => idx !== i) });

  // ── Value props ──
  const valueProps = p.valueProps ?? [];
  const updateValueProp = (i: number, patch: Partial<StorefrontValueProp>) =>
    set({ valueProps: valueProps.map((v, idx) => idx === i ? { ...v, ...patch } : v) });
  const addValueProp = () => set({ valueProps: [...valueProps, { icon: "coffee", title: "New value", description: "" }] });
  const removeValueProp = (i: number) => set({ valueProps: valueProps.filter((_, idx) => idx !== i) });

  // ── Collections ──
  const collections = p.collections ?? [];
  const updateCollection = (i: number, patch: Partial<StorefrontCollection>) =>
    set({ collections: collections.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const addCollection = () => set({ collections: [...collections, { title: "New Collection", variant: "dark" }] });
  const removeCollection = (i: number) => set({ collections: collections.filter((_, idx) => idx !== i) });

  // ── Products ──
  const products = p.products ?? [];
  const updateProduct = (i: number, patch: Partial<StorefrontProduct>) =>
    set({ products: products.map((pr, idx) => idx === i ? { ...pr, ...patch } : pr) });
  const addProduct = () => set({ products: [...products, { name: "New Product", price: "$0", category: "" }] });
  const removeProduct = (i: number) => set({ products: products.filter((_, idx) => idx !== i) });
  const moveProduct = (from: number, to: number) => {
    if (to < 0 || to >= products.length) return;
    const next = [...products];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ products: next });
  };

  // ── Product filters ──
  const productFilters = p.productFilters ?? [];
  const updateFilter = (i: number, value: string) =>
    set({ productFilters: productFilters.map((f, idx) => idx === i ? value : f) });
  const addFilter = () => set({ productFilters: [...productFilters, ""] });
  const removeFilter = (i: number) => set({ productFilters: productFilters.filter((_, idx) => idx !== i) });

  // ── Press logos ──
  const pressLogos = p.pressLogos ?? [];
  const updateLogo = (i: number, value: string) =>
    set({ pressLogos: pressLogos.map((l, idx) => idx === i ? value : l) });
  const addLogo = () => set({ pressLogos: [...pressLogos, ""] });
  const removeLogo = (i: number) => set({ pressLogos: pressLogos.filter((_, idx) => idx !== i) });

  // ── Reviews ──
  const reviews = p.reviews ?? [];
  const updateReview = (i: number, patch: Partial<StorefrontReview>) =>
    set({ reviews: reviews.map((r, idx) => idx === i ? { ...r, ...patch } : r) });
  const addReview = () => set({ reviews: [...reviews, { name: "New Reviewer", quote: "", rating: 5 }] });
  const removeReview = (i: number) => set({ reviews: reviews.filter((_, idx) => idx !== i) });

  // ── Bundle guarantees ──
  const bundleGuarantees = p.bundleGuarantees ?? [];
  const updateGuarantee = (i: number, patch: Partial<{ icon?: string; text: string }>) =>
    set({ bundleGuarantees: bundleGuarantees.map((g, idx) => idx === i ? { ...g, ...patch } : g) });
  const addGuarantee = () => set({ bundleGuarantees: [...bundleGuarantees, { icon: "shield", text: "New guarantee" }] });
  const removeGuarantee = (i: number) => set({ bundleGuarantees: bundleGuarantees.filter((_, idx) => idx !== i) });

  // ── Footer columns ──
  const footerColumns = p.footerColumns ?? [];
  const updateFooterColumn = (i: number, patch: Partial<StorefrontFooterColumn>) =>
    set({ footerColumns: footerColumns.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const addFooterColumn = () => set({ footerColumns: [...footerColumns, { heading: "Column", links: [] }] });
  const removeFooterColumn = (i: number) => set({ footerColumns: footerColumns.filter((_, idx) => idx !== i) });
  const addFooterLink = (ci: number) => {
    const col = footerColumns[ci];
    updateFooterColumn(ci, { links: [...(col.links ?? []), { label: "Link", href: "#" }] });
  };
  const updateFooterLink = (ci: number, li: number, patch: Partial<StorefrontNavLink>) => {
    const col = footerColumns[ci];
    updateFooterColumn(ci, { links: (col.links ?? []).map((l, idx) => idx === li ? { ...l, ...patch } : l) });
  };
  const removeFooterLink = (ci: number, li: number) => {
    const col = footerColumns[ci];
    updateFooterColumn(ci, { links: (col.links ?? []).filter((_, idx) => idx !== li) });
  };

  // ── Payment icons ──
  const paymentIcons = p.paymentIcons ?? [];
  const updatePayment = (i: number, value: string) =>
    set({ paymentIcons: paymentIcons.map((pi, idx) => idx === i ? value : pi) });
  const addPayment = () => set({ paymentIcons: [...paymentIcons, ""] });
  const removePayment = (i: number) => set({ paymentIcons: paymentIcons.filter((_, idx) => idx !== i) });

  // ── Footer legal links ──
  const footerLegalLinks = p.footerLegalLinks ?? [];
  const updateLegal = (i: number, patch: Partial<StorefrontNavLink>) =>
    set({ footerLegalLinks: footerLegalLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l) });
  const addLegal = () => set({ footerLegalLinks: [...footerLegalLinks, { label: "Privacy", href: "#" }] });
  const removeLegal = (i: number) => set({ footerLegalLinks: footerLegalLinks.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-0 p-4">
      <BlockRefreshButton
        blockType="storefront"
        fields={["heroTitle", "heroDescription"]}
        values={{ heroTitle: p.heroTitle ?? "", heroDescription: p.heroDescription ?? "" }}
        onApply={(u) => set(u)}
      />

      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <SectionHeader label="Brand" open={open.brand} onToggle={() => toggle("brand")} />
      {open.brand && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Brand Name">
            <Input value={p.brandName ?? ""} onChange={e => set({ brandName: e.target.value })} className="text-xs h-7" placeholder="Meridian Coffee Co." />
          </Field>
          <Field label="Logo URL" hint="Leave blank for text + icon wordmark">
            <ImagePicker value={p.logoUrl ?? ""} onChange={v => set({ logoUrl: v || undefined })} />
          </Field>
        </div>
      )}

      {/* ── Theme & Style ──────────────────────────────────────────────── */}
      <SectionHeader label="Theme & Style" open={open.theme} onToggle={() => toggle("theme")} />
      {open.theme && (
        <div className="space-y-2 pt-3 pb-4">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Fonts</Label>
          <Field label="Heading Font" hint="Display headlines">
            <FontSelect value={theme.displayFontFamily} onChange={(v) => setTheme({ displayFontFamily: v ?? THEME_DEFAULTS.displayFontFamily })} inheritLabel={`Default (${THEME_DEFAULTS.displayFontFamily})`} />
          </Field>
          <Field label="Body Font" hint="Paragraphs, nav, buttons">
            <FontSelect value={theme.bodyFontFamily} onChange={(v) => setTheme({ bodyFontFamily: v ?? THEME_DEFAULTS.bodyFontFamily })} inheritLabel={`Default (${THEME_DEFAULTS.bodyFontFamily})`} />
          </Field>

          <div className="border-t border-border pt-2 mt-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Page Colors</Label>
            <div className="space-y-1">
              <ColorRow label="Background" value={theme.bg} fallback={THEME_DEFAULTS.bg} onChange={v => setTheme({ bg: v })} />
              <ColorRow label="Alt BG" value={theme.altBg} fallback={THEME_DEFAULTS.altBg} onChange={v => setTheme({ altBg: v })} />
              <ColorRow label="Card BG" value={theme.cardBg} fallback={THEME_DEFAULTS.cardBg} onChange={v => setTheme({ cardBg: v })} />
              <ColorRow label="Dark BG" value={theme.darkBg} fallback={THEME_DEFAULTS.darkBg} onChange={v => setTheme({ darkBg: v })} />
              <ColorRow label="Text" value={theme.fg} fallback={THEME_DEFAULTS.fg} onChange={v => setTheme({ fg: v })} />
              <ColorRow label="Headings" value={theme.headingColor} fallback={THEME_DEFAULTS.headingColor} onChange={v => setTheme({ headingColor: v })} />
              <ColorRow label="Accent" value={theme.primary} fallback={THEME_DEFAULTS.primary} onChange={v => setTheme({ primary: v })} />
              <ColorRow label="Muted" value={theme.muted} fallback={THEME_DEFAULTS.muted} onChange={v => setTheme({ muted: v })} />
              <ColorRow label="Border" value={theme.border} fallback={THEME_DEFAULTS.border} onChange={v => setTheme({ border: v })} />
            </div>
          </div>

          <div className="border-t border-border pt-2 mt-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Nav Bar</Label>
            <div className="space-y-1">
              <ColorRow label="Nav BG" value={theme.navBg} fallback={THEME_DEFAULTS.navBg} onChange={v => setTheme({ navBg: v })} />
              <ColorRow label="Nav Text" value={theme.navText} fallback={THEME_DEFAULTS.navText} onChange={v => setTheme({ navText: v })} />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <Label className="text-[11px] shrink-0">Opacity {Math.round(((theme.navBgOpacity ?? THEME_DEFAULTS.navBgOpacity) as number) * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(((theme.navBgOpacity ?? THEME_DEFAULTS.navBgOpacity) as number) * 100)} onChange={e => setTheme({ navBgOpacity: Number(e.target.value) / 100 })} className="flex-1 h-4" />
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full mt-1" onClick={resetTheme}>
            Reset to defaults
          </Button>
        </div>
      )}

      {/* ── Section Visibility ─────────────────────────────────────────── */}
      <SectionHeader label="Section Visibility" open={open.visibility} onToggle={() => toggle("visibility")} />
      {open.visibility && (
        <div className="space-y-1 pt-3 pb-4">
          <p className="text-[11px] text-muted-foreground mb-2">Toggle sections on or off. Hidden sections won't render on the page.</p>
          {([
            ["showAnnouncement", "Announcement Bar"],
            ["showNav", "Navigation Bar"],
            ["showHero", "Product Hero"],
            ["showValueProps", "Value Props Row"],
            ["showCollections", "Collections & Products"],
            ["showSocialProof", "Social Proof"],
            ["showClosingCta", "Closing CTA / Bundle"],
            ["showFooter", "Footer"],
            ["showNewsletter", "Footer Newsletter"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ [key]: p[key] === false } as Partial<StorefrontBlockProps>)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                p[key] !== false ? "bg-primary/10 text-foreground" : "bg-muted/30 text-muted-foreground line-through"
              }`}
            >
              {p[key] !== false ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Announcement Bar ───────────────────────────────────────────── */}
      <SectionHeader label="Announcement Bar" open={open.announcement} onToggle={() => toggle("announcement")} />
      {open.announcement && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Primary Text">
            <Input value={p.announcementText ?? ""} onChange={e => set({ announcementText: e.target.value })} className="text-xs h-7" placeholder="Free carbon-neutral shipping over $50" />
          </Field>
          <Field label="Secondary Text">
            <Input value={p.announcementSecondaryText ?? ""} onChange={e => set({ announcementSecondaryText: e.target.value })} className="text-xs h-7" placeholder="Roasted to order" />
          </Field>
        </div>
      )}

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <SectionHeader label="Navigation" open={open.nav} onToggle={() => toggle("nav")} />
      {open.nav && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Shop CTA Text">
            <Input value={p.navCtaText ?? ""} onChange={e => set({ navCtaText: e.target.value })} className="text-xs h-7" placeholder="Shop coffee" />
          </Field>
          <Field label="Shop CTA URL">
            <Input value={p.navCtaUrl ?? ""} onChange={e => set({ navCtaUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="#shop" />
          </Field>
          <Field label="Cart Count">
            <Input type="number" value={p.cartCount ?? 0} onChange={e => set({ cartCount: Number(e.target.value) })} className="text-xs h-7" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Nav Links</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addNavLink}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {navLinks.map((link, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Input value={link.label} onChange={e => updateNavLink(i, { label: e.target.value })} placeholder="Label" className="text-xs h-7 flex-1" />
                <Input value={link.href} onChange={e => updateNavLink(i, { href: e.target.value })} placeholder="#section" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeNavLink(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Product Hero ───────────────────────────────────────────────── */}
      <SectionHeader label="Product Hero" open={open.hero} onToggle={() => toggle("hero")} />
      {open.hero && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.heroEyebrow ?? ""} onChange={v => set({ heroEyebrow: v })} fieldLabel="Hero Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("storefront", "heroEyebrow", p.heroEyebrow ?? "", {})} />
          </Field>
          <Field label="Title">
            <AiTextField type="input" value={p.heroTitle ?? ""} onChange={v => set({ heroTitle: v })} fieldLabel="Hero Title" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("storefront", "heroTitle", p.heroTitle ?? "", {})} />
          </Field>
          <Field label="Description">
            <AiTextField type="textarea" value={p.heroDescription ?? ""} onChange={v => set({ heroDescription: v })} rows={3} fieldLabel="Hero Description" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("storefront", "heroDescription", p.heroDescription ?? "", {})} />
          </Field>
          <Field label="Hero Image">
            <ImagePicker value={p.heroImageUrl ?? ""} onChange={v => set({ heroImageUrl: v || undefined })} />
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Rating">
              <Input type="number" step="0.1" value={p.heroRating ?? ""} onChange={e => set({ heroRating: Number(e.target.value) })} className="text-xs h-7" placeholder="4.9" />
            </Field>
            <Field label="Review Count">
              <Input type="number" value={p.heroReviewCount ?? ""} onChange={e => set({ heroReviewCount: Number(e.target.value) })} className="text-xs h-7" placeholder="412" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Price">
              <Input value={p.heroPrice ?? ""} onChange={e => set({ heroPrice: e.target.value })} className="text-xs h-7" placeholder="$22" />
            </Field>
            <Field label="Compare Price">
              <Input value={p.heroComparePrice ?? ""} onChange={e => set({ heroComparePrice: e.target.value })} className="text-xs h-7" placeholder="$26" />
            </Field>
          </div>
          <Field label="Variant Selector Label">
            <Input value={p.heroVariantLabel ?? ""} onChange={e => set({ heroVariantLabel: e.target.value })} className="text-xs h-7" placeholder="Grind" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Variant Options</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addVariant}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {heroVariants.map((v, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Input value={v.label} onChange={e => updateVariant(i, { label: e.target.value })} placeholder="Whole bean" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeVariant(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Add to Cart Label">
              <Input value={p.heroAddToCartLabel ?? ""} onChange={e => set({ heroAddToCartLabel: e.target.value })} className="text-xs h-7" placeholder="Add to cart" />
            </Field>
            <Field label="Add to Cart URL">
              <Input value={p.heroAddToCartUrl ?? ""} onChange={e => set({ heroAddToCartUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="#shop" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Buy Now Label">
              <Input value={p.heroBuyNowLabel ?? ""} onChange={e => set({ heroBuyNowLabel: e.target.value })} className="text-xs h-7" placeholder="Buy now" />
            </Field>
            <Field label="Buy Now URL">
              <Input value={p.heroBuyNowUrl ?? ""} onChange={e => set({ heroBuyNowUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="#checkout" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Floating Card Label">
              <Input value={p.heroCardLabel ?? ""} onChange={e => set({ heroCardLabel: e.target.value })} className="text-xs h-7" placeholder="Roasted" />
            </Field>
            <Field label="Floating Card Value">
              <Input value={p.heroCardValue ?? ""} onChange={e => set({ heroCardValue: e.target.value })} className="text-xs h-7" placeholder="Within 24 hours" />
            </Field>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Trust Badges</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addBadge}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {heroTrustBadges.map((b, i) => (
              <div key={i} className="flex gap-1 items-center">
                <div className="w-24 shrink-0"><IconSelect value={b.icon} onChange={v => updateBadge(i, { icon: v })} /></div>
                <Input value={b.text} onChange={e => updateBadge(i, { text: e.target.value })} placeholder="Free returns" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeBadge(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Value Props ────────────────────────────────────────────────── */}
      <SectionHeader label={`Value Props (${valueProps.length})`} open={open.valueProps} onToggle={() => toggle("valueProps")} />
      {open.valueProps && (
        <div className="space-y-3 pt-3 pb-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Items</Label>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addValueProp}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          {valueProps.map((v, i) => (
            <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{v.title || `Item ${i + 1}`}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeValueProp(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <IconSelect value={v.icon} onChange={val => updateValueProp(i, { icon: val })} />
              <Input value={v.title} onChange={e => updateValueProp(i, { title: e.target.value })} placeholder="Title" className="text-xs h-7" />
              <Input value={v.description ?? ""} onChange={e => updateValueProp(i, { description: e.target.value })} placeholder="Description" className="text-xs h-7" />
            </div>
          ))}
        </div>
      )}

      {/* ── Collections ────────────────────────────────────────────────── */}
      <SectionHeader label={`Collections (${collections.length})`} open={open.collections} onToggle={() => toggle("collections")} />
      {open.collections && (
        <div className="space-y-3 pt-3 pb-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Collection Banners</Label>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addCollection}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          {collections.map((c, i) => (
            <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{c.title || `Collection ${i + 1}`}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeCollection(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <ImagePicker value={c.imageUrl ?? ""} onChange={v => updateCollection(i, { imageUrl: v || undefined })} />
              <Input value={c.eyebrow ?? ""} onChange={e => updateCollection(i, { eyebrow: e.target.value })} placeholder="Eyebrow" className="text-xs h-7" />
              <Input value={c.title} onChange={e => updateCollection(i, { title: e.target.value })} placeholder="Title" className="text-xs h-7" />
              <Textarea value={c.description ?? ""} onChange={e => updateCollection(i, { description: e.target.value })} placeholder="Description" className="text-xs min-h-[3rem]" rows={2} />
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={c.ctaLabel ?? ""} onChange={e => updateCollection(i, { ctaLabel: e.target.value })} placeholder="CTA label" className="text-xs h-7" />
                <Input value={c.ctaUrl ?? ""} onChange={e => updateCollection(i, { ctaUrl: e.target.value })} placeholder="CTA URL" className="text-xs h-7 font-mono" />
              </div>
              <Select value={c.variant ?? "dark"} onValueChange={v => updateCollection(i, { variant: v as "dark" | "accent" })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="accent">Accent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {/* ── Products ───────────────────────────────────────────────────── */}
      <SectionHeader label={`Products (${products.length})`} open={open.products} onToggle={() => toggle("products")} />
      {open.products && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Section Eyebrow">
            <Input value={p.productsEyebrow ?? ""} onChange={e => set({ productsEyebrow: e.target.value })} className="text-xs h-7" placeholder="Shop the catalog" />
          </Field>
          <Field label="Section Headline">
            <AiTextField type="input" value={p.productsHeadline ?? ""} onChange={v => set({ productsHeadline: v })} fieldLabel="Products Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("storefront", "productsHeadline", p.productsHeadline ?? "", {})} />
          </Field>
          <Field label="Add to Cart Label">
            <Input value={p.productAddToCartLabel ?? ""} onChange={e => set({ productAddToCartLabel: e.target.value })} className="text-xs h-7" placeholder="Add to cart" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Filter Chips</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addFilter}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {productFilters.map((f, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Input value={f} onChange={e => updateFilter(i, e.target.value)} placeholder="All" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeFilter(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Product Cards</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addProduct}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {products.map((pr, i) => {
              const key = `prod-${i}`;
              const collapsed = !openIdx[key];
              return (
                <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                  <div className="flex items-center gap-1">
                    <button type="button" className="flex-1 flex items-center gap-1.5 text-left" onClick={() => setOpenIdx(s => ({ ...s, [key]: !s[key] }))}>
                      {collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                      <span className="text-xs font-medium text-muted-foreground truncate">{pr.name || `Product ${i + 1}`}</span>
                    </button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveProduct(i, i - 1)} disabled={i === 0}><ArrowUp className="w-3 h-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveProduct(i, i + 1)} disabled={i === products.length - 1}><ArrowDown className="w-3 h-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeProduct(i)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  {!collapsed && (
                    <div className="space-y-1.5 pt-1">
                      <ImagePicker value={pr.imageUrl ?? ""} onChange={v => updateProduct(i, { imageUrl: v || undefined })} />
                      <Input value={pr.name} onChange={e => updateProduct(i, { name: e.target.value })} placeholder="Name" className="text-xs h-7" />
                      <Input value={pr.category ?? ""} onChange={e => updateProduct(i, { category: e.target.value })} placeholder="Category" className="text-xs h-7" />
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input value={pr.price} onChange={e => updateProduct(i, { price: e.target.value })} placeholder="Price" className="text-xs h-7" />
                        <Input value={pr.comparePrice ?? ""} onChange={e => updateProduct(i, { comparePrice: e.target.value })} placeholder="Compare" className="text-xs h-7" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input type="number" step="0.1" value={pr.rating ?? ""} onChange={e => updateProduct(i, { rating: Number(e.target.value) })} placeholder="Rating" className="text-xs h-7" />
                        <Input type="number" value={pr.reviewCount ?? ""} onChange={e => updateProduct(i, { reviewCount: Number(e.target.value) })} placeholder="Reviews" className="text-xs h-7" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input value={pr.tag ?? ""} onChange={e => updateProduct(i, { tag: e.target.value })} placeholder="Tag (Bestseller)" className="text-xs h-7" />
                        <Input value={pr.href ?? ""} onChange={e => updateProduct(i, { href: e.target.value })} placeholder="Link" className="text-xs h-7 font-mono" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Social Proof ───────────────────────────────────────────────── */}
      <SectionHeader label="Social Proof" open={open.social} onToggle={() => toggle("social")} />
      {open.social && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Headline">
            <AiTextField type="input" value={p.reviewsHeadline ?? ""} onChange={v => set({ reviewsHeadline: v })} fieldLabel="Reviews Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("storefront", "reviewsHeadline", p.reviewsHeadline ?? "", {})} />
          </Field>
          <Field label="Summary Text">
            <Input value={p.reviewsSummaryText ?? ""} onChange={e => set({ reviewsSummaryText: e.target.value })} className="text-xs h-7" placeholder="Rated excellent by 11,400+ drinkers" />
          </Field>
          <Field label="Aggregate Rating">
            <Input type="number" step="0.1" value={p.reviewsAggregateRating ?? ""} onChange={e => set({ reviewsAggregateRating: Number(e.target.value) })} className="text-xs h-7" placeholder="4.9" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Logo Marquee</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addLogo}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {pressLogos.map((l, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Input value={l} onChange={e => updateLogo(i, e.target.value)} placeholder="Brand name" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeLogo(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Review Cards</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addReview}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {reviews.map((r, i) => (
              <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{r.name || `Review ${i + 1}`}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeReview(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <ImagePicker value={r.avatarUrl ?? ""} onChange={v => updateReview(i, { avatarUrl: v || undefined })} />
                <Input value={r.name} onChange={e => updateReview(i, { name: e.target.value })} placeholder="Name" className="text-xs h-7" />
                <Input value={r.location ?? ""} onChange={e => updateReview(i, { location: e.target.value })} placeholder="Location" className="text-xs h-7" />
                <Textarea value={r.quote} onChange={e => updateReview(i, { quote: e.target.value })} placeholder="Quote" className="text-xs min-h-[3rem]" rows={2} />
                <Input type="number" step="0.1" value={r.rating ?? ""} onChange={e => updateReview(i, { rating: Number(e.target.value) })} placeholder="Rating" className="text-xs h-7" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Closing CTA / Bundle ───────────────────────────────────────── */}
      <SectionHeader label="Closing CTA / Bundle" open={open.bundle} onToggle={() => toggle("bundle")} />
      {open.bundle && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <Input value={p.bundleEyebrow ?? ""} onChange={e => set({ bundleEyebrow: e.target.value })} className="text-xs h-7" placeholder="Best value" />
          </Field>
          <Field label="Title">
            <AiTextField type="input" value={p.bundleTitle ?? ""} onChange={v => set({ bundleTitle: v })} fieldLabel="Bundle Title" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("storefront", "bundleTitle", p.bundleTitle ?? "", {})} />
          </Field>
          <Field label="Description">
            <AiTextField type="textarea" value={p.bundleDescription ?? ""} onChange={v => set({ bundleDescription: v })} rows={3} fieldLabel="Bundle Description" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("storefront", "bundleDescription", p.bundleDescription ?? "", {})} />
          </Field>
          <Field label="Bundle Image">
            <ImagePicker value={p.bundleImageUrl ?? ""} onChange={v => set({ bundleImageUrl: v || undefined })} />
          </Field>
          <div className="grid grid-cols-3 gap-1.5">
            <Field label="Price">
              <Input value={p.bundlePrice ?? ""} onChange={e => set({ bundlePrice: e.target.value })} className="text-xs h-7" placeholder="$48" />
            </Field>
            <Field label="Compare">
              <Input value={p.bundleComparePrice ?? ""} onChange={e => set({ bundleComparePrice: e.target.value })} className="text-xs h-7" placeholder="$64" />
            </Field>
            <Field label="Save Label">
              <Input value={p.bundleSaveLabel ?? ""} onChange={e => set({ bundleSaveLabel: e.target.value })} className="text-xs h-7" placeholder="Save 25%" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="CTA Label">
              <Input value={p.bundleCtaLabel ?? ""} onChange={e => set({ bundleCtaLabel: e.target.value })} className="text-xs h-7" placeholder="Add bundle to cart" />
            </Field>
            <Field label="CTA URL">
              <Input value={p.bundleCtaUrl ?? ""} onChange={e => set({ bundleCtaUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="#shop" />
            </Field>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Guarantees</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addGuarantee}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {bundleGuarantees.map((g, i) => (
              <div key={i} className="flex gap-1 items-center">
                <div className="w-24 shrink-0"><IconSelect value={g.icon} onChange={v => updateGuarantee(i, { icon: v })} /></div>
                <Input value={g.text} onChange={e => updateGuarantee(i, { text: e.target.value })} placeholder="Guarantee" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeGuarantee(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <SectionHeader label="Footer" open={open.footer} onToggle={() => toggle("footer")} />
      {open.footer && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Tagline">
            <Textarea value={p.footerTagline ?? ""} onChange={e => set({ footerTagline: e.target.value })} className="text-xs min-h-[3rem]" rows={2} placeholder="Small-batch coffee…" />
          </Field>
          <Field label="Copyright">
            <Input value={p.footerCopyright ?? ""} onChange={e => set({ footerCopyright: e.target.value })} className="text-xs h-7" placeholder="© 2025 Meridian Coffee Co." />
          </Field>

          <div className="border-t border-border pt-2 space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Newsletter</Label>
            <Field label="Heading">
              <Input value={p.newsletterHeading ?? ""} onChange={e => set({ newsletterHeading: e.target.value })} className="text-xs h-7" placeholder="Join the club" />
            </Field>
            <Field label="Subtext">
              <Input value={p.newsletterSubtext ?? ""} onChange={e => set({ newsletterSubtext: e.target.value })} className="text-xs h-7" placeholder="Get 10% off your first order" />
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Placeholder">
                <Input value={p.newsletterPlaceholder ?? ""} onChange={e => set({ newsletterPlaceholder: e.target.value })} className="text-xs h-7" placeholder="you@email.com" />
              </Field>
              <Field label="Button Label">
                <Input value={p.newsletterButtonLabel ?? ""} onChange={e => set({ newsletterButtonLabel: e.target.value })} className="text-xs h-7" placeholder="Subscribe" />
              </Field>
            </div>
            <Field label="Submit URL" hint="POST endpoint for the signup. Defaults to /api/lp/leads.">
              <Input value={p.newsletterSubmitUrl ?? ""} onChange={e => set({ newsletterSubmitUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="/api/lp/leads" />
            </Field>
            <Field label="Success Message">
              <Input value={p.newsletterSuccessMessage ?? ""} onChange={e => set({ newsletterSuccessMessage: e.target.value })} className="text-xs h-7" placeholder="You're in. Watch your inbox." />
            </Field>
          </div>

          <div className="border-t border-border pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Footer Columns</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addFooterColumn}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {footerColumns.map((col, ci) => (
              <div key={ci} className="border border-border rounded-md p-2 space-y-1.5">
                <div className="flex items-center gap-1">
                  <Input value={col.heading} onChange={e => updateFooterColumn(ci, { heading: e.target.value })} placeholder="Heading" className="text-xs h-7 flex-1" />
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeFooterColumn(ci)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-1 pl-2">
                  {(col.links ?? []).map((l, li) => (
                    <div key={li} className="flex gap-1 items-center">
                      <Input value={l.label} onChange={e => updateFooterLink(ci, li, { label: e.target.value })} placeholder="Label" className="text-xs h-6 flex-1" />
                      <Input value={l.href} onChange={e => updateFooterLink(ci, li, { href: e.target.value })} placeholder="#" className="text-xs h-6 flex-1 font-mono" />
                      <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => removeFooterLink(ci, li)}>
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs w-full border border-dashed border-border" onClick={() => addFooterLink(ci)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Link
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Payment Icons</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addPayment}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {paymentIcons.map((pi, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Input value={pi} onChange={e => updatePayment(i, e.target.value)} placeholder="VISA" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removePayment(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Legal Links</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addLegal}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {footerLegalLinks.map((l, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Input value={l.label} onChange={e => updateLegal(i, { label: e.target.value })} placeholder="Privacy" className="text-xs h-7 flex-1" />
                <Input value={l.href} onChange={e => updateLegal(i, { href: e.target.value })} placeholder="#" className="text-xs h-7 flex-1 font-mono" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeLegal(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StorefrontPanel;
