import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import type { CtaButtonBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { motion } from "framer-motion";
import { ChiliPiperModal } from "./ChiliPiperModal";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: CtaButtonBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CtaButtonBlockProps) => void;
}

const SIZE_CLASSES: Record<string, string> = {
  small: "px-4 py-2 text-sm",
  medium: "px-6 py-3 text-base",
  large: "px-10 py-4 text-lg",
};

const ALIGN_CLASSES: Record<string, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

export function BlockCtaButton({ props, brand, onFieldChange }: Props) {
  const [cpOpen, setCpOpen] = useState(false);
  const isChiliPiper = props.ctaAction === "chilipiper" && !!props.chilipiperUrl;

  const getStyleClasses = () => {
    switch (props.style) {
      case "secondary":
        return "border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
      case "outline":
        return "border-2 bg-transparent hover:opacity-80";
      default:
        return "";
    }
  };

  const getInlineStyle = () => {
    if (props.style === "outline") {
      return {
        borderColor: props.bgColor || brand.accentColor,
        color: props.bgColor || brand.accentColor,
      };
    }
    if (props.style === "primary") {
      return {
        backgroundColor: props.bgColor || brand.accentColor,
        color: brand.primaryColor,
      };
    }
    return {};
  };

  const radius = {
    pill: "rounded-full",
    rounded: "rounded-xl",
    slight: "rounded-lg",
    square: "rounded-none",
  }[brand.buttonRadius] ?? "rounded-full";

  const btnClass = cn(
    "inline-flex items-center font-semibold transition-colors cursor-pointer",
    radius,
    SIZE_CLASSES[props.size] ?? SIZE_CLASSES.medium,
    getStyleClasses()
  );

  return (
    <section className={cn("w-full bg-white", SECTION_PY[brand.sectionPadding])}>
      <div className={cn("max-w-7xl mx-auto px-6 flex", ALIGN_CLASSES[props.alignment] ?? "justify-center")}>
        {isChiliPiper ? (
          <motion.button
            type="button"
            onClick={() => setCpOpen(true)}
            className={btnClass}
            style={getInlineStyle()}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
          >
            <InlineText
              value={props.label}
              onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, label: v }) : undefined}
            />
          </motion.button>
        ) : (
          <motion.a
            href={props.url || "#"}
            className={btnClass}
            style={getInlineStyle()}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
          >
            <InlineText
              value={props.label}
              onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, label: v }) : undefined}
            />
          </motion.a>
        )}
      </div>
      {cpOpen && props.chilipiperUrl && (
        <ChiliPiperModal
          url={props.chilipiperUrl}
          onClose={() => setCpOpen(false)}
        />
      )}
    </section>
  );
}
