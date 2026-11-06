import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_DISPLAY, MINT_PILL, MINT_RING, MINT_WIDE,
  MintCtaButtons, MintEyebrow, mintCard, resolveMintButtonColors, resolveMintPalette, useMintReveal,
  type MintPalette,
} from "./mint/mint-theme";
import type { ForestCloseBlockProps, ForestCloseMode, ForestPromise } from "@/blocks/BlockForestClose";
import { useForestForm, type ForestFormKey, type ForestFormStatus } from "./forest/use-forest-form";
import type { ForestLeadValues } from "./forest/global-form-map";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Close — type "mint-close"  (DSO Page (Light) family, Nov 2026)
 *
 * The green CTA band, v2: a dotted texture masked to the upper right and a
 * lime glow orb off the bottom-left corner; a 6/6 grid from 1000px. Left:
 * lime-dot eyebrow, display headline ("\n" breaks a line), muted sub and
 * the check-marked promises (22px translucent-lime discs). Right, by `mode`:
 *   "form"   — a white ringed card with a grey header strip ("Working
 *              session request · 30 min · routed by group size"), the
 *              artifact's fields (name, work email, organization, role,
 *              locations, lab strategy, and an optional fourth "what
 *              prompted this" select), a full-width lime pill with an
 *              arrow, centred fine print and a "Thank you." done state.
 *              Submission reuses the forest close's hook and global-form
 *              mapper unchanged: label-keyed fields + attribution POSTed to
 *              /api/lp/leads, filed under a linked global form's labels.
 *   "button" — a single reading column: the copy, then the CTA suite as
 *              lime pills (form modal, Chili Piper, URL, video), then the
 *              promises.
 * Under the grid sits the small "Prefer to call?" line. In the builder the
 * form never submits; every visible string edits in place.
 * -------------------------------------------------------------------------- */

/**
 * The forest close's props (eyebrow, promises, form labels, options,
 * toggles, lead routing, CTA suite, style keys) plus the mint-only form
 * header strip and alt line. `buttonHeadline` / `buttonBody` are accepted
 * but not rendered here.
 */
export interface MintCloseBlockProps extends ForestCloseBlockProps {
  /** Header strip of the form card, left ("Working session request"). */
  formTitle?: string;
  /** Header strip of the form card, right, muted ("30 min · routed by group size"). */
  formMeta?: string;
  /** Small line under the grid ("Prefer to call? …"). */
  altText?: string;
}

interface Props {
  props: MintCloseBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintCloseBlockProps) => void;
}

