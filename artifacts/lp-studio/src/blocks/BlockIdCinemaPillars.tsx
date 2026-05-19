import { useEffect, useRef, useState } from "react";
import { BRAND_BODY_FONT } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
import type { IdCinemaPillarsBlockProps, IdCinemaPillar } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdCinemaPillarsBlockProps;
  onFieldChange?: (next: IdCinemaPillarsBlockProps) => void;
}

const ART_KINDS = ["scan", "design", "rail", "bars", "video"] as const;
type ArtKind = (typeof ART_KINDS)[number];

// The art layer for a given kind. All five are rendered at once; CSS opacity
// crossfades between them based on which one has `.id-active`.
function PillarArt({ kind, videoSrc, videoPosition, isActive }: { kind: ArtKind; videoSrc?: string; videoPosition?: string; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // `autoPlay` only fires on initial mount, so when the user scrolls to a
  // pillar that wasn't active at first paint its video never starts. Drive
  // play/pause imperatively from `isActive` instead.
  useEffect(() => {
    if (kind !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => { /* ignore autoplay rejection */ });
    } else {
      v.pause();
    }
  }, [kind, isActive, videoSrc]);

  if (kind === "video") {
    if (!videoSrc) {
      return <div className="id-art-video id-art-video-empty" aria-hidden />;
    }
    // Only the *active* pillar's video preloads anything from the network on
    // mount. Inactive pillars defer entirely (`preload="none"`) — the imperative
    // play() in the effect above will trigger a load when the user scrolls to
    // them. Without this, every pillar's video (5–10 MP4s, multi-MB each) hits
    // the network in parallel during initial page load and competes with the
    // hero's bg image, fonts, and JS chunks for bandwidth.
    return (
      <video
        ref={videoRef}
        className="id-art-video"
        src={videoSrc}
        muted
        loop
        playsInline
        preload={isActive ? "metadata" : "none"}
        style={{ objectPosition: videoPosition || "center" }}
        aria-hidden
      />
    );
  }
  if (kind === "scan") {
    return (
      <div className="id-art-scan">
        <div className="id-dots" />
        <div className="id-ring" />
        <div className="id-ring id-r2" />
        <div className="id-ring id-r3" />
        <div className="id-core" />
      </div>
    );
  }
  if (kind === "design") {
    return (
      <div className="id-art-design">
        <div className="id-grid-floor" />
        <svg viewBox="0 0 680 480" aria-hidden>
          <defs>
            <linearGradient id="idWireGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--brand-accent, #C7E738)" }} />
              <stop offset="100%" stopColor="#1AC065" />
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#idWireGrad)" strokeWidth={1} opacity={0.85}>
            <ellipse cx={340} cy={240} rx={200} ry={120} />
            <ellipse cx={340} cy={240} rx={150} ry={90} />
            <ellipse cx={340} cy={240} rx={100} ry={60} />
            <path d="M140 240 Q 340 120 540 240" />
            <path d="M140 240 Q 340 360 540 240" />
            <path d="M340 120 L 340 360" />
            <path d="M240 180 L 440 300" />
            <path d="M440 180 L 240 300" />
          </g>
        </svg>
      </div>
    );
  }
  if (kind === "rail") {
    return (
      <div className="id-art-make">
        <div className="id-rail" />
        <div className="id-traveler" />
        <div className="id-node" />
        <div className="id-node" />
        <div className="id-node" />
        <div className="id-node" />
        <div className="id-node" />
      </div>
    );
  }
  return (
    <div className="id-art-bars">
      {[30, 48, 38, 62, 55, 74, 68, 82, 78, 92, 88, 100].map((h, i) => (
        <div key={i} className="id-bar" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function normalizeArt(art: string | undefined): ArtKind {
  return (ART_KINDS as readonly string[]).includes(art ?? "") ? (art as ArtKind) : "scan";
}

export function BlockIdCinemaPillars({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const pillars = props.pillars ?? [];
  const isEditor = !!onFieldChange;
  const sectionRef = useRef<HTMLElement>(null);
  const spacerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [active, setActive] = useState(0);

  // Scroll-driven crossfade. Replaces the previous discrete "active index
  // flips at the 50% line + fixed 900ms CSS transition" model with a
  // continuous per-pillar progress (0..1) computed from the spacer's
  // distance from viewport center, written straight to the DOM as a `--p`
  // CSS variable on each layer and panel. Because progress is now coupled
  // to scroll position, slow scrolls give slow fades and fast scrolls
  // give fast fades — no orphaned transitions, no mid-air "snap".
  const holdVh = Math.max(0.5, props.pillarHoldVh ?? 1.5);
  const stackedScroll = props.pillarStackedScroll !== false;

  useEffect(() => {
    if (isEditor) return;
    if (props.pillarStackedScroll === false) return;
    if (typeof window === "undefined") return;
    spacerRefs.current.length = pillars.length;
    const root = sectionRef.current;
    if (!root) return;
    const layerEls = root.querySelectorAll<HTMLElement>(".id-cinema-art .id-layer");
    const panelEls = root.querySelectorAll<HTMLElement>(".id-cinema-text .id-panel");
    const bgEl = root.querySelector<HTMLElement>(".id-cinema-bg");
    let raf = 0;
    // Sharp S-curve. smootherstep(t) = 6t^5 − 15t^4 + 10t^3; composing it
    // with itself (`smootherstep(smootherstep(t))`) gives a much steeper
    // ramp through the midpoint than plain smoothstep, so the awkward
    // 50/50 dwell where both pillars are half-visible is brief.
    const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const ease = (t: number) => smootherstep(smootherstep(t));
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      // Strict complementary crossfade between *exactly two* neighboring
      // pillars at a time. Find the spacer just above and just below the
      // viewport center, compute t = how far between them, and assign
      // opacities (1-t, t). Everything else is 0. This guarantees the
      // visible opacities always sum to 1 — no white flash between, no
      // three-way overlap of stacked text, and no period where both
      // adjacent pillars sit at half-opacity.
      let beforeI = -1;
      let beforePos = -Infinity;
      let afterI = -1;
      let afterPos = Infinity;
      for (let i = 0; i < pillars.length; i++) {
        const el = spacerRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const pos = (r.top + r.height / 2) - vh / 2;
        if (pos <= 0 && pos > beforePos) {
          beforeI = i;
          beforePos = pos;
        }
        if (pos > 0 && pos < afterPos) {
          afterI = i;
          afterPos = pos;
        }
      }
      const opacities = new Array<number>(pillars.length).fill(0);
      let activeI = 0;
      if (beforeI === -1 && afterI === -1) {
        // No spacers measured yet (initial mount before layout).
        opacities[0] = 1;
      } else if (beforeI === -1) {
        // Above the first pillar — anchor on it.
        opacities[afterI] = 1;
        activeI = afterI;
      } else if (afterI === -1) {
        // Past the last pillar — anchor on it.
        opacities[beforeI] = 1;
        activeI = beforeI;
      } else {
        const span = afterPos - beforePos;
        const t = span > 0 ? (-beforePos) / span : 0;
        const eased = ease(Math.min(1, Math.max(0, t)));
        opacities[beforeI] = 1 - eased;
        opacities[afterI] = eased;
        activeI = eased >= 0.5 ? afterI : beforeI;
      }
      for (let i = 0; i < pillars.length; i++) {
        const v = opacities[i].toFixed(4);
        layerEls[i]?.style.setProperty("--p", v);
        panelEls[i]?.style.setProperty("--p", v);
      }
      // Discrete state still drives the side stepper (color/dot scale) and
      // the background gradient swap, but only re-renders when it actually
      // flips — so the cheap React work doesn't fight the rAF loop.
      setActive((cur) => (cur === activeI ? cur : activeI));
      if (bgEl && bgEl.dataset.bg !== String(activeI)) {
        bgEl.dataset.bg = String(activeI);
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [isEditor, pillars.length, props.pillarStackedScroll, holdVh]);
  const flatMode = !stackedScroll && !isEditor;

  const updatePillar = (i: number, patch: Partial<IdCinemaPillar>) => {
    if (!onFieldChange) return;
    const next = pillars.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onFieldChange({ ...props, pillars: next });
  };

  return (
    <section
      ref={sectionRef}
      className={`id-block id-cinema${isEditor ? " id-cinema-editor" : ""}${flatMode ? " id-cinema-flat" : ""}`}
    >
      <div className="id-cinema-sticky">
        <div className="id-cinema-bg" data-bg={String(active)} aria-hidden />
        <div className="id-cinema-stepper" aria-hidden>
          {pillars.map((p, i) => (
            <div key={i} className={`id-step${i === active ? " id-active" : ""}`}>
              <span className="id-dot" style={{ fontFamily: BODY }}/>
              <span style={{ fontFamily: BODY }}>
                {String(i + 1).padStart(2, "0")} / {(p.label ?? "").split("·")[0]?.trim() || `Step ${i + 1}`}
              </span>
            </div>
          ))}
        </div>
        <div className="id-cinema-art" aria-hidden>
          {pillars.map((p, i) => {
            const kind = normalizeArt(p.art);
            return (
              <div key={i} className={`id-layer${i === active ? " id-active" : ""}${kind === "bars" ? " id-pillar-bars" : ""}`}>
                <PillarArt
                  kind={kind}
                  videoSrc={p.videoSrc}
                  videoPosition={p.videoPosition}
                  isActive={i === active}
                />
              </div>
            );
          })}
        </div>
        <div className="id-cinema-text">
          {pillars.map((p, i) => {
            const kind = normalizeArt(p.art);
            return (
              <div key={i} className={`id-panel${i === active ? " id-active" : ""}${kind === "bars" ? " id-pillar-bars" : ""}`}>
                {flatMode && (
                  <div className={`id-panel-art${kind === "bars" ? " id-pillar-bars" : ""}`} aria-hidden>
                    <PillarArt
                      kind={kind}
                      videoSrc={p.videoSrc}
                      videoPosition={p.videoPosition}
                      isActive
                    />
                  </div>
                )}
                <div className="id-meta">
                  <EditableEm
                    as="div"
                    className="id-num"
                    value={p.number ?? ""}
                    onUpdate={onFieldChange ? (v) => updatePillar(i, { number: v }) : undefined}
                  />
                  <div className="id-right">
                    <InlineText
                      as="div"
                      className="id-label"
                      value={p.label ?? ""}
                      onUpdate={onFieldChange ? (v) => updatePillar(i, { label: v }) : undefined}
                    />
                    <EditableEm
                      as="h3"
                      value={p.headline ?? ""}
                      onUpdate={onFieldChange ? (v) => updatePillar(i, { headline: v }) : undefined}
                    />
                    <EditableEm
                      as="p"
                      multiline
                      value={p.body ?? ""}
                      onUpdate={onFieldChange ? (v) => updatePillar(i, { body: v }) : undefined}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {!isEditor && stackedScroll &&
        pillars.map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              spacerRefs.current[i] = el;
            }}
            className="id-cinema-spacer"
            style={{ height: `${holdVh * 100}vh` }}
            aria-hidden
          />
        ))}
    </section>
  );
}
