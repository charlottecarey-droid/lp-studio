import React from "react";
import { CheckCircle2, ChevronRight, Play, Users, LayoutTemplate, Send, BarChart2, ArrowUpRight, Plus } from "lucide-react";

export default function WizardStepper() {
  return (
    <section
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

      <div className="max-w-[1180px] mx-auto relative">
        {/* Headline + narrative */}
        <div style={{ maxWidth: 760, marginBottom: 48 }}>
          <div
            className="flex items-center gap-3 mb-5"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.18em",
              color: "#8B857C",
              textTransform: "uppercase",
            }}
          >
            <div style={{ width: 24, height: 1, background: "#B5AEA2" }} />
            09 / Campaign Orchestration
          </div>
          <h2
            style={{
              fontFamily: "'DM Sans', 'Inter', sans-serif",
              fontSize: "clamp(34px, 4.5vw, 46px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#1A1815",
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Build your campaigns here.{" "}
            <br className="hidden sm:block" />
            <em style={{ fontStyle: "italic", color: "#4B47E5" }}>
              Push the list to your stack.
            </em>
          </h2>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 17,
              lineHeight: 1.6,
              color: "#5C5853",
              margin: "16px 0 0",
              maxWidth: 600,
            }}
          >
            Studio generates the audience list and tokenized per-person URLs. Push it all to Marketo, HubSpot, or Salesforce to fire the send. Because links are tokenized upfront, you still get person-level analytics when they click.
          </p>
        </div>

        {/* The Wizard + Analytics Payload */}
        <div className="flex flex-col lg:flex-row items-start gap-8">
          
          {/* Main Wizard Card */}
          <div
            className="flex-1 w-full"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(26,24,21,0.18)",
              borderRadius: 14,
              boxShadow: "0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
              overflow: "hidden"
            }}
          >
            {/* Stepper Header */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid rgba(26,24,21,0.10)",
                background: "#FAFAFA"
              }}
            >
              {[
                { step: 1, label: "Audience", active: false, done: true, icon: Users },
                { step: 2, label: "Template", active: false, done: true, icon: LayoutTemplate },
                { step: 3, label: "Push to Stack", active: true, done: false, icon: Send },
              ].map((s, i) => (
                <div
                  key={s.step}
                  className="flex-1 flex items-center justify-center gap-2.5 py-4 px-2 relative"
                  style={{
                    borderRight: i < 2 ? "1px solid rgba(26,24,21,0.10)" : "none",
                    background: s.active ? "#FFFFFF" : "transparent",
                    color: s.active ? "#4B47E5" : (s.done ? "#1A1815" : "#8B857C"),
                  }}
                >
                  {s.active && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#4B47E5" }} />
                  )}
                  {s.done ? (
                    <CheckCircle2 size={16} color="#6B9171" />
                  ) : (
                    <div
                      style={{
                        width: 18, height: 18, borderRadius: 9,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 600,
                        background: s.active ? "#4B47E5" : "transparent",
                        border: s.active ? "none" : "1px solid rgba(26,24,21,0.18)",
                        color: s.active ? "#FFFFFF" : "#8B857C"
                      }}
                    >
                      {s.step}
                    </div>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Wizard Body showing summary of previous steps + active step 3 */}
            <div style={{ padding: "24px 32px" }}>
              {/* Step 1 Summary */}
              <div className="flex items-center gap-4 mb-6">
                <div style={{ width: 24, textAlign: "center", color: "#B5AEA2", fontSize: 12, fontWeight: 600 }}>1</div>
                <div className="flex-1 border border-[rgba(26,24,21,0.10)] rounded-lg p-3 flex items-center justify-between" style={{ background: "#F6F2E9" }}>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#1A1815" }}>Q3 Expansion Accounts</span>
                    <span style={{ fontSize: 11, color: "#5C5853", background: "rgba(26,24,21,0.05)", padding: "2px 6px", borderRadius: 4 }}>+ 3 filters</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#5C5853]">
                    <Users size={14} /> 1,240 contacts
                  </div>
                </div>
              </div>

              {/* Step 2 Summary */}
              <div className="flex items-start gap-4 mb-8">
                <div style={{ width: 24, textAlign: "center", color: "#B5AEA2", fontSize: 12, fontWeight: 600, marginTop: 12 }}>2</div>
                <div className="flex-1 flex gap-3">
                  {[
                    { name: "Executive Brief", sel: true },
                    { name: "Product Launch", sel: false },
                    { name: "Event Invite", sel: false }
                  ].map((tpl) => (
                    <div
                      key={tpl.name}
                      style={{
                        flex: 1,
                        border: tpl.sel ? "2px solid #4B47E5" : "1px solid rgba(26,24,21,0.10)",
                        borderRadius: 8,
                        padding: "8px",
                        background: tpl.sel ? "rgba(75,71,229,0.02)" : "#FFFFFF",
                        opacity: tpl.sel ? 1 : 0.6
                      }}
                    >
                      <div style={{ height: 48, background: "#EFE9DC", borderRadius: 4, marginBottom: 8 }} />
                      <div style={{ fontSize: 11, fontWeight: 600, color: tpl.sel ? "#4B47E5" : "#5C5853", textAlign: "center" }}>
                        {tpl.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: "rgba(26,24,21,0.10)", margin: "0 -32px 24px" }} />

              {/* Step 3 Active */}
              <div className="flex items-start gap-4">
                <div style={{ width: 24, textAlign: "center", color: "#4B47E5", fontSize: 12, fontWeight: 600, marginTop: 4 }}>3</div>
                <div className="flex-1">
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1815", marginBottom: 12 }}>
                    Where should we push this campaign?
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { name: "Marketo", dot: "#5C4C9F", sel: false },
                      { name: "HubSpot", dot: "#FF7A59", sel: true },
                      { name: "Salesforce", dot: "#00A1E0", sel: false },
                      { name: "Google Sheets", dot: "#0F9D58", sel: false },
                      { name: "Resend", dot: "#4B47E5", sel: false },
                      { name: "Webhook", dot: "#8A8780", sel: false },
                    ].map(p => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                        style={{
                          border: p.sel ? "1px solid #4B47E5" : "1px solid rgba(26,24,21,0.10)",
                          background: p.sel ? "rgba(75,71,229,0.04)" : "#FFFFFF",
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.dot }} />
                          <span style={{ fontSize: 13, fontWeight: p.sel ? 600 : 500, color: p.sel ? "#1A1815" : "#5C5853" }}>
                            {p.name}
                          </span>
                        </div>
                        <div
                          style={{
                            width: 16, height: 16, borderRadius: "50%",
                            border: p.sel ? "5px solid #4B47E5" : "1px solid rgba(26,24,21,0.18)",
                            background: "#FFFFFF"
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between bg-[#F6F2E9] p-4 rounded-lg">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1815" }}>Push 1,240 contacts to HubSpot</div>
                      <div style={{ fontSize: 12, color: "#5C5853", marginTop: 2 }}>Includes unique tracking URLs per contact</div>
                    </div>
                    <button
                      className="flex items-center gap-2 px-5 py-2.5 rounded-md transition-opacity hover:opacity-90"
                      style={{
                        background: "#4B47E5",
                        color: "#FFFFFF",
                        fontSize: 13,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(75,71,229,0.2)"
                      }}
                    >
                      Push to HubSpot <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Payoff Strip */}
          <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-4">
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "#8B857C",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}>
              <BarChart2 size={12} />
              After you push: Analytics
            </div>

            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(26,24,21,0.18)",
                borderRadius: 12,
                boxShadow: "0 10px 30px -10px rgba(26,24,21,0.08)",
                overflow: "hidden"
              }}
            >
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(26,24,21,0.10)", background: "#FAFAFA" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1815" }}>High Intent Prospects</div>
                <div style={{ fontSize: 11, color: "#5C5853", marginTop: 2 }}>Detected from tokenized URLs</div>
              </div>
              
              <div style={{ padding: 8 }}>
                {[
                  { name: "David Kim", role: "VP Eng, Vertex", score: 92, action: "Route to Sales", icon: ArrowUpRight },
                  { name: "Elena Rostova", role: "Dir Ops, Nexus", score: 85, action: "Add to segment", icon: Plus },
                  { name: "Marcus Thorne", role: "CIO, Stratus", score: 78, action: "Route to Sales", icon: ArrowUpRight }
                ].map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-[#F6F2E9] transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: i === 0 ? "#E26B4F" : (i === 1 ? "#6B9171" : "#C8923D") }}
                      >
                        {p.score}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1815" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#8B857C" }}>{p.role}</div>
                      </div>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-semibold transition-opacity"
                      style={{ color: "#4B47E5", background: "rgba(75,71,229,0.08)", padding: "4px 8px", borderRadius: 4 }}
                    >
                      {p.action} <p.icon size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, lineHeight: 1.5, color: "#5C5853", padding: "0 4px" }}>
              Every engagement is tied back to the person, automatically routing hot leads to your sales team's queue.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
