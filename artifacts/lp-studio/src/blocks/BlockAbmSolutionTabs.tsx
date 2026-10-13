import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { BlendMedia, type MediaPlayMode } from "@/lib/glow-media";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, AbmArrowLink, anchorClick, displayStyle, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { AbmCtaButtons, ABM_CTA_DEFAULTS, type AbmCtaProps } from "./abm/AbmCta";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Solution Tabs — type "abm-solution-tabs"
 *
 * "Connect all your projects and people in a single solution": a centered
 * headline with an arrow link, a row of tab chips (quiet stone chips, the
 * active one lifts to white with an accent underline), and the active panel —
 * a title, a paragraph, a bullet list and the CTA pair on the left, a product
 * screenshot or clip on the right.
 * -------------------------------------------------------------------------- */

export interface AbmSolutionTab {
  label: string;
  title: string;
  body?: string;
  bullets?: string[];
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  /** Nested clip — safe from Page CTA aliasing on an item. */
  videoUrl?: string;
}

export interface AbmSolutionTabsBlockProps extends AbmCtaProps, AbmStyleProps {
  headline?: string;
  subheadline?: string;
  /** Arrow text link under the headline. Deliberately not a CTA alias. */
  linkText?: string;
  linkUrl?: string;
  tabs: AbmSolutionTab[];
  mediaPlayMode?: MediaPlayMode;
  anchorId?: string;
}

interface Props {
  props: AbmSolutionTabsBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: AbmSolutionTabsBlockProps) => void;
}

export const ABM_SOLUTION_TABS_DEFAULT_PROPS: AbmSolutionTabsBlockProps = {
  ...ABM_CTA_DEFAULTS,
  headline: "Connect all your projects and people\nin a single solution",
  subheadline: "",
  linkText: "Contact your account team",
  linkUrl: "#team",
  tabs: [
    {
      label: "Change management",
      title: "Get paid for the work you do",
      body: "Bring change management to the field, facilitating faster approvals, more accurate communication and eliminating the need to proceed at risk.",
      bullets: [
        "Standardize change management processes across your business",
        "Capture and manage financial risk and opportunities in one connected place",
        "Make communication more transparent, open and honest",
        "Create one source of information for collaborative decision making",
        "Empower teams to manage change as it occurs on site",
      ],
      imageUrl: "",
      imageAlt: "",
    },
    {
      label: "Quality management",
      title: "Catch issues before they become rework",
      body: "Standardize inspections and daily logs so every site runs the same playbook and problems surface while they are still cheap to fix.",
      bullets: ["Consistent inspection templates across every program", "Real-time visibility into open items and owners", "A clean audit trail for every decision"],
    },
    {
      label: "Risk management",
      title: "See risk early, everywhere",
      body: "Connect field observations, incidents and schedule impacts so leadership sees exposure across the portfolio, not one project at a time.",
      bullets: ["Portfolio-wide risk dashboards", "Incident capture from any device", "Trend reporting by region and segment"],
    },
    {
      label: "Financial management",
      title: "Real-time cost certainty",
      body: "Budgets, commitments and forecasts in one connected ledger so finance and operations work from the same numbers.",
      bullets: ["Live budget-to-actual by program", "Commitments and change orders in one flow", "Forecasts leadership can trust"],
    },
  ],
  ctaText: "Contact your account team",
  ctaUrl: "#team",
  mediaPlayMode: "inview",
  anchorId: "solutions",
  backgroundStyle: "white",
};

