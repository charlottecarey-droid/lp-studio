import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_DISPLAY, MINT_PILL, MINT_SECTION_PAD, MINT_WRAP,
  MintCtaButtons, mintDisplay, mintSub, resolveMintButtonColors, resolveMintPalette, useMintReveal,
  type MintPalette,
} from "./mint/mint-theme";
import type { ForestCloseBlockProps, ForestCloseMode } from "@/blocks/BlockForestClose";
import { useForestForm, type ForestFormKey, type ForestFormStatus } from "./forest/use-forest-form";
import type { ForestLeadValues } from "./forest/global-form-map";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Close — type "mint-close"  (DSO Page (Light) family, Nov 2026)
 *
 * The green CTA band: a centred display headline ("\n" breaks a line) and
 * a muted sub in cream, then, by `mode`:
 *   "form"   — a white rounded card with the artifact's fields (name, work
 *              email, organization, role, locations, lab strategy, and an
 *              optional fourth "what prompted this" select), a full-width
 *              lime pill, centred fine print and a "Thank you." done state.
 *              Submission reuses the forest close's hook and global-form
 *              mapper unchanged: label-keyed fields + attribution POSTed to
 *              /api/lp/leads, filed under a linked global form's labels.
 *   "button" — the CTA suite as centred lime pills (form modal, Chili
 *              Piper, URL, video) instead of the card.
 * Under either sits the small "Prefer to call?" line. In the builder the
 * form never submits; every visible string edits in place.
 * -------------------------------------------------------------------------- */

/**
 * The forest close's props (form labels, options, toggles, lead routing,
 * CTA suite, style keys) plus the mint-only alt line. `eyebrow`, `promises`,
 * `buttonHeadline` and `buttonBody` are accepted but not rendered here.
 */
export interface MintCloseBlockProps extends ForestCloseBlockProps {
  /** Small line under the card / buttons ("Prefer to call? …"). */
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
  eyebrow: "",
  headline: "Bring your lab spend.\nWe'll bring the plan.",
  lede: "A 30-minute working session with the enterprise team, built on your numbers: locations, lab count, current spend. A specialist replies within one business day.",
  promises: [],
  mode: "form",
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
  fineprint: "Groups of 4–50 locations can start with a three-location pilot.",
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

const LABEL_CLS = "block text-[12px] font-medium";
const INPUT_CLS = "mint-input w-full min-w-0 appearance-none rounded-[12px] px-[14px] py-[13px] text-[16px] leading-[1.3] outline-none transition-[border-color,box-shadow] duration-300";

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
        className={cn(INPUT_CLS, "pr-[38px]")}
        style={{
          ...inputStyle(invalid),
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='${chevron}' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center",
        }}
        aria-invalid={!!invalid}
      >
        {options.map((o, i) => <option key={`${i}-${o}`} value={o} style={{ color: CARD_INK }}>{o}</option>)}
      </select>
    </div>
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

  // The band is the brand green unless a preset or custom colour overrides it.
  const paintGreen = !p.bgColor && (!p.backgroundStyle || p.backgroundStyle === "dandy-green");
  const surface = paintGreen ? pal.green : pal.bg;
  const dark = paintGreen || pal.dark;
  const ink = dark ? pal.cream : pal.ink;
  const muted = dark ? pal.creamMuted : pal.inkMuted;
  const mode: ForestCloseMode = p.mode === "button" ? "button" : "form";
  const primary = resolveMintButtonColors(p, pal, "lime");
  const chrome: FieldChrome = { pal, isEditor, status };
  const opts = (list: string[] | undefined) => (list ?? []).map((s) => s.trim()).filter(Boolean);
  const v = (k: keyof ForestLeadValues) => values[k] ?? "";
  const headlineLines = (p.headline ?? "").split("\n");

  const formCard = (
    <div
      className="relative mx-auto w-full max-w-[560px] text-left"
      style={{ background: "#FFFFFF", color: CARD_INK, borderRadius: 20, padding: 26, boxShadow: "0 20px 60px rgba(0,0,0,.18)" }}
    >
      {status === "success" ? (
        <div className="py-6 text-center" role="status" data-mint-success="true">
          <b className="mb-2 block" style={{ fontFamily: MINT_DISPLAY, fontWeight: 400, fontSize: "1.5rem", letterSpacing: "-0.02em", lineHeight: 1.15, color: CARD_INK }}>
            {p.successHeadline}
          </b>
          {p.successBody && <span className="block text-[12.5px] leading-[1.5]" style={{ color: CARD_SUBTLE }}>{p.successBody}</span>}
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-3" data-mint-form={isEditor ? "editor" : "live"}>
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
            <p className="rounded-[12px] px-4 py-3 text-[13px]" style={{ background: "rgba(220,73,73,0.10)", color: "#8A2B2B", border: `1px solid ${ERROR_RED}`, margin: 0 }}>Something went wrong sending that. Please try again.</p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className={cn(MINT_PILL, "mt-1.5 w-full gap-2 disabled:opacity-70")}
            style={{ background: primary.bg, color: primary.text, fontFamily: MINT_BODY, padding: 15 }}
          >
            <InlineText as="span" value={p.submitText || "Book the working session"} onUpdate={field("submitText")} />
            {status === "loading" && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />}
          </button>
          {(p.fineprint || isEditor) && (
            <p className="text-center text-[12.5px] leading-[1.5]" style={{ color: CARD_SUBTLE, margin: 0 }}>
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
      style={{ background: surface, color: ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{`${MINT_CSS}
        .mint-close .mint-input::placeholder{color:${CARD_SUBTLE};opacity:1}
        .mint-close .mint-input:focus{outline:none;border-color:${pal.green};box-shadow:0 0 0 4px color-mix(in srgb, ${pal.green} 12%, transparent)}
        .mint-close select.mint-input option{color:${CARD_INK};background:#FFFFFF}
      `}</style>
      <div className={cn(MINT_WRAP, "text-center")}>
        {(p.headline || isEditor) && (
          <motion.h2 {...rise(0)} className="mx-auto" style={mintDisplay("clamp(2rem, 4.2vw, 3.4rem)", ink)}>
            {isEditor ? (
              <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
            ) : (
              headlineLines.map((line, i) => <span key={i} className="block">{line}</span>)
            )}
          </motion.h2>
        )}
        {(p.lede || isEditor) && (
          <motion.p {...rise(0.08)} className="mx-auto" style={mintSub(muted)}>
            <InlineText as="span" value={p.lede ?? ""} onUpdate={field("lede")} multiline />
          </motion.p>
        )}

        <motion.div {...rise(0.16)} className={cn("flex justify-center", mode === "form" ? "mt-10" : "mt-[34px]")}>
          {mode === "form" ? formCard : buttons}
        </motion.div>

        {(p.altText || isEditor) && (
          <motion.p {...rise(0.24)} className="mx-auto text-[14px]" style={{ color: muted, marginTop: 26 }}>
            <InlineText as="span" value={p.altText ?? ""} onUpdate={field("altText")} />
          </motion.p>
        )}
      </div>
    </section>
  );
}
