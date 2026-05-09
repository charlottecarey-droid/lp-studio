import type { ReactNode } from "react";
import { InlineText } from "@/components/InlineText";

// Render text with <em>...</em> markers as <em> elements (accent color).
// Mirrors the BoldStatement pattern.
export function renderEm(value: string): ReactNode {
  if (!value) return null;
  const parts = value.split(/(<em>.*?<\/em>)/g);
  return parts.map((part, i) => {
    const m = part.match(/^<em>(.*?)<\/em>$/);
    if (m) return <em key={i}>{m[1]}</em>;
    return <span key={i}>{part}</span>;
  });
}

interface EditableProps {
  value: string;
  onUpdate?: (v: string) => void;
  className?: string;
  multiline?: boolean;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div" | "b";
  placeholder?: string;
}

// Wrapper that renders InlineText for the editor and a static element with
// <em> rendering for the live preview. The live preview path is what visitors
// see, so it must support the <em>...</em> accent markup.
export function EditableEm({ value, onUpdate, className, multiline, as = "span", placeholder }: EditableProps) {
  if (onUpdate) {
    return (
      <InlineText
        as={as}
        value={value}
        onUpdate={onUpdate}
        className={className}
        multiline={multiline}
       
      />
    );
  }
  const Tag = as as React.ElementType;
  return <Tag className={className}>{renderEm(value)}</Tag>;
}
