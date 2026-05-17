import React, { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";

const theme = {
  bg: "#FFFFFF",
  surface: "#F9FAFB",
  surfaceHover: "#F3F4F6",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#0055FF", // Deep bright blue for high contrast on light
  accentMuted: "rgba(0, 85, 255, 0.05)",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSans: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const chapters = [
  { id: "vision", label: "Vision" },
  { id: "features", label: "Features" },
  { id: "specs", label: "Specs" },
  { id: "pricing", label: "Pricing" },
];

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function LinearLight() {
  const [activeChapter, setActiveChapter] = useState("vision");

  useEffect(() => {
    const handleScroll = () => {
      let current = chapters[0].id;
      for (const chapter of chapters) {
        const el = document.getElementById(chapter.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100) {
            current = chapter.id;
          }
        }
      }
      setActiveChapter(current);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: theme.fontSans, minHeight: "100vh" }}>
      {/* 1. Sticky Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${theme.border}`,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          height: "64px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <div style={{ fontWeight: 600, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "2px", background: theme.accent }} />
            NEXUS IDE
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => scrollTo(ch.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: activeChapter === ch.id ? theme.text : theme.textMuted,
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  padding: "24px 0",
                  position: "relative",
                  fontWeight: activeChapter === ch.id ? 600 : 400,
                }}
              >
                {ch.label}
                {activeChapter === ch.id && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "2px",
                      background: theme.accent,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
        <button
          style={{
            background: theme.text,
            color: theme.bg,
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Download
        </button>
      </nav>

      {/* 2. Hero */}
      <section id="vision" style={{ padding: "120px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "800px",
            height: "800px",
            background: `radial-gradient(circle, ${theme.accentMuted} 0%, rgba(255,255,255,0) 70%)`,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "1000px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ fontSize: "14px", color: theme.accent, fontFamily: theme.fontMono, marginBottom: "24px" }}>
              NEXUS 2.0 IS HERE
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1
              style={{
                fontSize: "80px",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                marginBottom: "32px",
              }}
            >
              The editor built for
              <br />
              <span style={{ color: theme.textMuted }}>the next decade.</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p style={{ fontSize: "20px", color: theme.textMuted, maxWidth: "600px", margin: "0 auto 48px" }}>
              Lightning-fast native performance, multiplayer collaboration, and deeply integrated AI capabilities. It's time to upgrade your workflow.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "80px" }}>
              <button
                style={{
                  background: theme.text,
                  color: theme.bg,
                  border: "none",
                  padding: "16px 32px",
                  borderRadius: "8px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Download for macOS
              </button>
              <button
                style={{
                  background: theme.surface,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  padding: "16px 32px",
                  borderRadius: "8px",
                  fontSize: "15px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Read the Docs
              </button>
            </div>
          </FadeIn>
          <FadeIn delay={0.4}>
            <div
              style={{
                width: "100%",
                aspectRatio: "16/9",
                background: "#0A0A0A", // Keep editor inner dark for the light mode
                border: `1px solid ${theme.border}`,
                borderRadius: "16px",
                boxShadow: "0 24px 48px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div style={{ height: "40px", borderBottom: `1px solid #222`, display: "flex", alignItems: "center", padding: "0 16px", gap: "8px", background: "#111" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#444" }} />
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#444" }} />
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#444" }} />
              </div>
              <div style={{ flex: 1, padding: "24px", fontFamily: theme.fontMono, fontSize: "14px", color: "#888", textAlign: "left" }}>
                <span style={{ color: "#FF7B72" }}>import</span> {"{"} Nexus {"}"} <span style={{ color: "#FF7B72" }}>from</span> <span style={{ color: "#A5D6FF" }}>'@nexus/core'</span>;<br /><br />
                <span style={{ color: "#FF7B72" }}>const</span> editor = <span style={{ color: "#FF7B72" }}>new</span> Nexus({"{"}<br />
                &nbsp;&nbsp;theme: <span style={{ color: "#A5D6FF" }}>'light'</span>,<br />
                &nbsp;&nbsp;ai: <span style={{ color: "#79C0FF" }}>true</span>,<br />
                &nbsp;&nbsp;multiplayer: <span style={{ color: "#79C0FF" }}>true</span><br />
                {"}"});<br /><br />
                editor.initialize();
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 3. Feature Slabs */}
      <section id="features" style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "160px" }}>
          
          {/* Slab 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
            <FadeIn>
              <div>
                <div style={{ fontSize: "14px", color: "#C026D3", fontFamily: theme.fontMono, marginBottom: "16px" }}>SPEED</div>
                <h2 style={{ fontSize: "48px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "24px", lineHeight: 1.1 }}>
                  Zero latency.<br />Infinite scale.
                </h2>
                <p style={{ fontSize: "18px", color: theme.textMuted, marginBottom: "32px", lineHeight: 1.6 }}>
                  Built entirely in Rust, Nexus bypasses the browser engine to give you native performance. Open massive monorepos in milliseconds.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {["Memory safe execution", "Multi-threaded indexing", "GPU-accelerated rendering"].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", color: theme.textMuted }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C026D3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div style={{ aspectRatio: "1/1", background: `linear-gradient(135deg, rgba(192, 38, 211, 0.05), transparent)`, border: `1px solid ${theme.border}`, borderRadius: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(192, 38, 211, 0.2) 0%, transparent 70%)" }} />
              </div>
            </FadeIn>
          </div>

          {/* Slab 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
            <FadeIn delay={0.2}>
              <div style={{ aspectRatio: "1/1", background: `linear-gradient(135deg, rgba(5, 150, 105, 0.05), transparent)`, border: `1px solid ${theme.border}`, borderRadius: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(5, 150, 105, 0.2) 0%, transparent 70%)" }} />
              </div>
            </FadeIn>
            <FadeIn>
              <div>
                <div style={{ fontSize: "14px", color: "#059669", fontFamily: theme.fontMono, marginBottom: "16px" }}>INTELLIGENCE</div>
                <h2 style={{ fontSize: "48px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "24px", lineHeight: 1.1 }}>
                  Your copilot,<br />built in.
                </h2>
                <p style={{ fontSize: "18px", color: theme.textMuted, marginBottom: "32px", lineHeight: 1.6 }}>
                  Nexus understands your entire codebase. Ask complex architectural questions, refactor across files, and let AI write the boilerplate.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {["Context-aware completions", "Automated test generation", "Semantic code search"].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", color: theme.textMuted }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>

        </div>
      </section>

      {/* 4. Specs */}
      <section id="specs" style={{ padding: "120px 24px", borderTop: `1px solid ${theme.border}`, background: theme.surface }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <FadeIn>
            <h2 style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "64px", textAlign: "center" }}>
              Technical Specifications
            </h2>
          </FadeIn>
          <div style={{ fontFamily: theme.fontMono, fontSize: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "16px", color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>
              <div>FEATURE</div>
              <div>FREE</div>
              <div>PRO</div>
              <div>TEAM</div>
            </div>
            {[
              ["Telemetry", "Opt-in", "Disabled", "Disabled"],
              ["Extensions API", "Full Access", "Full Access", "Enterprise APIs"],
              ["Max File Size", "500MB", "Unlimited", "Unlimited"],
              ["AI Requests", "100/mo", "Unlimited", "Unlimited"],
              ["Multiplayer", "Read-only", "Full Read/Write", "Role-based ACL"],
            ].map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "16px", borderBottom: `1px solid ${theme.border}`, background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <div style={{ color: theme.text }}>{row[0]}</div>
                <div style={{ color: theme.textMuted }}>{row[1]}</div>
                <div style={{ color: theme.textMuted }}>{row[2]}</div>
                <div style={{ color: theme.textMuted }}>{row[3]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Plans */}
      <section id="pricing" style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <FadeIn>
            <h2 style={{ fontSize: "48px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "64px", textAlign: "center" }}>
              Simple pricing.
            </h2>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { name: "Free", price: "$0", desc: "For individuals", popular: false },
              { name: "Pro", price: "$20", desc: "For professionals", popular: true },
              { name: "Team", price: "$49", desc: "For organizations", popular: false },
            ].map((plan, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div
                  style={{
                    padding: "40px",
                    borderRadius: "24px",
                    border: `1px solid ${plan.popular ? theme.accent : theme.border}`,
                    background: plan.popular ? theme.bg : theme.surface,
                    position: "relative",
                    boxShadow: plan.popular ? "0 24px 48px rgba(0,85,255,0.1)" : "none",
                  }}
                >
                  {plan.popular && (
                    <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: theme.accent, color: "#FFF", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 600 }}>
                      Most Popular
                    </div>
                  )}
                  <div style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>{plan.name}</div>
                  <div style={{ color: theme.textMuted, marginBottom: "24px" }}>{plan.desc}</div>
                  <div style={{ fontSize: "48px", fontWeight: 700, letterSpacing: "-0.04em", marginBottom: "32px" }}>
                    {plan.price}<span style={{ fontSize: "16px", color: theme.textMuted, fontWeight: 400 }}>/mo</span>
                  </div>
                  <button
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: "8px",
                      border: "none",
                      background: plan.popular ? theme.accent : theme.surfaceHover,
                      color: plan.popular ? "#FFF" : theme.text,
                      fontWeight: 600,
                      cursor: "pointer",
                      marginBottom: "32px",
                      boxShadow: plan.popular ? "none" : `inset 0 0 0 1px ${theme.border}`,
                    }}
                  >
                    Get Started
                  </button>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {[1, 2, 3].map((_, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: "12px", color: theme.textMuted, fontSize: "14px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.popular ? theme.accent : theme.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        Standard feature included
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CTA */}
      <section style={{ padding: "120px 24px", textAlign: "center" }}>
        <FadeIn>
          <div style={{ maxWidth: "800px", margin: "0 auto", background: `linear-gradient(180deg, ${theme.surfaceHover}, ${theme.surface})`, border: `1px solid ${theme.border}`, borderRadius: "32px", padding: "80px 40px" }}>
            <div style={{ fontSize: "14px", color: theme.accent, fontFamily: theme.fontMono, marginBottom: "24px" }}>NEXUS IDE</div>
            <h2 style={{ fontSize: "48px", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "32px" }}>
              Ready to code?
            </h2>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <button style={{ background: theme.text, color: theme.bg, border: "none", padding: "16px 32px", borderRadius: "8px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>
                Order Now
              </button>
              <button style={{ background: "transparent", color: theme.text, border: `1px solid ${theme.border}`, padding: "16px 32px", borderRadius: "8px", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}>
                Watch the Keynote
              </button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* 7. Footer */}
      <footer style={{ borderTop: `1px solid ${theme.border}`, padding: "40px 24px", color: theme.textMuted, fontSize: "14px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>© 2024 Nexus Inc. All rights reserved.</div>
          <div style={{ display: "flex", gap: "24px" }}>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Twitter</a>
            <a href="#" style={{ color: "inherit", textDecoration: "none" }}>GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