export function BlockAbmSolutionTabs({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const tabs = props.tabs && props.tabs.length > 0 ? props.tabs : ABM_SOLUTION_TABS_DEFAULT_PROPS.tabs;
  const [active, setActive] = useState(0);
  useEffect(() => { if (active >= tabs.length) setActive(0); }, [tabs.length, active]);
  const tab = tabs[Math.min(active, tabs.length - 1)];

  const field = (key: keyof AbmSolutionTabsBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmSolutionTabsBlockProps[typeof key] }) : undefined;
  const label = onFieldChange ? (key: "ctaText" | "ctaSecondaryText", v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const updateTab = onFieldChange
    ? (i: number, patch: Partial<AbmSolutionTab>) => onFieldChange({ ...props, tabs: tabs.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) })
    : undefined;
  const updateBullet = updateTab
    ? (i: number, b: number, v: string) => updateTab(i, { bullets: (tabs[i].bullets ?? []).map((x, idx) => (idx === b ? v : x)) })
    : undefined;

  const reveal = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const chipInk = pal.muted;
  const activeIdx = Math.min(active, tabs.length - 1);

  return (
    <section id={props.anchorId || undefined} className="abm-solution-tabs relative overflow-hidden" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      <div className={cn(ABM_CONTAINER, "py-20 lg:py-28")}>
        <motion.div {...reveal(0)} className="mx-auto flex max-w-[940px] flex-col items-center text-center">
          <h2 className="whitespace-pre-line" style={displayStyle("clamp(1.9rem, 3.5vw, 2.75rem)", pal.heading)}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </h2>
          {(props.subheadline || isEditor) && (
            <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </p>
          )}
          {(props.linkText || isEditor) && (
            <AbmArrowLink href={props.linkUrl} onClick={anchorClick(props.linkUrl)} color={pal.accent} className="mt-4">
              <InlineText as="span" value={props.linkText ?? ""} onUpdate={field("linkText")} />
            </AbmArrowLink>
          )}
        </motion.div>

        {/* Tab chips */}
        <motion.div {...reveal(0.06)} className="mt-12 -mx-6 overflow-x-auto px-6 lg:mx-0 lg:px-0" role="tablist" aria-label="Solutions">
          <div className="flex min-w-max gap-2 lg:grid lg:min-w-0" style={{ gridTemplateColumns: `repeat(${Math.max(1, tabs.length)}, minmax(0, 1fr))` }}>
            {tabs.map((t, i) => {
              const on = i === activeIdx;
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(i)}
                  className="relative min-h-[64px] rounded-t-lg px-5 py-3 text-center text-[14px] font-semibold leading-snug transition-colors"
                  style={{
                    background: on ? pal.card : pal.panel,
                    color: on ? pal.heading : chipInk,
                    boxShadow: on ? `inset 0 -3px 0 ${pal.accentDeco}` : "none",
                  }}
                >
                  <InlineText as="span" value={t.label} onUpdate={updateTab ? (v) => updateTab(i, { label: v }) : undefined} />
                </button>
              );
            })}
          </div>
          <div aria-hidden className="h-px w-full" style={{ background: pal.hairline }} />
        </motion.div>

        {/* Active panel */}
        <div key={activeIdx} className="mt-12 grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14" role="tabpanel">
          <div className="lg:col-span-6">
            <h3 className="text-[26px] font-semibold leading-tight" style={{ color: pal.heading, letterSpacing: "-0.015em", fontFamily: ABM_BODY }}>
              <InlineText as="span" value={tab.title} onUpdate={updateTab ? (v) => updateTab(activeIdx, { title: v }) : undefined} />
            </h3>
            {(tab.body || isEditor) && (
              <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed" style={{ color: pal.muted }}>
                <InlineText as="span" value={tab.body ?? ""} onUpdate={updateTab ? (v) => updateTab(activeIdx, { body: v }) : undefined} multiline />
              </p>
            )}
            {(tab.bullets?.length ?? 0) > 0 && (
              <ul className="mt-6 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-relaxed" style={{ color: pal.text }}>
                {(tab.bullets ?? []).map((b, bi) => (
                  <li key={bi}>
                    <InlineText as="span" value={b} onUpdate={updateBullet ? (v) => updateBullet(activeIdx, bi, v) : undefined} />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-9">
              <AbmCtaButtons props={props} brand={brand} palette={pal} pageId={pageId} variantId={variantId} onCtaClick={onCtaClick} onLabelChange={label} source="abm-solution-tabs" />
            </div>
          </div>
          <div className="lg:col-span-6">
            <BlendMedia
              videoUrl={tab.videoUrl}
              imageUrl={tab.imageUrl}
              imageAlt={tab.imageAlt}
              imageFocal={tab.imageFocal}
              blend="none"
              edgeFade={false}
              aspect="16/9"
              fit="cover"
              playMode={props.mediaPlayMode ?? "inview"}
              palette={{ dark: pal.dark, accent: pal.accentDeco, glow: pal.accentDeco }}
              placeholder="sheet"
              className="w-full rounded-[6px]"
              style={{ boxShadow: `0 24px 48px -28px rgba(0,0,0,0.35), 0 0 0 1px ${pal.hairline}` }}
              title={tab.imageAlt || tab.title}
              onImageUpdate={updateTab ? (v) => updateTab(activeIdx, { imageUrl: v }) : undefined}
              onAltUpdate={updateTab ? (v) => updateTab(activeIdx, { imageAlt: v }) : undefined}
              onFocalUpdate={updateTab ? (v) => updateTab(activeIdx, { imageFocal: v }) : undefined}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
