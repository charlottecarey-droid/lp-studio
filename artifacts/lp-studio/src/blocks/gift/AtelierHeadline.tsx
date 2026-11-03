import type { CSSProperties } from "react";
import { InlineText } from "@/components/InlineText";
import { serifStyle } from "./atelier-theme";
import { cn } from "@/lib/utils";

/**
 * Brand-display headline whose last line is set in a softer tone when there
 * is more than one line (Dandy's two-tone headline: "Pick the gift /
 * you'd actually use." with the second line muted).
 * Each line is inline-editable on its own; edits rebuild the string.
 */
export function AtelierHeadline({ value, size, as: Tag = "h2", className, style, onUpdate }: { value: string; size: string; as?: "h1" | "h2" | "p"; className?: string; style?: CSSProperties; onUpdate?: (v: string) => void }) {
  const lines = (value || "").split("\n");
  const multi = lines.length > 1;
  return (
    <Tag className={cn("flex flex-col", className)} style={serifStyle(size, style)}>
      {lines.map((line, i) => (
        <span key={i} className="block" style={multi && i === lines.length - 1 ? { color: "rgba(43,31,23,0.5)" } : undefined}>
          <InlineText
            as="span"
            value={line}
            onUpdate={onUpdate ? (v) => onUpdate(lines.map((l, idx) => (idx === i ? v : l)).join("\n")) : undefined}
          />
        </span>
      ))}
    </Tag>
  );
}
