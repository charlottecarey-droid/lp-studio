import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_CTA_DEFAULTS, FOREST_DISPLAY, FOREST_PILL,
  ForestCtaButtons, ForestEyebrow, ForestGrain, forestDisplay, resolveForestButtonColors, resolveForestPalette, useForestReveal,
  type ForestCtaProps, type ForestPalette, type ForestStyleProps,
} from "./forest/forest-theme";
import { useForestForm, type ForestFormKey, type ForestFormStatus } from "./forest/use-forest-form";
import type { ForestLeadValues } from "./forest/global-form-map";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Close — type "forest-close"  (DSO Page family, Nov 2026)
 *
 * "Talk to the team": the page's lead-capture close on the deep-forest band
 * with the v2 texture — a 22px dot grid masked to the upper right and a
 * soft accent glow orb low-left. Left: eyebrow, display headline, lede and
 * up to four promises led by 22px translucent-accent check discs. Right, by
 * `mode`:
 *   "form"   — a glass card with a header strip ("Working session request ·
 *              30 min · routed by group size") over the artifact's fields
 *              (name, work email, organization, role, locations, lab
 *              strategy, what prompted this), posted label-keyed to
 *              /api/lp/leads with the page's attribution and, when a global
 *              form is linked, filed under that form's labels so its routing
 *              and redirect apply.
 *   "button" — the same card with a headline, a line and the CTA suite, so
 *              the close can open a global-form modal or Chili Piper.
 * In the builder the form never submits; every visible string edits in place.
 * -------------------------------------------------------------------------- */

export interface ForestPromise {
  title: string;
  body?: string;
}

export type ForestCloseMode = "form" | "button";

export interface ForestCloseBlockProps extends ForestStyleProps, ForestCtaProps {
  eyebrow?: string;
  headline?: string;
  lede?: string;
  /** 0–4 check-marked rows. */
  promises?: ForestPromise[];
  /** "form" = the inline form card (default); "button" = headline + CTA buttons (modal / Chili Piper). */
  mode?: ForestCloseMode;
  /** Header strip over the card: uppercase title left, a muted meta right (both empty = no strip). */
  formTitle?: string;
  formMeta?: string;
  nameLabel?: string;
  emailLabel?: string;
  orgLabel?: string;
  roleLabel?: string;
  roleOptions?: string[];
  locationsLabel?: string;
  locationOptions?: string[];
  stageLabel?: string;
  stageOptions?: string[];
  whyLabel?: string;
  whyOptions?: string[];
  askRole?: boolean;
  askLocations?: boolean;
  askStage?: boolean;
  askWhy?: boolean;
  submitText?: string;
  fineprint?: string;
  successHeadline?: string;
  successBody?: string;
  /** Route leads through this global form (lp_forms id): its notifications, CRM sync, Sheets, webhook, follow-up and redirect apply; the card keeps its own design. */
  formId?: number;
  /** Lead source label saved with the lead. */
  source?: string;
  buttonHeadline?: string;
  buttonBody?: string;
  anchorId?: string;
}

interface Props {
  props: ForestCloseBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestCloseBlockProps) => void;
}

