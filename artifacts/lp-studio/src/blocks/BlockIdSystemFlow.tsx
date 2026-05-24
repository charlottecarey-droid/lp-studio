import type { IdSystemFlowBlockProps } from "@/lib/block-types";

interface Props {
  props: IdSystemFlowBlockProps;
}

const HEAD = `"Söhne", -apple-system, "Helvetica Neue", Arial, sans-serif`;
const SERIF = `"Tiempos Headline", "GT Sectra", "Canela", Georgia, serif`;
const MONO = `"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace`;
const TEAL = "#001814";
const CITRON = "#C7E738";
const DIVIDER = "rgba(199,231,56,0.16)";
const RAIL = "rgba(199,231,56,0.35)";

function pad2(n: number) {
  return String(n + 1).padStart(2, "0");
}

export function BlockIdSystemFlow({ props }: Props) {
  const stations = (props.stations ?? []).slice(0, 6);
  const activeIndex = Math.max(
    0,
    Math.min(stations.length - 1, props.activeIndex ?? 0),
  );

  return (
    <section
      className="id-flow"
      style={{
        background: TEAL,
        color: "#fff",
        padding: "120px 56px 96px",
        fontFamily: HEAD,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <FlowStyles />

      {/* Header */}
      <div className="id-flow__head">
        <div>
          {props.eyebrow && (
            <div className="id-flow__eyebrow">
              <span className="id-flow__eyebrow-dot" aria-hidden />
              <span dangerouslySetInnerHTML={{ __html: props.eyebrow }} />
            </div>
          )}
          <h2
            className="id-flow__headline"
            dangerouslySetInnerHTML={{ __html: props.headline }}
          />
        </div>
        {(props.metricLabel || props.metricValue) && (
          <div className="id-flow__metric">
            {props.metricLabel && (
              <div className="id-flow__metric-label">{props.metricLabel}</div>
            )}
            {props.metricValue && (
              <div
                className="id-flow__metric-value"
                dangerouslySetInnerHTML={{ __html: props.metricValue }}
              />
            )}
          </div>
        )}
      </div>

      <hr className="id-flow__divider" />

      {/* Top meta row: timestamp / italic label / tag */}
      <div
        className="id-flow__grid"
        style={{ gridTemplateColumns: `repeat(${stations.length}, 1fr)` }}
      >
        {stations.map((s, i) => (
          <div key={`top-${i}`} className="id-flow__top">
            {s.timestamp && (
              <div className="id-flow__top-time">{s.timestamp}</div>
            )}
            <div className="id-flow__top-label">{s.label}</div>
            {s.tag && <div className="id-flow__top-tag">{s.tag}</div>}
          </div>
        ))}
      </div>

      <hr className="id-flow__divider" />

      {/* The rail */}
      <div
        className="id-flow__rail-wrap"
        style={{ gridTemplateColumns: `repeat(${stations.length}, 1fr)` }}
      >
        <div className="id-flow__rail-line" aria-hidden />
        {stations.map((s, i) => {
          const isActive = i === activeIndex;
          return (
            <div key={`circle-${i}`} className="id-flow__circle-cell">
              <div
                className={`id-flow__circle${isActive ? " id-flow__circle--active" : ""}`}
              >
                <span>{pad2(i)}</span>
                {isActive && (
                  <span className="id-flow__circle-pulse" aria-hidden />
                )}
              </div>
              {isActive && s.activeCaseId && (
                <div className="id-flow__case-chip">
                  <span className="id-flow__case-dot" aria-hidden />
                  <span>{s.activeCaseId}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom block info */}
      <div
        className="id-flow__grid id-flow__bottom"
        style={{ gridTemplateColumns: `repeat(${stations.length}, 1fr)` }}
      >
        {stations.map((s, i) => (
          <div key={`bot-${i}`} className="id-flow__cell">
            {s.category && (
              <div className="id-flow__cell-cat">{s.category}</div>
            )}
            <div
              className="id-flow__cell-title"
              dangerouslySetInnerHTML={{ __html: s.title }}
            />
            {s.description && (
              <div className="id-flow__cell-desc">{s.description}</div>
            )}
          </div>
        ))}
      </div>

      {(props.footerBadge ||
        props.footerBody ||
        props.footerMetricValue ||
        props.ctaText) && (
        <>
          <hr className="id-flow__divider" />
          <div className="id-flow__footer">
            <div className="id-flow__footer-left">
              {props.footerBadge && (
                <span className="id-flow__footer-badge">
                  {props.footerBadge}
                </span>
              )}
              {props.footerBody && (
                <p
                  className="id-flow__footer-body"
                  dangerouslySetInnerHTML={{ __html: props.footerBody }}
                />
              )}
            </div>
            <div className="id-flow__footer-right">
              {(props.footerMetricLabel || props.footerMetricValue) && (
                <div className="id-flow__footer-metric">
                  {props.footerMetricLabel && (
                    <div className="id-flow__metric-label">
                      {props.footerMetricLabel}
                    </div>
                  )}
                  {props.footerMetricValue && (
                    <div
                      className="id-flow__footer-metric-value"
                      dangerouslySetInnerHTML={{
                        __html: props.footerMetricValue,
                      }}
                    />
                  )}
                </div>
              )}
              {props.ctaText && (
                <a
                  className="id-flow__cta"
                  href={props.ctaUrl || "#"}
                >
                  {props.ctaText}
                  <span aria-hidden> →</span>
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function FlowStyles() {
  return (
    <style>{`
      .id-flow { box-sizing: border-box; }
      .id-flow *, .id-flow *::before, .id-flow *::after { box-sizing: border-box; }
      .id-flow__head { display: grid; grid-template-columns: 1fr auto; gap: 48px; align-items: end; margin-bottom: 32px; }
      .id-flow__eyebrow { font-family: ${MONO}; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.7); display: inline-flex; align-items: center; gap: 10px; margin-bottom: 28px; }
      .id-flow__eyebrow-dot { width: 8px; height: 8px; border-radius: 50%; background: ${CITRON}; box-shadow: 0 0 12px rgba(199,231,56,0.6); }
      .id-flow__headline { font-family: ${SERIF}; font-weight: 400; font-size: clamp(44px, 5.4vw, 88px); line-height: 1.02; letter-spacing: -0.02em; margin: 0; color: #fff; }
      .id-flow__headline em { font-style: italic; color: ${CITRON}; }
      .id-flow__metric { text-align: right; font-family: ${MONO}; }
      .id-flow__metric-label { font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,255,255,0.55); margin-bottom: 12px; }
      .id-flow__metric-value { font-family: ${SERIF}; font-size: 22px; color: #fff; }
      .id-flow__metric-value em { font-style: italic; color: ${CITRON}; }
      .id-flow__divider { border: 0; border-top: 1px solid ${DIVIDER}; margin: 28px 0; }
      .id-flow__grid { display: grid; gap: 24px; }
      .id-flow__top { padding-right: 16px; }
      .id-flow__top-time { font-family: ${MONO}; font-size: 11px; letter-spacing: 0.18em; color: rgba(255,255,255,0.45); margin-bottom: 14px; }
      .id-flow__top-label { font-family: ${SERIF}; font-style: italic; font-size: clamp(22px, 2vw, 30px); line-height: 1; color: #fff; margin-bottom: 10px; }
      .id-flow__top-tag { font-family: ${MONO}; font-size: 10px; letter-spacing: 0.26em; text-transform: uppercase; color: rgba(255,255,255,0.45); }

      .id-flow__rail-wrap { position: relative; display: grid; gap: 24px; padding: 36px 0 28px; }
      .id-flow__rail-line { position: absolute; left: 8%; right: 8%; top: 50%; height: 1px; background: repeating-linear-gradient(to right, ${RAIL} 0 6px, transparent 6px 12px); transform: translateY(-50%); pointer-events: none; }
      .id-flow__circle-cell { display: flex; flex-direction: column; align-items: center; position: relative; }
      .id-flow__circle { position: relative; width: clamp(64px, 6vw, 88px); aspect-ratio: 1; border-radius: 50%; border: 1.5px solid ${RAIL}; background: ${TEAL}; display: flex; align-items: center; justify-content: center; font-family: ${SERIF}; font-style: italic; font-size: clamp(20px, 1.8vw, 26px); color: rgba(255,255,255,0.65); transition: all 240ms ease; z-index: 1; }
      .id-flow__circle--active { background: ${CITRON}; border-color: ${CITRON}; color: ${TEAL}; box-shadow: 0 0 36px rgba(199,231,56,0.45), 0 0 0 6px rgba(199,231,56,0.08); }
      .id-flow__circle-pulse { position: absolute; right: -22px; top: 50%; width: 8px; height: 8px; border-radius: 50%; background: ${CITRON}; box-shadow: 0 0 14px rgba(199,231,56,0.8); transform: translateY(-50%); animation: id-flow-pulse 1.6s ease-in-out infinite; }
      @keyframes id-flow-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      .id-flow__case-chip { position: absolute; left: calc(50% + 44px); top: 50%; transform: translateY(-50%); white-space: nowrap; display: inline-flex; align-items: center; gap: 10px; padding-left: 28px; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.7); }
      .id-flow__case-dot { width: 0; height: 0; }

      .id-flow__bottom { margin-top: 24px; }
      .id-flow__cell { padding-right: 18px; }
      .id-flow__cell-cat { font-family: ${MONO}; font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 14px; }
      .id-flow__cell-title { font-family: ${SERIF}; font-size: clamp(22px, 2vw, 30px); line-height: 1.1; color: #fff; margin-bottom: 12px; }
      .id-flow__cell-title em { font-style: italic; color: ${CITRON}; }
      .id-flow__cell-desc { font-size: 14px; line-height: 1.5; color: rgba(255,255,255,0.6); max-width: 28ch; }

      .id-flow__footer { display: grid; grid-template-columns: auto 1fr auto; gap: 48px; align-items: center; margin-top: 12px; }
      .id-flow__footer-left { display: contents; }
      .id-flow__footer-badge { display: inline-flex; align-items: center; padding: 10px 22px; border-radius: 999px; border: 1px solid ${RAIL}; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,255,255,0.8); }
      .id-flow__footer-body { margin: 0; font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.78); max-width: 64ch; }
      .id-flow__footer-body em { font-style: italic; color: ${CITRON}; }
      .id-flow__footer-right { display: flex; align-items: center; gap: 40px; }
      .id-flow__footer-metric { text-align: right; }
      .id-flow__footer-metric-value { font-family: ${SERIF}; font-style: italic; font-size: 26px; color: #fff; }
      .id-flow__footer-metric-value em { color: ${CITRON}; }
      .id-flow__cta { font-family: ${HEAD}; font-size: 14px; color: #fff; text-decoration: none; padding-bottom: 4px; border-bottom: 1px solid ${CITRON}; transition: color 200ms ease; }
      .id-flow__cta:hover { color: ${CITRON}; }

      @media (max-width: 900px) {
        .id-flow { padding: 80px 24px 64px; }
        .id-flow__head { grid-template-columns: 1fr; gap: 24px; }
        .id-flow__metric { text-align: left; }
        .id-flow__grid, .id-flow__rail-wrap { grid-template-columns: 1fr !important; }
        .id-flow__rail-line { display: none; }
        .id-flow__circle-cell { flex-direction: row; gap: 16px; justify-content: flex-start; }
        .id-flow__case-chip { position: static; transform: none; padding-left: 0; }
        .id-flow__top, .id-flow__cell { padding-right: 0; }
        .id-flow__footer { grid-template-columns: 1fr; gap: 20px; }
        .id-flow__footer-right { flex-direction: column; align-items: flex-start; gap: 16px; }
        .id-flow__footer-metric { text-align: left; }
      }
    `}</style>
  );
}
