import type React from "react";

export type BackgroundStyle =
  | "white"
  | "light-gray"
  | "muted"
  | "dark"
  | "dandy-green"
  | "black"
  | "gradient";

// "dandy-green" historically baked the Dandy forest hex (#003A30). We keep
// the same key for backwards compatibility with already-saved page rows
// (it's also the implicit default for many DSO blocks), but resolve the
// color via --brand-primary so non-Dandy tenants see their own brand. The
// hardcoded hex is preserved as a CSS fallback for isolated previews.
const MAP: Record<BackgroundStyle, React.CSSProperties> = {
  "white":       { background: "#fff" },
  "light-gray":  { background: "#f8fafc" },
  "muted":       { background: "hsl(42,18%,96%)" },
  "dark":        { background: "#1a1a1a", color: "#fff" },
  "dandy-green": { background: "var(--brand-primary, #003A30)", color: "#fff" },
  "black":       { background: "#000000", color: "#fff" },
  "gradient":    { background: "radial-gradient(ellipse 120% 100% at 50% 50%, var(--brand-primary, #003A30) 0%, #001a14 55%, #000000 100%)", color: "#fff" },
};

export function getBgStyle(style: string | undefined): React.CSSProperties {
  return MAP[(style ?? "white") as BackgroundStyle] ?? MAP.white;
}

export function isDarkBg(style: string | undefined): boolean {
  return ["dark", "dandy-green", "black", "gradient"].includes(style ?? "");
}

/** Returns section inline styles when an image background is used. */
export function getImageBgSectionStyle(imageUrl: string): React.CSSProperties {
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    position: "relative",
  };
}

export const BG_OPTIONS: { value: BackgroundStyle; label: string }[] = [
  { value: "white",        label: "White" },
  { value: "light-gray",   label: "Light gray" },
  { value: "muted",        label: "Muted (off-white)" },
  { value: "dark",         label: "Dark (charcoal)" },
  { value: "dandy-green",  label: "Dandy green" },
  { value: "black",        label: "Black" },
  { value: "gradient",     label: "Black → Dandy green gradient" },
];