export const FOREST_CLOSE_DEFAULT_PROPS: ForestCloseBlockProps = {
  ...FOREST_CTA_DEFAULTS,
  eyebrow: "Talk to the enterprise team",
  headline: "Bring your lab spend. We will bring the plan.",
  lede: "A 30-minute working session with the enterprise team, built on your numbers: locations, lab count, current spend. No slideware, no gift cards.",
  promises: [
    { title: "A specialist replies within one business day.", body: "Not a BDR cadence." },
    { title: "Groups of 4–50 locations", body: "can start with a three-location pilot." },
    { title: "Prefer to call?", body: "Enterprise team: 1-800-000-0000" },
  ],
  mode: "form",
  formTitle: "Working session request",
  formMeta: "30 min · routed by group size",
  nameLabel: "Name",
  emailLabel: "Work email",
  orgLabel: "Organization",
  roleLabel: "Role",
  roleOptions: ["COO / VP Operations", "CFO / VP Finance", "Chief Clinical Officer", "Clinical Director", "VP Procurement", "Owner / CEO", "Other"],
  locationsLabel: "Locations",
  locationOptions: ["4–10", "11–25", "26–50", "51–200", "200+"],
  stageLabel: "Lab strategy today",
  stageOptions: ["No lab strategy yet", "Preferred labs, scattered spend", "Preferred-lab program, want outcomes", "Managed as a procurement category"],
  whyLabel: "What prompted this",
  whyOptions: ["Cost review or margin pressure", "Opening a new location", "Contract renewal", "Integrating an acquisition", "Evaluating new technology", "Other"],
  askRole: true,
  askLocations: true,
  askStage: true,
  askWhy: true,
  submitText: "Book the working session",
  fineprint: "Routed to the enterprise team by group size. No newsletters, no incentives.",
  successHeadline: "Thank you. A specialist will reply within one business day.",
  successBody: "Check your inbox for a calendar link.",
  source: "dso-page",
  buttonHeadline: "Book a 30-minute working session.",
  buttonBody: "Bring your locations, lab count and current spend. We will bring the plan.",
  ctaText: "Book the working session",
  ctaUrl: "#",
  ctaAction: "url",
  ctaSecondaryText: "",
  anchorId: "talk",
  backgroundStyle: "dandy-green",
};

const ERROR_RED = "#DC4949";
const SECTION_PAD: React.CSSProperties = { paddingBlock: "clamp(72px, 8vw, 120px)" };

interface FieldChrome {
  pal: ForestPalette;
  dark: boolean;
  isEditor: boolean;
  status: ForestFormStatus;
}

interface ForestFieldProps extends FieldChrome {
  id: ForestFormKey;
  label: string;
  onLabelChange?: (v: string) => void;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}

function fieldLabelStyle(pal: ForestPalette, dark: boolean): React.CSSProperties {
  return { color: dark ? "rgba(255,252,239,0.66)" : pal.muted, fontFamily: FOREST_BODY };
}

function inputStyle(pal: ForestPalette, dark: boolean, invalid?: boolean): React.CSSProperties {
  return {
    background: dark ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.04)",
    border: `1px solid ${invalid ? ERROR_RED : dark ? "rgba(255,252,239,0.14)" : pal.hairline}`,
    color: dark ? pal.cream : pal.text,
    fontFamily: FOREST_BODY,
  };
}

const LABEL_CLS = "block text-[11px] font-semibold uppercase tracking-[0.14em]";
const INPUT_CLS = "forest-input w-full min-w-0 appearance-none rounded-xl px-4 py-3.5 text-[15px] leading-[1.3] outline-none transition-[border-color,box-shadow] duration-300";

