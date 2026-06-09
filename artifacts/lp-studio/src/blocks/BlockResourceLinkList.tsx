import { ArrowUpRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { ResourceLinkListBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { motion } from "framer-motion";
import { SectionDecor } from "@/lib/premium-toolkit";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

const COLS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

interface Props {
  props: ResourceLinkListBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ResourceLinkListBlockProps) => void;
}

/** A compact directory of links grouped into titled columns — for surfacing a
 *  large set of resources (help articles, guides, docs) as scannable text
 *  links rather than heavy image cards. */
export function BlockResourceLinkList({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const text = props.textColor ?? surface.color ?? "#171717";
  const accent = props.accentColor ?? brand.primaryColor ?? "#1f7a4d";
  const muted = pickContrastingColor(undefined, surface.base, ["#525252", "#a3a3a3"]);
  const columns = props.columns ?? 3;
  const isBuilder = !!onFieldChange;
  const groups = props.groups ?? [];

  const update = <K extends keyof ResourceLinkListBlockProps>(key: K, value: ResourceLinkListBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const updateGroup = (gi: number, patch: Partial<ResourceLinkListBlockProps["groups"][number]>) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, groups: groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
  };

  return (
    <section
      className="relative w-full overflow-hidden px-6 py-20 md:py-28 md:px-12"
      style={{ background: surface.background, color: text }}
    >
      <SectionDecor accent={accent} isDark={surface.isDark} disabled={isBuilder} />
      <div className="relative z-10 mx-auto w-full max-w-[1180px]">
        <div className="max-w-3xl">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="p"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-4 text-sm font-semibold uppercase tracking-wider"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          {(props.headline || onFieldChange) && (
            <InlineText
              as="h2"
              value={props.headline ?? ""}
              onUpdate={onFieldChange ? (v) => update("headline", v) : undefined}
              className="text-4xl font-bold tracking-tight md:text-6xl"
              style={{ fontFamily: DISPLAY, color: accent }} />
          )}
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v) => update("subheadline", v) : undefined}
              className="mt-4 text-base md:text-lg"
              style={{ color: muted, fontFamily: BODY }}
              multiline />
          )}
        </div>

        <div className="mt-8 h-px w-full" style={{ backgroundColor: accent, opacity: 0.85 }} />

        <div className={`mt-12 grid grid-cols-1 gap-x-10 gap-y-14 ${COLS[columns] ?? COLS[3]}`}>
          {groups.map((group, gi) => (
            <motion.div
              key={gi}
              initial={isBuilder ? false : { opacity: 0, y: 24 }}
              whileInView={isBuilder ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={isBuilder ? undefined : { duration: 0.5, delay: gi * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <InlineText
                as="h3"
                value={group.title}
                onUpdate={onFieldChange ? (v) => updateGroup(gi, { title: v }) : undefined}
                className="mb-5 text-2xl font-bold tracking-tight md:text-3xl"
                style={{ fontFamily: DISPLAY, color: text }} />
              <ul className="flex flex-col gap-3">
                {(group.links ?? []).map((link, li) => (
                  <li key={li}>
                    <a
                      href={link.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={isBuilder ? (e) => e.preventDefault() : undefined}
                      className="group inline-flex items-start gap-1.5 text-[15px] font-medium leading-snug transition-colors hover:underline"
                      style={{ color: accent, fontFamily: BODY }}
                    >
                      <InlineText
                        as="span"
                        value={link.label}
                        onUpdate={onFieldChange ? (v) => updateGroup(gi, { links: group.links.map((l, i) => (i === li ? { ...l, label: v } : l)) }) : undefined} />
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              </ul>
              {(group.ctaLabel || onFieldChange) && (
                <div className="mt-6">
                  <a
                    href={group.ctaUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={isBuilder ? (e) => e.preventDefault() : undefined}
                    className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-80"
                    style={{ borderColor: accent, color: accent, fontFamily: BODY }}
                  >
                    <InlineText
                      as="span"
                      value={group.ctaLabel ?? ""}
                      onUpdate={onFieldChange ? (v) => updateGroup(gi, { ctaLabel: v }) : undefined} />
                  </a>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
