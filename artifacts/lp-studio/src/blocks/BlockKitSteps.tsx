import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Download, Play, Wifi } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, INVITE_DISPLAY, INVITE_NUMBERS, Kicker, displayStyle, resolveInvitePalette, type InvitePalette } from "@/lib/invite-theme";

/* ----------------------------------------------------------------------------
 * Kit Steps — type "kit-steps"
 *
 * "SET UP IN FIVE STEPS": the numbered instructions a kit's QR code exists
 * for. A centered header, then hairline-separated rows — a large accent
 * two-digit number, a title, a short body, an optional italic tip, an
 * optional help link — and, per step, an optional inline visual:
 *
 *   "code"   six entry cells (filled from `code` when set, else blanks) and
 *            a caption telling the reader where their code is;
 *   "store"  a faux store listing (icon, app name, store line, "Get" pill);
 *   "stream" the "Stream · Play · Download" chip row.
 *
 * Built for a phone first: one column, generous tap targets, numbers that
 * read from arm's length.
 * -------------------------------------------------------------------------- */

export type KitStepVisual = "none" | "code" | "store" | "stream";

export interface KitStep {
  title: string;
  body: string;
  /** Italic one-liner under the body ("Have your phone nearby…"). */
  tip?: string;
  /** Help link — deliberately NOT ctaText/ctaUrl so Page CTA never rewrites it. */
  linkText?: string;
  linkUrl?: string;
  visual?: KitStepVisual;
  /** "store": the app name. "stream": chip labels separated by "·". */
  visualLabel?: string;
  /** "store": the store line ("Horizon Store · Free"). */
  visualSub?: string;
}

export interface KitStepsBlockProps {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  steps: KitStep[];
  /** Six-digit access code to show in the "code" visual. Blank = empty cells. */
  code?: string;
  codeLabel?: string;
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: KitStepsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: KitStepsBlockProps) => void;
}

export const KIT_STEPS_DEFAULT_PROPS: KitStepsBlockProps = {
  kicker: "Set up in five steps",
  headline: "From the box to the experience\nin about ten minutes.",
  subheadline: "Follow the steps in order. Each one takes a minute or two.",
  steps: [
    { title: "Create your account", body: "Put on the headset and follow the on-screen setup. Sign in to your account — or create one — and connect to Wi-Fi.", tip: "Keep your phone nearby; the companion app makes pairing faster.", visual: "none" },
    { title: "Install the app", body: "Open the store from the home menu, search for the app and install it. It's free.", visual: "store", visualLabel: "Companion app", visualSub: "App store · Free" },
    { title: "Enter your access code", body: "Open the app and enter the six-digit code from the card in your kit. It unlocks your experience.", tip: "Codes are specific to your kit. If yours is missing, get in touch and we'll send a new one.", visual: "code" },
    { title: "Open the experience", body: "Once the code is accepted you'll land in the dedicated space. Pick the tour to begin.", visual: "none" },
    { title: "Stream, play or download", body: "Stream instantly over Wi-Fi, or download once and watch anywhere — no connection needed afterwards.", visual: "stream", visualLabel: "Stream · Play · Download" },
  ],
  code: "",
  codeLabel: "Your code is on the card in the box.",
  anchorId: "steps",
};

const CHIP_ICONS = [Wifi, Play, Download];

function CodeCells({ code, label, palette }: { code?: string; label?: string; palette: InvitePalette }) {
  const digits = (code ?? "").replace(/\D/g, "").slice(0, 6).split("");
  return (
    <div className="mt-5 flex flex-col gap-3" data-kit-visual="code">
      <div className="flex gap-2" role="img" aria-label={digits.length === 6 ? `Access code ${digits.join(" ")}` : "Six-digit access code"}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="flex h-12 w-10 items-center justify-center rounded-lg text-xl sm:h-14 sm:w-12 sm:text-2xl"
            style={{
              background: palette.panelRaised,
              border: `1px solid ${digits[i] ? palette.accent : palette.hairline}`,
              color: digits[i] ? palette.text : palette.faint,
              fontFamily: INVITE_NUMBERS,
              fontVariantNumeric: "tabular-nums",
              boxShadow: digits[i] ? `0 0 0 3px color-mix(in srgb, ${palette.accent} 18%, transparent)` : undefined,
            }}
          >
            {digits[i] ?? "·"}
          </span>
        ))}
      </div>
      {label && <p className="text-xs" style={{ color: palette.faint }}>{label}</p>}
    </div>
  );
}

