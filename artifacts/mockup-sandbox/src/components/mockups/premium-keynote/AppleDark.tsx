import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

const theme = {
  bg: "#000000",
  fg: "#FFFFFF",
  muted: "#86868B",
  border: "#333336",
  accent: "#0A84FF", // Dark mode adjusted accent
  panelBg: "#151516",
  slabs: {
    1: "#FF375F",
    2: "#32D74B",
    3: "#FF9F0A",
  }
};

const chapters = [
  { id: "vision", label: "Vision" },
  { id: "design", label: "Design" },
  { id: "acoustics", label: "Acoustics" },
  { id: "specs", label: "Specs" },
  { id: "order", label: "Order" },
];

export default function AppleDark() {
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
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: theme.bg, color: theme.fg, minHeight: "100vh" }}>
      {/* 1. Sticky top chapter nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50, background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "12px 24px", fontSize: "12px", fontWeight: 600, letterSpacing: "-0.01em"
      }}>
        <div style={{ fontSize: "18px", fontWeight: 700 }}>Aura Max</div>
        <div style={{ display: "flex", gap: "24px" }}>
          {chapters.map((c) => (
            <button
              key={c.id}
              onClick={() => scrollTo(c.id)}
              style={{
                background: "none", border: "none", padding: "4px 0", cursor: "pointer",
                color: activeChapter === c.id ? theme.fg : theme.muted,
                borderBottom: activeChapter === c.id ? `2px solid ${theme.fg}` : "2px solid transparent",
                textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.05em", fontWeight: 600,
                transition: "color 0.2s"
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 2. Full-bleed Vision Hero */}
      <section id="vision" style={{ minHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px", position: "relative", overflow: "hidden" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
          <div style={{ color: theme.accent, fontWeight: 600, letterSpacing: "0.1em", fontSize: "14px", marginBottom: "16px", textTransform: "uppercase" }}>
            The New Era
          </div>
          <h1 style={{ fontSize: "clamp(64px, 10vw, 120px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: "24px" }}>
            Aura Max.
          </h1>
          <p style={{ fontSize: "clamp(24px, 4vw, 32px)", color: theme.muted, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "40px", maxWidth: "600px" }}>
            High-fidelity audio. Completely reimagined.
          </p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
            <button style={{ background: theme.accent, color: "#FFF", border: "none", borderRadius: "30px", padding: "12px 24px", fontSize: "16px", fontWeight: 600, cursor: "pointer" }}>
              Buy
            </button>
            <button style={{ background: "transparent", color: theme.accent, border: "none", padding: "12px 24px", fontSize: "16px", fontWeight: 600, cursor: "pointer" }}>
              Watch the film &gt;
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.3 }} style={{ marginTop: "80px", width: "100%", maxWidth: "1000px", height: "500px", borderRadius: "32px", background: "linear-gradient(145deg, #1A1A1D, #0A0A0B)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `1px solid ${theme.border}` }}>
          <div style={{ width: "300px", height: "300px", background: "radial-gradient(circle, rgba(10,132,255,0.15) 0%, transparent 70%)", filter: "blur(40px)" }} />
        </motion.div>
      </section>

      {/* 3. Feature Slabs */}
      <section style={{ padding: "120px 24px" }}>
        {[
          { id: "design", accent: theme.slabs[1], title: "An elegant composition.", text: "Crafted with an acoustically engineered mesh canopy and custom-designed memory foam ear cushions.", reverse: false },
          { id: "acoustics", accent: theme.slabs[2], title: "Computational audio.", text: "Dual H2 chips deliver an industry-leading listening experience through breakthrough computational audio.", reverse: true },
          { id: "battery", accent: theme.slabs[3], title: "Power for days.", text: "Up to 30 hours of listening time with Active Noise Cancellation enabled. Charge via MagSafe.", reverse: false },
        ].map((slab, i) => (
          <motion.div key={i} id={slab.id} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} style={{ display: "flex", flexDirection: slab.reverse ? "row-reverse" : "row", gap: "80px", alignItems: "center", maxWidth: "1200px", margin: "0 auto 160px", flexWrap: "wrap", scrollMarginTop: "80px" }}>
            <div style={{ flex: "1 1 400px" }}>
              <div style={{ color: slab.accent, fontWeight: 700, fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>Feature 0{i + 1}</div>
              <h2 style={{ fontSize: "56px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "24px" }}>{slab.title}</h2>
              <p style={{ fontSize: "20px", color: theme.muted, lineHeight: 1.5, fontWeight: 500, marginBottom: "32px" }}>{slab.text}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
                {[1, 2, 3].map(n => (
                  <li key={n} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: 500 }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: slab.accent }} />
                    Detail specification point
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ flex: "1 1 400px", height: "600px", borderRadius: "32px", background: theme.panelBg, border: `1px solid ${theme.border}`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: "-20%", right: "-20%", width: "80%", height: "80%", background: slab.accent, opacity: 0.15, filter: "blur(80px)", borderRadius: "50%" }} />
            </div>
          </motion.div>
        ))}
      </section>

      {/* 4. Specs comparison table */}
      <section id="specs" style={{ padding: "120px 24px", background: theme.panelBg }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "48px", fontWeight: 700, letterSpacing: "-0.03em", textAlign: "center", marginBottom: "80px" }}>Compare the models.</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", borderBottom: `2px solid ${theme.border}`, paddingBottom: "24px", marginBottom: "24px", fontWeight: 600, fontSize: "18px" }}>
              <div></div>
              <div>Aura Light</div>
              <div>Aura Pro</div>
              <div>Aura Max</div>
            </div>
            {[
              ["Driver", "40mm", "50mm Custom", "50mm Pro-G"],
              ["Noise Cancellation", "Active", "Advanced", "Pro-level"],
              ["Spatial Audio", "No", "Personalized", "Personalized w/ Head Tracking"],
              ["Battery Life", "20 hours", "24 hours", "30 hours"],
              ["Materials", "Plastic", "Aluminum", "Stainless Steel"],
              ["Weight", "250g", "280g", "320g"],
            ].map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", borderBottom: `1px solid ${theme.border}`, padding: "24px 0", fontSize: "16px", color: theme.muted, fontWeight: 500 }}>
                <div style={{ color: theme.fg, fontWeight: 600 }}>{row[0]}</div>
                <div>{row[1]}</div>
                <div>{row[2]}</div>
                <div>{row[3]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Plans section */}
      <section style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", alignItems: "center" }}>
          {[
            { name: "Aura Light", price: "$249", feats: ["40mm Drivers", "Active Noise Cancellation", "20 hours battery"] },
            { name: "Aura Pro", price: "$399", feats: ["50mm Custom Drivers", "Advanced ANC", "Spatial Audio", "24 hours battery"], highlight: true },
            { name: "Aura Max", price: "$549", feats: ["50mm Pro-G Drivers", "Pro-level ANC", "Head Tracking", "30 hours battery", "Carrying Case"] },
          ].map((plan, i) => (
            <div key={i} style={{ padding: "40px", borderRadius: "24px", border: plan.highlight ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`, background: theme.panelBg, transform: plan.highlight ? "scale(1.05)" : "scale(1)", position: "relative" }}>
              {plan.highlight && <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: theme.accent, color: "#fff", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>Most Popular</div>}
              <h3 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "8px" }}>{plan.name}</h3>
              <div style={{ fontSize: "40px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "32px" }}>{plan.price}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {plan.feats.map((f, j) => (
                  <li key={j} style={{ color: theme.muted, fontSize: "16px", fontWeight: 500 }}>{f}</li>
                ))}
              </ul>
              <button style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "none", background: plan.highlight ? theme.fg : theme.border, color: plan.highlight ? theme.bg : theme.fg, fontSize: "16px", fontWeight: 600, cursor: "pointer" }}>
                Buy {plan.name}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Order / CTA close */}
      <section id="order" style={{ padding: "160px 24px", background: theme.panelBg, textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(48px, 8vw, 80px)", fontWeight: 700, letterSpacing: "-0.04em", marginBottom: "24px" }}>Aura Max.</h2>
        <p style={{ fontSize: "24px", color: theme.muted, fontWeight: 500, marginBottom: "48px" }}>Sound, perfected.</p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          <button style={{ background: theme.fg, color: theme.bg, border: "none", borderRadius: "30px", padding: "16px 32px", fontSize: "18px", fontWeight: 600, cursor: "pointer" }}>
            Order Now
          </button>
        </div>
      </section>

      {/* 7. Tiny footer */}
      <footer style={{ padding: "40px 24px", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", fontSize: "12px", color: theme.muted, fontWeight: 500, flexWrap: "wrap", gap: "16px" }}>
        <div>Copyright © 2024 Aura Inc. All rights reserved.</div>
        <div style={{ display: "flex", gap: "24px" }}>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy Policy</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms of Use</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Sales and Refunds</a>
        </div>
      </footer>
    </div>
  );
}
