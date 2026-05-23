import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { IdReservationPassBlockProps } from "@/lib/block-types";
import { CtaButton, type CtaActionMode } from "@/components/CtaButton";
import { useBrandConfig } from "@/components/BrandSwatches";
import { usePageContext } from "@/lib/page-context";
import { safeNavigate } from "@/lib/safe-url";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: IdReservationPassBlockProps;
  onCtaClick?: () => void;
}

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

/**
 * BlockIdReservationPass — a cinematic dark-stage final CTA inspired
 * by an "insider's pass" / boarding-pass mark. Use this in place of a
 * standard bottom-CTA when launching a high-touch experience (Inside
 * Dandy, Spatial Tour, executive invite) — the pass card visually
 * communicates scarcity + status while still delegating the actual
 * click behavior to the shared CtaButton (URL / Chili Piper popup /
 * modal-form / modal-chilipiper) so it slots straight into existing
 * lead-routing infrastructure.
 *
 * Visual surface:
 *  • Full-bleed dark stage with optional photo, animated mint aurora
 *    blobs, a static dot-grid, and four mint corner-HUD frames that
 *    trace in on mount.
 *  • Top ribbon: ordinal mark left + live status w/ pulsing dot right.
 *  • Centered editorial column: eyebrow tag, serif display headline
 *    (with <em> italic-citron accents), lede, optional seats pill.
 *  • "Inside Pass" glass card with perforated dashed dividers (mint
 *    dots at the ends — the ticket-stub motif), 3-column meta grid
 *    (DATE / LOCATION / DURATION), and the primary CTA + ghost link
 *    in its bottom rail.
 *  • Tertiary footer notes line, hairline-separated.
 *
 * Headline + eyebrow accept <em> tags; the pass card title + serial
 * are pure text. All copy and CTA behavior is editable from the
 * IdReservationPassPanel.
 */
