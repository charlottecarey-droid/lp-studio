import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getButtonClasses } from "@/lib/brand-config";
import type { BrandConfig } from "@/lib/brand-config";
import type { NavHeaderBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo } from "@/components/BrandLogo";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { motion } from "framer-motion";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: NavHeaderBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: NavHeaderBlockProps) => void;
}

export function BlockNavHeader({ props, brand, onFieldChange }: Props) {
  // Load any catalog Google Font referenced by the per-header font override.
  // Without this, picking "Geist" or "Playfair Display" from the dropdown
  // does nothing — the browser falls back to the next family in the stack.
  useBlockFonts(props.fontFamily);

  const updateLink = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const navLinks = (props.navLinks ?? []).map((l, idx) => idx === i ? { ...l, [key]: value } : l);
    onFieldChange({ ...props, navLinks });
  };

  // Inline background/text/font overrides. Falls back to the historical
  // white bar with slate-900 text when unset.
  const headerBg = props.backgroundColor ?? "#ffffff";
  const headerFg = props.textColor;
  const overlay = Math.max(0, Math.min(1, props.backgroundOverlay ?? 0));
  const headerStyle: React.CSSProperties = {
    background: props.backgroundImage
      ? `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url("${props.backgroundImage}") center/cover no-repeat, ${headerBg}`
      : headerBg,
    color: headerFg || undefined,
    fontFamily: props.fontFamily || undefined,
  };
  // Drop the hard-coded bg/text classes when an override is in play so the
  // user's color isn't fighting tailwind's `bg-white` / `text-slate-*`.
  const hasBgOverride = !!(props.backgroundColor || props.backgroundImage);
  const hasFgOverride = !!props.textColor;

  return (
    <header
      className={cn(
        "w-full border-b border-slate-200 shadow-sm sticky top-0 z-50",
        !hasBgOverride && "bg-white",
      )}
      style={headerStyle}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">
        <div className="shrink-0">
          <BrandLogo
            brand={brand}
            url={props.logoUrl}
            tone="onLight"
            alt={props.logoText || brand.brandName || "Logo"}
            className="h-8 w-auto"
          />
        </div>

        {(props.navLinks ?? []).length > 0 && (
          <nav className="hidden md:flex items-center gap-6 flex-1">
            {(props.navLinks ?? []).map((link, i) => (
              <a
                key={i}
                href={link.url || "#"}
                className={cn(
                  "text-sm font-medium transition-colors whitespace-nowrap",
                  // Drop the slate palette when the user has set their own
                  // text color so it actually takes effect (the slate classes
                  // would otherwise win over inherited `color`).
                  hasFgOverride ? "hover:opacity-80" : "text-slate-600 hover:text-slate-900",
                )}
              >
                <InlineText
                  value={link.label}
                  onUpdate={onFieldChange ? (v) => updateLink(i, "label", v) : undefined}
                />
              </a>
            ))}
          </nav>
        )}

        <div className={cn("flex items-center gap-3 ml-auto shrink-0")}>
          {props.phone && (
            <a
              href={`tel:${props.phone.replace(/\s/g, "")}`}
              className={cn(
                "hidden lg:flex items-center gap-1.5 text-sm font-medium transition-colors",
                hasFgOverride ? "hover:opacity-80" : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Phone className="w-4 h-4" />
              <InlineText
                value={props.phone}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, phone: v }) : undefined}
              />
            </a>
          )}
          {props.cta1?.label && (
            <motion.a
              href={props.cta1.url || "#"}
              className={cn(
                getButtonClasses(brand),
                "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              )}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
            >
              <InlineText
                value={props.cta1.label}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, cta1: { ...props.cta1, label: v } }) : undefined}
              />
            </motion.a>
          )}
          {props.cta2?.label && (
            <motion.a
              href={props.cta2.url || "#"}
              className={getButtonClasses(brand)}
              style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
            >
              <InlineText
                value={props.cta2.label}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, cta2: { ...props.cta2, label: v } }) : undefined}
              />
            </motion.a>
          )}
        </div>
      </div>
    </header>
  );
}
