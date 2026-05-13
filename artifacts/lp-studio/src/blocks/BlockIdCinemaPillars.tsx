import { useEffect, useRef, useState } from "react";
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
    return (
      <video
        ref={videoRef}
        className="id-art-video"
        src={videoSrc}
        muted
        loop
        playsInline
        preload="metadata"
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
              <stop offset="0%" stopColor="#C7E738" />
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

  // Scroll-driven step switcher: whichever spacer has its midpoint closest to
  // the viewport center is the active panel. Mirrors the source's behavior.
  useEffect(() => {
    if (isEditor) return;
    if (props.pillarStackedScroll === false) return;
    if (typeof window === "undefined") return;
    // Trim any stale entries left over from a previous render with more
    // pillars so we never read past the current pillar count.
    spacerRefs.current.length = pillars.length;
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      let next = 0;
      for (let i = 0; i < pillars.length; i++) {
        const el = spacerRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.5 && r.bottom > vh * 0.5) {
          next = i;
          break;
        }
      }
      setActive((cur) => (cur === next ? cur : next));
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
  }, [isEditor, pillars.length]);

  const holdVh = Math.max(0.5, props.pillarHoldVh ?? 1.5);
  const stackedScroll = props.pillarStackedScroll !== false;
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
              <span className="id-dot" />
              <span>
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
