import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
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
        <div className="max-w-7xl mx-auto px-6 h-9 flex items-center justify-end">
          <a
            href="https://www.meetdandy.com/careers/"
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            *We&apos;re hiring* Careers
          </a>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
        {/* Logo */}
        <div className="shrink-0">
          <img
            src={props.logoUrl || dandyLogoUrl}
            alt="Dandy"
            className="h-8 w-auto brightness-0 invert"
          />
        </div>

        {/* Nav links */}
        {(props.navLinks ?? []).length > 0 && (
          <nav className="hidden lg:flex items-center gap-6 flex-1">
            {(props.navLinks ?? []).map((link, i) => (
              <a
                key={i}
                href={link.url || "#"}
                className="text-sm font-medium text-white/80 hover:text-white transition-colors whitespace-nowrap"
              >
                <InlineText
                  value={link.label}
                  onUpdate={onFieldChange ? (v) => updateNav(i, "label", v) : undefined}
                />
              </a>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3 shrink-0">
          {/* Phone */}
          {props.phoneNumber && (
            <a
              href={`tel:${props.phoneNumber}`}
              className="hidden md:flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <InlineText value={props.phoneLabel || props.phoneNumber} onUpdate={field("phoneLabel")} />
            </a>
          )}

          {/* Secondary CTA */}
          {props.secondaryCtaText && (
            <button
              onClick={() => safeNavigate(props.secondaryCtaUrl)}
              className="hidden md:block text-sm font-semibold text-white border border-white/30 rounded-lg px-4 py-2 hover:bg-white/10 transition-colors"
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </button>
          )}

          {/* Primary CTA */}
          {props.primaryCtaText && (
            <button
              onClick={() => safeNavigate(props.primaryCtaUrl)}
              className="bg-[#C7E738] text-[#003A30] font-bold text-sm rounded-lg px-4 py-2 hover:brightness-110 transition-all"
            >
              <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
