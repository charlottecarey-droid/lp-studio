import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { StatCounter } from "./StatCounter";
import { INVITE_BODY, INVITE_DISPLAY, INVITE_NUMBERS, Kicker, resolveInvitePalette } from "@/lib/invite-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Invite Proof — type "invite-proof"
 *
 * Editorial proof band: a kicker, one large italic pull quote with its
 * attribution, then a hairline row of 3–4 count-up stats with labels, and an
 * optional line of customer wordmarks. Proof placed right before the
 * reservation form — the last thing read before the decision.
 * -------------------------------------------------------------------------- */

export interface InviteProofStat {
  value: string;
  label: string;
}

export interface InviteProofBlockProps {
  kicker?: string;
  quote?: string;
  author?: string;
  role?: string;
  stats: InviteProofStat[];
  logosLabel?: string;
  logos?: { name: string }[];
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: InviteProofBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: InviteProofBlockProps) => void;
}

export const INVITE_PROOF_DEFAULT_PROPS: InviteProofBlockProps = {
  kicker: "Why teams take the meeting",
  quote: "They showed up, put our own numbers on the table, and left us with a plan we could actually run. It was the most useful thirty minutes we spent that quarter.",
  author: "Operations lead",
  role: "Multi-location group",
  stats: [
    { value: "30", label: "minutes, start to finish" },
    { value: "3", label: "outcomes you leave with" },
    { value: "0", label: "commitment required" },
  ],
  logosLabel: "",
  logos: [],
  anchorId: "proof",
};

export function BlockInviteProof({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;
  const stats = props.stats && props.stats.length > 0 ? props.stats : INVITE_PROOF_DEFAULT_PROPS.stats;
  const logos = props.logos ?? [];

  const field = (key: keyof InviteProofBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as InviteProofBlockProps[typeof key] }) : undefined;
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<InviteProofStat>) => onFieldChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  const cols = stats.length >= 4 ? "md:grid-cols-4" : stats.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <section id={props.anchorId || "proof"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[60%]" style={{ background: `radial-gradient(50% 60% at 50% 0%, color-mix(in srgb, ${pal.accent} 9%, transparent) 0%, transparent 70%)` }} />
      <div className="relative mx-auto w-full max-w-[1240px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
          {(props.kicker || isEditor) && <Kicker palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></Kicker>}
          {(props.quote || isEditor) && (
            <motion.blockquote
              initial={reduced ? false : anim({ opacity: 0, y: 14 })}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="text-[1.6rem] leading-[1.25] lg:text-[2.2rem]"
              style={{ fontFamily: INVITE_DISPLAY, fontStyle: "italic", letterSpacing: "-0.02em" }}
            >
              <InlineText as="span" value={props.quote ? `“${props.quote}”` : ""} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, quote: v.replace(/^[“"]|[”"]$/g, "") }) : undefined} multiline />
            </motion.blockquote>
          )}
          {(props.author || isEditor) && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: pal.faint }}>
              <InlineText as="span" value={props.author ?? ""} onUpdate={field("author")} />
              {(props.role || isEditor) && (
                <>
                  <span aria-hidden="true" className="mx-3 inline-block h-1 w-1 -translate-y-0.5 rounded-full" style={{ background: pal.accent }} />
                  <InlineText as="span" value={props.role ?? ""} onUpdate={field("role")} />
                </>
              )}
            </p>
          )}
        </div>

        <div className={cn("mt-16 grid grid-cols-2 lg:mt-20", cols)} style={{ borderTop: `1px solid ${pal.hairline}`, borderBottom: `1px solid ${pal.hairline}` }}>
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-2 px-4 py-9 text-center" style={{ borderLeft: i > 0 ? `1px solid ${pal.hairline}` : "none" }}>
              <div className="tabular-nums" style={{ fontFamily: INVITE_NUMBERS, fontWeight: 400, fontSize: "clamp(2.4rem, 4.5vw, 3.6rem)", letterSpacing: "-0.04em", lineHeight: 1 }}>
                {updateStat ? (
                  <InlineText as="span" value={s.value} onUpdate={(v) => updateStat(i, { value: v })} />
                ) : (
                  <StatCounter value={s.value} />
                )}
              </div>
              <p className="max-w-[22ch] text-xs leading-relaxed" style={{ color: pal.muted }}>
                <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} multiline />
              </p>
            </div>
          ))}
        </div>

        {(logos.length > 0 || props.logosLabel || isEditor) && (
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {(props.logosLabel || isEditor) && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em]" style={{ color: pal.faint }}>
                <InlineText as="span" value={props.logosLabel ?? ""} onUpdate={field("logosLabel")} />
              </p>
            )}
            {logos.map((l, i) => (
              <span key={i} className="text-base" style={{ fontFamily: INVITE_DISPLAY, opacity: 0.75 }}>{l.name}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
