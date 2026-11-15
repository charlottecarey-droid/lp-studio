import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { HUB_BODY, HUB_CSS, HubKicker, hubDisplayStyle, resolveHubPalette, type HubPalette, type HubStyleProps } from "@/lib/hub-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Content Hub Plan — type "hub-plan"
 *
 * The shared plan of a partner / launch room: the phases of a rollout
 * ("Days 1–30 · Foundation & launch") each with what happens and what success
 * looks like, then the mutual action plan under it — swimlanes (ours /
 * theirs) of task · owner · due · status rows. The customer-facing subset of
 * an internal rollout tracker: the people running the launch keep the
 * statuses current in the builder, the customer reads one page instead of a
 * spreadsheet.
 *
 * Read-only for visitors. Same presets / palette as the rest of the family.
 * -------------------------------------------------------------------------- */

export type HubPhaseStatus = "done" | "current" | "upcoming";
export type HubTaskStatus = "done" | "on-track" | "at-risk" | "not-started";

export interface HubPlanPhase {
  label?: string;
  title: string;
  items?: string[];
  success?: string;
  status?: HubPhaseStatus;
}

export interface HubPlanTask {
  task: string;
  owner?: string;
  due?: string;
  status?: HubTaskStatus;
}

export interface HubPlanLane {
  title: string;
  rows: HubPlanTask[];
}

export interface HubPlanBlockProps extends HubStyleProps {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  phases: HubPlanPhase[];
  /** Label above each phase's success line. */
  successLabel?: string;
  planTitle?: string;
  planNote?: string;
  lanes?: HubPlanLane[];
  anchorId?: string;
}

interface Props {
  props: HubPlanBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: HubPlanBlockProps) => void;
}

export const HUB_TASK_STATUS_LABEL: Record<HubTaskStatus, string> = {
  done: "Done",
  "on-track": "On track",
  "at-risk": "Needs attention",
  "not-started": "Not started",
};

export const HUB_PLAN_DEFAULT_PROPS: HubPlanBlockProps = {
  kicker: "The plan",
  headline: "What happens next, week by week.",
  subheadline: "One plan we run together. Every phase ends with a shared checkpoint, so nothing moves forward on assumption.",
  successLabel: "Success looks like",
  anchorId: "plan",
  phases: [
    {
      label: "Days 1–30",
      title: "Foundation & launch",
      items: ["Kickoff with both teams", "Shared action plan signed off", "First locations trained"],
      success: "First wave of training on the calendar.",
      status: "current",
    },
    {
      label: "Days 31–60",
      title: "Momentum",
      items: ["Early wins reviewed with leadership", "Reporting live for every location", "Next wave scheduled"],
      success: "First wave live and active.",
      status: "upcoming",
    },
    {
      label: "Days 61–90",
      title: "Scale & review",
      items: ["Results reviewed from your own data", "Your first success story", "Ongoing review cadence set"],
      success: "A plan for the next two quarters.",
      status: "upcoming",
    },
  ],
  planTitle: "Shared action plan",
  planNote: "Reviewed together at every check-in.",
  lanes: [
    {
      title: "Our deliverables",
      rows: [
        { task: "Kickoff and success metrics", owner: "Account lead", due: "Week 1", status: "done" },
        { task: "Welcome kits shipped to every location", owner: "Marketing", due: "Week 2", status: "on-track" },
        { task: "First-wave training scheduled", owner: "Implementation", due: "Week 3", status: "on-track" },
      ],
    },
    {
      title: "Your deliverables",
      rows: [
        { task: "Internal announcement to your network", owner: "Communications", due: "Week 2", status: "on-track" },
        { task: "Regional leader kickoff booked", owner: "Operations", due: "Week 3", status: "not-started" },
      ],
    },
  ],
};

