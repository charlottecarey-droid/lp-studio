import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, INVITE_DISPLAY, Kicker, displayStyle, resolveInvitePalette } from "@/lib/invite-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Invite Details — type "invite-details"
 *
 * "THE DETAILS / What to expect": a centered kicker, headline and one-line
 * sub, then a hairline-divided row of 3–4 facts, each with a tiny rule, a
 * letter-spaced label, a large italic display value and a caption. The event
 * page's When / Where / Cost, repurposed for a demo: Format / Who / Cost / You
 * leave with.
 * -------------------------------------------------------------------------- */

export interface InviteDetailItem {
  label: string;
  value: string;
  caption?: string;
}

export interface InviteDetailsBlockProps {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  items: InviteDetailItem[];
  /** HTML id so hero links can jump here. Default "details". */
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: InviteDetailsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: InviteDetailsBlockProps) => void;
}

export const INVITE_DETAILS_DEFAULT_PROPS: InviteDetailsBlockProps = {
  kicker: "The details",
  headline: "What to expect",
  subheadline: "Everything is prepared in advance. You bring the questions; we bring the numbers.",
  items: [
    { label: "Format", value: "Video call", caption: "Thirty minutes, on your calendar" },
    { label: "Who", value: "Senior team", caption: "The people who run pilots, not a hand-off" },
    { label: "Cost", value: "Nothing", caption: "No commitment, no preparation required" },
    { label: "You leave with", value: "A plan", caption: "A sized opportunity and a pilot scope" },
  ],
  anchorId: "details",
};

export function BlockInviteDetails({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;
  const items = props.items && props.items.length > 0 ? props.items : INVITE_DETAILS_DEFAULT_PROPS.items;

  const field = (key: keyof InviteDetailsBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as InviteDetailsBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<InviteDetailItem>) => onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  const cols = items.length >= 4 ? "md:grid-cols-4" : items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <section id={props.anchorId || "details"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
      <div className="mx-auto w-full max-w-[1240px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          {(props.kicker || isEditor) && <Kicker palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></Kicker>}
          {(props.headline || isEditor) && (
            <h2 style={displayStyle("clamp(2.2rem, 4.6vw, 3.6rem)")}>
              <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            </h2>
          )}
          {(props.subheadline || isEditor) && (
            <p className="max-w-[48ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
        </div>

        <div className={cn("mt-14 grid grid-cols-1 lg:mt-20", cols)} style={{ borderTop: `1px solid ${pal.hairline}`, borderBottom: `1px solid ${pal.hairline}` }}>
          {items.map((it, i) => (
            <motion.div
              key={i}
              initial={reduced ? false : anim({ opacity: 0, y: 14 })}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: Math.min(i * 0.08, 0.32), ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-3 px-6 py-10 text-center"
              style={{ borderLeft: i > 0 ? `1px solid ${pal.hairline}` : "none" }}
            >
              <span aria-hidden="true" className="block h-px w-6" style={{ background: pal.accent, opacity: 0.8 }} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em]" style={{ color: pal.faint }}>
                <InlineText as="span" value={it.label} onUpdate={updateItem ? (v) => updateItem(i, { label: v }) : undefined} />
              </p>
              <p className="text-2xl lg:text-[1.75rem]" style={{ fontFamily: INVITE_DISPLAY, fontStyle: "italic", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                <InlineText as="span" value={it.value} onUpdate={updateItem ? (v) => updateItem(i, { value: v }) : undefined} />
              </p>
              {(it.caption || isEditor) && (
                <p className="text-xs leading-relaxed" style={{ color: pal.muted }}>
                  <InlineText as="span" value={it.caption ?? ""} onUpdate={updateItem ? (v) => updateItem(i, { caption: v }) : undefined} multiline />
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
