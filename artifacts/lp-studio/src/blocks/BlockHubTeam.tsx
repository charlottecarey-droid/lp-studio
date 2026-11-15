import { motion, useReducedMotion } from "framer-motion";
import { Mail, Phone, User } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { HUB_BODY, HUB_CSS, HubKicker, hubDisplayStyle, resolveHubPalette, type HubStyleProps } from "@/lib/hub-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Content Hub Team — type "hub-team"
 *
 * The team directory of a partner / launch room: named people on both sides,
 * in groups ("Your team at <us>" / "Your team"), each with a role, what they
 * own, and how to reach them. Replaces the "who do I ask?" tab of a shared
 * workbook. A person without a photo gets an initials disc; an email renders
 * as a mailto link, a phone as a tel link — nothing is invented when blank.
 *
 * Same presets / palette as the rest of the family.
 * -------------------------------------------------------------------------- */

export interface HubTeamMember {
  name: string;
  role?: string;
  /** One line on what this person owns ("Day-to-day partner: reviews, adoption"). */
  owns?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
}

export interface HubTeamGroup {
  title: string;
  members: HubTeamMember[];
}

export interface HubTeamBlockProps extends HubStyleProps {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  groups: HubTeamGroup[];
  anchorId?: string;
}

interface Props {
  props: HubTeamBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HubTeamBlockProps) => void;
}

export const HUB_TEAM_DEFAULT_PROPS: HubTeamBlockProps = {
  kicker: "Your team",
  headline: "Named people, on both sides.",
  subheadline: "Who owns what, and when to reach them. No shared inboxes.",
  anchorId: "team",
  groups: [
    {
      title: "Our team",
      members: [
        { name: "Alex Morgan", role: "Account lead", owns: "Partnership strategy and your executive relationship.", email: "alex@example.com" },
        { name: "Jordan Lee", role: "Account manager", owns: "Your day-to-day partner: reviews, adoption and planning.", email: "jordan@example.com" },
        { name: "Sam Patel", role: "Implementation", owns: "Training schedules and go-live for every location.", email: "sam@example.com" },
      ],
    },
    {
      title: "Your team",
      members: [
        { name: "Executive sponsor", role: "Leadership", owns: "Sets the direction and clears escalations." },
        { name: "Operations lead", role: "Operations", owns: "Runs your side of the plan and logistics." },
      ],
    },
  ],
};

/** Up to two initials from a name ("Jordan Lee" → "JL"; "Operations lead" → "OL").
 *  Blank for a placeholder like "[Name]" — the disc shows a person glyph instead. */
export function memberInitials(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  if (!words.length) return "";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function BlockHubTeam({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveHubPalette(props, brand, "library");
  const t = pal.t;
  const isEditor = !!onFieldChange;
  const groups = (props.groups ?? []).slice(0, 3).filter((g) => isEditor || (g.members ?? []).length > 0);
  const cols = groups.length >= 3 ? "lg:grid-cols-3" : groups.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";

  const field = (key: keyof HubTeamBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as HubTeamBlockProps[typeof key] }) : undefined;
  const updateGroup = onFieldChange
    ? (gi: number, patch: Partial<HubTeamGroup>) => onFieldChange({ ...props, groups: (props.groups ?? []).map((g, idx) => (idx === gi ? { ...g, ...patch } : g)) })
    : undefined;
  const updateMember = onFieldChange
    ? (gi: number, mi: number, patch: Partial<HubTeamMember>) =>
        onFieldChange({
          ...props,
          groups: (props.groups ?? []).map((g, idx) => (idx === gi ? { ...g, members: g.members.map((m, mIdx) => (mIdx === mi ? { ...m, ...patch } : m)) } : g)),
        })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 18 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const cardStyle: React.CSSProperties =
    t.cardStyle === "flat"
      ? { background: pal.cardTint, borderRadius: t.cardRadius + 6 }
      : { background: pal.card, border: `1px solid ${pal.hairline}`, borderRadius: t.cardRadius + 6, boxShadow: pal.isDark ? "none" : "0 1px 2px rgba(11,11,15,0.04)" };

  return (
    <section id={props.anchorId || undefined} className="hub-team relative" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY }}>
      <style>{HUB_CSS}</style>
      <div className="mx-auto w-full max-w-page px-6 py-16 lg:px-10 lg:py-24">
        {(props.kicker || props.headline || props.subheadline || isEditor) && (
          <div className="mb-10 max-w-[680px] lg:mb-14">
            {(props.kicker || isEditor) && (
              <div className="mb-4">
                <HubKicker palette={pal}>
                  <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
                </HubKicker>
              </div>
            )}
            {(props.headline || isEditor) && (
              <h2 className="whitespace-pre-line" style={hubDisplayStyle(pal, "clamp(2rem, 4vw, 3.4rem)")}>
                <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
              </h2>
            )}
            {(props.subheadline || isEditor) && (
              <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed lg:text-[17px]" style={{ color: pal.muted }}>
                <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </p>
            )}
          </div>
        )}

        <div className={cn("grid gap-5 lg:gap-6", cols)}>
          {groups.map((g, gi) => (
            <motion.div key={gi} {...reveal(gi * 0.08)} className="hub-card p-7 lg:p-9" style={cardStyle} data-hub-team-group>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.accent }}>
                <InlineText as="span" value={g.title} onUpdate={updateGroup ? (v) => updateGroup(gi, { title: v }) : undefined} />
              </p>
              <ul className="list-none p-0">
                {(g.members ?? []).map((m, mi) => {
                  const photo = (m.photoUrl ?? "").trim();
                  const email = (m.email ?? "").trim();
                  const phone = (m.phone ?? "").trim();
                  return (
                    <li key={mi} className="flex items-start gap-4 py-5" style={mi > 0 ? { borderTop: `1px solid ${pal.hairline}` } : undefined} data-hub-member>
                      {photo ? (
                        <img src={photo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" loading="lazy" />
                      ) : (
                        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold" style={{ background: pal.cardTint, color: pal.heading, border: `1px solid ${pal.hairline}` }}>
                          {memberInitials(m.name) || <User className="h-5 w-5" style={{ opacity: 0.55 }} />}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <p className="text-[16px] font-semibold" style={{ color: pal.text }}>
                            <InlineText as="span" value={m.name} onUpdate={updateMember ? (v) => updateMember(gi, mi, { name: v }) : undefined} />
                          </p>
                          {(m.role || isEditor) && (
                            <p className="text-[13px]" style={{ color: pal.muted }}>
                              <InlineText as="span" value={m.role ?? ""} onUpdate={updateMember ? (v) => updateMember(gi, mi, { role: v }) : undefined} />
                            </p>
                          )}
                        </div>
                        {(m.owns || isEditor) && (
                          <p className="mt-1 text-[14.5px] leading-relaxed" style={{ color: pal.muted }}>
                            <InlineText as="span" value={m.owns ?? ""} onUpdate={updateMember ? (v) => updateMember(gi, mi, { owns: v }) : undefined} multiline />
                          </p>
                        )}
                        {(email || phone) && (
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] font-medium">
                            {email && (
                              <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 no-underline hover:underline" style={{ color: pal.accent }} onClick={isEditor ? (e) => e.preventDefault() : undefined}>
                                <Mail className="h-3.5 w-3.5" aria-hidden />
                                {email}
                              </a>
                            )}
                            {phone && (
                              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1.5 no-underline hover:underline" style={{ color: pal.accent }} onClick={isEditor ? (e) => e.preventDefault() : undefined}>
                                <Phone className="h-3.5 w-3.5" aria-hidden />
                                {phone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
