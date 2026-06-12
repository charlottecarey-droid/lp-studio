import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import { IconOrImage } from "@/lib/icon-value";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;

/* ----------------------------------------------------------------------------
 * Feature Tabs Showcase — type "feature-tabs-showcase"
 *
 * Interactive product showcase: a left rail of 3–5 feature tabs (title +
 * one-liner) and a right media panel rendered inside a glass browser frame.
 * The media crossfades + slides on tab switch (instant under reduced motion),
 * auto-advances every ~6s — pausing on hover/focus and stopping after a
 * manual selection — and the tab rail is fully keyboard-navigable with proper
 * tablist semantics. On mobile the tabs become a horizontal scroll-snap strip
 * above the media.
 * -------------------------------------------------------------------------- */

export interface FeatureTabItem {
  /** Short tab title (2–5 words). */
  title: string;
  /** One-line supporting copy shown under the title. */
  description?: string;
  /** Lucide icon name or image URL shown beside the tab title. */
  icon?: string;
  /** Screenshot / product image shown in the media panel for this tab. */
  imageUrl?: string;
  imageAlt?: string;
  /** Optional CSS object-position focal point, e.g. "50% 30%". */
  imageFocal?: string;
}

export interface FeatureTabsShowcaseBlockProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  /** "light" (default) or "dark" frosted-glass treatment. */
  theme?: "light" | "dark";
  /** Section background override (hex). Defaults per theme. */
  bgColor?: string;
  /** Accent override (hex). Defaults to the brand accent. */
  accentColor?: string;
  /** Auto-advance the active tab. Default true (disabled under
   *  prefers-reduced-motion and inside the builder). */
  autoAdvance?: boolean;
  /** Auto-advance interval in ms. Default 6000. */
  intervalMs?: number;
  /** Label shown in the browser frame's faux address bar, e.g. "app.acme.com". */
  frameLabel?: string;
  tabs: FeatureTabItem[];
}

interface Props {
  props: FeatureTabsShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeatureTabsShowcaseBlockProps) => void;
}

export const FEATURE_TABS_DEFAULT_PROPS: FeatureTabsShowcaseBlockProps = {
  eyebrow: "Product tour",
  headline: "See the work, not the busywork.",
  subheadline:
    "Four views, one source of truth. Switch between them without losing your place — or your data.",
  theme: "light",
  autoAdvance: true,
  intervalMs: 6000,
  frameLabel: "app.yourproduct.com",
  tabs: [
    {
      title: "Live dashboard",
      description: "Every metric that matters, updated the moment it changes.",
      icon: "LayoutDashboard",
      imageUrl:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1400&h=900&fit=crop",
      imageAlt: "Analytics dashboard with charts and key metrics",
    },
    {
      title: "Automations",
      description: "Build if-this-then-that flows in plain language.",
      icon: "Workflow",
      imageUrl:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1400&h=900&fit=crop",
      imageAlt: "Workflow builder interface on a laptop screen",
    },
    {
      title: "Team inbox",
      description: "Assign, comment, and resolve without leaving the thread.",
      icon: "Inbox",
      imageUrl:
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1400&h=900&fit=crop",
      imageAlt: "Team collaborating on shared work in an office",
    },
    {
      title: "Reports",
      description: "Board-ready summaries generated in one click.",
      icon: "BarChart3",
      imageUrl:
        "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=1400&h=900&fit=crop",
      imageAlt: "Report charts reviewed by a product team",
    },
  ],
};

