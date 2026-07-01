import { useState } from "react";
import { MapPin, Linkedin, Mail } from "lucide-react";
import type { AboutTeamBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { BRAND_DISPLAY_STACK, BRAND_BODY_STACK } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: AboutTeamBlockProps;
  brand?: BrandConfig;
  animationsEnabled?: boolean;
  onFieldChange?: (updated: AboutTeamBlockProps) => void;
}

type Shape = "circle" | "rounded" | "square";

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function mainRadius(shape: Shape, corner: number): string {
  if (shape === "circle") return "9999px";
  if (shape === "square") return "0px";
  return `${corner}px`;
}

function avatarRadius(shape: Shape, size: number, corner: number): string {
  if (shape === "circle") return "9999px";
  if (shape === "square") return "0px";
  return `${Math.min(corner, Math.round(size / 2))}px`;
}

export function BlockAboutTeam({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#ffffff");
  const paperBase = surface.base || "#ffffff";
  const ink = props.textColor || surface.color || "#16151f";
  const accent =
    props.accentColor || brand?.accentColor || "var(--brand-accent, #4f46e5)";
  const muted = `color-mix(in srgb, ${ink} 58%, ${paperBase})`;
  const line = `color-mix(in srgb, ${ink} 12%, transparent)`;
  const brandSoft = `color-mix(in srgb, ${accent} 12%, transparent)`;

  useBlockFonts(props.headlineFont, props.bodyFont);
  const headFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || BRAND_DISPLAY_STACK
    : BRAND_DISPLAY_STACK;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") || BRAND_BODY_STACK
    : BRAND_BODY_STACK;

  const corner = typeof props.cornerRadius === "number" ? props.cornerRadius : 24;
  const avatarSize = typeof props.avatarSize === "number" ? props.avatarSize : 72;
  const avatarShape: Shape = props.avatarShape ?? "circle";
  const mainImageShape: Shape = props.mainImageShape ?? "rounded";

  const members = props.members ?? [];
  const [activeIdx, setActiveIdx] = useState(0);

  if (members.length === 0) {
    if (!onFieldChange) return null;
    return (
      <section
        className="flex w-full items-center justify-center px-6 py-16"
        style={{ background: surface.background, color: muted, fontFamily: bodyFamily }}
      >
        <p className="max-w-md text-center text-sm">
          Add a person in the panel on the right to build your team section.
        </p>
      </section>
    );
  }

  const active = members[Math.min(activeIdx, members.length - 1)] ?? members[0];
  const hasRoster = members.length > 1;
  const showHeader = props.showHeader ?? members.length > 1;

  const mainR = mainRadius(mainImageShape, corner);
  const avatarR = avatarRadius(avatarShape, avatarSize, corner);
  const portraitSquare = mainImageShape === "circle";

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ background: surface.background, color: ink, fontFamily: bodyFamily }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background: `radial-gradient(60% 120% at 15% 0%, ${brandSoft} 0%, transparent 70%)`,
        }}
      />
      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16 md:px-12 md:py-20">
        {showHeader && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {props.eyebrow && (
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: accent, fontFamily: bodyFamily }}
              >
                {props.eyebrow}
              </p>
            )}
            {props.headline && (
              <h2
                className="mt-4 text-4xl font-semibold leading-[1.08] md:text-5xl"
                style={{ fontFamily: headFamily }}
              >
                {props.headline}
              </h2>
            )}
            {props.subheadline && (
              <p
                className="mt-5 text-base leading-relaxed md:text-lg"
                style={{ color: muted }}
              >
                {props.subheadline}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-10 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-14">
          <div className="relative">
            {active?.photo ? (
              <img
                src={active.photo}
                alt={active.name}
                className={portraitSquare ? "aspect-square w-full object-cover" : "aspect-[3/4] w-full object-cover"}
                style={{
                  borderRadius: mainR,
                  boxShadow: "0 40px 80px -50px rgba(20,19,34,0.6)",
                }}
              />
            ) : (
              <div
                className={
                  (portraitSquare ? "aspect-square" : "aspect-[3/4]") +
                  " flex w-full items-center justify-center"
                }
                style={{ borderRadius: mainR, background: brandSoft, color: accent }}
              >
                <span
                  className="text-6xl font-semibold"
                  style={{ fontFamily: headFamily }}
                >
                  {initialsOf(active?.name ?? "")}
                </span>
              </div>
            )}
            <span
              aria-hidden
              className="absolute -bottom-4 -left-4 h-24 w-24"
              style={{
                borderRadius: mainR,
                background: brandSoft,
                outline: `8px solid ${paperBase}`,
                zIndex: -1,
              }}
            />
          </div>

          <div className="flex flex-col">
            <h3
              className="text-4xl font-semibold leading-[1.08] md:text-5xl"
              style={{ fontFamily: headFamily }}
            >
              {active?.name || "Team member"}
            </h3>
            {active?.role && (
              <p className="mt-2 text-lg font-medium" style={{ color: accent }}>
                {active.role}
              </p>
            )}

            {(active?.location || active?.focus) && (
              <div
                className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                style={{ color: muted }}
              >
                {active?.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" strokeWidth={1.75} />
                    {active.location}
                  </span>
                )}
                {active?.location && active?.focus && (
                  <span
                    aria-hidden
                    className="h-1 w-1 rounded-full"
                    style={{ background: line }}
                  />
                )}
                {active?.focus && <span>{active.focus}</span>}
              </div>
            )}

            {active?.bio && (
              <p className="mt-6 text-[15px] leading-[1.8]">{active.bio}</p>
            )}

            {(active?.linkedinUrl || active?.email) && (
              <div className="mt-8 flex items-center gap-2" style={{ color: muted }}>
                {active?.linkedinUrl && (
                  <a
                    href={active.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${active.name} on LinkedIn`}
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ outline: `1px solid ${line}` }}
                  >
                    <Linkedin className="h-4 w-4" strokeWidth={1.75} />
                  </a>
                )}
                {active?.email && (
                  <a
                    href={`mailto:${active.email}`}
                    aria-label={`Email ${active.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ outline: `1px solid ${line}` }}
                  >
                    <Mail className="h-4 w-4" strokeWidth={1.75} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {hasRoster && (
          <div className="mt-14 border-t pt-10" style={{ borderColor: line }}>
            <div
              className="flex flex-wrap justify-center gap-x-8 gap-y-6"
              role="listbox"
              aria-label="Team members"
            >
              {members.map((m, i) => {
                const selected = i === Math.min(activeIdx, members.length - 1);
                return (
                  <button
                    key={i}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setActiveIdx(i)}
                    className="group flex flex-col items-center gap-3 text-center transition-transform duration-200"
                    style={{ width: Math.max(avatarSize + 48, 120) }}
                  >
                    {m.photo ? (
                      <img
                        src={m.photo}
                        alt={m.name}
                        className="object-cover transition-all duration-200 group-hover:-translate-y-0.5"
                        style={{
                          height: avatarSize,
                          width: avatarSize,
                          borderRadius: avatarR,
                          boxShadow: selected
                            ? `0 0 0 2px ${paperBase}, 0 0 0 4px ${accent}`
                            : `0 0 0 2px ${paperBase}, 0 0 0 3px ${line}`,
                        }}
                      />
                    ) : (
                      <span
                        className="flex items-center justify-center font-semibold transition-all duration-200 group-hover:-translate-y-0.5"
                        style={{
                          height: avatarSize,
                          width: avatarSize,
                          borderRadius: avatarR,
                          background: brandSoft,
                          color: accent,
                          fontFamily: headFamily,
                          fontSize: Math.round(avatarSize / 2.8),
                          boxShadow: selected
                            ? `0 0 0 2px ${paperBase}, 0 0 0 4px ${accent}`
                            : `0 0 0 2px ${paperBase}, 0 0 0 3px ${line}`,
                        }}
                      >
                        {initialsOf(m.name)}
                      </span>
                    )}
                    <span className="leading-tight">
                      <span
                        className="block text-sm font-medium"
                        style={{ color: selected ? accent : ink }}
                      >
                        {m.name}
                      </span>
                      {m.role && (
                        <span
                          className="mt-0.5 block text-xs"
                          style={{ color: muted }}
                        >
                          {m.role}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
