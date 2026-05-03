import type React from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandySiteHeaderBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo } from "@/components/BrandLogo";
import { safeNavigate } from "@/lib/safe-url";
import { useBlockFonts } from "@/lib/use-block-fonts";

interface Props {
  props: DandySiteHeaderBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandySiteHeaderBlockProps) => void;
}

export function BlockDandySiteHeader({ props, brand, onFieldChange }: Props) {
  // Load any catalog Google Font referenced by the per-header font override.
  // Without this, picking "Geist" or "Playfair Display" from the dropdown
  // does nothing — the browser falls back to the next family in the stack.
  useBlockFonts(props.fontFamily);

  const field = (key: keyof DandySiteHeaderBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateNav = (i: number, key: string, v: string) => {
    if (!onFieldChange) return;
    const navLinks = (props.navLinks ?? []).map((l, idx) => idx === i ? { ...l, [key]: v } : l);
    onFieldChange({ ...props, navLinks });
  };

  // Compose inline overrides. When unset, fall back to the original
  // brand-primary background + white text via the existing tailwind class.
  // `textColor` is also exposed as a CSS variable so descendant elements
  // (nav links, phone, CTAs) can inherit it without per-element edits.
  const headerBg = props.backgroundColor ?? `var(--brand-primary, ${brand.primaryColor})`;
  const headerFg = props.textColor ?? "#ffffff";
  const overlay = Math.max(0, Math.min(1, props.backgroundOverlay ?? 0));
  const headerStyle: React.CSSProperties = {
    background: props.backgroundImage
      ? `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url("${props.backgroundImage}") center/cover no-repeat, ${headerBg}`
      : headerBg,
    color: headerFg,
    fontFamily: props.fontFamily || undefined,
    ["--header-fg" as string]: headerFg,
  };
  const hasFgOverride = !!props.textColor;

  return (
    <header className="w-full shadow-sm" style={headerStyle}>
      {/* Main header */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-20 flex items-center gap-8">
        {/* Logo */}
        <div className="shrink-0">
          <BrandLogo
            brand={brand}
            url={props.logoUrl}
            tone="onPrimary"
            alt={brand.brandName || "Logo"}
            className="h-9 w-auto"
          />
        </div>

        {/* Nav links */}
        {(props.navLinks ?? []).length > 0 && (
          <nav className="hidden lg:flex items-center gap-8 flex-1">
            {(props.navLinks ?? []).map((link, i) => (
              <a
                key={i}
                href={link.url || "#"}
                className={cn(
                  "text-sm font-medium transition-colors whitespace-nowrap",
                  // Use the inherited header color when the user supplied a
                  // textColor; otherwise keep the original white/75 ramp.
                  hasFgOverride ? "opacity-80 hover:opacity-100" : "text-white/75 hover:text-white",
                )}
              >
                <InlineText
                  value={link.label}
                  onUpdate={onFieldChange ? (v) => updateNav(i, "label", v) : undefined}
                />
              </a>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-4 shrink-0">
          {/* Phone */}
          {props.phoneNumber && (
            <a
              href={`tel:${props.phoneNumber}`}
              className={cn(
                "hidden md:flex items-center gap-2 text-sm transition-colors",
                hasFgOverride ? "opacity-70 hover:opacity-100" : "text-white/65 hover:text-white",
              )}
            >
              <Phone className="w-4 h-4" />
              <InlineText value={props.phoneLabel || props.phoneNumber} onUpdate={field("phoneLabel")} />
            </a>
          )}

          {/* Secondary CTA */}
          {props.secondaryCtaText && (
            <button
              onClick={() => safeNavigate(props.secondaryCtaUrl)}
              className={cn(
                "hidden md:block text-sm font-semibold border rounded-xl px-5 py-2.5 transition-colors",
                hasFgOverride
                  ? "border-current/30 hover:bg-black/5"
                  : "text-white border-white/30 hover:bg-white/10",
              )}
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </button>
          )}

          {/* Primary CTA */}
          {props.primaryCtaText && (
            <button
              onClick={() => safeNavigate(props.primaryCtaUrl)}
              className="bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold text-sm rounded-xl px-5 py-2.5 hover:brightness-110 transition-all"
            >
              <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
