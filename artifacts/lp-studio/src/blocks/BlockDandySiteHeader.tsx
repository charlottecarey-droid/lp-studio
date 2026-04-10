import { Phone } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandySiteHeaderBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DandySiteHeaderBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandySiteHeaderBlockProps) => void;
}

export function BlockDandySiteHeader({ props, brand, onFieldChange }: Props) {
  const field = (key: keyof DandySiteHeaderBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateNav = (i: number, key: string, v: string) => {
    if (!onFieldChange) return;
    const navLinks = (props.navLinks ?? []).map((l, idx) => idx === i ? { ...l, [key]: v } : l);
    onFieldChange({ ...props, navLinks });
  };

  return (
    <header className="w-full bg-[#003A30] shadow-sm">
      {/* Utility bar */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-10 flex items-center justify-end">
          <a
            href="https://www.meetdandy.com/careers/"
            className="text-xs text-white/55 hover:text-white transition-colors tracking-wide"
          >
            *We&apos;re hiring* Careers
          </a>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-20 flex items-center gap-8">
        {/* Logo */}
        <div className="shrink-0">
          <img
            src={props.logoUrl || dandyLogoUrl}
            alt="Dandy"
            className="h-9 w-auto brightness-0 invert"
          />
        </div>

        {/* Nav links */}
        {(props.navLinks ?? []).length > 0 && (
          <nav className="hidden lg:flex items-center gap-8 flex-1">
            {(props.navLinks ?? []).map((link, i) => (
              <a
                key={i}
                href={link.url || "#"}
                className="text-sm font-medium text-white/75 hover:text-white transition-colors whitespace-nowrap"
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
              className="hidden md:flex items-center gap-2 text-sm text-white/65 hover:text-white transition-colors"
            >
              <Phone className="w-4 h-4" />
              <InlineText value={props.phoneLabel || props.phoneNumber} onUpdate={field("phoneLabel")} />
            </a>
          )}

          {/* Secondary CTA */}
          {props.secondaryCtaText && (
            <button
              onClick={() => safeNavigate(props.secondaryCtaUrl)}
              className="hidden md:block text-sm font-semibold text-white border border-white/30 rounded-xl px-5 py-2.5 hover:bg-white/10 transition-colors"
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </button>
          )}

          {/* Primary CTA */}
          {props.primaryCtaText && (
            <button
              onClick={() => safeNavigate(props.primaryCtaUrl)}
              className="bg-[#C7E738] text-[#003A30] font-bold text-sm rounded-xl px-5 py-2.5 hover:brightness-110 transition-all"
            >
              <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