export const MINT_CLOSE_DEFAULT_PROPS: MintCloseBlockProps = {
  ...MINT_CTA_DEFAULTS,
  eyebrow: "Talk to the enterprise team",
  headline: "Bring your lab spend.\nWe'll bring the plan.",
  lede: "A 30-minute working session with the enterprise team, built on your numbers: locations, lab count, current spend. No slideware, no gift cards.",
  promises: [
    { title: "A specialist replies within one business day.", body: "Not an automated cadence." },
    { title: "Groups of 4–50 locations", body: "can start with a three-location pilot." },
    { title: "One session, one plan.", body: "You leave with a written consolidation plan for your group." },
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
  stageOptions: ["No lab strategy yet", "Preferred labs, scattered spend", "Preferred-lab program", "Procurement category"],
  whyLabel: "What prompted this",
  whyOptions: ["Cost review or margin pressure", "Opening a new location", "Contract renewal", "Integrating an acquisition", "Evaluating new technology", "Other"],
  askRole: true,
  askLocations: true,
  askStage: true,
  askWhy: false,
  submitText: "Book the working session",
  fineprint: "No newsletters, no incentives, no patient-care dropdown.",
  successHeadline: "Thank you.",
  successBody: "A specialist will reply within one business day.",
  source: "dso-page",
  buttonHeadline: "",
  buttonBody: "",
  altText: "Prefer to call? Enterprise team: 1-800-000-0000",
  ctaText: "Book the working session",
  ctaUrl: "#",
  ctaAction: "url",
  ctaSecondaryText: "",
  anchorId: "talk",
  backgroundStyle: "dandy-green",
};

/* The card is always white, as in the artifact, whatever the band colour. */
const CARD_INK = "#1D1D1F";
const CARD_MUTED = "#6E6E73";
const CARD_SUBTLE = "#A1A1A6";
const INPUT_BORDER = "#D2D2D7";
const ERROR_RED = "#DC4949";

interface FieldChrome {
  pal: MintPalette;
  isEditor: boolean;
  status: ForestFormStatus;
}

interface MintFieldProps extends FieldChrome {
  id: ForestFormKey;
  label: string;
  onLabelChange?: (v: string) => void;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}

const LABEL_CLS = "block text-[11.5px] font-medium";
const INPUT_CLS = "mint-input w-full min-w-0 appearance-none rounded-[11px] px-[13px] py-[12px] text-[15px] leading-[1.3] outline-none transition-[border-color,box-shadow] duration-300";

function inputStyle(invalid?: boolean): React.CSSProperties {
  return { background: "#FFFFFF", border: `1px solid ${invalid ? ERROR_RED : INPUT_BORDER}`, color: CARD_INK, fontFamily: MINT_BODY };
}

/** Module-level so React keeps the <input> mounted (and focused) across keystrokes. */
function MintInput({ id, label, onLabelChange, value, onChange, invalid, isEditor, status, type = "text", autoComplete, required }: MintFieldProps & { type?: string; autoComplete?: string; required?: boolean }) {
  const inputId = `mint-close-${id}`;
  return (
    <div className="grid min-w-0 gap-1.5">
      {isEditor ? (
        <span className={LABEL_CLS} style={{ color: CARD_MUTED }}><InlineText as="span" value={label} onUpdate={onLabelChange} /></span>
      ) : (
        <label htmlFor={inputId} className={LABEL_CLS} style={{ color: CARD_MUTED }}>{label}</label>
      )}
      <input
        id={inputId}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        disabled={status === "loading"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLS}
        style={inputStyle(invalid)}
        aria-invalid={!!invalid}
      />
    </div>
  );
}

function MintSelect({ id, label, onLabelChange, value, onChange, invalid, isEditor, status, options }: MintFieldProps & { options: string[] }) {
  const inputId = `mint-close-${id}`;
  const chevron = encodeURIComponent(CARD_MUTED);
  return (
    <div className="grid min-w-0 gap-1.5">
      {isEditor ? (
        <span className={LABEL_CLS} style={{ color: CARD_MUTED }}><InlineText as="span" value={label} onUpdate={onLabelChange} /></span>
      ) : (
        <label htmlFor={inputId} className={LABEL_CLS} style={{ color: CARD_MUTED }}>{label}</label>
      )}
      <select
        id={inputId}
        name={id}
        disabled={status === "loading"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT_CLS, "pr-[36px]")}
        style={{
          ...inputStyle(invalid),
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='${chevron}' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 13px center",
        }}
        aria-invalid={!!invalid}
      >
        {options.map((o, i) => <option key={`${i}-${o}`} value={o} style={{ color: CARD_INK }}>{o}</option>)}
      </select>
    </div>
  );
}

/** The 22px translucent-lime disc with a 12px lime check (v2 `.promise i`). */
function MintPromiseCheck({ lime }: { lime: string }) {
  return (
    <span aria-hidden className="mt-px inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${lime} 16%, transparent)`, color: lime }}>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
    </span>
  );
}

