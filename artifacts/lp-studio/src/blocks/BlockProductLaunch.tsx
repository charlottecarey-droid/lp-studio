import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { ProductLaunchBlockProps, ProductLaunchTheme } from "@/lib/block-types";
import { useBlockFonts } from "@/lib/use-block-fonts";

const LIGHT_DEFAULTS: Required<ProductLaunchTheme> = {
  bg: "#FFFFFF",
  fg: "#1D1D1F",
  muted: "#86868B",
  border: "#D2D2D7",
  accent: "#0071E3",
  panelBg: "#F5F5F7",
  displayFontFamily: "",
  bodyFontFamily: "",
};

const DARK_DEFAULTS: Required<ProductLaunchTheme> = {
  bg: "#000000",
  fg: "#FFFFFF",
  muted: "#86868B",
  border: "#333336",
  accent: "#0A84FF",
  panelBg: "#151516",
  displayFontFamily: "",
  bodyFontFamily: "",
};

function resolveTheme(mode: "light" | "dark", t: ProductLaunchTheme | undefined) {
  const base = mode === "light" ? LIGHT_DEFAULTS : DARK_DEFAULTS;
  return { ...base, ...(t ?? {}) };
}

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return dark;
}

interface Props {
  props: ProductLaunchBlockProps;
}

