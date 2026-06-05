import { useEffect, useRef, useState, type ReactNode } from "react";

// BrowserFrame — the chrome-around-product-UI device that makes the Claude
// design package's feature rows feel like you're looking through a window
// into the actual app. The trick that makes this performant: the child is
// lazy-mounted via a poll + scroll listener so multiple embedded mockups
// (Sales Console, Brand Settings, Builder, Templates) can live on the page
// without ballooning initial render. Inspired by design-preview/marketing/
// home-parts.jsx's Browser component, ported to TSX with a proper
// IntersectionObserver-fallback.

interface BrowserFrameProps {
  url: string;
  bodyHeight?: number;
  children: ReactNode;
  /** Optional aspect — if set, ignores bodyHeight and uses padding-bottom for a fluid frame. */
  aspect?: number;
}

export default function BrowserFrame({
  url,
  bodyHeight = 560,
  children,
  aspect,
}: BrowserFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;

    // Prefer IntersectionObserver where available — falls back to a poll +
    // scroll listener on older browsers (very rare in 2026 but cheap to keep).
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setShow(true);
            io.disconnect();
          }
        },
        { rootMargin: "700px 0px" }, // generous so the mount feels instant on scroll
      );
      io.observe(el);
      return () => io.disconnect();
    }

    const check = () => {
      const e = ref.current;
      if (!e) return false;
      const r = e.getBoundingClientRect();
      if (r.top < window.innerHeight + 700 && r.bottom > -700) {
        setShow(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const id = window.setInterval(() => {
      if (check()) window.clearInterval(id);
    }, 250);
    window.addEventListener("scroll", check, { passive: true });
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", check);
    };
  }, [show]);

  const bodyStyle: React.CSSProperties = aspect
    ? { paddingBottom: `${(1 / aspect) * 100}%`, position: "relative", overflow: "hidden" }
    : ({
        "--bf-h": `${bodyHeight}px`,
        height: "var(--bf-h)",
        overflow: "hidden",
        position: "relative",
      } as React.CSSProperties);

  return (
    <div
      ref={ref}
      style={{
        borderRadius: 14,
        overflow: "hidden",
        background: "#fff",
        border: "1px solid var(--hairline)",
        boxShadow:
          "0 40px 80px -34px rgba(26,24,21,0.34), 0 12px 28px -18px rgba(26,24,21,0.18)",
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 14px",
          background: "var(--cream-2)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <span style={{ display: "inline-flex", gap: 7 }}>
          <i style={{ width: 10, height: 10, borderRadius: 999, background: "#ec6a5e" }} />
          <i style={{ width: 10, height: 10, borderRadius: 999, background: "#f4bf4f" }} />
          <i style={{ width: 10, height: 10, borderRadius: 999, background: "#61c554" }} />
        </span>
        <span
          style={{
            flex: 1,
            marginLeft: 6,
            background: "#fff",
            border: "1px solid var(--hairline)",
            borderRadius: 7,
            padding: "4px 12px",
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            fontSize: 11.5,
            color: "var(--ink-mute)",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.5 }}
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          {url}
        </span>
      </div>

      {/* Body — placeholder shown until lazy-mount triggers */}
      <div className={aspect ? undefined : "bf-body"} style={bodyStyle}>
        {show ? (
          children
        ) : (
          <div
            style={{
              position: aspect ? "absolute" : undefined,
              inset: aspect ? 0 : undefined,
              height: aspect ? undefined : "100%",
              background:
                "repeating-linear-gradient(135deg,#fbf9f3,#fbf9f3 14px,#f5f1e7 14px,#f5f1e7 28px)",
            }}
          />
        )}
      </div>
    </div>
  );
}
