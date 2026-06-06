import type { CSSProperties } from "react";

// EmbedIcons — shared lucide-shaped inline SVG icons used by the product UI
// embeds (Builder, Templates, Dashboard, NewMicrosite, DraftEmail). One
// central path table avoids both a runtime lucide-react dependency in the
// marketing chunk and the duplication of inlining icons in every embed.

export const ICON_PATHS: Record<string, string> = {
  "align-left": "M21 6H3M15 12H3M17 18H3",
  "arrow-left": "M19 12H5M12 19l-7-7 7-7",
  "arrow-right": "M5 12h14M13 5l7 7-7 7",
  "arrow-up-down": "M21 16l-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16",
  "arrow-up-right": "M7 17L17 7M7 7h10v10",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  "building-2": "M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18ZM6 12H4a2 2 0 00-2 2v8h4ZM18 9h2a2 2 0 012 2v11h-4ZM10 6h4M10 10h4M10 14h4M10 18h4",
  check: "M5 12.5L10 17.5L20 7.5",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-up": "M18 15l-6-6-6 6",
  clock: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  copy: "M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z",
  eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z",
  "external-link": "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3",
  "file-text": "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  globe: "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z",
  "grip-vertical": "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
  image: "M3 3h18v18H3zM3 16l5-5 4 4 5-5 4 4M9 9a2 2 0 100-4 2 2 0 000 4z",
  "layout-grid": "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  link: "M10 13a5 5 0 007 0l4-4a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-4 4a5 5 0 007 7l1-1",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6L12 13 2 6",
  megaphone: "M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 11-5.8-1.6",
  "message-square": "M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z",
  minus: "M5 12h14",
  "more-horizontal": "M12 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2z",
  pencil: "M12 20h9M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z",
  plus: "M12 5v14M5 12h14",
  radio: "M4.93 19.07A10 10 0 1119.07 4.93M7.76 16.24A6 6 0 1116.24 7.76M12 14a2 2 0 100-4 2 2 0 000 4z",
  "refresh-cw": "M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5",
  save: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",
  search: "M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z",
  "shopping-bag": "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 11-8 0",
  "sliders-horizontal": "M21 4H14M10 4H3M21 12H12M8 12H3M21 20H16M12 20H3M14 2v4M8 10v4M16 18v4",
  sparkles: "M12 3l1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5zM5 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 14l.7 1.5L21 16l-1.3.5L19 18l-.7-1.5L17 16l1.3-.5z",
  star: "M12 2l2.7 6.7L22 9.6l-5.4 4.7L18 22l-6-3.5L6 22l1.4-7.7L2 9.6l7.3-.9z",
  target: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6a6 6 0 100 12 6 6 0 000-12zM12 10a2 2 0 100 4 2 2 0 000-4z",
  "thumbs-down": "M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17",
  "thumbs-up": "M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3",
  "trash-2": "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6",
  "trending-down": "M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6",
  "trending-up": "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  type: "M4 7V4h16v3M9 20h6M12 4v16",
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M22 21v-2a4 4 0 00-3-3.87M13 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z",
  "wand-2": "M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h0M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5",
  x: "M18 6L6 18M6 6l12 12",
};

interface IconProps {
  name: string;
  size?: number;
  style?: CSSProperties;
  strokeWidth?: number;
}

export default function Icon({
  name,
  size = 16,
  style,
  strokeWidth = 2,
}: IconProps) {
  const d = ICON_PATHS[name];
  if (!d) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={style}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
