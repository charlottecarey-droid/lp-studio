import React from "react";
import { 
  Users, 
  LayoutTemplate, 
  Send, 
  Eye, 
  Clock, 
  MousePointerClick, 
  TrendingUp,
  ChevronRight,
  Filter
} from "lucide-react";

export default function OrchestrationSplit() {
  return (
    <section
      id="campaign-orchestration"
      className="px-6"
      style={{
        background: "#F6F2E9",
        paddingTop: 96,
        paddingBottom: 96,
        borderTop: "1px solid rgba(26,24,21,0.10)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft accent orb */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "8%",
          left: "-10%",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(75,71,229,0.10) 0%, transparent 65%)",
          filter: "blur(10px)",
        }}
      />

      <div
        className="max-w-[1180px] mx-auto relative"
      >
        {/* Headline + narrative */}
        <div style={{ maxWidth: 760, marginBottom: 56 }}>
          <div 
            className="flex items-center gap-3 mb-5"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.18em",
              color: "#8B857C",
              textTransform: "uppercase"
            }}
          >
            <div style={{ width: 24, height: 1, background: "#B5AEA2" }} />
            09 / Campaign Orchestration
          </div>
          
          <h2
            style={{ 
              fontFamily: "'DM Sans', 'Inter', sans-serif",
              fontSize: "clamp(34px, 4vw, 46px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#1A1815", 
              lineHeight: 1.1,
              margin: 0 
            }}
          >
            Orchestrate campaigns. <br />
            <em style={{ fontStyle: "italic", color: "#4B47E5" }}>
              Uncover who&apos;s ready to buy.
            </em>
          </h2>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 17,
              lineHeight: 1.6,
              color: "#5C5853",
              margin: "20px 0 0",
              maxWidth: 600,
            }}
          >
            Build your audience, attach personalized templates, and push the tokenized list to your preferred platform. Because every link is unique, Studio reveals person-level engagement so you can route the hottest prospects straight to Sales.
          </p>
        </div>

        {/* Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT: Builder Card */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(26,24,21,0.18)",
              borderRadius: 14,
              boxShadow: "0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid rgba(26,24,21,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {["#E26B4F", "#C8923D", "#6B9171"].map((c, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.8 }} />
                ))}
              </div>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  color: "#8B857C",
                  textTransform: "uppercase"
                }}
              >
                Campaign Wizard
              </span>
            </div>

            {/* Steps */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 32 }}>
              
              {/* Step 1: Audience */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div style={{ background: "rgba(75,71,229,0.1)", color: "#4B47E5", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>1</div>
                  <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1815" }}>Select Audience</h4>
                </div>
                <div style={{ border: "1px solid rgba(26,24,21,0.18)", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="flex items-center gap-3">
                    <Users size={16} color="#8B857C" />
                    <div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, color: "#1A1815" }}>Enterprise AEs · Q3 Expansion</div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#5C5853", marginTop: 2 }}>Based on Salesforce active accounts</div>
                    </div>
                  </div>
                  <div style={{ background: "#F6F2E9", padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 600, color: "#2A2722", fontFamily: "'Inter', sans-serif" }}>
                    1,240 contacts
                  </div>
                </div>
              </div>

              {/* Step 2: Template */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div style={{ background: "rgba(75,71,229,0.1)", color: "#4B47E5", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>2</div>
                  <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1815" }}>Attach Templates</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div style={{ border: "2px solid #4B47E5", borderRadius: 8, padding: 12, background: "rgba(75,71,229,0.02)" }}>
                    <div style={{ height: 60, background: "#EFE9DC", borderRadius: 4, marginBottom: 8, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 8, left: 8, right: 8, height: 12, background: "#fff", borderRadius: 2, opacity: 0.7 }} />
                      <div style={{ position: "absolute", top: 24, left: 8, width: "60%", height: 6, background: "#fff", borderRadius: 2, opacity: 0.5 }} />
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1815" }}>Executive Brief</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#5C5853" }}>Dynamic microsite</div>
                  </div>
                  <div style={{ border: "1px solid rgba(26,24,21,0.10)", borderRadius: 8, padding: 12, opacity: 0.6 }}>
                    <div style={{ height: 60, background: "#F6F2E9", borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, color: "#2A2722" }}>Product Teaser</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#8B857C" }}>Landing page</div>
                  </div>
                </div>
              </div>

              {/* Step 3: Destination */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div style={{ background: "rgba(75,71,229,0.1)", color: "#4B47E5", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>3</div>
                  <h4 style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1815" }}>Push to Platform</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "Marketo", dot: "#5C4C9F", active: true },
                    { name: "HubSpot", dot: "#FF7A59" },
                    { name: "Salesforce", dot: "#00A1E0" },
                    { name: "Sheets", dot: "#0F9D58" },
                    { name: "Webhook", dot: "#8A8780" },
                  ].map(platform => (
                    <div 
                      key={platform.name}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 100,
                        border: platform.active ? "1px solid #4B47E5" : "1px solid rgba(26,24,21,0.10)",
                        background: platform.active ? "rgba(75,71,229,0.06)" : "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13,
                        fontWeight: platform.active ? 600 : 500,
                        color: platform.active ? "#4B47E5" : "#5C5853"
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: platform.dot }} />
                      {platform.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action */}
              <div className="pt-2">
                <button
                  style={{
                    width: "100%",
                    background: "#4B47E5",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "12px",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 2px 4px rgba(75,71,229,0.2)"
                  }}
                >
                  <Send size={16} />
                  Generate & Push 1,240 URLs to Marketo
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Payoff Card */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(26,24,21,0.18)",
              borderRadius: 14,
              boxShadow: "0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(26,24,21,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 600, color: "#1A1815", margin: 0 }}>
                  Engagement Insights
                </h3>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#5C5853", marginTop: 2 }}>
                  Live signals from tokenized URLs
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(26,24,21,0.18)", background: "#fff", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 500, color: "#2A2722", display: "flex", alignItems: "center", gap: 4 }}>
                  <Filter size={14} /> Filter
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: "2fr 1fr 1fr 1fr", 
                  padding: "12px 24px", 
                  background: "#F6F2E9",
                  borderBottom: "1px solid rgba(26,24,21,0.10)",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  color: "#8B857C",
                  textTransform: "uppercase"
                }}
              >
                <div>Prospect</div>
                <div>Status</div>
                <div>Time</div>
                <div>Score</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {[
                  { name: "Michael Chen", title: "VP Sales, TechFlow", status: "Active now", time: "4m 12s", score: 98, hot: true },
                  { name: "Sarah Jenkins", title: "CRO, Apex Systems", status: "Viewed 2h ago", time: "2m 45s", score: 85, hot: true },
                  { name: "David Kim", title: "Director, Innovate", status: "Viewed 1d ago", time: "1m 10s", score: 62, hot: false },
                  { name: "Elena Rodriguez", title: "VP Ops, GlobalNet", status: "Viewed 1d ago", time: "0m 45s", score: 45, hot: false },
                  { name: "James Wilson", title: "AE, CloudScale", status: "Opened email", time: "-", score: 15, hot: false },
                ].map((person, i) => (
                  <div 
                    key={i}
                    style={{ 
                      display: "grid", 
                      gridTemplateColumns: "2fr 1fr 1fr 1fr", 
                      padding: "16px 24px", 
                      borderBottom: "1px solid rgba(26,24,21,0.06)",
                      alignItems: "center",
                      background: person.hot ? "rgba(226, 107, 79, 0.02)" : "transparent",
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1815", display: "flex", alignItems: "center", gap: 6 }}>
                        {person.name}
                        {person.hot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E26B4F" }} />}
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#5C5853" }}>{person.title}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'Inter', sans-serif", fontSize: 12, color: person.hot ? "#E26B4F" : "#5C5853" }}>
                      {person.hot ? <TrendingUp size={14} /> : <Eye size={14} />}
                      {person.status}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#2A2722", fontWeight: 500 }}>
                      <Clock size={14} color="#8B857C" /> {person.time}
                    </div>
                    <div>
                      <div style={{ background: person.hot ? "rgba(226, 107, 79, 0.1)" : "#F6F2E9", color: person.hot ? "#E26B4F" : "#5C5853", padding: "4px 8px", borderRadius: 6, display: "inline-block", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>
                        {person.score}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Action */}
            <div style={{ padding: "16px 24px", background: "rgba(75,71,229,0.02)", borderTop: "1px solid rgba(26,24,21,0.10)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#5C5853" }}>
                <strong style={{ color: "#1A1815", fontWeight: 600 }}>142</strong> high-intent prospects found
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: "#4B47E5", background: "transparent", border: "none", cursor: "pointer" }}>
                  Save as Segment
                </button>
                <button style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: "#FFFFFF", background: "#4B47E5", padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  Push to Salesforce <ChevronRight size={14} />
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