export function BlockProductLaunch({ props }: Props) {
  const prefersDark = usePrefersDark();
  const mode: "light" | "dark" =
    props.colorScheme === "auto" ? (prefersDark ? "dark" : "light") : props.colorScheme;
  const theme = useMemo(
    () => resolveTheme(mode, mode === "light" ? props.lightTheme : props.darkTheme),
    [mode, props.lightTheme, props.darkTheme],
  );

  useBlockFonts(theme.displayFontFamily, theme.bodyFontFamily);

  const displayFont = theme.displayFontFamily
    ? `'${theme.displayFontFamily}', system-ui, -apple-system, sans-serif`
    : "system-ui, -apple-system, 'SF Pro Display', sans-serif";
  const bodyFont = theme.bodyFontFamily
    ? `'${theme.bodyFontFamily}', system-ui, -apple-system, sans-serif`
    : "system-ui, -apple-system, 'SF Pro Text', sans-serif";

  const [activeChapter, setActiveChapter] = useState<string>(props.navChapters[0]?.id ?? "");

  useEffect(() => {
    const handleScroll = () => {
      let current = props.navChapters[0]?.id ?? "";
      for (const c of props.navChapters) {
        const el = document.getElementById(c.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100) current = c.id;
        }
      }
      setActiveChapter(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [props.navChapters]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navBg = mode === "light" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)";

  return (
    <div style={{ fontFamily: bodyFont, background: theme.bg, color: theme.fg, minHeight: "100vh" }}>
      {/* Sticky nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: navBg,
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: displayFont }}>{props.productName}</div>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          {props.navChapters.map((c) => (
            <button
              key={c.id}
              onClick={() => scrollTo(c.id)}
              style={{
                background: "none",
                border: "none",
                padding: "4px 0",
                cursor: "pointer",
                color: activeChapter === c.id ? theme.fg : theme.muted,
                borderBottom: activeChapter === c.id ? `2px solid ${theme.fg}` : "2px solid transparent",
                textTransform: "uppercase",
                fontSize: "10px",
                letterSpacing: "0.05em",
                fontWeight: 600,
                transition: "color 0.2s",
              }}
            >
              {c.label}
            </button>
          ))}
          {props.navCtaText && (
            <a
              href={props.navCtaUrl || "#"}
              style={{
                background: theme.accent,
                color: "#fff",
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.02em",
              }}
            >
              {props.navCtaText}
            </a>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section
        id="hero"
        style={{
          minHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px 24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
          {props.heroEyebrow && (
            <div
              style={{
                color: theme.accent,
                fontWeight: 600,
                letterSpacing: "0.1em",
                fontSize: "14px",
                marginBottom: "16px",
                textTransform: "uppercase",
              }}
            >
              {props.heroEyebrow}
            </div>
          )}
          <h1
            style={{
              fontFamily: displayFont,
              fontSize: "clamp(56px, 10vw, 120px)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              marginBottom: "24px",
            }}
          >
            {props.heroTitle}
          </h1>
          <p
            style={{
              fontSize: "clamp(20px, 4vw, 32px)",
              color: theme.muted,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              marginBottom: "40px",
              maxWidth: "640px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {props.heroTagline}
          </p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            {props.heroPrimaryCtaText && (
              <a
                href={props.heroPrimaryCtaUrl || "#"}
                style={{
                  background: theme.accent,
                  color: "#FFF",
                  border: "none",
                  borderRadius: "30px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {props.heroPrimaryCtaText}
              </a>
            )}
            {props.heroSecondaryCtaText && (
              <a
                href={props.heroSecondaryCtaUrl || "#"}
                style={{
                  background: "transparent",
                  color: theme.accent,
                  border: "none",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {props.heroSecondaryCtaText} &gt;
              </a>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          style={{
            marginTop: "80px",
            width: "100%",
            maxWidth: "1000px",
            aspectRatio: "16 / 9",
            borderRadius: "32px",
            background:
              mode === "light"
                ? "linear-gradient(145deg, #F5F5F7, #E8E8ED)"
                : "linear-gradient(145deg, #1A1A1D, #0A0A0B)",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            border: `1px solid ${theme.border}`,
          }}
        >
          {props.heroVideoUrl ? (
            <video
              src={props.heroVideoUrl}
              poster={props.heroPosterUrl || undefined}
              autoPlay
              muted
              loop
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : props.heroPosterUrl ? (
            <img
              src={props.heroPosterUrl}
              alt={props.heroTitle}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "300px",
                height: "300px",
                background: `radial-gradient(circle, ${theme.accent}33 0%, transparent 70%)`,
                filter: "blur(40px)",
              }}
            />
          )}
        </motion.div>
      </section>

      {/* Feature slabs */}
      <section style={{ padding: "80px 24px" }}>
        {props.slabs.map((slab, i) => (
          <motion.div
            key={slab.id || i}
            id={slab.id}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            style={{
              display: "flex",
              flexDirection: slab.reverse ? "row-reverse" : "row",
              gap: "80px",
              alignItems: "center",
              maxWidth: "1200px",
              margin: "0 auto 120px",
              flexWrap: "wrap",
              scrollMarginTop: "80px",
            }}
          >
            <div style={{ flex: "1 1 400px" }}>
              {slab.eyebrow && (
                <div
                  style={{
                    color: slab.accentColor || theme.accent,
                    fontWeight: 700,
                    fontSize: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "16px",
                  }}
                >
                  {slab.eyebrow}
                </div>
              )}
              <h2
                style={{
                  fontFamily: displayFont,
                  fontSize: "clamp(36px, 5vw, 56px)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  marginBottom: "24px",
                }}
              >
                {slab.title}
              </h2>
              <p style={{ fontSize: "20px", color: theme.muted, lineHeight: 1.5, fontWeight: 500, marginBottom: "32px" }}>
                {slab.body}
              </p>
              {slab.bullets.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {slab.bullets.map((b, j) => (
                    <li
                      key={j}
                      style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 500 }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: slab.accentColor || theme.accent,
                          flexShrink: 0,
                        }}
                      />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              style={{
                flex: "1 1 400px",
                height: "500px",
                borderRadius: "32px",
                background: theme.panelBg,
                border: `1px solid ${theme.border}`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {slab.imageUrl ? (
                <img
                  src={slab.imageUrl}
                  alt={slab.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    bottom: "-20%",
                    right: "-20%",
                    width: "80%",
                    height: "80%",
                    background: slab.accentColor || theme.accent,
                    opacity: 0.15,
                    filter: "blur(80px)",
                    borderRadius: "50%",
                  }}
                />
              )}
            </div>
          </motion.div>
        ))}
      </section>

      {/* Specs table */}
      {props.specsRows.length > 0 && (
        <section id="specs" style={{ padding: "120px 24px", background: theme.panelBg, scrollMarginTop: "80px" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <h2
              style={{
                fontFamily: displayFont,
                fontSize: "clamp(36px, 5vw, 48px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                textAlign: "center",
                marginBottom: "60px",
              }}
            >
              {props.specsHeadline}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `1.5fr repeat(${props.specsColumns.length}, 1fr)`,
                borderBottom: `2px solid ${theme.border}`,
                paddingBottom: "20px",
                marginBottom: "20px",
                fontWeight: 600,
                fontSize: "16px",
              }}
            >
              <div></div>
              {props.specsColumns.map((c, i) => (
                <div key={i}>{c}</div>
              ))}
            </div>
            {props.specsRows.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: `1.5fr repeat(${props.specsColumns.length}, 1fr)`,
                  borderBottom: `1px solid ${theme.border}`,
                  padding: "20px 0",
                  fontSize: "15px",
                  color: theme.muted,
                  fontWeight: 500,
                }}
              >
                <div style={{ color: theme.fg, fontWeight: 600 }}>{row.label}</div>
                {row.values.map((v, j) => (
                  <div key={j}>{v}</div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Plans */}
      {props.plans.length > 0 && (
        <section id="plans" style={{ padding: "120px 24px", scrollMarginTop: "80px" }}>
          {props.plansHeadline && (
            <h2
              style={{
                fontFamily: displayFont,
                fontSize: "clamp(36px, 5vw, 48px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                textAlign: "center",
                marginBottom: "60px",
              }}
            >
              {props.plansHeadline}
            </h2>
          )}
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px",
              alignItems: "center",
            }}
          >
            {props.plans.map((plan, i) => (
              <div
                key={i}
                style={{
                  padding: "40px",
                  borderRadius: "24px",
                  border: plan.highlight ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`,
                  background: theme.panelBg,
                  transform: plan.highlight ? "scale(1.05)" : "scale(1)",
                  position: "relative",
                }}
              >
                {plan.highlight && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: theme.accent,
                      color: "#fff",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Most Popular
                  </div>
                )}
                <h3 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "8px" }}>{plan.name}</h3>
                <div
                  style={{
                    fontSize: "40px",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    marginBottom: "28px",
                    fontFamily: displayFont,
                  }}
                >
                  {plan.price}
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0 0 32px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {plan.features.map((f, j) => (
                    <li key={j} style={{ color: theme.muted, fontSize: "15px", fontWeight: 500 }}>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.ctaUrl || "#"}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    border: "none",
                    background: plan.highlight ? theme.fg : theme.border,
                    color: plan.highlight ? theme.bg : theme.fg,
                    fontSize: "15px",
                    fontWeight: 600,
                    textDecoration: "none",
                    textAlign: "center",
                    boxSizing: "border-box",
                  }}
                >
                  {plan.ctaText}
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA close */}
      <section
        id="order"
        style={{
          padding: "140px 24px",
          background: theme.panelBg,
          textAlign: "center",
          scrollMarginTop: "80px",
        }}
      >
        <h2
          style={{
            fontFamily: displayFont,
            fontSize: "clamp(40px, 8vw, 80px)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            marginBottom: "20px",
          }}
        >
          {props.ctaHeadline}
        </h2>
        {props.ctaSubtitle && (
          <p style={{ fontSize: "22px", color: theme.muted, fontWeight: 500, marginBottom: "40px" }}>
            {props.ctaSubtitle}
          </p>
        )}
        {props.ctaButtonText && (
          <a
            href={props.ctaButtonUrl || "#"}
            style={{
              display: "inline-block",
              background: theme.fg,
              color: theme.bg,
              border: "none",
              borderRadius: "30px",
              padding: "16px 32px",
              fontSize: "18px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {props.ctaButtonText}
          </a>
        )}
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "32px 24px",
          borderTop: `1px solid ${theme.border}`,
          fontSize: "12px",
          color: theme.muted,
          fontWeight: 500,
          textAlign: "center",
        }}
      >
        {props.footerText}
      </footer>
    </div>
  );
}
