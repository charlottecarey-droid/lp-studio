import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./EmbedIcons";

// TemplatesEmbed — real templates from LP_TEMPLATES (lib/templates.ts). The
// card shows a curated Unsplash thumbnail for fast initial render; clicking
// opens a modal that iframes the live /preview/template/:templateId route
// which renders the template via BlockRenderer for real. The /preview/template
// route is public (App.tsx routes it inside the openLocations allowlist), so
// the iframe works without auth.
//
// "Use this template" → app.lpstudio.ai/?template={id} which the app reads on
// initial load and uses to clone the template into the user's tenant on first
// auth (or signup). Tracked separately; for now the URL is set, app side just
// needs to consume the param.

interface Template {
  /** LP_TEMPLATES id — the same id the public /preview/template/:id route resolves */
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  // Display category. The built-in list uses a small fixed set, but the
  // superadmin-editable config can supply any string, so accept any value and
  // fall back to a neutral accent color for unknown categories.
  category: string;
  blocks: number;
}

const CAT_COLOR: Record<string, string> = {
  Marketing: "#3C38B8",
  Sales: "#E26B4F",
  Events: "#C8923D",
  Story: "#6B9171",
  Launch: "#3C38B8",
};
const CAT_COLOR_FALLBACK = "#3C38B8";

// Curated subset of LP_TEMPLATES (artifacts/lp-studio/src/lib/templates.ts).
// IDs map 1:1 to /preview/template/:id (App.tsx mounts that route inside the
// public openLocations allowlist, so the iframe loads without auth). Trimmed
// to 6 here so the embed reads as a curated preview rather than the full
// gallery — visitors who want the catalogue can hit app.lpstudio.ai/templates
// from the modal CTA. Picked across all five categories (Launch / Events /
// Story / Marketing / Sales) for range.
const TEMPLATES: Template[] = [
  {
    id: "product-launch-keynote",
    title: "Product Launch Keynote",
    description:
      "Apple-event reveal style: sticky chapter nav, full-bleed hero with video, feature slabs, comparison table, plans, and a closing CTA. Toggle Light/Dark/Auto.",
    thumbnail:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&h=630&fit=crop",
    category: "Launch",
    blocks: 12,
  },
  {
    id: "inside-dandy-event",
    title: "Executive Event RSVP",
    description:
      "Premium invite-only event landing page with a 3-day agenda, photo gallery, and multi-step RSVP form. Built for high-touch VIP events.",
    thumbnail:
      "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=1200&h=630&fit=crop",
    category: "Events",
    blocks: 9,
  },
  {
    id: "story-hub-dark-luxury",
    title: "Customer Story Hub",
    description:
      "Editorial dark-luxury gallery of customer stories. Cinematic featured hero, filterable grid, stats row, and closing CTA.",
    thumbnail:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1200&h=630&fit=crop",
    category: "Story",
    blocks: 10,
  },
  {
    id: "video-hero",
    title: "Video Hero",
    description:
      "Lead with the demo video, back it up with proof. Highest-converting structure for warm traffic that already knows the category.",
    thumbnail:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&h=630&fit=crop",
    category: "Marketing",
    blocks: 7,
  },
  {
    id: "social-proof-leader",
    title: "Social Proof Leader",
    description:
      "Lead with a powerful customer testimonial. Skeptics trust peers more than brands — open with the quote, then back it with the why.",
    thumbnail:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1200&h=630&fit=crop",
    category: "Sales",
    blocks: 8,
  },
  {
    id: "inside-dandy-spatial-tour",
    title: "Immersive Product Tour",
    description:
      "Cinematic, vertical-journey landing page. Five-station scroll narrative, spatial-VR vibe, dark forest palette. For premium product reveals.",
    thumbnail:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&h=630&fit=crop",
    category: "Launch",
    blocks: 11,
  },
];

const APP_BASE = "https://app.lpstudio.ai";

function previewUrl(id: string): string {
  return `${APP_BASE}/preview/template/${encodeURIComponent(id)}`;
}

function templateUrl(id: string): string {
  return `${APP_BASE}/?template=${encodeURIComponent(id)}&utm_source=marketing&utm_medium=template_card`;
}

// Live preview iframe — renders the real LP_TEMPLATES output at desktop
// design width (1280px), CSS-scaled down to fit the modal. ResizeObserver
// keeps the scale correct on container resize. Tall fixed design height so
// the whole template scrolls inside the modal body.
function LivePreview({ url }: { url: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.55);
  const DESIGN_W = 1280;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / DESIGN_W);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "var(--cream-2)",
      }}
    >
      <iframe
        src={url}
        title="Template preview"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: DESIGN_W,
          height: `${100 / scale}%`,
          border: "none",
          background: "#fff",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}

