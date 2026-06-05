import type { ReactNode } from "react";
import { useInView } from "../hooks/useInView";
import BrowserFrame from "./BrowserFrame";

// FeatureRow — the section wrapper that pairs a marker + headline + body +
// bullets with a Browser-framed product mockup. Mirrors the Claude design
// package's FeatureRow pattern from design-preview/marketing/home-parts.jsx
// where each major section embeds a full product UI in faux browser chrome.
//
// `full` mode (the default for these embeds) stacks the copy above the
// frame for maximum visual room — the embedded mockup gets the full content
// width. Used for sections where the product surface IS the proof: Sales
// Console, Brand Settings, Builder, Templates.

interface FeatureRowProps {
  id?: string;
  num: string;
  label: string;
  title: string;
  body: string | ReactNode;
  bullets?: string[];
  url: string;
  bodyHeight?: number;
  /** The mocked product UI rendered inside the BrowserFrame. */
  frame: ReactNode;
  /** Background tint variant for the section. */
  variant?: "cream" | "cream-2";
}

export default function FeatureRow({
  id,
  num,
  label,
  title,
  body,
  bullets,
  url,
  bodyHeight = 600,
  frame,
  variant = "cream",
}: FeatureRowProps) {
  const { ref, inView } = useInView(0.05);
  const bg = variant === "cream-2" ? "var(--cream-2)" : "var(--cream)";

  return (
    <section
      id={id}
      className="px-6 py-24 md:py-28"
      style={{
        background: bg,
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Copy block */}
        <div className="max-w-[660px] mb-10">
          <div className="marker marker-rule mb-5">
            {num} / {label}
          </div>
          <h2
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(30px, 3.6vw, 42px)",
              lineHeight: 1.08,
              letterSpacing: "-0.022em",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {title}
          </h2>
          <div
            className="mt-5 text-[16.5px] leading-[1.6] max-w-[560px]"
            style={{ color: "var(--ink-soft)" }}
          >
            {body}
          </div>
          {bullets && (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "20px 0 0",
                display: "flex",
                flexWrap: "wrap",
                gap: "10px 22px",
              }}
            >
              {bullets.map((b) => (
                <li
                  key={b}
                  style={{
                    display: "flex",
                    gap: 9,
                    alignItems: "center",
                    fontSize: 13.5,
                    color: "var(--ink-2)",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--indigo)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    <path d="M5 12.5L10 17.5L20 7.5" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Browser frame with embedded product UI */}
        <BrowserFrame url={url} bodyHeight={bodyHeight}>
          {frame}
        </BrowserFrame>
      </div>
    </section>
  );
}
