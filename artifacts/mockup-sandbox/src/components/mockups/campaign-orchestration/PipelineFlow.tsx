import React, { useEffect, useRef, useState } from "react";
import { Users, LayoutTemplate, Send, Activity, UserPlus, PieChart } from "lucide-react";

export default function PipelineFlow() {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="campaign-orchestration"
      style={{
        background: "#F6F2E9",
        paddingTop: "96px",
        paddingBottom: "96px",
        paddingLeft: "24px",
        paddingRight: "24px",
        borderTop: "1px solid rgba(26,24,21,0.10)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft accent orb */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          pointerEvents: "none",
          top: "8%",
          left: "-10%",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(75,71,229,0.10) 0%, transparent 65%)",
          filter: "blur(10px)",
        }}
      />

      <div
        ref={ref}
        style={{
          maxWidth: 1180,
          margin: "auto",
          position: "relative",
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Header */}
        <div style={{ maxWidth: 760, marginBottom: 56 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: "0.04em",
              color: "#8B857C",
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 24,
                height: 1,
                background: "#B5AEA2",
              }}
            />
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
              margin: "0 0 16px 0",
            }}
          >
            Tokenize once. <em style={{ fontStyle: "italic", color: "#4B47E5" }}>Send from anywhere.</em>
          </h2>

          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 17,
              lineHeight: 1.6,
              color: "#5C5853",
              margin: 0,
              maxWidth: 600,
            }}
          >
            Build your audience and attach personalized microsites in Studio. Push the list to your MAP/CRM to handle the send. Because every link is pre-tokenized, you still get person-level engagement insights.
          </p>
        </div>

        {/* Pipeline Diagram */}
        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "stretch" }}>
          
          {/* Stage 1: Audience */}
          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 12 }}>
            <NodeHeader step="1" label="Audience" icon={<Users size={16} />} />
            <PipelineCard>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1815", marginBottom: 4 }}>Q3 Expansion Accounts</div>
              <div style={{ fontSize: 12, color: "#5C5853", marginBottom: 12 }}>Saved segment · 1,240 contacts</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                <FilterChip label="Enterprise" />
                <FilterChip label="No open opps" />
              </div>
            </PipelineCard>
          </div>

          <Connector />

          {/* Stage 2: Template */}
          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 12 }}>
            <NodeHeader step="2" label="Template" icon={<LayoutTemplate size={16} />} />
            <PipelineCard>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1815", marginBottom: 4 }}>Executive Brief</div>
              <div style={{ fontSize: 12, color: "#5C5853", marginBottom: 12 }}>Landing page variant</div>
              <div style={{ width: "100%", height: 60, background: "#EFE9DC", borderRadius: 6, border: "1px solid rgba(26,24,21,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 10, color: "#8B857C", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>Thumbnail</span>
              </div>
            </PipelineCard>
          </div>

          <Connector />

          {/* Stage 3: Push */}
          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 12 }}>
            <NodeHeader step="3" label="Push to Platform" icon={<Send size={16} />} />
            <PipelineCard>
              <div style={{ fontSize: 12, color: "#5C5853", marginBottom: 12, lineHeight: 1.4 }}>
                URLs are tokenized per-person and pushed to:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <PlatformRow name="Marketo" color="#5C4C9F" selected />
                <PlatformRow name="HubSpot" color="#FF7A59" />
                <PlatformRow name="Salesforce" color="#00A1E0" />
              </div>
            </PipelineCard>
          </div>

          <Connector />

          {/* Stage 4 & Fork: Engagement & Outcomes */}
          <div style={{ flex: "2 1 300px", display: "flex", flexDirection: "column", gap: 12 }}>
             <NodeHeader step="4" label="Engagement Signals" icon={<Activity size={16} />} />
             
             <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
               {/* Signal Box */}
               <div style={{ 
                 background: "rgba(75,71,229,0.04)", 
                 border: "1px solid rgba(75,71,229,0.15)", 
                 borderRadius: 14, 
                 padding: 16,
                 display: "flex",
                 alignItems: "center",
                 gap: 12
               }}>
                 <div style={{ width: 40, height: 40, borderRadius: 8, background: "#4B47E5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                    <Activity size={20} />
                 </div>
                 <div>
                   <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1815" }}>Person-Level Analytics</div>
                   <div style={{ fontSize: 12, color: "#5C5853", marginTop: 2 }}>Opens · Visits · Time-on-page</div>
                 </div>
               </div>

               {/* Fork paths */}
               <div style={{ display: "flex", gap: 16, position: "relative" }}>
                 {/* Visual fork lines */}
                 <div style={{ position: "absolute", left: 20, top: -16, bottom: 20, width: 2, background: "rgba(75,71,229,0.15)", zIndex: 0 }} />
                 <div style={{ position: "absolute", left: 20, top: 40, width: 16, height: 2, background: "rgba(75,71,229,0.15)", zIndex: 0 }} />
                 <div style={{ position: "absolute", left: 20, bottom: 40, width: 16, height: 2, background: "rgba(75,71,229,0.15)", zIndex: 0 }} />
                 
                 <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", paddingLeft: 36, zIndex: 1 }}>
                   
                   {/* Sales Fork */}
                   <div style={{ 
                     background: "#FFFFFF", 
                     border: "1px solid rgba(26,24,21,0.18)", 
                     borderRadius: 12, 
                     padding: 14,
                     boxShadow: "0 10px 22px -14px rgba(26,24,21,0.08)"
                   }}>
                     <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                       <UserPlus size={14} color="#E26B4F" />
                       <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1815" }}>Route to Sales</div>
                     </div>
                     <div style={{ fontSize: 12, color: "#5C5853" }}>
                       Follow up with highly engaged prospects immediately.
                     </div>
                     <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                       <Avatar initials="SC" color="#4B47E5" />
                       <div style={{ fontSize: 11 }}>
                         <span style={{ fontWeight: 600, color: "#1A1815" }}>Sarah Chen</span>
                         <span style={{ color: "#8B857C" }}> · 4 visits</span>
                       </div>
                     </div>
                   </div>

                   {/* Marketing Fork */}
                   <div style={{ 
                     background: "#FFFFFF", 
                     border: "1px solid rgba(26,24,21,0.18)", 
                     borderRadius: 12, 
                     padding: 14,
                     boxShadow: "0 10px 22px -14px rgba(26,24,21,0.08)"
                   }}>
                     <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                       <PieChart size={14} color="#6B9171" />
                       <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1815" }}>Segment for Marketing</div>
                     </div>
                     <div style={{ fontSize: 12, color: "#5C5853" }}>
                       Retarget based on page engagement scores.
                     </div>
                   </div>

                 </div>
               </div>
             </div>
          </div>

        </div>

      </div>
    </section>
  );
}