function StoreListing({ name, sub, palette }: { name: string; sub?: string; palette: InvitePalette }) {
  const initial = (name.trim()[0] ?? "A").toUpperCase();
  return (
    <div className="mt-5 inline-flex max-w-full items-center gap-4 rounded-2xl p-3 pr-4" style={{ background: palette.panel, border: `1px solid ${palette.hairline}` }} data-kit-visual="store">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-xl font-semibold"
        style={{ background: `linear-gradient(135deg, ${palette.accent}, color-mix(in srgb, ${palette.accent} 55%, ${palette.bg}))`, color: palette.onAccent, fontFamily: INVITE_DISPLAY }}
        aria-hidden="true"
      >
        {initial}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-medium">{name}</span>
        {sub && <span className="text-xs leading-snug" style={{ color: palette.muted }}>{sub}</span>}
      </span>
      <span className="ml-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold" style={{ background: palette.accent, color: palette.onAccent }} aria-hidden="true">Get</span>
    </div>
  );
}

function StreamChips({ labels, palette }: { labels: string; palette: InvitePalette }) {
  const chips = labels.split("·").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  return (
    <ul className="mt-5 flex flex-wrap gap-2" data-kit-visual="stream">
      {chips.map((c, i) => {
        const Icon = CHIP_ICONS[i] ?? Play;
        return (
          <li key={i} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium" style={{ background: palette.panel, border: `1px solid ${palette.hairline}` }}>
            <Icon className="h-3.5 w-3.5" style={{ color: palette.accent }} aria-hidden />
            {c}
          </li>
        );
      })}
    </ul>
  );
}

export function BlockKitSteps({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;
  const steps = props.steps && props.steps.length > 0 ? props.steps : KIT_STEPS_DEFAULT_PROPS.steps;

  const field = (key: keyof KitStepsBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as KitStepsBlockProps[typeof key] }) : undefined;
  const updateStep = onFieldChange
    ? (i: number, patch: Partial<KitStep>) => onFieldChange({ ...props, steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  return (
    <section id={props.anchorId || "steps"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <div className="mx-auto w-full max-w-[1240px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          {(props.kicker || isEditor) && <Kicker palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></Kicker>}
          {(props.headline || isEditor) && (
            <h2 className="whitespace-pre-line" style={displayStyle("clamp(2.2rem, 4.6vw, 3.6rem)")}>
              <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            </h2>
          )}
          {(props.subheadline || isEditor) && (
            <p className="max-w-[48ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
        </div>

        <ol className="mx-auto mt-14 max-w-3xl lg:mt-20" style={{ borderTop: `1px solid ${pal.hairline}` }}>
          {steps.map((s, i) => (
            <motion.li
              key={i}
              initial={reduced ? false : anim({ opacity: 0, y: 16 })}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.65, delay: Math.min(i * 0.05, 0.2), ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-[3.25rem_1fr] gap-x-5 py-8 sm:grid-cols-[5rem_1fr] sm:gap-x-8 lg:py-10"
              style={{ borderBottom: `1px solid ${pal.hairline}` }}
            >
              <span className="pt-1 text-[1.75rem] leading-none sm:text-[2.4rem]" style={{ fontFamily: INVITE_DISPLAY, color: pal.accent, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-medium sm:text-2xl" style={{ letterSpacing: "-0.015em" }}>
                  <span className="sr-only">Step {i + 1}: </span>
                  <InlineText as="span" value={s.title} onUpdate={updateStep ? (v) => updateStep(i, { title: v }) : undefined} />
                </h3>
                <p className="mt-2.5 max-w-[58ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
                  <InlineText as="span" value={s.body} onUpdate={updateStep ? (v) => updateStep(i, { body: v }) : undefined} multiline />
                </p>
                {(s.tip || isEditor) && (
                  <p className="mt-3 flex max-w-[58ch] gap-3 text-sm italic leading-relaxed" style={{ color: pal.faint }}>
                    <span aria-hidden="true" className="mt-2.5 block h-px w-4 shrink-0" style={{ background: pal.accent, opacity: 0.8 }} />
                    <InlineText as="span" value={s.tip ?? ""} onUpdate={updateStep ? (v) => updateStep(i, { tip: v }) : undefined} multiline />
                  </p>
                )}

                {s.visual === "code" && <CodeCells code={props.code} label={props.codeLabel} palette={pal} />}
                {s.visual === "store" && <StoreListing name={s.visualLabel || "App"} sub={s.visualSub} palette={pal} />}
                {s.visual === "stream" && <StreamChips labels={s.visualLabel || "Stream · Play · Download"} palette={pal} />}

                {s.linkText && s.linkUrl && (
                  <a
                    href={s.linkUrl}
                    target={s.linkUrl.startsWith("#") ? undefined : "_blank"}
                    rel={s.linkUrl.startsWith("#") ? undefined : "noopener noreferrer"}
                    className="mt-4 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
                    style={{ color: pal.accent }}
                  >
                    {s.linkText}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )}
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
