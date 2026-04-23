import { useInView } from "@/hooks/useInView";

const LIME = "#C7E738";

const integrations = [
  "Salesforce",
  "HubSpot",
  "Marketo",
  "Outreach",
  "Slack",
  "Segment",
  "Snowflake",
  "Mixpanel",
  "Clearbit",
  "6sense",
  "Chili Piper",
  "Iterable",
];

export default function Integrations() {
  const { ref, inView } = useInView();
  return (
    <section
      id="integrations"
      className="px-6 py-20 md:py-24 relative"
      style={{ background: "#001512" }}
    >
      <div
        ref={ref}
        className="max-w-5xl mx-auto text-center"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
          style={{
            background: "rgba(199,231,56,0.08)",
            color: LIME,
            border: "1px solid rgba(199,231,56,0.18)",
          }}
        >
          Plays nice with your stack
        </div>
        <h2
          className="text-3xl md:text-4xl font-bold mb-4 text-white"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          Drop into the tools you{" "}
          <span style={{ color: LIME }}>already use.</span>
        </h2>
        <p
          className="text-base md:text-lg max-w-xl mx-auto mb-10"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          CRM, MAP, analytics, scheduling — LP Studio reads from where your
          data lives and writes back to where your team works.
        </p>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {integrations.map((name) => (
            <div
              key={name}
              className="rounded-xl px-3 py-4 flex items-center justify-center text-sm font-semibold transition-all cursor-default"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.7)",
                fontFamily: "Outfit, sans-serif",
                letterSpacing: "0.02em",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(199,231,56,0.06)";
                e.currentTarget.style.borderColor = "rgba(199,231,56,0.25)";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "rgba(255,255,255,0.7)";
              }}
            >
              {name}
            </div>
          ))}
        </div>

        <div
          className="mt-8 inline-flex items-center gap-2 text-sm"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          <span>+ open API and Zapier — wire up anything.</span>
        </div>
      </div>
    </section>
  );
}