/** Module-level so React keeps the <input> mounted (and focused) across keystrokes. */
function ForestInput({ id, label, onLabelChange, value, onChange, invalid, pal, dark, isEditor, status, type = "text", placeholder, autoComplete, required }: ForestFieldProps & { type?: string; placeholder?: string; autoComplete?: string; required?: boolean }) {
  const inputId = `forest-close-${id}`;
  return (
    <div className="grid min-w-0 gap-[7px]">
      {isEditor ? (
        <span className={LABEL_CLS} style={fieldLabelStyle(pal, dark)}><InlineText as="span" value={label} onUpdate={onLabelChange} /></span>
      ) : (
        <label htmlFor={inputId} className={LABEL_CLS} style={fieldLabelStyle(pal, dark)}>{label}</label>
      )}
      <input
        id={inputId}
        name={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={status === "loading"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLS}
        style={inputStyle(pal, dark, invalid)}
        aria-invalid={!!invalid}
      />
    </div>
  );
}

function ForestSelect({ id, label, onLabelChange, value, onChange, invalid, pal, dark, isEditor, status, options }: ForestFieldProps & { options: string[] }) {
  const inputId = `forest-close-${id}`;
  const chevron = encodeURIComponent(pal.accentDeco);
  return (
    <div className="grid min-w-0 gap-[7px]">
      {isEditor ? (
        <span className={LABEL_CLS} style={fieldLabelStyle(pal, dark)}><InlineText as="span" value={label} onUpdate={onLabelChange} /></span>
      ) : (
        <label htmlFor={inputId} className={LABEL_CLS} style={fieldLabelStyle(pal, dark)}>{label}</label>
      )}
      <select
        id={inputId}
        name={id}
        disabled={status === "loading"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT_CLS, "pr-10")}
        style={{
          ...inputStyle(pal, dark, invalid),
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='${chevron}' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 16px center",
        }}
        aria-invalid={!!invalid}
      >
        {options.map((o, i) => <option key={`${i}-${o}`} value={o} style={{ color: "#111111" }}>{o}</option>)}
      </select>
    </div>
  );
}