function NodeHeader({ step, label, icon }: { step: string, label: string, icon: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ 
        width: 20, height: 20, 
        borderRadius: 4, 
        background: "rgba(26,24,21,0.05)", 
        border: "1px solid rgba(26,24,21,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 600, color: "#5C5853",
        fontFamily: "'JetBrains Mono', monospace"
      }}>
        {step}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#2A2722", fontWeight: 600, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
        {icon}
        {label}
      </div>
    </div>
  );
}

function PipelineCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#FFFFFF",
      borderRadius: 14,
      border: "1px solid rgba(26,24,21,0.18)",
      padding: 16,
      boxShadow: "0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
      fontFamily: "'Inter', sans-serif",
      flex: 1
    }}>
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      width: 24,
      color: "rgba(26,24,21,0.2)"
    }} className="hidden md:flex">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      background: "#F6F2E9",
      border: "1px solid rgba(26,24,21,0.1)",
      borderRadius: 999,
      fontSize: 11,
      color: "#5C5853"
    }}>
      {label}
    </span>
  );
}

function PlatformRow({ name, color, selected = false }: { name: string, color: string, selected?: boolean }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 8px",
      borderRadius: 6,
      background: selected ? "rgba(75,71,229,0.05)" : "transparent",
      border: selected ? "1px solid rgba(75,71,229,0.15)" : "1px solid transparent"
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <div style={{ fontSize: 12, fontWeight: selected ? 600 : 500, color: selected ? "#4B47E5" : "#5C5853" }}>
        {name}
      </div>
      {selected && (
        <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4B47E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      )}
    </div>
  );
}

function Avatar({ initials, color }: { initials: string, color: string }) {
  return (
    <div style={{
      width: 24,
      height: 24,
      borderRadius: "50%",
      background: color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 10,
      fontWeight: 600,
      fontFamily: "'DM Sans', 'Inter', sans-serif"
    }}>
      {initials}
    </div>
  );
}