function TemplateCard({
  template,
  onPreview,
}: {
  template: Template;
  onPreview: (t: Template) => void;
}) {
  // Cards are tappable on every breakpoint: desktop opens the slim PreviewModal,
  // mobile opens the full-screen MobilePreviewSheet. The hover-driven styles are
  // purely visual; mobile fires no hover events, so `hover` simply stays false.
  const [hover, setHover] = useState(false);
  const color = CAT_COLOR[template.category] ?? CAT_COLOR_FALLBACK;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onPreview(template)}
      style={{
        background: "#fff",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform .16s cubic-bezier(.16,1,.3,1), box-shadow .16s",
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover
          ? `0 22px 44px -22px rgba(26,24,21,0.34), 0 0 0 1.5px ${color}`
          : "0 0 0 1px var(--hairline), 0 1px 2px rgba(26,24,21,0.04)",
      }}
    >
      {/* Real thumbnail */}
      <div
        style={{
          position: "relative",
          borderBottom: "1px solid var(--hairline)",
          height: 160,
          overflow: "hidden",
          background: "var(--cream-2)",
        }}
      >
        <img
          src={template.thumbnail}
          alt={template.title}
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        {/* Hover overlay with Preview pill */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(14, 27, 48, 0.34)",
            opacity: hover ? 1 : 0,
            transition: "opacity .16s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: hover ? "blur(1px)" : "none",
            WebkitBackdropFilter: hover ? "blur(1px)" : "none",
          }}
        >
          <span
            style={{
              background: "#fff",
              borderRadius: 999,
              padding: "9px 16px",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--ink)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 6px 16px -6px rgba(0,0,0,0.3)",
            }}
          >
            <Icon name="eye" size={13} /> Preview
          </span>
        </div>
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            color: "var(--ink)",
            borderRadius: 999,
            padding: "3px 9px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          }}
        >
          Free
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "13px 16px 14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 9,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
            }}
          >
            {template.title}
          </span>
          <Icon
            name="arrow-up-right"
            size={14}
            style={{
              color: hover
                ? color
                : "color-mix(in srgb, var(--ink-mute) 50%, transparent)",
              flexShrink: 0,
            }}
          />
        </div>
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--ink-mute)",
            margin: "0 0 12px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 36,
          }}
        >
          {template.description}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingTop: 11,
            borderTop: "1px solid var(--hairline)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              color,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: color,
              }}
            />
            {template.category}
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--ink-mute)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Icon name="layout-grid" size={11} /> {template.blocks} blocks
          </span>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  // Lock body scroll + close-on-Escape while the modal is mounted. Restores
  // the original overflow value on unmount so we don't trample whatever else
  // is using it. Portal renders to document.body so the modal escapes the
  // BrowserFrame's clipping and covers the whole marketing page.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const modal = (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${template.title} — template preview`}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14, 27, 48, 0.62)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 880,
          height: 600,
          maxWidth: "100%",
          maxHeight: "100%",
          background: "#fff",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--hairline)",
          boxShadow: "0 24px 60px -28px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header — slim, single white surface separated from the preview by a
            hairline. Title + meta on the left, flat action + minimal close on
            the right. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            padding: "14px 16px",
            borderBottom: "1px solid var(--hairline)",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: "-0.01em",
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {template.title}
            </div>
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
          >
            <a
              href={templateUrl(template.id)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 14px",
                borderRadius: 8,
                background: "#3C38B8",
                color: "#fff",
                border: "none",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                letterSpacing: "-0.005em",
              }}
            >
              <Icon name="sparkles" size={13} /> Use this template
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "transparent",
                border: "none",
                color: "var(--ink-mute)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Icon name="x" size={17} />
            </button>
          </div>
        </div>

        {/* Body — the live preview is the sole focus; it fills the remaining
            height with no framing chrome beyond the header hairline. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            background: "var(--cream-2)",
          }}
        >
          <LivePreview url={previewUrl(template.id)} />
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// Mobile preview — a full-screen sheet that loads the live /preview/template
// iframe at the phone's native width (the template renders responsively, so no
// desktop-style scaling is needed). A sticky bottom CTA keeps "Use this
// template" reachable; the header carries the title + a close affordance.
// Honors safe-area insets so the chrome clears notches / home indicators.
function MobilePreviewSheet({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${template.title} — template preview`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header — title + close, padded for the notch */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
          borderBottom: "1px solid var(--hairline)",
          flexShrink: 0,
          background: "#fff",
        }}
      >
        <div
          style={{
            fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
            flex: 1,
          }}
        >
          {template.title}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "transparent",
            border: "none",
            color: "var(--ink-mute)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Icon name="x" size={19} />
        </button>
      </div>

      {/* Body — live iframe at native width, scrolls inside the sheet */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          background: "var(--cream-2)",
        }}
      >
        <iframe
          src={previewUrl(template.id)}
          title="Template preview"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            background: "#fff",
            display: "block",
          }}
        />
      </div>

      {/* Sticky CTA — keeps "Use this template" thumb-reachable */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 14px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          borderTop: "1px solid var(--hairline)",
          background: "#fff",
        }}
      >
        <a
          href={templateUrl(template.id)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            width: "100%",
            fontSize: 14,
            fontWeight: 600,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#3C38B8",
            color: "#fff",
            border: "none",
            textDecoration: "none",
            letterSpacing: "-0.005em",
          }}
        >
          <Icon name="sparkles" size={14} /> Use this template
        </a>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}

