import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { bannerInk } from "@/lib/banner-color";

interface Props {
  text: string;
  linkUrl: string;
  ctaLabel: string;
  bgColor: string;
}

// A tiny, stable key so dismissal is remembered per banner content: when the
// operator changes the message or link, previously-dismissed visitors see the
// new bar again rather than it staying hidden forever.
function contentKey(text: string, linkUrl: string): string {
  let h = 0;
  const s = `${text}\u0000${linkUrl}`;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return `lp_banner_dismissed:${h}`;
}

/**
 * Slim, dismissible announcement bar pinned to the very top of the marketing
 * homepage. On-brand (ink bar / cream text), unobtrusive, and out of the way
 * once dismissed. While visible it sets the `--lp-banner-h` CSS variable to its
 * own height; the fixed Navbar reads that variable for its `top` offset and the
 * homepage pads its top by the same amount, so the bar never overlaps the nav
 * or the hero. Dismissing (or an empty/disabled config) resets the variable.
 */
// Defensive: the link is rendered into an <a href> so only allow http(s).
// Belt-and-suspenders for any legacy/bad row; the API also rejects these.
function isSafeUrl(u: string): boolean {
  try {
    const { protocol } = new URL(u, window.location.origin);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export default function AnnouncementBanner({ text, linkUrl, ctaLabel, bgColor }: Props) {
  const storageKey = contentKey(text, linkUrl);
  const ref = useRef<HTMLDivElement>(null);
  const safe = isSafeUrl(linkUrl);
  const [ctaHover, setCtaHover] = useState(false);
  const ink = bannerInk(bgColor);

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  // Keep the layout offset in sync with the bar's real height (it can wrap to
  // two lines on narrow screens). Cleared whenever the bar isn't shown.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (dismissed || !safe) {
      root.style.setProperty("--lp-banner-h", "0px");
      return;
    }
    const apply = () => {
      const h = ref.current?.offsetHeight ?? 0;
      root.style.setProperty("--lp-banner-h", `${h}px`);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.style.setProperty("--lp-banner-h", "0px");
    };
  }, [dismissed, safe, text, linkUrl, ctaLabel]);

  // If the content changes (new banner) re-evaluate the dismissed flag.
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  // Slide the banner up and out of view once the visitor starts scrolling. The
  // navbar reads the same threshold (scrollY > 8) and rises to the very top in
  // lockstep, so no gap ever opens between the menu and the top of the screen.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed || !safe) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* private mode — just hide for this session */
    }
    setDismissed(true);
  };

  const isExternal = /^https?:\/\//i.test(linkUrl);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Announcement"
      className="fixed top-0 left-0 right-0 z-[60]"
      style={{
        background: bgColor,
        color: ink.text,
        transform: scrolled ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 0.15s ease",
        pointerEvents: scrolled ? "none" : "auto",
      }}
    >
      <div className="max-w-[1180px] mx-auto px-6 py-2.5 flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center">
        <a
          href={linkUrl}
          {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="group inline-flex items-center gap-2 text-[13px] leading-snug"
          style={{ color: ink.text }}
          onMouseEnter={() => setCtaHover(true)}
          onMouseLeave={() => setCtaHover(false)}
        >
          <span style={{ opacity: 0.92 }}>{text}</span>
          {ctaLabel ? (
            <span
              className="inline-flex items-center gap-1 font-medium whitespace-nowrap"
              style={{
                color: ctaHover ? "var(--coral)" : ink.text,
                borderBottom: `1px solid ${ctaHover ? "var(--coral)" : ink.textSoft}`,
                transition: "color .15s ease, border-color .15s ease",
              }}
            >
              {ctaLabel}
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          ) : null}
        </a>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded transition-opacity"
        style={{ color: ink.text, opacity: 0.65 }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
