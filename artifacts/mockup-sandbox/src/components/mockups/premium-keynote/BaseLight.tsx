import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

const theme = {
  bg: "#FAFAFA",
  text: "#18181B",
  textMuted: "#71717A",
  border: "#E4E4E7",
  surface: "#FFFFFF",
  navBg: "rgba(250, 250, 250, 0.8)",
  primary: "#18181B",
  primaryText: "#FFFFFF",
  accent1: "#F59E0B", // Amber
  accent2: "#3B82F6", // Blue
  accent3: "#10B981", // Emerald
};

const CHAPTERS = [
  { id: "vision", label: "Vision" },
  { id: "design", label: "Design" },
  { id: "fidelity", label: "Fidelity" },
  { id: "connectivity", label: "Connectivity" },
  { id: "specs", label: "Specs" },
  { id: "reserve", label: "Reserve" },
];

export default function BaseLight() {
  const [activeChapter, setActiveChapter] = useState("vision");

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      
      for (let i = CHAPTERS.length - 1; i >= 0; i--) {
        const el = document.getElementById(CHAPTERS[i].id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= windowHeight * 0.3) {
            setActiveChapter(CHAPTERS[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const navHeight = 60;
      const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.text, minHeight: "100vh", fontFamily: "sans-serif" }}>
      {/* 1. Sticky Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: theme.navBg,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 24px",
          height: 60,
        }}
      >
        <div style={{ fontWeight: 700, letterSpacing: "-0.02em", fontSize: 18 }}>AURA V1</div>
        <div className="hidden md:flex" style={{ gap: 24 }}>
          {CHAPTERS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => scrollTo(ch.id)}
              style={{
                background: "none",
                border: "none",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: activeChapter === ch.id ? 600 : 500,
                color: activeChapter === ch.id ? theme.text : theme.textMuted,
                cursor: "pointer",
                padding: "20px 0",
                position: "relative",
              }}
            >
              {ch.label}
              {activeChapter === ch.id && (
                <motion.div
                  layoutId="activeTabLight"
                  style={{
                    position: "absolute",
                    bottom: -1,
                    left: 0,
                    right: 0,
                    height: 2,
                    backgroundColor: theme.text,
                  }}
                />
              )}
            </button>
          ))}
        </div>
        <div>
          <button
            onClick={() => scrollTo("reserve")}
            style={{
              backgroundColor: theme.primary,
              color: theme.primaryText,
              border: "none",
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Pre-order
          </button>
        </div>
      </nav>

      {/* 2. Hero */}
      <section
        id="vision"
        style={{
          minHeight: "calc(100vh - 60px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{ maxWidth: 800 }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24 }}>
            The New Standard in Analog
          </div>
          <h1 style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 24, fontFamily: "serif" }}>
            Pure sound.<br />Zero compromise.
          </h1>
          <p style={{ fontSize: "clamp(18px, 2vw, 24px)", color: theme.textMuted, marginBottom: 48, maxWidth: 600, marginInline: "auto" }}>
            Aura V1 reimagines the high-fidelity turntable for the modern era. Solid aluminum plinth, carbon fiber tonearm, and wireless connectivity when you need it.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 80 }}>
            <button
              onClick={() => scrollTo("reserve")}
              style={{
                backgroundColor: theme.primary,
                color: theme.primaryText,
                border: "none",
                padding: "16px 32px",
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Order Now — $1,499
            </button>
            <button
              style={{
                backgroundColor: "transparent",
                color: theme.text,
                border: `1px solid ${theme.border}`,
                padding: "16px 32px",
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Watch the Keynote
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          style={{
            width: "100%",
            maxWidth: 1200,
            aspectRatio: "16/9",
            borderRadius: 24,
            background: `linear-gradient(135deg, ${theme.border} 0%, ${theme.bg} 100%)`,
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.8) 0%, transparent 100%)" }} />
          {/* Abstract Turntable Shape */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "60%", height: "60%", borderRadius: "50%", border: `1px solid ${theme.textMuted}`, opacity: 0.2 }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "55%", height: "55%", borderRadius: "50%", border: `1px solid ${theme.textMuted}`, opacity: 0.4 }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "10%", height: "10%", borderRadius: "50%", background: theme.text }} />
        </motion.div>
      </section>

      {/* 3. Feature Slabs */}
      <div style={{ padding: "120px 24px", display: "flex", flexDirection: "column", gap: 160, maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Slab 1 */}
        <section id="design" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 64, alignItems: "center" }}>
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}>
            <div style={{ color: theme.accent1, fontWeight: 600, fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Machined to Perfection</div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 500, fontFamily: "serif", lineHeight: 1.1, marginBottom: 24, letterSpacing: "-0.02em" }}>A plinth carved from a single block of aluminum.</h2>
            <p style={{ fontSize: 18, color: theme.textMuted, lineHeight: 1.6, marginBottom: 32 }}>
              We rejected MDF and acrylic in favor of aerospace-grade aluminum. It provides unparalleled resonance control and a monolithic aesthetic that anchors any room.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {["12kg solid mass", "Anodized finish", "Adjustable isolation feet"].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: theme.text }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent1 }} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} style={{ aspectRatio: "1/1", backgroundColor: theme.surface, borderRadius: 24, padding: 32, position: "relative", overflow: "hidden", border: `1px solid ${theme.border}` }}>
             <div style={{ position: "absolute", inset: 0, background: `linear-gradient(45deg, transparent, ${theme.accent1}15)` }} />
             <div style={{ position: "absolute", bottom: -40, right: -40, width: "80%", height: "80%", backgroundColor: theme.border, borderRadius: "20%", transform: "rotate(15deg)" }} />
          </motion.div>
        </section>

        {/* Slab 2 */}
        <section id="fidelity" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 64, alignItems: "center" }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} style={{ aspectRatio: "1/1", backgroundColor: theme.surface, borderRadius: 24, padding: 32, position: "relative", overflow: "hidden", border: `1px solid ${theme.border}`, order: 2 }}>
             <div style={{ position: "absolute", inset: 0, background: `linear-gradient(-45deg, transparent, ${theme.accent2}15)` }} />
             <div style={{ position: "absolute", top: 40, left: -20, width: 200, height: 12, backgroundColor: theme.text, transform: "rotate(-35deg)" }} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} style={{ order: 1 }}>
            <div style={{ color: theme.accent2, fontWeight: 600, fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>The Carbon Tonearm</div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 500, fontFamily: "serif", lineHeight: 1.1, marginBottom: 24, letterSpacing: "-0.02em" }}>Lightweight rigidity for flawless tracking.</h2>
            <p style={{ fontSize: 18, color: theme.textMuted, lineHeight: 1.6, marginBottom: 32 }}>
              The 9-inch carbon fiber tonearm reduces moving mass while maximizing stiffness. Pre-fitted with a custom Ortofon moving magnet cartridge, it retrieves every nuance from the groove.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {["Ultra-low friction bearings", "VTA and azimuth adjustable", "Pre-aligned cartridge"].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: theme.text }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent2 }} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </section>

        {/* Slab 3 */}
        <section id="connectivity" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 64, alignItems: "center" }}>
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}>
            <div style={{ color: theme.accent3, fontWeight: 600, fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Analog Meets Digital</div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 500, fontFamily: "serif", lineHeight: 1.1, marginBottom: 24, letterSpacing: "-0.02em" }}>Stream your vinyl to any room.</h2>
            <p style={{ fontSize: 18, color: theme.textMuted, lineHeight: 1.6, marginBottom: 32 }}>
              A purist analog signal path meets an optional high-resolution digital broadcast. Stream losslessly to your wireless speakers without compromising the physical connection.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {["aptX™ HD Bluetooth", "Built-in phono preamp", "Optical audio out"].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, color: theme.text }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent3 }} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} style={{ aspectRatio: "1/1", backgroundColor: theme.surface, borderRadius: 24, padding: 32, position: "relative", overflow: "hidden", border: `1px solid ${theme.border}` }}>
             <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, transparent, ${theme.accent3}15)` }} />
             <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 100, height: 100, borderRadius: 50, border: `2px dashed ${theme.accent3}`, opacity: 0.5 }} />
             <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 150, height: 150, borderRadius: 75, border: `1px dashed ${theme.accent3}`, opacity: 0.3 }} />
          </motion.div>
        </section>

      </div>

      {/* 4. Specs */}
      <section id="specs" style={{ padding: "120px 24px", backgroundColor: theme.surface, borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 500, fontFamily: "serif", marginBottom: 64, textAlign: "center" }}>Technical Specifications</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 15 }}>
              <thead>
                <tr>
                  <th style={{ padding: "16px 24px", borderBottom: `2px solid ${theme.text}`, color: theme.text, fontWeight: 600 }}>Feature</th>
                  <th style={{ padding: "16px 24px", borderBottom: `2px solid ${theme.text}`, color: theme.text, fontWeight: 600 }}>Aura V1 Core</th>
                  <th style={{ padding: "16px 24px", borderBottom: `2px solid ${theme.text}`, color: theme.text, fontWeight: 600 }}>Aura V1 Wireless</th>
                  <th style={{ padding: "16px 24px", borderBottom: `2px solid ${theme.text}`, color: theme.text, fontWeight: 600 }}>Aura V1 Studio</th>
                </tr>
              </thead>
              <tbody style={{ fontFamily: "monospace" }}>
                {[
                  ["Plinth Material", "Solid Aluminum", "Solid Aluminum", "Machined Brass"],
                  ["Tonearm", "9\" Carbon Fiber", "9\" Carbon Fiber", "10\" Titanium"],
                  ["Cartridge", "Ortofon 2M Red", "Ortofon 2M Blue", "Ortofon 2M Black"],
                  ["Drive System", "Belt Drive", "Belt Drive", "Direct Drive"],
                  ["Phono Preamp", "External req.", "Built-in (Bypassable)", "Built-in Studio Grade"],
                  ["Connectivity", "RCA only", "RCA, BT aptX, Optical", "RCA, XLR Balanced, BT aptX"],
                  ["Weight", "12 kg", "12.5 kg", "18 kg"],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: "20px 24px", color: theme.textMuted, fontFamily: "sans-serif" }}>{row[0]}</td>
                    <td style={{ padding: "20px 24px" }}>{row[1]}</td>
                    <td style={{ padding: "20px 24px" }}>{row[2]}</td>
                    <td style={{ padding: "20px 24px" }}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 5. Plans */}
      <section id="reserve" style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 500, fontFamily: "serif", marginBottom: 16 }}>Choose your fidelity.</h2>
            <p style={{ fontSize: 18, color: theme.textMuted }}>Reserve today. Shipping begins November 2024.</p>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
            {[
              { name: "Core", price: "$999", desc: "The pure analog experience.", features: ["Aluminum Plinth", "Carbon Tonearm", "Ortofon 2M Red"] },
              { name: "Wireless", price: "$1,299", desc: "Analog soul, digital freedom.", features: ["Everything in Core", "Built-in Preamp", "aptX™ HD Bluetooth"], highlight: true },
              { name: "Studio", price: "$1,899", desc: "Uncompromised reference audio.", features: ["Brass Plinth", "Titanium Tonearm", "Balanced XLR Outputs"] },
            ].map((plan, i) => (
              <div key={i} style={{ 
                backgroundColor: theme.surface, 
                border: `1px solid ${plan.highlight ? theme.text : theme.border}`, 
                borderRadius: 24, 
                padding: 40,
                position: "relative",
                display: "flex",
                flexDirection: "column"
              }}>
                {plan.highlight && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", backgroundColor: theme.text, color: theme.bg, fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Most Popular
                  </div>
                )}
                <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>{plan.name}</div>
                <div style={{ fontSize: 48, fontWeight: 500, fontFamily: "serif", marginBottom: 16 }}>{plan.price}</div>
                <div style={{ fontSize: 16, color: theme.textMuted, marginBottom: 32 }}>{plan.desc}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 48, flex: 1 }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, fontSize: 15 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.textMuted }}>
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button style={{ 
                  width: "100%", 
                  padding: "16px", 
                  backgroundColor: plan.highlight ? theme.primary : "transparent",
                  color: plan.highlight ? theme.primaryText : theme.text,
                  border: `1px solid ${plan.highlight ? theme.primary : theme.border}`,
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 500,
                  cursor: "pointer"
                }}>
                  Pre-order {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CTA Close */}
      <section style={{ padding: "120px 24px", backgroundColor: theme.surface, borderTop: `1px solid ${theme.border}` }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(48px, 6vw, 72px)", fontWeight: 500, fontFamily: "serif", lineHeight: 1.1, marginBottom: 24, letterSpacing: "-0.02em" }}>
            The music is waiting.
          </h2>
          <p style={{ fontSize: 20, color: theme.textMuted, marginBottom: 48 }}>
            Experience vinyl the way it was meant to be heard. Order today to secure your place in the first production run.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <button
              onClick={() => scrollTo("reserve")}
              style={{
                backgroundColor: theme.primary,
                color: theme.primaryText,
                border: "none",
                padding: "16px 32px",
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Order Aura V1
            </button>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer style={{ padding: "48px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${theme.border}`, fontSize: 14, color: theme.textMuted, flexWrap: "wrap", gap: 24 }}>
        <div>&copy; 2024 Aura Audio. All rights reserved.</div>
        <div style={{ display: "flex", gap: 24 }}>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Support</a>
        </div>
      </footer>
    </div>
  );
}
