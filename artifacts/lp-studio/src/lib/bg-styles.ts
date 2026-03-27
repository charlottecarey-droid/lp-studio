import type React from "react";

export type BackgroundStyle =
  | "white"
  | "light-gray"
  | "muted"
  | "dark"
  | "dandy-green"
  | "black"
  | "gradient";

const MAP: Record<BackgroundStyle, React.CSSProperties> = {
  "white":       { background: "#fff" },
  "light-gray":  { background: "#f8fafc" },
  "muted":       { background: "hsl(42,18%,96%)" },
  "dark":        { background: "#0f172a", color: "#fff" },
  "dandy-green": { background: "#003A30", color: "#fff" },
  "black":       { background: "#000000", color: "#fff" },
  "gradient":    { background: "radial-gradient(ellipse 120% 100% at 50% 50%, #003A30 0%, #001a14 55%, #000000 100%)", color: "#fff" },
};

export function getBgStyle(style: string | undefined): React.CSSProperties {
  return MAP[(style ?? "white") as BackgroundStyle] ?? MAP.white;
}

export function isDarkBg(style: string | undefined): boolean {
  return ["dark", "dandy-green", "black", "gradient"].includes(style ?? "");
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
