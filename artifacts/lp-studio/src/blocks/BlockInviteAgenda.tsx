import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, INVITE_DISPLAY, Kicker, displayStyle, resolveInvitePalette } from "@/lib/invite-theme";

/* ----------------------------------------------------------------------------
 * Invite Agenda — type "invite-agenda"
 *
 * "THE AGENDA": centered kicker + headline + sub, then hairline-separated rows
 * with a letter-spaced label on the left (DAY ONE → "MINUTES 0–10") and an
 * italic display title with one or two short paragraphs on the right. Sets
 * expectations for the call — the single biggest no-show reducer.
 * -------------------------------------------------------------------------- */

export interface InviteAgendaItem {
  label: string;
  title: string;
  body: string;
  /** Optional second paragraph. */
  body2?: string;
}

export interface InviteAgendaBlockProps {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  items: InviteAgendaItem[];
  anchorId?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: InviteAgendaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: InviteAgendaBlockProps) => void;
}

export const INVITE_AGENDA_DEFAULT_PROPS: InviteAgendaBlockProps = {
  kicker: "The agenda",
  headline: "Thirty minutes, three outcomes",
  subheadline: "A working session, not a walkthrough. Every block ends with something you can use.",
  items: [
    { label: "Minutes 0–10", title: "Map the opportunity", body: "We walk through where you are today and put numbers on the gap — what it costs, where it hides, and what closing it would be worth." },
    { label: "Minutes 10–20", title: "See it on real data", body: "The platform on a live account, not a slide: the views your leadership team would actually use on a Monday morning." },
    { label: "Minutes 20–30", title: "Scope the proof", body: "Pick a small set of locations, agree the baseline and the success criteria, and leave with a plan your whole team can say yes to." },
  ],
  anchorId: "agenda",
};

export function BlockInviteAgenda({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;
  const items = props.items && props.items.length > 0 ? props.items : INVITE_AGENDA_DEFAULT_PROPS.items;

  const field = (key: keyof InviteAgendaBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as InviteAgendaBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (i: number, patch: Partial<InviteAgendaItem>) => onFieldChange({ ...props, items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) })
    : undefined;

  return (
    <section id={props.anchorId || "agenda"} className="relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY }}>
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

        <ol className="mx-auto mt-14 max-w-4xl lg:mt-20" style={{ borderTop: `1px solid ${pal.hairline}` }}>
          {items.map((it, i) => (
            <motion.li
              key={i}
              initial={reduced ? false : anim({ opacity: 0, y: 14 })}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: Math.min(i * 0.06, 0.3), ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 gap-4 py-10 md:grid-cols-12 md:gap-8 lg:py-12"
              style={{ borderBottom: `1px solid ${pal.hairline}` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] md:col-span-3 md:pt-2" style={{ color: pal.faint }}>
                <InlineText as="span" value={it.label} onUpdate={updateItem ? (v) => updateItem(i, { label: v }) : undefined} />
              </p>
              <div className="md:col-span-9 flex flex-col gap-4">
                <h3 className="text-2xl lg:text-[1.9rem]" style={{ fontFamily: INVITE_DISPLAY, fontStyle: "italic", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  <InlineText as="span" value={it.title} onUpdate={updateItem ? (v) => updateItem(i, { title: v }) : undefined} />
                </h3>
                <p className="max-w-[62ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
                  <InlineText as="span" value={it.body} onUpdate={updateItem ? (v) => updateItem(i, { body: v }) : undefined} multiline />
                </p>
                {(it.body2 || isEditor) && (
                  <>
                    <span aria-hidden="true" className="block h-px w-6" style={{ background: pal.hairline }} />
                    <p className="max-w-[62ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
                      <InlineText as="span" value={it.body2 ?? ""} onUpdate={updateItem ? (v) => updateItem(i, { body2: v }) : undefined} multiline />
                    </p>
                  </>
                )}
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
