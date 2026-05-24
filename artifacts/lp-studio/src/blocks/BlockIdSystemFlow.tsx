import type { IdSystemFlowBlockProps } from "@/lib/block-types";

interface Props {
  props: IdSystemFlowBlockProps;
}

const HEAD = `var(--brand-font-body, var(--app-font-sans, system-ui)), 'Inter', system-ui, sans-serif`;
const SERIF = `var(--brand-font-display, var(--app-font-display, 'Bagoss Standard')), 'Bagoss Standard', 'Inter', Georgia, serif`;
const MONO = `"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace`;
const TEAL = "#001814";
const CITRON = "#C7E738";
const DIVIDER = "rgba(255,255,255,0.08)";
const RAIL = "rgba(199,231,56,0.28)";

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
      className={`id-block id-flow${props.hideHeaderGlow ? " id-flow--no-glow" : ""}`}
      style={{
        background: TEAL,
        color: "#fff",
        paddingTop: props.paddingTop != null ? `${props.paddingTop}px` : "clamp(96px, 10vw, 140px)",
        paddingBottom: props.paddingBottom != null ? `${props.paddingBottom}px` : "clamp(96px, 10vw, 140px)",
        paddingLeft: props.paddingX != null ? `${props.paddingX}px` : "clamp(24px, 4vw, 56px)",
        paddingRight: props.paddingX != null ? `${props.paddingX}px` : "clamp(24px, 4vw, 56px)",
        fontFamily: HEAD,
        fontWeight: 350,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <FlowStyles />
      <div className="id-flow__inner" style={props.maxWidth != null ? { maxWidth: `${props.maxWidth}px` } : undefined}>

      {/* Header */}
      {!props.hideHeader && (
        <>
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
        </>
      )}
      {props.hideHeader && <hr className="id-flow__divider id-flow__divider--top" />}

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
        <div className="id-flow__rail-glow" aria-hidden />
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
      </div>
    </section>
  );
}

