/**
 * Container blocks — layout shells whose only job is to host other blocks
 * via a `children: PageBlock[]` slot. Children are passed through
 * `BlockRenderer`'s recursive renderer so any block type can nest.
 *
 * These blocks have no inline-editable copy of their own; all content lives
 * in their children. The renderer handles the drop/insert chrome.
 */

import type { BackgroundStyle } from "../bg-styles";

export interface SectionBlockProps {
  /** Optional eyebrow/heading line shown above children. */
  eyebrow?: string;
  headline?: string;
  /** Background style — same vocabulary as other blocks. */
  backgroundStyle?: BackgroundStyle;
  /** Inner max-width: "narrow" (640) | "default" (1100) | "wide" (1280) | "full". */
  maxWidth?: "narrow" | "default" | "wide" | "full";
  /** Vertical padding scale: "compact" | "default" | "spacious". */
  paddingY?: "compact" | "default" | "spacious";
  /** Horizontal alignment of children. */
  align?: "start" | "center" | "end" | "stretch";
  /** Optional background image overlay. */
  backgroundImage?: string;
}

export interface ColumnsBlockProps {
  /** Number of columns at desktop. Mobile collapses to 1. */
  columns?: 2 | 3 | 4;
  /** Gap between columns in rem. */
  gap?: number;
  /** Cross-axis alignment within each column. */
  align?: "start" | "center" | "end" | "stretch";
  backgroundStyle?: BackgroundStyle;
}

export interface GridBlockProps {
  /** CSS grid `grid-template-columns` shorthand: number of equal cols. */
  columns?: number;
  /** Mobile cols (default 1). */
  mobileColumns?: number;
  /** Gap in rem. */
  gap?: number;
  backgroundStyle?: BackgroundStyle;
}

export interface StackBlockProps {
  /** Gap between children in rem. */
  gap?: number;
  /** Cross-axis alignment. */
  align?: "start" | "center" | "end" | "stretch";
  backgroundStyle?: BackgroundStyle;
}
