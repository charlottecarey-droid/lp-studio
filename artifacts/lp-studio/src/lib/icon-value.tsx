import * as LucideIcons from "lucide-react";

/**
 * Task #1279 — icon fields in LP Studio blocks store EITHER a Lucide icon name
 * (e.g. "Zap") OR an image URL / data-URI (uploaded, library, or AI-generated).
 * These helpers let a single string field render correctly either way and keep
 * the detection logic consistent across every renderer.
 */

export type IconComp = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

/** True when the stored icon value is an image reference rather than a Lucide name. */
export function isImageIcon(value?: string): boolean {
  if (!value) return false;
  const s = value.trim();
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("/") ||
    s.startsWith("data:") ||
    s.startsWith("blob:")
  );
}

/** Resolve a Lucide component by name, falling back to a provided component (default Sparkles). */
export function resolveLucideIcon(name?: string, fallback?: IconComp): IconComp {
  const map = LucideIcons as unknown as Record<string, IconComp>;
  return (name ? map[name] : undefined) ?? fallback ?? LucideIcons.Sparkles;
}

interface IconOrImageProps {
  /** Lucide icon name or image URL / data-URI. */
  value?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Alt text used only when the value is an image. */
  alt?: string;
  /** Lucide fallback when the value is empty or an unknown name. */
  fallback?: IconComp;
}

/**
 * Renders an icon field that may hold a Lucide name or an image URL. Images are
 * rendered as a contained <img> sized by `className`/`style`; Lucide names
 * resolve to the matching component (or `fallback`).
 */
export function IconOrImage({ value, className, style, alt, fallback }: IconOrImageProps) {
  if (isImageIcon(value)) {
    return (
      <img
        src={value}
        alt={alt ?? ""}
        className={className}
        style={{ objectFit: "contain", ...style }}
      />
    );
  }
  const Icon = resolveLucideIcon(value, fallback);
  return <Icon className={className} style={style} />;
}