function FlowStyles() {
  return (
    <style>{`
      .id-flow { box-sizing: border-box; }
      .id-flow *, .id-flow *::before, .id-flow *::after { box-sizing: border-box; }
      .id-flow::before { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(199,231,56,0.06), transparent 60%); pointer-events: none; }
      .id-flow--no-glow::before { display: none; }
      .id-flow__divider--top { margin-top: 0; }
      .id-flow > * { position: relative; }
      .id-flow__inner { max-width: 1280px; margin: 0 auto; }

      .id-flow__head { display: grid; grid-template-columns: 1fr auto; gap: 56px; align-items: end; margin-bottom: 36px; }
      .id-flow__eyebrow { font-family: ${MONO}; font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(255,255,255,0.62); display: inline-flex; align-items: center; gap: 12px; margin-bottom: 36px; }
      .id-flow__eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: ${CITRON}; box-shadow: 0 0 10px rgba(199,231,56,0.7); }
      .id-flow__headline { font-family: ${SERIF}; font-weight: 300; font-size: clamp(36px, 4.4vw, 68px); line-height: 1.04; letter-spacing: -0.022em; margin: 0; color: #fff; max-width: 20ch; }
      .id-flow__headline em { font-style: italic; color: ${CITRON}; font-weight: 300; }
      .id-flow__metric { text-align: right; font-family: ${MONO}; flex-shrink: 0; }
      .id-flow__metric-label { font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 14px; }
      .id-flow__metric-value { font-family: ${SERIF}; font-weight: 300; font-size: 22px; color: #fff; letter-spacing: -0.01em; }
      .id-flow__metric-value em { font-style: italic; color: ${CITRON}; font-weight: 300; }

      .id-flow__divider { border: 0; border-top: 1px solid ${DIVIDER}; margin: 28px 0; }

      .id-flow__grid { display: grid; gap: 24px; }
      .id-flow__top { padding-right: 16px; }
      .id-flow__top-time { font-family: ${MONO}; font-size: 10.5px; letter-spacing: 0.22em; color: rgba(255,255,255,0.4); margin-bottom: 14px; }
      .id-flow__top-label { font-family: ${SERIF}; font-style: italic; font-weight: 300; font-size: clamp(20px, 1.7vw, 26px); line-height: 1; letter-spacing: -0.01em; color: rgba(255,255,255,0.92); margin-bottom: 10px; }
      .id-flow__top-tag { font-family: ${MONO}; font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,255,255,0.4); }

      .id-flow__rail-wrap { position: relative; display: grid; gap: 24px; padding: 44px 0 32px; }
      .id-flow__rail-line { position: absolute; left: 6%; right: 6%; top: 50%; height: 1px; background: repeating-linear-gradient(to right, ${RAIL} 0 4px, transparent 4px 10px); transform: translateY(-50%); pointer-events: none; z-index: 0; }
      .id-flow__rail-glow { position: absolute; left: 6%; right: 6%; top: 50%; height: 1px; background: linear-gradient(to right, transparent, rgba(199,231,56,0.5), transparent); transform: translateY(-50%); pointer-events: none; z-index: 0; opacity: 0.6; filter: blur(4px); }
      .id-flow__circle-cell { display: flex; flex-direction: column; align-items: center; position: relative; z-index: 1; }
      .id-flow__circle { position: relative; width: clamp(52px, 4.6vw, 68px); aspect-ratio: 1; border-radius: 50%; border: 1px solid ${RAIL}; background: ${TEAL}; display: flex; align-items: center; justify-content: center; font-family: ${SERIF}; font-style: italic; font-weight: 300; font-size: clamp(16px, 1.3vw, 20px); color: rgba(255,255,255,0.55); transition: all 320ms cubic-bezier(0.7,0,0.18,1); letter-spacing: -0.01em; }
      .id-flow__circle::before { content: ""; position: absolute; inset: -1px; border-radius: 50%; border: 1px solid transparent; }
      .id-flow__circle--active { background: ${CITRON}; border-color: ${CITRON}; color: ${TEAL}; box-shadow: 0 0 40px rgba(199,231,56,0.5), 0 0 0 1px rgba(199,231,56,0.4), 0 0 0 8px rgba(199,231,56,0.06); font-weight: 400; }
      .id-flow__circle--active::before { inset: -10px; border-color: rgba(199,231,56,0.18); animation: id-flow-ring 2.4s ease-out infinite; }
      @keyframes id-flow-ring { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.4); opacity: 0; } }
      .id-flow__circle-pulse { display: none; }
      .id-flow__case-chip { position: absolute; left: calc(50% + 48px); top: 50%; transform: translateY(-50%); white-space: nowrap; display: inline-flex; align-items: center; gap: 12px; font-family: ${MONO}; font-size: 10.5px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.65); }
      .id-flow__case-chip::before { content: ""; width: 18px; height: 1px; background: ${RAIL}; }
      .id-flow__case-dot { display: none; }

      .id-flow__bottom { margin-top: 4px; }
      .id-flow__cell { padding-right: 18px; position: relative; }
      .id-flow__cell::before { content: ""; position: absolute; top: -28px; left: 0; right: 12px; height: 1px; background: rgba(255,255,255,0.05); }
      .id-flow__cell-cat { font-family: ${MONO}; font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 12px; }
      .id-flow__cell-title { font-family: ${SERIF}; font-weight: 300; font-size: clamp(20px, 1.7vw, 26px); line-height: 1.08; letter-spacing: -0.015em; color: #fff; margin-bottom: 10px; }
      .id-flow__cell-title em { font-style: italic; color: ${CITRON}; font-weight: 300; }
      .id-flow__cell-desc { font-family: ${HEAD}; font-weight: 350; font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.55); max-width: 26ch; }

      .id-flow__footer { display: grid; grid-template-columns: auto 1fr auto auto; gap: 40px; align-items: center; margin-top: 4px; }
      .id-flow__footer-left { display: contents; }
      .id-flow__footer-badge { display: inline-flex; align-items: center; padding: 11px 22px; border-radius: 999px; border: 1px solid ${RAIL}; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,255,255,0.78); }
      .id-flow__footer-body { margin: 0; font-family: ${HEAD}; font-weight: 350; font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.72); max-width: 56ch; }
      .id-flow__footer-body em { font-style: italic; font-family: ${SERIF}; color: ${CITRON}; font-weight: 400; }
      .id-flow__footer-right { display: contents; }
      .id-flow__footer-metric { text-align: right; }
      .id-flow__footer-metric-value { font-family: ${SERIF}; font-style: italic; font-weight: 300; font-size: 28px; letter-spacing: -0.015em; color: #fff; }
      .id-flow__footer-metric-value em { color: ${CITRON}; font-weight: 300; }
      .id-flow__cta { font-family: ${HEAD}; font-weight: 500; font-size: 13px; letter-spacing: 0.02em; color: #fff; text-decoration: none; padding-bottom: 6px; border-bottom: 1px solid ${CITRON}; transition: all 240ms ease; display: inline-flex; align-items: center; gap: 8px; }
      .id-flow__cta:hover { color: ${CITRON}; gap: 12px; }

      @media (max-width: 900px) {
        .id-flow { padding: 72px 22px 64px; }
        .id-flow__inner { display: flex; flex-direction: column; }
        .id-flow__head { grid-template-columns: 1fr; gap: 24px; order: 0; margin-bottom: 8px; }
        .id-flow__metric { text-align: left; }
        .id-flow__divider { margin: 18px 0; }
        .id-flow__divider--top { order: 1; }

        /* Hide duplicated timestamp/label row on mobile - same info appears in cell below */
        .id-flow__top { display: none; }

        /* Interleave circles + cells so each station reads as a self-contained pair */
        .id-flow__rail-wrap,
        .id-flow__bottom { display: contents; }
        .id-flow__rail-line, .id-flow__rail-glow { display: none; }
        .id-flow__case-chip { display: none; }

        .id-flow__circle-cell {
          flex-direction: row;
          gap: 18px;
          justify-content: flex-start;
          align-items: center;
          padding: 18px 0 4px;
          border-top: 1px solid ${DIVIDER};
        }
        .id-flow__circle {
          width: 44px;
          min-width: 44px;
          height: 44px;
          aspect-ratio: 1;
          font-size: 14px;
          flex: 0 0 44px;
        }
        .id-flow__circle--active {
          box-shadow: 0 0 24px rgba(199,231,56,0.45), 0 0 0 1px rgba(199,231,56,0.4), 0 0 0 6px rgba(199,231,56,0.06);
        }
        .id-flow__circle--active::before { inset: -6px; }

        .id-flow__cell { padding: 0 0 14px 62px; margin-top: -8px; }
        .id-flow__cell::before { display: none; }
        .id-flow__cell-cat { margin-bottom: 6px; }
        .id-flow__cell-title { font-size: 22px; margin-bottom: 6px; }
        .id-flow__cell-desc { font-size: 13px; max-width: none; }

        /* nth-child reorder: each station = circle (order 2n) + cell (order 2n+1) */
        /* circle-cells are children 3-12 of __rail-wrap (after rail-line + rail-glow) */
        .id-flow__rail-wrap > .id-flow__circle-cell:nth-child(3)  { order: 2; }
        .id-flow__rail-wrap > .id-flow__circle-cell:nth-child(4)  { order: 4; }
        .id-flow__rail-wrap > .id-flow__circle-cell:nth-child(5)  { order: 6; }
        .id-flow__rail-wrap > .id-flow__circle-cell:nth-child(6)  { order: 8; }
        .id-flow__rail-wrap > .id-flow__circle-cell:nth-child(7)  { order: 10; }
        .id-flow__rail-wrap > .id-flow__circle-cell:nth-child(8)  { order: 12; }
        .id-flow__rail-wrap > .id-flow__circle-cell:nth-child(9)  { order: 14; }
        .id-flow__rail-wrap > .id-flow__circle-cell:nth-child(10) { order: 16; }
        .id-flow__bottom > .id-flow__cell:nth-child(1) { order: 3; }
        .id-flow__bottom > .id-flow__cell:nth-child(2) { order: 5; }
        .id-flow__bottom > .id-flow__cell:nth-child(3) { order: 7; }
        .id-flow__bottom > .id-flow__cell:nth-child(4) { order: 9; }
        .id-flow__bottom > .id-flow__cell:nth-child(5) { order: 11; }
        .id-flow__bottom > .id-flow__cell:nth-child(6) { order: 13; }
        .id-flow__bottom > .id-flow__cell:nth-child(7) { order: 15; }
        .id-flow__bottom > .id-flow__cell:nth-child(8) { order: 17; }

        .id-flow__footer { grid-template-columns: 1fr; gap: 24px; order: 99; }
        .id-flow__footer-metric { text-align: left; }
      }
    `}</style>
  );
}