export function BlockFeatureTabsShowcase({ props, brand, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const theme = props.theme ?? "light";

  const sectionBg = props.bgColor || (theme === "dark" ? "#0B0B11" : "#FFFFFF");
  const dark = relativeLuminance(sectionBg) < 0.35;
  const text = dark ? "#F6F7F9" : "#0B0B0F";
  const muted = dark ? "rgba(246,247,249,0.6)" : "rgba(11,11,15,0.6)";
  const accent = props.accentColor || brand.accentColor || "#3B82F6";
  const primary = brand.primaryColor || "#0f172a";
  const accentResolved = pickContrastingColor(accent, sectionBg, [primary], 3.0);
  const eyebrowColor = pickContrastingColor(accent, sectionBg, [primary, dark ? "#E2E8F0" : "#0f172a"], 4.5);

  const tabs =
    props.tabs && props.tabs.length > 0 ? props.tabs.slice(0, 5) : FEATURE_TABS_DEFAULT_PROPS.tabs;
  const intervalMs = Math.max(2500, props.intervalMs ?? 6000);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const safeActive = Math.min(active, tabs.length - 1);

  // Auto-advance: off under reduced motion, in the builder (it would fight
  // inline editing), after any manual selection, and while hovered/focused.
  const autoplay =
    (props.autoAdvance ?? true) &&
    !reduced &&
    !onFieldChange &&
    !interacted &&
    !paused &&
    tabs.length > 1;

  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => {
      setActive((a) => (a + 1) % tabs.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoplay, intervalMs, tabs.length]);

  const select = (i: number, manual: boolean) => {
    setActive(i);
    if (manual) setInteracted(true);
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (safeActive + 1) % tabs.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (safeActive - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
    tabRefs.current[next]?.focus();
  };

  const field = (key: keyof FeatureTabsShowcaseBlockProps) =>
    onFieldChange
      ? (v: string) => onFieldChange({ ...props, [key]: v as FeatureTabsShowcaseBlockProps[typeof key] })
      : undefined;
  const updateTab = onFieldChange
    ? (i: number, patch: Partial<FeatureTabItem>) =>
        onFieldChange({
          ...props,
          tabs: tabs.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
        })
    : undefined;

  const activeTab = tabs[safeActive];
  const tabId = (i: number) => `${uid}-tab-${i}`;
  const panelId = `${uid}-panel`;

  const railCardBg = dark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const railBorder = dark ? "rgba(255,255,255,0.09)" : "rgba(11,11,15,0.08)";

  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: sectionBg, color: text, fontFamily: BODY }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {dark && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `radial-gradient(50% 40% at 80% 0%, color-mix(in srgb, ${accent} 13%, transparent) 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {(props.eyebrow || props.headline || props.subheadline || onFieldChange) && (
          <div className="max-w-3xl mb-12 lg:mb-16">
            {(props.eyebrow || onFieldChange) && (
              <p
                className="text-[11px] uppercase tracking-[0.26em] font-semibold mb-4"
                style={{ color: eyebrowColor }}
              >
                <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </p>
            )}
            {(props.headline || onFieldChange) && (
              <h2
                className="font-bold tracking-tight leading-[1.05]"
                style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)", fontFamily: DISPLAY }}
              >
                <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
              </h2>
            )}
            {(props.subheadline || onFieldChange) && (
              <p className="text-base lg:text-lg leading-relaxed mt-4 max-w-2xl" style={{ color: muted }}>
                <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(280px,380px)_1fr] lg:gap-12 lg:items-center">
          {/* ── Tab rail (horizontal scroll-snap strip on mobile). ── */}
          <div
            role="tablist"
            aria-label={props.headline || "Product features"}
            aria-orientation="vertical"
            onKeyDown={onTabKeyDown}
            className="order-1 flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-6 px-6 pb-2
                       lg:order-none lg:flex-col lg:overflow-visible lg:snap-none lg:mx-0 lg:px-0 lg:pb-0"
          >
            {tabs.map((tab, i) => {
              const selected = i === safeActive;
              return (
                <button
                  key={i}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  type="button"
                  id={tabId(i)}
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i, true)}
                  className={cn(
                    "relative snap-start shrink-0 w-[240px] sm:w-[270px] lg:w-full text-left rounded-2xl border p-4 lg:p-5 overflow-hidden",
                    "focus-visible:outline-2 focus-visible:outline-offset-2",
                    !reduced && "transition-all duration-300",
                  )}
                  style={{
                    backgroundColor: selected
                      ? dark
                        ? "rgba(255,255,255,0.08)"
                        : "#FFFFFF"
                      : dark
                        ? "rgba(255,255,255,0.03)"
                        : "transparent",
                    borderColor: selected
                      ? `color-mix(in srgb, ${accentResolved} 45%, ${railBorder})`
                      : railBorder,
                    boxShadow: selected
                      ? dark
                        ? `0 0 0 1px color-mix(in srgb, ${accentResolved} 18%, transparent), 0 16px 36px -18px rgba(0,0,0,0.7)`
                        : "0 1px 2px rgba(15,15,20,0.05), 0 12px 28px -14px rgba(15,15,20,0.14)"
                      : "none",
                    outlineColor: accentResolved,
                  }}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${accentResolved} 13%, transparent)`,
                        color: accentResolved,
                      }}
                      aria-hidden="true"
                    >
                      <IconOrImage value={tab.icon} fallback={Sparkles} className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block text-sm sm:text-[15px] font-semibold leading-snug"
                        style={{ fontFamily: DISPLAY, opacity: selected ? 1 : 0.85 }}
                      >
                        <InlineText
                          as="span"
                          value={tab.title}
                          onUpdate={updateTab ? (v) => updateTab(i, { title: v }) : undefined}
                        />
                      </span>
                      {(tab.description || onFieldChange) && (
                        <span
                          className="block text-xs sm:text-[13px] leading-relaxed mt-1"
                          style={{ color: muted, opacity: selected ? 1 : 0.85 }}
                        >
                          <InlineText
                            as="span"
                            value={tab.description ?? ""}
                            multiline
                            onUpdate={updateTab ? (v) => updateTab(i, { description: v }) : undefined}
                          />
                        </span>
                      )}
                    </span>
                  </span>

                  {/* Auto-advance progress indicator on the active tab. */}
                  {selected && autoplay && (
                    <span
                      className="absolute left-0 right-0 bottom-0 h-0.5 overflow-hidden"
                      aria-hidden="true"
                    >
                      <motion.span
                        key={`${safeActive}-progress`}
                        className="block h-full origin-left"
                        style={{ backgroundColor: accentResolved }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: intervalMs / 1000, ease: "linear" }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Media panel in a glass browser frame. ── */}
          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId(safeActive)}
            className="order-2 lg:order-none min-w-0"
          >
            <div
              className={cn("rounded-2xl border overflow-hidden", dark && "backdrop-blur-xl")}
              style={{
                backgroundColor: railCardBg,
                borderColor: railBorder,
                boxShadow: dark
                  ? "0 1px 0 rgba(255,255,255,0.05) inset, 0 32px 64px -24px rgba(0,0,0,0.8)"
                  : "0 1px 2px rgba(15,15,20,0.05), 0 28px 60px -24px rgba(15,15,20,0.22)",
              }}
            >
              {/* Browser chrome */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: railBorder }}
              >
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FF5F57" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FEBC2E" }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#28C840" }} />
                </span>
                <span
                  className="flex-1 max-w-xs mx-auto text-center text-[11px] truncate rounded-md px-3 py-1"
                  style={{
                    color: muted,
                    backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(11,11,15,0.05)",
                  }}
                >
                  <InlineText
                    as="span"
                    value={props.frameLabel ?? "app.yourproduct.com"}
                    onUpdate={field("frameLabel")}
                  />
                </span>
                <span className="w-12" aria-hidden="true" />
              </div>

              {/* Crossfade + slide media (instant swap under reduced motion). */}
              <div className="relative aspect-[16/10] w-full">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    key={safeActive}
                    className="absolute inset-0"
                    initial={reduced ? { opacity: 1 } : { opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
                    transition={
                      reduced ? { duration: 0 } : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
                    }
                  >
                    <InlineImage
                      src={activeTab?.imageUrl || ""}
                      alt={activeTab?.imageAlt ?? activeTab?.title ?? ""}
                      className="absolute inset-0 w-full h-full object-cover"
                      wrapperClassName="absolute inset-0"
                      loading="lazy"
                      onUpdate={updateTab ? (url) => updateTab(safeActive, { imageUrl: url }) : undefined}
                      onAltUpdate={updateTab ? (v) => updateTab(safeActive, { imageAlt: v }) : undefined}
                      focalPoint={activeTab?.imageFocal}
                      onFocalUpdate={updateTab ? (v) => updateTab(safeActive, { imageFocal: v }) : undefined}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