const rgba = (hexColor: string, a: number) => {
  const h = /^#[0-9a-f]{6}$/i.test(hexColor) ? hexColor : "#888888";
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Chip colours per status: done = solid accent, on track = accent outline, needs attention = amber, not started = quiet. */
export function taskChipStyle(status: HubTaskStatus, pal: HubPalette): React.CSSProperties {
  if (status === "done") return { background: pal.accentFill, color: pal.onAccentFill, border: "1px solid transparent" };
  if (status === "on-track") return { background: "transparent", color: pal.accent, border: `1px solid ${rgba(pal.accent, 0.45)}` };
  if (status === "at-risk") {
    const amber = pal.isDark ? "#FBBF24" : "#9A4B00";
    return { background: rgba(amber, pal.isDark ? 0.14 : 0.08), color: amber, border: `1px solid ${rgba(amber, 0.4)}` };
  }
  return { background: "transparent", color: pal.muted, border: `1px solid ${pal.hairline}` };
}

const TASK_STATUSES: HubTaskStatus[] = ["done", "on-track", "at-risk", "not-started"];
export function resolveTaskStatus(s: string | undefined): HubTaskStatus {
  return TASK_STATUSES.includes(s as HubTaskStatus) ? (s as HubTaskStatus) : "not-started";
}

export function BlockHubPlan({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveHubPalette(props, brand, "library");
  const t = pal.t;
  const isEditor = !!onFieldChange;
  const phases = (props.phases ?? []).slice(0, 6);
  const lanes = (props.lanes ?? []).filter((l) => isEditor || (l.rows ?? []).length > 0);
  const cols = phases.length >= 4 ? "lg:grid-cols-4" : phases.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  const field = (key: keyof HubPlanBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as HubPlanBlockProps[typeof key] }) : undefined;
  const updatePhase = onFieldChange
    ? (i: number, patch: Partial<HubPlanPhase>) => onFieldChange({ ...props, phases: (props.phases ?? []).map((p, idx) => (idx === i ? { ...p, ...patch } : p)) })
    : undefined;
  const updateTask = onFieldChange
    ? (li: number, ri: number, patch: Partial<HubPlanTask>) =>
        onFieldChange({
          ...props,
          lanes: (props.lanes ?? []).map((l, idx) => (idx === li ? { ...l, rows: l.rows.map((r, rIdx) => (rIdx === ri ? { ...r, ...patch } : r)) } : l)),
        })
    : undefined;
  const updateLane = onFieldChange
    ? (li: number, patch: Partial<HubPlanLane>) => onFieldChange({ ...props, lanes: (props.lanes ?? []).map((l, idx) => (idx === li ? { ...l, ...patch } : l)) })
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
    <section id={props.anchorId || undefined} className="hub-plan relative" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY }}>
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

        {phases.length > 0 && (
          <ol className={cn("grid list-none gap-5 p-0 lg:gap-6", cols)}>
            {phases.map((p, i) => {
              const status: HubPhaseStatus = p.status === "done" || p.status === "current" ? p.status : "upcoming";
              const lit = status !== "upcoming";
              return (
                <motion.li key={i} {...reveal(i * 0.08)} className="hub-card relative flex flex-col p-7 lg:p-8" style={cardStyle} data-hub-phase={status}>
                  <div className="mb-5 flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                      style={lit ? { background: pal.accentFill, color: pal.onAccentFill } : { border: `1px solid ${pal.hairline}`, color: pal.muted }}
                    >
                      {status === "done" ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    {(p.label || isEditor) && (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.accent }}>
                        <InlineText as="span" value={p.label ?? ""} onUpdate={updatePhase ? (v) => updatePhase(i, { label: v }) : undefined} />
                      </p>
                    )}
                    {status === "current" && (
                      <span className="ml-auto rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={taskChipStyle("on-track", pal)}>
                        Now
                      </span>
                    )}
                  </div>
                  <h3 style={hubDisplayStyle(pal, "clamp(1.35rem, 2vw, 1.75rem)")}>
                    <InlineText as="span" value={p.title} onUpdate={updatePhase ? (v) => updatePhase(i, { title: v }) : undefined} />
                  </h3>
                  {(p.items?.length ?? 0) > 0 && (
                    <ul className="mt-4 list-none space-y-2 p-0 text-[14.5px]" style={{ color: pal.text }}>
                      {(p.items ?? []).map((b, bi) => (
                        <li key={bi} className="flex items-start gap-3">
                          <span aria-hidden="true" className="mt-[9px] block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: pal.accentFill }} />
                          <InlineText as="span" value={b} onUpdate={updatePhase ? (v) => updatePhase(i, { items: (p.items ?? []).map((x, xi) => (xi === bi ? v : x)) }) : undefined} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {(p.success || isEditor) && (
                    <div className="mt-auto pt-6">
                      <div className="pt-4" style={{ borderTop: `1px solid ${pal.hairline}` }}>
                        {props.successLabel && (
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: pal.muted }}>
                            {props.successLabel}
                          </p>
                        )}
                        <p className="text-[14.5px] leading-relaxed" style={{ color: pal.text }}>
                          <InlineText as="span" value={p.success ?? ""} onUpdate={updatePhase ? (v) => updatePhase(i, { success: v }) : undefined} multiline />
                        </p>
                      </div>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </ol>
        )}

        {lanes.length > 0 && (
          <motion.div {...reveal(0.1)} className="mt-12 overflow-hidden lg:mt-16" style={cardStyle} data-hub-action-plan>
            {(props.planTitle || props.planNote || isEditor) && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 pb-2 pt-6 lg:px-9 lg:pt-8">
                <h3 style={hubDisplayStyle(pal, "clamp(1.35rem, 2vw, 1.75rem)")}>
                  <InlineText as="span" value={props.planTitle ?? ""} onUpdate={field("planTitle")} />
                </h3>
                {(props.planNote || isEditor) && (
                  <p className="text-[13.5px]" style={{ color: pal.muted }}>
                    <InlineText as="span" value={props.planNote ?? ""} onUpdate={field("planNote")} />
                  </p>
                )}
              </div>
            )}
            {(props.lanes ?? []).map((lane, li) =>
              !isEditor && (lane.rows ?? []).length === 0 ? null : (
                <div key={li} className="px-6 pb-4 pt-5 lg:px-9" data-hub-lane>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.accent }}>
                    <InlineText as="span" value={lane.title} onUpdate={updateLane ? (v) => updateLane(li, { title: v }) : undefined} />
                  </p>
                  <ul className="list-none p-0">
                    {(lane.rows ?? []).map((r, ri) => {
                      const status = resolveTaskStatus(r.status);
                      return (
                        <li
                          key={ri}
                          className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[minmax(0,1fr)_170px_110px_140px]"
                          style={{ borderTop: `1px solid ${pal.hairline}` }}
                          data-hub-task={status}
                        >
                          <span className="text-[15px] font-medium" style={{ color: pal.text }}>
                            <InlineText as="span" value={r.task} onUpdate={updateTask ? (v) => updateTask(li, ri, { task: v }) : undefined} />
                          </span>
                          <span className="order-3 text-[13.5px] sm:order-none" style={{ color: pal.muted }}>
                            <InlineText as="span" value={r.owner ?? ""} onUpdate={updateTask ? (v) => updateTask(li, ri, { owner: v }) : undefined} />
                          </span>
                          <span className="order-4 text-right text-[13.5px] sm:order-none sm:text-left" style={{ color: pal.muted }}>
                            <InlineText as="span" value={r.due ?? ""} onUpdate={updateTask ? (v) => updateTask(li, ri, { due: v }) : undefined} />
                          </span>
                          <span className="justify-self-end">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={taskChipStyle(status, pal)}>
                              {status === "done" && <Check className="h-3 w-3" aria-hidden />}
                              {HUB_TASK_STATUS_LABEL[status]}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
            )}
            <div className="h-3" />
          </motion.div>
        )}
      </div>
    </section>
  );
}
