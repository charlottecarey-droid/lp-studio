import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { MuteToggleButton } from "@/components/MuteToggleButton";
import type { DsoHeartlandHeroBlockProps } from "@/lib/block-types";
import { getBgStyle } from "@/lib/bg-styles";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";

interface Props {
  props: DsoHeartlandHeroBlockProps;
  onCtaClick?: () => void;
}

const PRIMARY  = "hsl(72, 55%, 48%)";
const MUTED_FG = "hsl(192, 10%, 55%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";


export function BlockDsoHeartlandHero({ props: p, onCtaClick }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const [bgVideoMuted, setBgVideoMuted] = useState(true);
  const [heroVideoMuted, setHeroVideoMuted] = useState(true);
  const [heroVideoPlaying, setHeroVideoPlaying] = useState(false);

  const attachBgVideo = useCallback((el: HTMLVideoElement | null) => {
    bgVideoRef.current = el;
    if (!el) return;
    el.muted = true;
  }, []);

  const attachHeroVideo = useCallback((el: HTMLVideoElement | null) => {
    heroVideoRef.current = el;
    if (!el) return;
    el.muted = true;
  }, []);

  const toggleBgMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = bgVideoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setBgVideoMuted(el.muted);
  };

  const toggleHeroVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = heroVideoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setHeroVideoMuted(el.muted);
  };
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const contentY    = useTransform(scrollYProgress, [0, 1], ["0px", "60px"]);

  const layout = p.layout ?? "full-bleed";
  const isSplit = layout === "split";
  const isSplitVideo = layout === "split-video";
  const isStackedVideo = layout === "stacked-video";
  const imageRight = (p.heroImageSide ?? "right") !== "left";
  const company = p.companyName?.trim() ?? "";

  const renderHeadline = () => {
    const text = p.headline ?? "";

    if (text.includes("{") && text.includes("}")) {
      const parts: React.ReactNode[] = [];
      const regex = /\{([^}]+)\}/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let key = 0;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.slice(lastIndex, match.index));
        }
        parts.push(
          <span key={key++} style={{ color: PRIMARY }}>{match[1]}</span>
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) parts.push(text.slice(lastIndex));
      return <>{parts}</>;
    }

    if (company && text.includes(company)) {
      const [before, ...rest] = text.split(company);
      const after = rest.join(company);
      return (
        <>
          {before}
          <span style={{ color: PRIMARY }}>{company}</span>
          {after}
        </>
      );
    }

    return text;
  };

  const statsBar = p.stats && p.stats.length > 0 && (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      style={{
        marginTop: isSplit ? "2rem" : "3.5rem",
        display: "grid",
        gridTemplateColumns: `repeat(${p.stats.length}, 1fr)`,
        gap: "0.5rem",
        borderTop: "1px solid rgba(255,255,255,0.10)",
        paddingTop: "1.5rem",
      }}
    >
      {p.stats.map((s, i) => (
        <div key={i}>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(1.375rem, 3vw, 2rem)",
              fontWeight: 600,
              color: PRIMARY,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {s.value}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: MUTED_FG,
              marginTop: "0.25rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {s.label}
          </div>
        </div>
      ))}
    </motion.div>
  );

  const ctaButtons = (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="flex flex-col sm:flex-row gap-3"
      style={{ marginTop: "2rem" }}
    >
      {p.primaryCtaText && (
        <a
          href={onCtaClick ? undefined : (p.primaryCtaUrl || "#")}
          onClick={onCtaClick ? (e) => { e.preventDefault(); onCtaClick(); } : undefined}
          className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: PRIMARY,
            color: "hsl(192, 30%, 6%)",
            cursor: "pointer",
          }}
        >
          {p.primaryCtaText}
          <ArrowRight className="w-4 h-4" />
        </a>
      )}

      {p.secondaryCtaText && (
        <a
          href={p.secondaryCtaUrl || "#"}
          className="inline-flex items-center justify-center gap-2 rounded-full border px-8 py-3.5 text-sm font-semibold transition-all hover:bg-white/10"
          style={{
            borderColor: "rgba(255,255,255,0.20)",
            color: "rgba(255,255,255,0.90)",
          }}
        >
          {p.secondaryCtaText}
        </a>
      )}
    </motion.div>
  );

  const navBar = (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="absolute top-0 left-0 right-0 z-20"
      style={{
        padding: "1.25rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(to bottom, rgba(8,22,20,0.70) 0%, transparent 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <img
          src={dandyLogoUrl}
          alt="Dandy"
          style={{
            height: 26,
            width: "auto",
            filter: "brightness(0) invert(1)",
            display: "block",
          }}
        />
        {company && (
          <>
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", margin: "0 0.125rem", userSelect: "none" }}>×</span>
            <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "rgba(255,255,255,0.75)", letterSpacing: "-0.01em" }}>
              {company}
            </span>
          </>
        )}
      </div>

      {p.primaryCtaText && (
        <a
          href={onCtaClick ? undefined : (p.primaryCtaUrl || "#")}
          onClick={onCtaClick ? (e) => { e.preventDefault(); onCtaClick(); } : undefined}
          className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ background: PRIMARY, color: "hsl(192, 30%, 6%)", padding: "0.5rem 1.125rem", cursor: "pointer" }}
        >
          {p.primaryCtaText}
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      )}
    </motion.nav>
  );

  /* ── SPLIT LAYOUT ─────────────────────────────────────────── */
  if (isSplit) {
    return (
      <div style={{ ...getBgStyle(p.backgroundStyle ?? "dandy-green") }}>
        <section
          ref={heroRef}
          className="relative overflow-hidden"
          style={{ minHeight: "100vh" }}
        >
          {navBar}
          <div
            style={{
              display: "flex",
              flexDirection: imageRight ? "row" : "row-reverse",
              minHeight: "100vh",
              flexWrap: "wrap",
            }}
          >
            {/* ── Content column ── */}
            <motion.div
              style={{ opacity: heroOpacity, y: contentY, flex: "0 0 55%", padding: "7rem 3rem 4rem", minWidth: 0 }}
              className="relative z-10 flex flex-col justify-center"
            >
              {p.eyebrow && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: PRIMARY,
                    marginBottom: "1.25rem",
                  }}
                >
                  {p.eyebrow}
                </motion.p>
              )}

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: "clamp(2.25rem, 5vw, 3.75rem)",
                  fontWeight: 600,
                  lineHeight: 1.06,
                  letterSpacing: "-0.02em",
                  color: "#fff",
                  textShadow: "0 2px 40px rgba(0,0,0,0.25)",
                }}
              >
                {renderHeadline()}
              </motion.h1>

              {p.subheadline && (
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  style={{
                    marginTop: "1.5rem",
                    fontSize: "1.0625rem",
                    color: MUTED_FG,
                    lineHeight: 1.7,
                    maxWidth: 480,
                  }}
                >
                  {p.subheadline}
                </motion.p>
              )}

              {ctaButtons}
              {statsBar}
            </motion.div>

            {/* ── Image column ── */}
            <div
              style={{
                flex: "0 0 45%",
                position: "relative",
                minHeight: "40vh",
                overflow: "hidden",
              }}
            >
              {p.heroImageUrl ? (
                <img
                  src={p.heroImageUrl}
                  alt=""
                  aria-hidden="true"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(135deg, hsl(152 35% 12%) 0%, hsl(72 30% 8%) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.12)",
                    fontSize: "0.8125rem",
                    fontFamily: DISPLAY_FONT,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Add hero image
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  /* ── SPLIT-VIDEO LAYOUT ───────────────────────────────────── */
  if (isSplitVideo) {
    const videoLeft = (p.heroImageSide ?? "right") === "left";
    const splitTopPad = p.heroTopPadding ?? 0;
    const splitMinH = p.heroMinHeight ?? 80;
    const splitSidePad = p.heroSidePadding ?? 48;
    return (
      <div style={{ ...getBgStyle(p.backgroundStyle ?? "dandy-green") }}>
        <section ref={heroRef} className="relative overflow-hidden" style={{ paddingTop: splitTopPad }}>
          {navBar}
          <div
            style={{
              display: "flex",
              flexDirection: videoLeft ? "row-reverse" : "row",
              flexWrap: "wrap",
              minHeight: `${splitMinH}vh`,
              alignItems: "center",
              paddingBottom: "5rem",
            }}
          >
            {/* ── Content column ── */}
            <motion.div
              style={{ opacity: heroOpacity, y: contentY, flex: "0 0 52%", padding: `2rem ${splitSidePad}px`, minWidth: 0 }}
              className="relative z-10 flex flex-col justify-center"
            >
              {p.eyebrow && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: PRIMARY,
                    marginBottom: "1.25rem",
                  }}
                >
                  {p.eyebrow}
                </motion.p>
              )}
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
                  fontWeight: 600,
                  lineHeight: 1.06,
                  letterSpacing: "-0.02em",
                  color: "#fff",
                  textShadow: "0 2px 40px rgba(0,0,0,0.25)",
                }}
              >
                {renderHeadline()}
              </motion.h1>
              {p.subheadline && (
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  style={{
                    marginTop: "1.5rem",
                    fontSize: "1.0625rem",
                    color: MUTED_FG,
                    lineHeight: 1.7,
                    maxWidth: 480,
                  }}
                >
                  {p.subheadline}
                </motion.p>
              )}
              {ctaButtons}
              {statsBar}
            </motion.div>

            {/* ── Video column ── */}
            <motion.div
              initial={{ opacity: 0, x: videoLeft ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
              style={{
                flex: "0 0 48%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 2.5rem",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: "100%",
                  borderRadius: "1rem",
                  overflow: "hidden",
                  position: "relative",
                  aspectRatio: "16 / 9",
                  background: "rgba(255,255,255,0.05)",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)",
                }}
              >
                {p.heroVideoUrl ? (
                  <>
                    <video
                      ref={attachHeroVideo}
                      src={p.heroVideoUrl}
                      autoPlay={p.videoAutoplay ?? true}
                      loop={p.videoAutoplay ?? true}
                      playsInline
                      onPlay={() => setHeroVideoPlaying(true)}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    {((p.videoAutoplay ?? true) || heroVideoPlaying) && (
                      <MuteToggleButton
                        muted={heroVideoMuted}
                        onClick={toggleHeroVideoMute}
                        className="absolute bottom-3 right-3 z-10"
                      />
                    )}
                    {!(p.videoAutoplay ?? true) && !heroVideoPlaying && (
                      <button
                        onClick={() => { heroVideoRef.current?.play(); setHeroVideoPlaying(true); }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(0,0,0,0.35)",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.15)",
                          backdropFilter: "blur(8px)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1.5px solid rgba(255,255,255,0.3)",
                        }}>
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="white" stroke="none">
                            <polygon points="6 3 20 12 6 21 6 3" />
                          </svg>
                        </div>
                      </button>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: "0.5rem",
                      color: "rgba(255,255,255,0.25)",
                      fontSize: "0.8125rem",
                      fontFamily: DISPLAY_FONT,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Add hero video URL
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    );
  }

  /* ── STACKED-VIDEO LAYOUT ─────────────────────────────────── */
  if (isStackedVideo) {
    const stackedTopPad = p.heroTopPadding ?? 128;
    const stackedMinH = p.heroMinHeight;
    return (
      <div style={{ ...getBgStyle(p.backgroundStyle ?? "dandy-green") }}>
        <section
          ref={heroRef}
          className="relative overflow-hidden"
          style={stackedMinH ? { minHeight: `${stackedMinH}vh` } : undefined}
        >
          {navBar}

          {/* ── Centered text content ── */}
          <motion.div
            style={{ opacity: heroOpacity, y: contentY }}
            className="relative z-10 w-full"
          >
            <div
              style={{
                maxWidth: 720,
                margin: "0 auto",
                paddingTop: stackedTopPad,
                paddingLeft: "2rem",
                paddingRight: "2rem",
                paddingBottom: "3rem",
                textAlign: "center",
              }}
            >
              {p.eyebrow && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: PRIMARY,
                    marginBottom: "1.25rem",
                  }}
                >
                  {p.eyebrow}
                </motion.p>
              )}

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: "clamp(2.5rem, 5.5vw, 4.25rem)",
                  fontWeight: 600,
                  lineHeight: 1.06,
                  letterSpacing: "-0.025em",
                  color: "#fff",
                  textShadow: "0 2px 40px rgba(0,0,0,0.25)",
                }}
              >
                {renderHeadline()}
              </motion.h1>

              {p.subheadline && (
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  style={{
                    marginTop: "1.375rem",
                    fontSize: "1.0625rem",
                    color: MUTED_FG,
                    lineHeight: 1.7,
                    maxWidth: 520,
                    margin: "1.375rem auto 0",
                  }}
                >
                  {p.subheadline}
                </motion.p>
              )}

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
                className="flex flex-col sm:flex-row gap-3 justify-center"
                style={{ marginTop: "2rem" }}
              >
                {p.primaryCtaText && (
                  <a
                    href={onCtaClick ? undefined : (p.primaryCtaUrl || "#")}
                    onClick={onCtaClick ? (e) => { e.preventDefault(); onCtaClick(); } : undefined}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: PRIMARY, color: "hsl(192, 30%, 6%)", cursor: "pointer" }}
                  >
                    {p.primaryCtaText}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}
                {p.secondaryCtaText && (
                  <a
                    href={p.secondaryCtaUrl || "#"}
                    className="inline-flex items-center justify-center gap-2 rounded-full border px-8 py-3.5 text-sm font-semibold transition-all hover:bg-white/10"
                    style={{ borderColor: "rgba(255,255,255,0.20)", color: "rgba(255,255,255,0.90)" }}
                  >
                    {p.secondaryCtaText}
                  </a>
                )}
              </motion.div>
            </div>

            {/* ── Large video showcase ── */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
              style={{
                maxWidth: 1100,
                margin: "0 auto",
                padding: "0 1.5rem 4rem",
              }}
            >
              <div
                style={{
                  borderRadius: "1.25rem",
                  overflow: "hidden",
                  position: "relative",
                  aspectRatio: "16 / 9",
                  background: "rgba(255,255,255,0.05)",
                  boxShadow: "0 32px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
                }}
              >
                {p.heroVideoUrl ? (
                  <>
                    <video
                      ref={attachHeroVideo}
                      src={p.heroVideoUrl}
                      autoPlay={p.videoAutoplay ?? true}
                      loop={p.videoAutoplay ?? true}
                      playsInline
                      onPlay={() => setHeroVideoPlaying(true)}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    {((p.videoAutoplay ?? true) || heroVideoPlaying) && (
                      <MuteToggleButton
                        muted={heroVideoMuted}
                        onClick={toggleHeroVideoMute}
                        className="absolute bottom-4 right-4 z-10"
                      />
                    )}
                    {!(p.videoAutoplay ?? true) && !heroVideoPlaying && (
                      <button
                        onClick={() => { heroVideoRef.current?.play(); setHeroVideoPlaying(true); }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(0,0,0,0.35)",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{
                          width: 72,
                          height: 72,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.15)",
                          backdropFilter: "blur(8px)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1.5px solid rgba(255,255,255,0.3)",
                        }}>
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="white" stroke="none">
                            <polygon points="6 3 20 12 6 21 6 3" />
                          </svg>
                        </div>
                      </button>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: "0.75rem",
                      color: "rgba(255,255,255,0.20)",
                      fontSize: "0.875rem",
                      fontFamily: DISPLAY_FONT,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Add hero video URL
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Stats below video ── */}
            {p.stats && p.stats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                style={{
                  maxWidth: 1100,
                  margin: "0 auto",
                  padding: "0 1.5rem 5rem",
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.min(p.stats.length, 4)}, 1fr)`,
                  gap: "0.5rem",
                  borderTop: "1px solid rgba(255,255,255,0.10)",
                  paddingTop: "1.5rem",
                }}
              >
                {p.stats.map((s, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontFamily: DISPLAY_FONT,
                        fontSize: "clamp(1.375rem, 3vw, 2rem)",
                        fontWeight: 600,
                        color: PRIMARY,
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                      }}
                    >
                      {s.value}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: MUTED_FG,
                        marginTop: "0.25rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </section>
      </div>
    );
  }

  /* ── FULL-BLEED LAYOUT (default) ──────────────────────────── */
  return (
    <div style={{ ...getBgStyle(p.backgroundStyle ?? "dandy-green") }}>
      <section
        ref={heroRef}
        className="relative flex flex-col overflow-hidden"
        style={{ minHeight: "100vh" }}
      >
        {/* ── Background ──────────────────────────────────── */}
        {p.backgroundVideoUrl ? (
          <div className="absolute inset-0">
            <video
              ref={attachBgVideo}
              src={p.backgroundVideoUrl}
              autoPlay
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            <MuteToggleButton muted={bgVideoMuted} onClick={toggleBgMute} className="absolute bottom-4 right-4 z-20" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, hsl(192 30% 5% / 0.55) 0%, hsl(192 30% 5% / 0.65) 40%, hsl(192 25% 8% / 0.92) 100%)",
              }}
            />
          </div>
        ) : p.backgroundImageUrl ? (
          <div className="absolute inset-0">
            <img
              src={p.backgroundImageUrl}
              alt=""
              className="w-full h-full object-cover"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, hsl(192 30% 5% / 0.55) 0%, hsl(192 30% 5% / 0.65) 40%, hsl(192 25% 8% / 0.90) 100%)",
              }}
            />
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 55% at 50% 50%, hsl(152 35% 7% / 0.85), transparent),
                radial-gradient(ellipse 45% 35% at 25% 70%, hsl(72 45% 10% / 0.25), transparent),
                #000000
              `,
            }}
          />
        )}

        {navBar}

        {/* ── Hero content ─────────────────────────────── */}
        <motion.div
          style={{ opacity: heroOpacity, y: contentY }}
          className="relative z-10 flex flex-col justify-center flex-1 w-full pt-20"
        >
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 w-full">
            {p.eyebrow && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  color: PRIMARY,
                  marginBottom: "1.25rem",
                }}
              >
                {p.eyebrow}
              </motion.p>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(2.75rem, 7vw, 5rem)",
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "#fff",
                maxWidth: 760,
                textShadow: "0 2px 40px rgba(0,0,0,0.35)",
              }}
            >
              {renderHeadline()}
            </motion.h1>

            {p.subheadline && (
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                style={{
                  marginTop: "1.5rem",
                  fontSize: "1.0625rem",
                  color: MUTED_FG,
                  lineHeight: 1.7,
                  maxWidth: 520,
                }}
              >
                {p.subheadline}
              </motion.p>
            )}

            {ctaButtons}
            {statsBar}
          </div>

          {/* Scroll indicator */}
          {p.showScrollIndicator !== false && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="flex justify-center mt-12"
            >
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-5 h-8 rounded-full border flex items-start justify-center pt-1.5"
                style={{ borderColor: "rgba(255,255,255,0.18)" }}
              >
                <div
                  className="w-1 h-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.35)" }}
                />
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </section>
    </div>
  );
}