// Normalize a raw API entry into a Template, dropping anything missing the
// fields the card actually needs to render + preview/clone.
function toTemplate(raw: unknown): Template | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!id) return null;
  return {
    id,
    title: typeof r.title === "string" ? r.title : "",
    description: typeof r.description === "string" ? r.description : "",
    thumbnail: typeof r.thumbnail === "string" ? r.thumbnail : "",
    category: typeof r.category === "string" ? r.category : "",
    blocks: typeof r.blocks === "number" ? r.blocks : 0,
  };
}

export default function TemplatesEmbed() {
  const [open, setOpen] = useState<Template | null>(null);
  // Start with the built-in list so the section renders instantly (and works
  // when prerendered/offline), then replace it with the superadmin-editable
  // config from the public endpoint once it resolves. Any failure or empty
  // response keeps the built-in fallback, so the section is never blank.
  const [templates, setTemplates] = useState<Template[]>(TEMPLATES);

  // SSR-safe mobile detection: default desktop (marketing is prerendered to
  // desktop HTML), then flip after mount. On mobile we show only 3 cards; tap
  // opens the full-screen MobilePreviewSheet (desktop keeps the slim modal).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const visible = isMobile ? templates.slice(0, 3) : templates;

  useEffect(() => {
    let cancelled = false;
    fetch(`${APP_BASE}/api/lp/featured-templates`, { credentials: "omit" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.templates)) return;
        const parsed = data.templates
          .map(toTemplate)
          .filter((t: Template | null): t is Template => t !== null);
        if (parsed.length > 0) setTemplates(parsed);
      })
      .catch(() => {
        /* keep built-in fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        background: "var(--cream)",
        padding: "26px 30px",
        overflow: "auto",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <style>{`
        @media (max-width: 1023px) {
          .tpl-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 639px) {
          .tpl-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1
            style={{
              fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Templates
          </h1>
          <p
            style={{
              color: "var(--ink-mute)",
              fontSize: 13.5,
              margin: "5px 0 0",
            }}
          >
            Clone a ready-made layout, preview it live, then start from there
            in the builder.
          </p>
        </div>

        {/* Filter row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 180,
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: "1px solid var(--hairline)",
              borderRadius: 8,
              padding: "7px 11px",
              background: "#fff",
              color: "var(--ink-mute)",
              fontSize: 12.5,
            }}
          >
            <Icon name="search" size={13} /> Search templates…
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 11px",
              borderRadius: 8,
              background: "linear-gradient(180deg, #2D2A24 0%, #1A1815 100%)",
              color: "var(--cream)",
              border: "1px solid rgba(0,0,0,0.4)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 10px -6px rgba(26,24,21,0.4)",
              textShadow: "0 1px 0 rgba(0,0,0,0.25)",
            }}
          >
            <Icon name="star" size={12} /> Featured
          </span>
          {["Industry", "Type"].map((t) => (
            <span
              key={t}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: "7px 11px",
                borderRadius: 8,
                background: "var(--paper)",
                border: "1px solid var(--hairline-strong)",
                color: "var(--ink-2)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "var(--ink)",
              }}
            >
              All templates
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--ink-mute)",
                background:
                  "color-mix(in srgb, var(--ink) 6%, var(--paper))",
                borderRadius: 999,
                padding: "1px 8px",
              }}
            >
              {visible.length}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              color: "var(--ink-mute)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icon name="arrow-up-down" size={12} /> Featured
          </span>
        </div>

        {/* Grid */}
        <div
          className="tpl-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {visible.map((t) => (
            <TemplateCard key={t.id} template={t} onPreview={setOpen} />
          ))}
        </div>
      </div>

      {open &&
        (isMobile ? (
          <MobilePreviewSheet template={open} onClose={() => setOpen(null)} />
        ) : (
          <PreviewModal template={open} onClose={() => setOpen(null)} />
        ))}
    </div>
  );
}
