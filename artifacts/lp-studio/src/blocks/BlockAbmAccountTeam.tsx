import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, AbmArrowLink, anchorClick, displayStyle, initialsOf, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Account Team — type "abm-account-team"
 *
 * "Meet your account team": a centered headline and a row of up to eight
 * people — a round headshot (initials disc when there is no photo), the name,
 * an uppercase tracked title and the company line, plus an optional per-person
 * link (calendar, email). The booking anchor for the hero's "Contact your
 * account team" CTA.
 * -------------------------------------------------------------------------- */

export interface AbmTeamMember {
  name: string;
  title?: string;
  company?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Per-person link (scheduling page, mailto:). Not a CTA alias. */
  linkText?: string;
  linkUrl?: string;
}

export interface AbmAccountTeamBlockProps extends AbmStyleProps {
  headline?: string;
  subheadline?: string;
  members: AbmTeamMember[];
  /** Headshot diameter in px. Default 120. */
  headshotSize?: number;
  anchorId?: string;
}

interface Props {
  props: AbmAccountTeamBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: AbmAccountTeamBlockProps) => void;
}

export const ABM_ACCOUNT_TEAM_DEFAULT_PROPS: AbmAccountTeamBlockProps = {
  headline: "Meet your account team",
  subheadline: "",
  members: [
    { name: "Alex Rivera", title: "Strategic account executive", company: "" },
    { name: "Jordan Lee", title: "Customer success engineer", company: "" },
    { name: "Sam Patel", title: "Solutions engineer", company: "" },
    { name: "Morgan Chen", title: "Industry lead", company: "" },
    { name: "Taylor Brooks", title: "Inside sales representative", company: "" },
  ],
  headshotSize: 120,
  anchorId: "team",
  backgroundStyle: "white",
};

export function BlockAbmAccountTeam({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const members = (props.members ?? []).slice(0, 8);
  const size = Math.max(64, Math.min(200, props.headshotSize ?? 120));
  const company = brand.brandName || "";

  const field = (key: keyof AbmAccountTeamBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmAccountTeamBlockProps[typeof key] }) : undefined;
  const updateMember = onFieldChange
    ? (i: number, patch: Partial<AbmTeamMember>) => onFieldChange({ ...props, members: (props.members ?? []).map((m, idx) => (idx === i ? { ...m, ...patch } : m)) })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id={props.anchorId || undefined} className="abm-account-team relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "py-20 lg:py-24")}>
        <motion.div {...reveal(0)} className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 style={displayStyle("clamp(1.9rem, 3.4vw, 2.6rem)", pal.heading)}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} />
          </h2>
          {(props.subheadline || isEditor) && (
            <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
        </motion.div>

        <ul className="mt-14 flex flex-wrap items-start justify-center gap-x-6 gap-y-12 lg:gap-x-10">
          {members.map((m, i) => (
            <motion.li key={i} {...reveal(0.05 + i * 0.05)} className="flex flex-col items-center text-center" style={{ width: Math.max(size + 60, 180) }}>
              <div className="relative overflow-hidden rounded-full" style={{ width: size, height: size, background: pal.panel, boxShadow: `0 0 0 1px ${pal.hairline}` }} data-abm-headshot>
                {(m.imageUrl || isEditor) && (
                  <InlineImage
                    src={m.imageUrl ?? ""}
                    alt={m.imageAlt || m.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    wrapperClassName="absolute inset-0"
                    loading="lazy"
                    onUpdate={updateMember ? (v) => updateMember(i, { imageUrl: v }) : undefined}
                    onAltUpdate={updateMember ? (v) => updateMember(i, { imageAlt: v }) : undefined}
                  />
                )}
                {!m.imageUrl && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-semibold" style={{ color: pal.accent, fontSize: size * 0.3, letterSpacing: "0.02em" }} aria-hidden>
                    {initialsOf(m.name)}
                  </span>
                )}
              </div>
              <p className="mt-5 text-[17px] font-semibold leading-snug" style={{ color: pal.heading }}>
                <InlineText as="span" value={m.name} onUpdate={updateMember ? (v) => updateMember(i, { name: v }) : undefined} />
              </p>
              {(m.title || isEditor) && (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: pal.muted }}>
                  <InlineText as="span" value={m.title ?? ""} onUpdate={updateMember ? (v) => updateMember(i, { title: v }) : undefined} />
                </p>
              )}
              {(m.company || company || isEditor) && (
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: pal.muted }}>
                  <InlineText as="span" value={m.company || (isEditor ? "" : company)} onUpdate={updateMember ? (v) => updateMember(i, { company: v }) : undefined} />
                </p>
              )}
              {m.linkText && m.linkUrl && (
                <AbmArrowLink href={m.linkUrl} onClick={anchorClick(m.linkUrl)} color={pal.accent} className="mt-3 !text-[13px]">
                  {m.linkText}
                </AbmArrowLink>
              )}
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