export function BlockMintClose({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...MINT_CLOSE_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#003A30");
  const isEditor = !!onFieldChange;
  const { ref, rise } = useMintReveal<HTMLElement>();
  const { values, errors, status, set, submit } = useForestForm(p, { pageId, variantId, isEditor });

  const field = (key: keyof MintCloseBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintCloseBlockProps[typeof key] }) : undefined;
  const updatePromise = onFieldChange
    ? (i: number, patch: Partial<ForestPromise>) => onFieldChange({ ...props, promises: (p.promises ?? []).map((x, idx) => (idx === i ? { ...x, ...patch } : x)) })
    : undefined;

  // The band is the brand green unless a preset or custom colour overrides it.
  const paintGreen = !p.bgColor && (!p.backgroundStyle || p.backgroundStyle === "dandy-green");
  const surface = paintGreen ? pal.green : pal.bg;
  const dark = paintGreen || pal.dark;
  const ink = dark ? pal.cream : pal.ink;
  const muted = dark ? pal.creamMuted : pal.inkMuted;
  const eyebrowPal: MintPalette = dark ? { ...pal, dark: true } : pal;
  const mode: ForestCloseMode = p.mode === "button" ? "button" : "form";
  const primary = resolveMintButtonColors(p, pal, "lime");
  const chrome: FieldChrome = { pal, isEditor, status };
  const opts = (list: string[] | undefined) => (list ?? []).map((s) => s.trim()).filter(Boolean);
  const v = (k: keyof ForestLeadValues) => values[k] ?? "";
  const headlineLines = (p.headline ?? "").split("\n");
  const promises = (p.promises ?? []).filter((x) => x.title?.trim() || x.body?.trim() || isEditor).slice(0, 4);

  // Decorative layers: dots masked to the upper right, a lime orb off the bottom-left corner.
  const dotInk = dark ? "rgba(255,252,239,.08)" : `color-mix(in srgb, ${pal.green} 9%, transparent)`;
  const textureStyle: React.CSSProperties = {
    backgroundImage: `radial-gradient(${dotInk} 1px, transparent 1px)`,
    backgroundSize: "22px 22px",
    maskImage: "radial-gradient(60% 60% at 70% 40%, #000, transparent)",
    WebkitMaskImage: "radial-gradient(60% 60% at 70% 40%, #000, transparent)",
  };
  const orbStyle: React.CSSProperties = {
    width: 700, height: 700, left: -200, bottom: -400, borderRadius: "50%",
    background: `radial-gradient(closest-side, color-mix(in srgb, ${pal.lime} 18%, transparent), transparent)`,
  };

  const promisesBlock = promises.length > 0 && (
    <motion.div {...rise(0.24)} className="grid gap-3 text-[14px]" style={{ color: muted, marginTop: 28 }}>
      {promises.map((x, i) => (
        <div key={i} className="grid items-start gap-3" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
          <MintPromiseCheck lime={dark ? pal.lime : pal.green} />
          <span className="leading-[1.55]">
            <b className="font-medium" style={{ color: ink }}>
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
  );

  const copy = (
    <div className="min-w-0">
      {(p.eyebrow || isEditor) && (
        <motion.div {...rise(0)} className="mb-4">
          <MintEyebrow palette={eyebrowPal}>
            <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
          </MintEyebrow>
        </motion.div>
      )}
      {(p.headline || isEditor) && (
        <motion.h2 {...rise(0.08)} style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(1.9rem, 3.6vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: 400, color: ink, margin: 0, textWrap: "balance" } as React.CSSProperties}>
          {isEditor ? (
            <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
          ) : (
            headlineLines.map((line, i) => <span key={i} className="block">{line}</span>)
          )}
        </motion.h2>
      )}
      {(p.lede || isEditor) && (
        <motion.p {...rise(0.16)} style={{ fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.5, color: muted, maxWidth: "46ch", margin: "16px 0 0", textWrap: "pretty" } as React.CSSProperties}>
          <InlineText as="span" value={p.lede ?? ""} onUpdate={field("lede")} multiline />
        </motion.p>
      )}
      {mode === "form" && promisesBlock}
    </div>
  );

  const formCard = (
    <div
      className="relative w-full overflow-hidden text-left"
      style={{ ...mintCard(pal, { background: "#FFFFFF" }), color: CARD_INK, boxShadow: dark ? `${MINT_RING}, 0 30px 80px rgba(0,0,0,.25)` : mintCard(pal, { lift: true }).boxShadow }}
    >
      {(p.formTitle || p.formMeta || isEditor) && (
        <div
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.08em]"
          style={{ padding: "16px 22px", background: pal.grey, borderBottom: `1px solid ${pal.line}`, color: pal.green }}
        >
          <span><InlineText as="span" value={p.formTitle ?? ""} onUpdate={field("formTitle")} /></span>
          {(p.formMeta || isEditor) && (
            <span className="font-medium normal-case tracking-[0.02em]" style={{ color: CARD_SUBTLE, textTransform: "none" }}>
              <InlineText as="span" value={p.formMeta ?? ""} onUpdate={field("formMeta")} />
            </span>
          )}
        </div>
      )}
      {status === "success" ? (
        <div className="text-center" role="status" data-mint-success="true" style={{ padding: "30px 22px" }}>
          <b className="mb-2 block" style={{ fontFamily: MINT_DISPLAY, fontWeight: 400, fontSize: "1.5rem", letterSpacing: "-0.02em", lineHeight: 1.15, color: CARD_INK }}>
            {p.successHeadline}
          </b>
          {p.successBody && <span className="block text-[12px] leading-[1.5]" style={{ color: CARD_SUBTLE }}>{p.successBody}</span>}
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-3" style={{ padding: 22 }} data-mint-form={isEditor ? "editor" : "live"}>
          <div className="grid gap-3 min-[560px]:grid-cols-2">
            <MintInput {...chrome} id="name" label={p.nameLabel || "Name"} onLabelChange={field("nameLabel")} value={v("name")} onChange={(x) => set("name", x)} invalid={errors.name} autoComplete="name" required />
            <MintInput {...chrome} id="email" label={p.emailLabel || "Work email"} onLabelChange={field("emailLabel")} value={v("email")} onChange={(x) => set("email", x)} invalid={errors.email} type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-3 min-[560px]:grid-cols-2">
            <MintInput {...chrome} id="org" label={p.orgLabel || "Organization"} onLabelChange={field("orgLabel")} value={v("org")} onChange={(x) => set("org", x)} invalid={errors.org} autoComplete="organization" required />
            {(p.askRole ?? true) && (
              <MintSelect {...chrome} id="role" label={p.roleLabel || "Role"} onLabelChange={field("roleLabel")} value={v("role") || opts(p.roleOptions)[0] || ""} onChange={(x) => set("role", x)} options={opts(p.roleOptions)} />
            )}
          </div>
          {((p.askLocations ?? true) || (p.askStage ?? true)) && (
            <div className="grid gap-3 min-[560px]:grid-cols-2">
              {(p.askLocations ?? true) && (
                <MintSelect {...chrome} id="locations" label={p.locationsLabel || "Locations"} onLabelChange={field("locationsLabel")} value={v("locations") || opts(p.locationOptions)[0] || ""} onChange={(x) => set("locations", x)} options={opts(p.locationOptions)} />
              )}
              {(p.askStage ?? true) && (
                <MintSelect {...chrome} id="stage" label={p.stageLabel || "Lab strategy today"} onLabelChange={field("stageLabel")} value={v("stage") || opts(p.stageOptions)[0] || ""} onChange={(x) => set("stage", x)} options={opts(p.stageOptions)} />
              )}
            </div>
          )}
          {(p.askWhy ?? false) && (
            <MintSelect {...chrome} id="why" label={p.whyLabel || "What prompted this"} onLabelChange={field("whyLabel")} value={v("why") || opts(p.whyOptions)[0] || ""} onChange={(x) => set("why", x)} options={opts(p.whyOptions)} />
          )}
          {status === "error" && (
            <p className="rounded-[11px] px-4 py-3 text-[13px]" style={{ background: "rgba(220,73,73,0.10)", color: "#8A2B2B", border: `1px solid ${ERROR_RED}`, margin: 0 }}>Something went wrong sending that. Please try again.</p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className={cn(MINT_PILL, "mt-1 w-full gap-2.5 disabled:opacity-70")}
            style={{ background: primary.bg, color: primary.text, fontFamily: MINT_BODY, padding: 14, fontSize: 14, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}
          >
            <InlineText as="span" value={p.submitText || "Book the working session"} onUpdate={field("submitText")} />
            {status === "loading"
              ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              : <svg aria-hidden viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
          </button>
          {(p.fineprint || isEditor) && (
            <p className="text-center text-[12px] leading-[1.5]" style={{ color: CARD_SUBTLE, margin: 0 }}>
              <InlineText as="span" value={p.fineprint ?? ""} onUpdate={field("fineprint")} multiline />
            </p>
          )}
        </form>
      )}
    </div>
  );

  const buttons = (
    <MintCtaButtons
      props={p}
      brand={brand}
      palette={pal}
      pageId={pageId}
      variantId={variantId}
      onCtaClick={onCtaClick}
      onLabelChange={onFieldChange ? (k, val) => onFieldChange({ ...props, [k]: val }) : undefined}
      source="mint-close"
      tone="lime"
      align="start"
      primaryPlaceholder="Book the working session"
      secondaryPlaceholder="See how it works"
    />
  );

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-close"
      className="mint-close relative overflow-hidden"
      style={{ background: surface, color: ink, fontFamily: MINT_BODY, paddingBlock: "clamp(72px, 8vw, 120px)" }}
    >
      <style>{`${MINT_CSS}
        .mint-close .mint-input::placeholder{color:${CARD_SUBTLE};opacity:1}
        .mint-close .mint-input:focus{outline:none;border-color:${pal.green};box-shadow:0 0 0 4px color-mix(in srgb, ${pal.green} 12%, transparent)}
        .mint-close select.mint-input option{color:${CARD_INK};background:#FFFFFF}
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={textureStyle} />
      <div aria-hidden className="pointer-events-none absolute" style={orbStyle} />

      <div className={cn(MINT_WIDE, "relative")}>
        {mode === "form" ? (
          <div className="grid gap-10 min-[1000px]:grid-cols-2 min-[1000px]:items-start min-[1000px]:gap-[72px]">
            {copy}
            <motion.div {...rise(0.16)} className="min-w-0">
              {formCard}
            </motion.div>
          </div>
        ) : (
          <div className="max-w-[720px]">
            {copy}
            <motion.div {...rise(0.2)} style={{ marginTop: 32 }}>
              {buttons}
            </motion.div>
            {promisesBlock}
          </div>
        )}

        {(p.altText || isEditor) && (
          <motion.p {...rise(0.3)} className="text-[14px]" style={{ color: muted, marginTop: 36 }}>
            <InlineText as="span" value={p.altText ?? ""} onUpdate={field("altText")} />
          </motion.p>
        )}
      </div>
    </section>
  );
}
