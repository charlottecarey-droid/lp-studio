export type HeadlineSize = "sm" | "md" | "lg" | "xl" | "2xl";

export const HEADLINE_SIZE_LABELS: Record<HeadlineSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "X-Large",
  "2xl": "2X-Large",
};

const HEADLINE_CLASSES: Record<HeadlineSize, string> = {
  sm: "text-xl md:text-2xl lg:text-3xl",
  md: "text-2xl md:text-3xl lg:text-4xl",
  lg: "text-2xl md:text-4xl lg:text-5xl",
  xl: "text-3xl md:text-5xl lg:text-7xl",
  "2xl": "text-4xl md:text-6xl lg:text-8xl",
};

export function getHeadlineSizeClass(size?: HeadlineSize, defaultSize: HeadlineSize = "lg"): string {
  return HEADLINE_CLASSES[size ?? defaultSize];
}
