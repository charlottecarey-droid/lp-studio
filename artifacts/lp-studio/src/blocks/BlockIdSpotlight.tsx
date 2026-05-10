import { useEffect, useRef } from "react";
import type { IdSpotlightBlockProps } from "@/lib/block-types";
import { useInsideDandyStyles } from "./inside-dandy/insideDandyStyles";
import { EditableEm } from "./inside-dandy/idHelpers";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: IdSpotlightBlockProps;
  onFieldChange?: (next: IdSpotlightBlockProps) => void;
}

const TONE_TO_CLASS: Record<string, string> = {
  alert: "id-sp-tone-alert",
  warn: "id-sp-tone-warn",
  ok: "id-sp-tone-ok",
  info: "id-sp-tone-info",
};

export function BlockIdSpotlight({ props, onFieldChange }: Props) {
  useInsideDandyStyles();
  const eyebrow = props.eyebrow ?? "";
  const headline = props.headline ?? "";
  const body = props.body ?? "";
  const videoSrc = props.videoSrc ?? "";
  const posterUrl = props.posterUrl ?? "";
  const cardTitle = props.cardTitle ?? "";
  const cardSubtitle = props.cardSubtitle ?? "";
  const results = props.results ?? [];
  const steps = props.steps ?? [];
  const activeStep = Math.max(0, Math.min(steps.length - 1, props.activeStep ?? 0));

  const setField = <K extends keyof IdSpotlightBlockProps>(key: K, value: IdSpotlightBlockProps[K]) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, [key]: value });
  };

  // Browsers cap how many <video autoplay> elements can decode in parallel
  // (typically ~3 on desktop, even fewer on mobile). When a page has
  // multiple Spotlight / Cinema Pillars blocks each with their own video,
  // the later ones get stuck on a poster frame and look like static images.
  // The fix: only call play() while the video is actually in the viewport,
  // and pause it otherwise. That way the browser never has to juggle more
  // than 1-2 active decoders even on a long page.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v || typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [videoSrc]);

  return (
    <section className="id-section id-spotlight" aria-labelledby="id-spotlight-h">
      <div className="id-spotlight-bg" aria-hidden />
      <div className="id-spotlight-grid">
        <div className="id-spotlight-text">
          {(eyebrow || onFieldChange) && (
            <div className="id-spotlight-eyebrow">
              <InlineText
                value={eyebrow}
                onUpdate={onFieldChange ? (v: string) => setField("eyebrow", v) : undefined}
               
                
              />
            </div>
          )}
          <h2 id="id-spotlight-h" className="id-spotlight-h">
            <EditableEm
              value={headline}
              onUpdate={onFieldChange ? (v: string) => setField("headline", v) : undefined}
             
              
            />
          </h2>
          {(body || onFieldChange) && (
            <p className="id-spotlight-body">
              <InlineText
                value={body}
                onUpdate={onFieldChange ? (v: string) => setField("body", v) : undefined}
                multiline
               
                
              />
            </p>
          )}
        </div>

        <div className="id-spotlight-stage">
          <div className="id-spotlight-media">
            {videoSrc ? (
              <video
                ref={videoRef}
                className="id-spotlight-video"
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={posterUrl || undefined}
                style={{ objectPosition: props.videoPosition || "center" }}
                aria-hidden
              />
            ) : posterUrl ? (
              <img
                className="id-spotlight-video"
                src={posterUrl}
                alt=""
                style={{ objectPosition: props.videoPosition || "center" }}
              />
            ) : (
              <div className="id-spotlight-video id-spotlight-empty" aria-hidden />
            )}
          </div>

          {(cardTitle || cardSubtitle || results.length > 0) && (
            <div className="id-spotlight-card" role="group" aria-label="AI scan results">
              {(cardTitle || onFieldChange) && (
                <div className="id-sp-card-title">
                  <span className="id-sp-card-glyph" aria-hidden />
                  <InlineText
                    value={cardTitle}
                    onUpdate={onFieldChange ? (v: string) => setField("cardTitle", v) : undefined}
                   
                    
                  />
                </div>
              )}
              {(cardSubtitle || onFieldChange) && (
                <div className="id-sp-card-subtitle">
                  <InlineText
                    value={cardSubtitle}
                    onUpdate={onFieldChange ? (v: string) => setField("cardSubtitle", v) : undefined}
                   
                    
                  />
                </div>
              )}
              <div className="id-sp-results">
                {results.map((r, i) => (
                  <div key={i} className={`id-sp-result ${TONE_TO_CLASS[r.tone] || "id-sp-tone-alert"}`}>
                    <span className="id-sp-dot" aria-hidden />
                    <div className="id-sp-result-text">
                      <div className="id-sp-result-title">{r.title}</div>
                      {r.body && <div className="id-sp-result-body">{r.body}</div>}
                      {r.actionText && (
                        r.actionUrl ? (
                          <a className="id-sp-result-action" href={r.actionUrl}>{r.actionText}</a>
                        ) : (
                          <span className="id-sp-result-action">{r.actionText}</span>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {steps.length > 0 && (
            <ol className="id-spotlight-stepper" aria-label="Section steps">
              {steps.map((s, i) => (
                <li key={i} className={`id-sp-step${i === activeStep ? " id-active" : ""}`}>
                  <span className="id-sp-step-label">{s.label}</span>
                  <span className="id-sp-step-dot" aria-hidden />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