export function BlockForestClose({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...FOREST_CLOSE_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#003A30");
  const isEditor = !!onFieldChange;
  const { ref, rise } = useForestReveal<HTMLElement>();
  const { values, errors, status, set, submit } = useForestForm(p, { pageId, variantId, isEditor });

  const field = (key: keyof ForestCloseBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestCloseBlockProps[typeof key] }) : undefined;
  const promises = (p.promises ?? []).filter((x) => x.title?.trim() || x.body?.trim() || isEditor).slice(0, 4);
  const updatePromise = onFieldChange
    ? (i: number, patch: Partial<ForestPromise>) => onFieldChange({ ...props, promises: (p.promises ?? []).map((x, idx) => (idx === i ? { ...x, ...patch } : x)) })
    : undefined;

  const dark = pal.dark;
  const cream = pal.cream;
  const onDarkMuted = dark ? "rgba(255,252,239,0.66)" : pal.muted;
  const hairline = dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  const cardBg = dark ? "rgba(255,252,239,0.05)" : "rgba(0,0,0,0.03)";
  const stripBg = dark ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.04)";
  const dotInk = dark ? "rgba(255,252,239,0.08)" : "rgba(0,0,0,0.07)";
  const mode: ForestCloseMode = p.mode === "button" ? "button" : "form";
  const primary = resolveForestButtonColors(p, pal);
  const chrome: FieldChrome = { pal, dark, isEditor, status };
  const opts = (list: string[] | undefined) => (list ?? []).map((s) => s.trim()).filter(Boolean);
  const v = (k: keyof ForestLeadValues) => values[k] ?? "";
  const showStrip = !!p.formTitle || !!p.formMeta || isEditor;

  const cardStyle: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${hairline}`,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: dark ? "0 30px 80px rgba(0,0,0,0.25)" : pal.shadowElev,
  };

  const strip = showStrip && (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-[22px] py-4 text-[12px]" style={{ background: stripBg, borderBottom: `1px solid ${hairline}` }}>
      <span className="font-semibold uppercase tracking-[0.08em]" style={{ color: cream }}>
        <InlineText as="span" value={p.formTitle ?? ""} onUpdate={field("formTitle")} />
      </span>
      <span className="font-medium" style={{ color: onDarkMuted }}>
        <InlineText as="span" value={p.formMeta ?? ""} onUpdate={field("formMeta")} />
      </span>
    </div>
  );

  const formCard = (
    <div className="relative overflow-hidden rounded-[20px]" style={cardStyle}>
      {strip}
      <div className="p-[22px] sm:p-6">
        {status === "success" ? (
          <div className="px-2.5 py-[30px] text-center" role="status" data-forest-success="true">
            <b className="mb-2.5 block" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.6rem", fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.15, color: cream }}>
              {p.successHeadline}
            </b>
            {p.successBody && <span className="block text-[12px] leading-[1.5]" style={{ color: onDarkMuted }}>{p.successBody}</span>}
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-4" data-forest-form={isEditor ? "editor" : "live"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ForestInput {...chrome} id="name" label={p.nameLabel || "Name"} onLabelChange={field("nameLabel")} value={v("name")} onChange={(x) => set("name", x)} invalid={errors.name} placeholder="Your name" autoComplete="name" required />
              <ForestInput {...chrome} id="email" label={p.emailLabel || "Work email"} onLabelChange={field("emailLabel")} value={v("email")} onChange={(x) => set("email", x)} invalid={errors.email} type="email" placeholder="you@yourgroup.com" autoComplete="email" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ForestInput {...chrome} id="org" label={p.orgLabel || "Organization"} onLabelChange={field("orgLabel")} value={v("org")} onChange={(x) => set("org", x)} invalid={errors.org} placeholder="Group name" autoComplete="organization" required />
              {(p.askRole ?? true) && (
                <ForestSelect {...chrome} id="role" label={p.roleLabel || "Role"} onLabelChange={field("roleLabel")} value={v("role") || opts(p.roleOptions)[0] || ""} onChange={(x) => set("role", x)} options={opts(p.roleOptions)} />
              )}
            </div>
            {((p.askLocations ?? true) || (p.askStage ?? true)) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {(p.askLocations ?? true) && (
                  <ForestSelect {...chrome} id="locations" label={p.locationsLabel || "Locations"} onLabelChange={field("locationsLabel")} value={v("locations") || opts(p.locationOptions)[0] || ""} onChange={(x) => set("locations", x)} options={opts(p.locationOptions)} />
                )}
                {(p.askStage ?? true) && (
                  <ForestSelect {...chrome} id="stage" label={p.stageLabel || "Lab strategy today"} onLabelChange={field("stageLabel")} value={v("stage") || opts(p.stageOptions)[0] || ""} onChange={(x) => set("stage", x)} options={opts(p.stageOptions)} />
                )}
              </div>
            )}
            {(p.askWhy ?? true) && (
              <ForestSelect {...chrome} id="why" label={p.whyLabel || "What prompted this"} onLabelChange={field("whyLabel")} value={v("why") || opts(p.whyOptions)[0] || ""} onChange={(x) => set("why", x)} options={opts(p.whyOptions)} />
            )}
            {status === "error" && (
              <p className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "rgba(220,73,73,0.14)", color: dark ? "#FFD6D6" : "#8A2B2B", border: `1px solid ${ERROR_RED}` }}>Something went wrong sending that. Please try again.</p>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className={cn(FOREST_PILL, "mt-1 w-full disabled:opacity-70")}
              style={{ background: primary.bg, color: primary.text, fontFamily: FOREST_BODY, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)" }}
            >
              <InlineText as="span" value={p.submitText || "Book the working session"} onUpdate={field("submitText")} />
              {status === "loading" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />}
            </button>
            {(p.fineprint || isEditor) && (
              <p className="text-center text-[12px] leading-[1.5]" style={{ color: onDarkMuted, margin: 0 }}>
                <InlineText as="span" value={p.fineprint ?? ""} onUpdate={field("fineprint")} multiline />
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );

  const buttonCard = (
    <div className="relative overflow-hidden rounded-[20px]" style={cardStyle}>
      {strip}
      <div className="p-6 sm:p-[30px]">
        {(p.buttonHeadline || isEditor) && (
          <h3 style={forestDisplay("clamp(1.5rem, 2.4vw, 2rem)", cream)}>
            <InlineText as="span" value={p.buttonHeadline ?? ""} onUpdate={field("buttonHeadline")} multiline />
          </h3>
        )}
        {(p.buttonBody || isEditor) && (
          <p className="mt-4 max-w-[46ch] text-[15.5px] leading-[1.6]" style={{ color: onDarkMuted, margin: "16px 0 0" }}>
            <InlineText as="span" value={p.buttonBody ?? ""} onUpdate={field("buttonBody")} multiline />
          </p>
        )}
        <ForestCtaButtons
          props={p}
          brand={brand}
          palette={pal}
          pageId={pageId}
          variantId={variantId}
          onCtaClick={onCtaClick}
          onLabelChange={onFieldChange ? (k, val) => onFieldChange({ ...props, [k]: val }) : undefined}
          source="forest-close"
          className="mt-7"
          primaryPlaceholder="Book the working session"
          secondaryPlaceholder="See how it works"
        />
      </div>
    </div>
  );

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-close"
      className="forest-close relative overflow-hidden"
      style={{ background: dark ? pal.deep : pal.bg, color: cream, fontFamily: FOREST_BODY, isolation: "isolate", ...SECTION_PAD }}
    >
      <style>{`${FOREST_CSS}
        .forest-close .forest-input::placeholder{color:${dark ? "rgba(255,252,239,0.35)" : pal.muted};opacity:1}
        .forest-close .forest-input:focus{outline:none;border-color:${pal.accentDeco};box-shadow:0 0 0 4px ${pal.accentTint}}
        .forest-close select.forest-input option{color:#111111;background:#FFFFFF}
      `}</style>
      {/* The v2 texture: a 22px dot grid masked to the upper right, and a soft accent glow low-left. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(${dotInk} 1px, transparent 1px)`,
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(60% 60% at 70% 40%, #000, transparent)",
          WebkitMaskImage: "radial-gradient(60% 60% at 70% 40%, #000, transparent)",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{ width: 700, height: 700, left: -200, bottom: -400, background: `radial-gradient(closest-side, color-mix(in srgb, ${pal.accentDeco} 18%, transparent), transparent)`, zIndex: 0 }}
      />
      {dark && <ForestGrain opacity={0.04} />}
      <div className={cn(FOREST_CONTAINER, "relative")} style={{ zIndex: 1 }}>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-[72px]">
          <div className="min-w-0">
            {(p.eyebrow || isEditor) && (
              <motion.div {...rise(0)}>
                <ForestEyebrow palette={pal}>
                  <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
                </ForestEyebrow>
              </motion.div>
            )}
            {(p.headline || isEditor) && (
              <motion.h2 {...rise(0.08)} className="mt-[18px] max-w-[16ch]" style={{ ...forestDisplay("clamp(1.9rem, 3.6vw, 3rem)", cream), margin: "18px 0 0" }}>
                <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
              </motion.h2>
            )}
            {(p.lede || isEditor) && (
              <motion.p {...rise(0.16)} className="max-w-[46ch]" style={{ fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.5, color: onDarkMuted, margin: "16px 0 0" }}>
                <InlineText as="span" value={p.lede ?? ""} onUpdate={field("lede")} multiline />
              </motion.p>
            )}
            {promises.length > 0 && (
              <motion.div {...rise(0.24)} className="mt-7 grid gap-3 text-[14px]" style={{ color: onDarkMuted }}>
                {promises.map((x, i) => (
                  <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                    <span aria-hidden className="mt-[1px] grid h-[22px] w-[22px] place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${pal.accentDeco} 16%, transparent)`, color: pal.accent }}>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="leading-[1.55]">
                      <b className="font-medium" style={{ color: cream }}>
                        <InlineText as="span" value={x.title ?? ""} onUpdate={updatePromise ? (val) => updatePromise(i, { title: val }) : undefined} />
                      </b>
                      {(x.body || isEditor) && (
                        <>
                          {" "}
                          <InlineText as="span" value={x.body ?? ""} onUpdate={updatePromise ? (val) => updatePromise(i, { body: val }) : undefined} multiline />
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          <motion.div {...rise(0.16)} className="min-w-0">
            {mode === "form" ? formCard : buttonCard}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