export function BlockIdReservationPass({ props: p, onCtaClick }: Props) {
  const brand = useBrandConfig();
  const ctx = usePageContext();
  const prefersReducedMotion = useReducedMotion();

  const accent = p.accentColor || "#C7E738";
  const ordinal = p.ordinal ?? "№ 001";
  const status = p.status ?? "RESERVATION OPEN";
  const eyebrow = p.eyebrow ?? "";
  const body = p.body ?? "";
  const passLabel = p.passLabel ?? "DANDY · INSIDE PASS";
  const passSerial = p.passSerial ?? "";
  const meta = p.meta ?? [];
  const seats = p.seatsRemainingText ?? "";
  const footerNotes = p.footerNotes ?? [];
  const primaryAction = (p.primaryCtaAction ?? "url") as CtaActionMode;

  // Detect when the section enters the viewport so the corner-HUD
  // trace-in + headline reveal run on first view, not on mount in
  // pages where the block sits below the fold.
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion) {
      setInView(true);
      return;
    }
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [prefersReducedMotion]);

  const handlePrimaryCtaClick = () => {
    // CtaButton internally owns modal / Chili Piper flows; only fall
    // through to the parent navigation handler when this is a plain
    // URL action. This avoids double-navigation and prevents modal
    // / popup modes from being short-circuited by a parent redirect.
    if (primaryAction !== "url") return;
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    const url = p.primaryCtaUrl;
    if (!url || url === "#") return;
    const trimmed = url.trim();
    const sameTab =
      trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("?");
    safeNavigate(url, sameTab ? "_self" : "_blank");
  };

  return (
    <section
      ref={sectionRef}
      className="id-pass"
      style={
        {
          "--id-pass-accent": accent,
          fontFamily: BODY,
        } as React.CSSProperties
      }
    >
      <PassStyles />
      <div className="id-pass__bg" aria-hidden>
        {p.backgroundImageUrl && (
          <div
            className="id-pass__bg-photo"
            style={{ backgroundImage: `url(${p.backgroundImageUrl})` }}
          />
        )}
        <div className="id-pass__bg-orb id-pass__bg-orb--a" />
        <div className="id-pass__bg-orb id-pass__bg-orb--b" />
        <div className="id-pass__bg-grid" />
        <div className="id-pass__bg-vignette" />
      </div>

      <CornerHud inView={inView} />

      <div className="id-pass__inner">
        <header className="id-pass__ribbon">
          <span className="id-pass__ordinal" style={{ fontFamily: DISPLAY }}>
            {ordinal}
          </span>
          {status && (
            <span className="id-pass__status">
              <span className="id-pass__status-dot" />
              {status}
            </span>
          )}
        </header>

        <motion.div
          className="id-pass__column"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {eyebrow && (
            <div className="id-pass__eyebrow">
              <span className="id-pass__eyebrow-rule" />
              <span
                className="id-pass__eyebrow-text"
                dangerouslySetInnerHTML={{ __html: eyebrow }}
              />
              <span className="id-pass__eyebrow-rule" />
            </div>
          )}

          <h2
            className="id-pass__headline"
            style={{ fontFamily: DISPLAY }}
            dangerouslySetInnerHTML={{ __html: p.headline }}
          />

          {body && <p className="id-pass__body">{body}</p>}

          {seats && (
            <div className="id-pass__seats">
              <span className="id-pass__seats-dot" />
              <span>{seats}</span>
            </div>
          )}

          <div className="id-pass__card">
            <div className="id-pass__card-top">
              <span className="id-pass__card-label">{passLabel}</span>
              {passSerial && (
                <span className="id-pass__card-serial">{passSerial}</span>
              )}
            </div>

            <Perforation />

            <div className="id-pass__meta-grid">
              {meta.map((m, i) => (
                <div className="id-pass__meta" key={`${m.label}-${i}`}>
                  <span className="id-pass__meta-label">{m.label}</span>
                  <span
                    className="id-pass__meta-value"
                    style={{ fontFamily: DISPLAY }}
                  >
                    {m.value}
                  </span>
                </div>
              ))}
            </div>

            <Perforation />

            <div className="id-pass__cta-row">
              <CtaButton
                ctaAction={primaryAction}
                ctaUrl={p.primaryCtaUrl}
                chilipiperUrl={p.chilipiperUrl}
                videoUrl={p.videoUrl}
                modalChilipiperUrl={p.modalChilipiperUrl}
                modalFormSource={p.modalFormSource}
                modalFormId={p.modalFormId}
                modalMarketoBaseUrl={p.modalMarketoBaseUrl}
                modalMarketoMunchkinId={p.modalMarketoMunchkinId}
                modalMarketoFormId={p.modalMarketoFormId}
                modalChiliPiperHandoffUrl={p.modalChiliPiperHandoffUrl}
                modalChiliPiperHandoffMode={p.modalChiliPiperHandoffMode}
                modalChiliPiperHandoffFieldMap={p.modalChiliPiperHandoffFieldMap}
                modalHeadline={p.modalHeadline}
                modalSubheadline={p.modalSubheadline}
                modalSubmitText={p.modalSubmitText}
                modalSuccessMessage={p.modalSuccessMessage}
                modalDisclaimer={p.modalDisclaimer}
                modalShowFirstName={p.modalShowFirstName}
                modalShowLastName={p.modalShowLastName}
                modalShowPhone={p.modalShowPhone}
                modalShowCompany={p.modalShowCompany}
                brand={brand ?? undefined}
                pageId={ctx.pageId ?? undefined}
                variantId={ctx.variantId ?? undefined}
                source="id-reservation-pass"
                onClick={handlePrimaryCtaClick}
                className="id-pass__cta-primary"
              >
                {p.primaryCtaText}
                <span className="id-pass__cta-arrow" aria-hidden>
                  →
                </span>
              </CtaButton>

              {p.secondaryCtaText && (
                <CtaButton
                  ctaAction={(p.secondaryCtaAction ?? "url") as CtaActionMode}
                  ctaUrl={p.secondaryCtaUrl}
                  chilipiperUrl={p.secondaryChilipiperUrl}
                  videoUrl={p.secondaryVideoUrl}
                  modalChilipiperUrl={p.modalChilipiperUrl}
                  modalFormSource={p.modalFormSource}
                  modalFormId={p.modalFormId}
                  modalMarketoBaseUrl={p.modalMarketoBaseUrl}
                  modalMarketoMunchkinId={p.modalMarketoMunchkinId}
                  modalMarketoFormId={p.modalMarketoFormId}
                  modalChiliPiperHandoffUrl={p.modalChiliPiperHandoffUrl}
                  modalChiliPiperHandoffMode={p.modalChiliPiperHandoffMode}
                  modalChiliPiperHandoffFieldMap={p.modalChiliPiperHandoffFieldMap}
                  modalHeadline={p.modalHeadline}
                  modalSubheadline={p.modalSubheadline}
                  modalSubmitText={p.modalSubmitText}
                  modalSuccessMessage={p.modalSuccessMessage}
                  modalDisclaimer={p.modalDisclaimer}
                  modalShowFirstName={p.modalShowFirstName}
                  modalShowLastName={p.modalShowLastName}
                  modalShowPhone={p.modalShowPhone}
                  modalShowCompany={p.modalShowCompany}
                  brand={brand ?? undefined}
                  pageId={ctx.pageId ?? undefined}
                  variantId={ctx.variantId ?? undefined}
                  source="id-reservation-pass-secondary"
                  className="id-pass__cta-secondary"
                >
                  {p.secondaryCtaText}
                  <span aria-hidden> →</span>
                </CtaButton>
              )}
            </div>
          </div>

          {footerNotes.length > 0 && (
            <div className="id-pass__footer">
              {footerNotes.map((n, i) => (
                <span key={`${n}-${i}`} className="id-pass__footer-item">
                  {n}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- decorative subcomponents ---------- */

function CornerHud({ inView }: { inView: boolean }) {
  const corners: Array<"tl" | "tr" | "bl" | "br"> = ["tl", "tr", "bl", "br"];
  return (
    <div className="id-pass__hud" aria-hidden>
      {corners.map((c, i) => (
        <div key={c} className={`id-pass__hud-corner id-pass__hud-corner--${c}`}>
          <motion.span
            className="id-pass__hud-line id-pass__hud-line--h"
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: c.endsWith("r") ? "right" : "left" }}
          />
          <motion.span
            className="id-pass__hud-line id-pass__hud-line--v"
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: c.startsWith("b") ? "bottom" : "top" }}
          />
        </div>
      ))}
    </div>
  );
}

function Perforation() {
  return (
    <div className="id-pass__perf" aria-hidden>
      <span className="id-pass__perf-dot id-pass__perf-dot--l" />
      <span className="id-pass__perf-line" />
      <span className="id-pass__perf-dot id-pass__perf-dot--r" />
    </div>
  );
}

/* ---------- styles ---------- */

function PassStyles() {
  return (
    <style>{`
      .id-pass {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        padding: clamp(96px, 14vw, 180px) clamp(20px, 5vw, 64px);
        background: radial-gradient(1200px 800px at 50% -10%, #073A30 0%, #00231D 55%, #00120F 100%);
        color: #F1FBEF;
      }
      .id-pass__bg {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
      }
      .id-pass__bg-photo {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        opacity: 0.16;
        mix-blend-mode: screen;
        filter: saturate(0.85) contrast(1.05);
      }
      .id-pass__bg-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(120px);
        opacity: 0.55;
      }
      .id-pass__bg-orb--a {
        width: 56vw;
        height: 56vw;
        max-width: 760px;
        max-height: 760px;
        left: -10vw;
        top: -14vw;
        background: radial-gradient(circle at 30% 30%, rgba(199, 231, 56, 0.55), transparent 65%);
        animation: idPassDriftA 22s ease-in-out infinite;
      }
      .id-pass__bg-orb--b {
        width: 52vw;
        height: 52vw;
        max-width: 720px;
        max-height: 720px;
        right: -12vw;
        bottom: -16vw;
        background: radial-gradient(circle at 70% 70%, rgba(80, 200, 160, 0.5), transparent 65%);
        animation: idPassDriftB 26s ease-in-out infinite;
      }
      .id-pass__bg-grid {
        position: absolute;
        inset: 0;
        background-image:
          radial-gradient(circle at 1px 1px, rgba(199, 231, 56, 0.10) 1px, transparent 1.5px);
        background-size: 36px 36px;
        opacity: 0.4;
        mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, #000 50%, transparent 90%);
        -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, #000 50%, transparent 90%);
      }
      .id-pass__bg-vignette {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at center, transparent 45%, rgba(0, 18, 15, 0.9) 100%);
      }
      @keyframes idPassDriftA {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        50% { transform: translate3d(40px, 30px, 0) scale(1.08); }
      }
      @keyframes idPassDriftB {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        50% { transform: translate3d(-50px, -20px, 0) scale(1.05); }
      }

      /* corner HUD */
      .id-pass__hud {
        position: absolute;
        inset: clamp(20px, 4vw, 44px);
        z-index: 1;
        pointer-events: none;
      }
      .id-pass__hud-corner {
        position: absolute;
        width: 56px;
        height: 56px;
      }
      .id-pass__hud-corner--tl { top: 0; left: 0; }
      .id-pass__hud-corner--tr { top: 0; right: 0; }
      .id-pass__hud-corner--bl { bottom: 0; left: 0; }
      .id-pass__hud-corner--br { bottom: 0; right: 0; }
      .id-pass__hud-line {
        position: absolute;
        background: var(--id-pass-accent);
        box-shadow: 0 0 12px color-mix(in srgb, var(--id-pass-accent) 60%, transparent);
        display: block;
      }
      .id-pass__hud-line--h { height: 1px; width: 100%; top: 0; left: 0; }
      .id-pass__hud-line--v { width: 1px; height: 100%; top: 0; left: 0; }
      .id-pass__hud-corner--tr .id-pass__hud-line--v { left: auto; right: 0; }
      .id-pass__hud-corner--bl .id-pass__hud-line--h { top: auto; bottom: 0; }
      .id-pass__hud-corner--br .id-pass__hud-line--h { top: auto; bottom: 0; }
      .id-pass__hud-corner--br .id-pass__hud-line--v { left: auto; right: 0; }

      /* layout */
      .id-pass__inner {
        position: relative;
        z-index: 2;
        max-width: 1180px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: clamp(32px, 6vw, 56px);
      }
      .id-pass__ribbon {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        font-size: 11px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(241, 251, 239, 0.6);
      }
      .id-pass__ordinal {
        font-style: italic;
        font-size: 16px;
        letter-spacing: 0.05em;
        color: var(--id-pass-accent);
        text-transform: none;
      }
      .id-pass__status {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }
      .id-pass__status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--id-pass-accent);
        box-shadow: 0 0 14px var(--id-pass-accent);
        animation: idPassPulse 1.8s ease-in-out infinite;
      }
      @keyframes idPassPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.45; transform: scale(0.78); }
      }

      .id-pass__column {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: clamp(20px, 3vw, 32px);
        max-width: 880px;
        margin: 0 auto;
      }
      .id-pass__eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        font-size: 11px;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        color: rgba(199, 231, 56, 0.85);
      }
      .id-pass__eyebrow-rule {
        width: 42px;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--id-pass-accent));
      }
      .id-pass__eyebrow-text :is(em, i) {
        font-style: italic;
        color: #fff;
      }
      .id-pass__headline {
        margin: 0;
        font-size: clamp(44px, 7.4vw, 112px);
        line-height: 0.98;
        letter-spacing: -0.02em;
        font-weight: 400;
        color: #ffffff;
        text-wrap: balance;
      }
      .id-pass__headline :is(em, i) {
        font-style: italic;
        color: var(--id-pass-accent);
        font-weight: 400;
      }
      .id-pass__body {
        margin: 0;
        max-width: 56ch;
        font-size: clamp(15px, 1.2vw, 18px);
        line-height: 1.6;
        color: rgba(241, 251, 239, 0.72);
      }
      .id-pass__seats {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 16px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--id-pass-accent) 38%, transparent);
        background: color-mix(in srgb, var(--id-pass-accent) 8%, transparent);
        font-size: 11px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: rgba(241, 251, 239, 0.92);
      }
      .id-pass__seats-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--id-pass-accent);
        box-shadow: 0 0 10px var(--id-pass-accent);
        animation: idPassPulse 1.8s ease-in-out infinite;
      }

      /* pass card */
      .id-pass__card {
        position: relative;
        width: min(640px, 100%);
        margin-top: clamp(8px, 2vw, 20px);
        padding: clamp(24px, 3vw, 36px);
        border-radius: 22px;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
          rgba(8, 30, 24, 0.72);
        border: 1px solid color-mix(in srgb, var(--id-pass-accent) 28%, transparent);
        backdrop-filter: blur(18px) saturate(140%);
        -webkit-backdrop-filter: blur(18px) saturate(140%);
        box-shadow:
          0 30px 80px -20px rgba(0, 0, 0, 0.7),
          0 0 0 1px rgba(255, 255, 255, 0.04) inset,
          0 0 80px -30px color-mix(in srgb, var(--id-pass-accent) 50%, transparent);
        display: flex;
        flex-direction: column;
        gap: clamp(18px, 2.5vw, 24px);
        text-align: left;
      }
      .id-pass__card-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }
      .id-pass__card-label {
        color: var(--id-pass-accent);
      }
      .id-pass__card-serial {
        color: rgba(241, 251, 239, 0.55);
      }
      .id-pass__perf {
        display: flex;
        align-items: center;
        gap: 0;
        position: relative;
        margin: 0 -8px;
      }
      .id-pass__perf-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #00120F;
        border: 1px solid color-mix(in srgb, var(--id-pass-accent) 35%, transparent);
        flex: 0 0 auto;
      }
      .id-pass__perf-line {
        flex: 1;
        height: 1px;
        background-image: linear-gradient(90deg, color-mix(in srgb, var(--id-pass-accent) 55%, transparent) 50%, transparent 0);
        background-size: 8px 1px;
        background-repeat: repeat-x;
      }
      .id-pass__meta-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }
      .id-pass__meta {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }
      .id-pass__meta-label {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: rgba(241, 251, 239, 0.45);
      }
      .id-pass__meta-value {
        font-size: clamp(17px, 1.6vw, 22px);
        line-height: 1.2;
        color: #fff;
        letter-spacing: -0.005em;
      }

      /* cta row */
      .id-pass__cta-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 18px;
      }
      .id-pass__cta-primary {
        display: inline-flex !important;
        align-items: center;
        gap: 10px;
        padding: 16px 26px !important;
        border-radius: 999px !important;
        background: var(--id-pass-accent) !important;
        color: #002218 !important;
        font-weight: 600 !important;
        font-size: 15px !important;
        letter-spacing: 0.01em;
        border: none !important;
        cursor: pointer;
        text-decoration: none !important;
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--id-pass-accent) 90%, white 10%),
          0 18px 40px -12px color-mix(in srgb, var(--id-pass-accent) 70%, transparent),
          0 0 60px -10px color-mix(in srgb, var(--id-pass-accent) 80%, transparent);
        transition: transform 180ms ease, box-shadow 220ms ease;
      }
      .id-pass__cta-primary:hover {
        transform: translateY(-1px);
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--id-pass-accent) 95%, white 12%),
          0 22px 46px -10px color-mix(in srgb, var(--id-pass-accent) 78%, transparent),
          0 0 80px -8px color-mix(in srgb, var(--id-pass-accent) 90%, transparent);
      }
      .id-pass__cta-arrow {
        font-size: 1.05em;
        transition: transform 220ms ease;
      }
      .id-pass__cta-primary:hover .id-pass__cta-arrow {
        transform: translateX(3px);
      }
      .id-pass__cta-secondary {
        color: rgba(241, 251, 239, 0.78);
        font-size: 13.5px;
        letter-spacing: 0.04em;
        text-decoration: none;
        border-bottom: 1px solid rgba(241, 251, 239, 0.25);
        padding-bottom: 2px;
        transition: color 180ms ease, border-color 180ms ease;
      }
      .id-pass__cta-secondary:hover {
        color: #fff;
        border-color: var(--id-pass-accent);
      }

      /* footer notes */
      .id-pass__footer {
        margin-top: clamp(12px, 2vw, 20px);
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
        justify-content: center;
        font-size: 10.5px;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: rgba(241, 251, 239, 0.45);
      }
      .id-pass__footer-item {
        position: relative;
      }
      .id-pass__footer-item + .id-pass__footer-item::before {
        content: "";
        position: absolute;
        left: -10px;
        top: 50%;
        transform: translateY(-50%);
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--id-pass-accent) 60%, transparent);
      }

      @media (max-width: 640px) {
        .id-pass__meta-grid { grid-template-columns: 1fr; gap: 14px; }
        .id-pass__cta-row { flex-direction: column; align-items: stretch; }
        .id-pass__cta-primary { justify-content: center; }
        .id-pass__cta-secondary { text-align: center; }
      }
      @media (prefers-reduced-motion: reduce) {
        .id-pass__bg-orb,
        .id-pass__status-dot,
        .id-pass__seats-dot { animation: none !important; }
      }
    `}</style>
  );
}
