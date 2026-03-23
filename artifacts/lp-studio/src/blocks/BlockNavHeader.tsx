import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getButtonClasses } from "@/lib/brand-config";
import type { BrandConfig } from "@/lib/brand-config";
import type { NavHeaderBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";

interface Props {
  props: NavHeaderBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: NavHeaderBlockProps) => void;
}

export function BlockNavHeader({ props, brand, onFieldChange }: Props) {
  const updateLink = (i: number, key: string, value: string) => {
    if (!onFieldChange) return;
    const navLinks = props.navLinks.map((l, idx) => idx === i ? { ...l, [key]: value } : l);
    onFieldChange({ ...props, navLinks });
  };

  return (
    <header className="w-full bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">
        <div className="shrink-0">
          <img
            src={props.logoUrl || dandyLogoUrl}
            alt={props.logoText || "Dandy"}
            className="h-8 w-auto"
          />
        </div>

        {props.navLinks.length > 0 && (
          <nav className="hidden md:flex items-center gap-6 flex-1">
            {props.navLinks.map((link, i) => (
              <a
                key={i}
                href={link.url || "#"}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
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
              className="hidden lg:flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Phone className="w-4 h-4" />
              <InlineText
                value={props.phone}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, phone: v }) : undefined}
              />
            </a>
          )}
          {props.cta1?.label && (
            <a
              href={props.cta1.url || "#"}
              className={cn(
                getButtonClasses(brand),
                "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              <InlineText
                value={props.cta1.label}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, cta1: { ...props.cta1, label: v } }) : undefined}
              />
            </a>
          )}
          {props.cta2?.label && (
            <a
              href={props.cta2.url || "#"}
              className={getButtonClasses(brand)}
              style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
            >
              <InlineText
                value={props.cta2.label}
                onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, cta2: { ...props.cta2, label: v } }) : undefined}
              />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
