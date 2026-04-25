import { useInView } from "../hooks/useInView";

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
      className="px-6 py-24 md:py-28"
      style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        ref={ref}
        className="max-w-5xl mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div className="max-w-2xl mb-12">
          <div className="eyebrow mb-5">Plays nice with your stack</div>
          <h2 className="font-display text-3xl md:text-4xl leading-[1.1] font-semibold text-white">
            Drops into the tools you{" "}
            <span className="" style={{ color: "#D4F542" }}>
              already use
            </span>.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: "rgba(250,250,250,0.55)" }}>
            CRM, MAP, analytics, scheduling — read from where your data lives, write back to where your team works.
          </p>
        </div>

        <div
          className="grid grid-cols-3 md:grid-cols-6 gap-px rounded-xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {integrations.map((name) => (
            <div
              key={name}
              className="flex items-center justify-center text-[13px] font-medium py-7 transition-colors"
              style={{ background: "#0A0A0A", color: "rgba(250,250,250,0.65)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#0F0F0F";
                e.currentTarget.style.color = "#FAFAFA";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#0A0A0A";
                e.currentTarget.style.color = "rgba(250,250,250,0.65)";
              }}
            >
              {name}
            </div>
          ))}
        </div>

        <div className="mt-6 text-[13px]" style={{ color: "rgba(250,250,250,0.4)" }}>
          + open API and Zapier — wire up anything else.
        </div>
      </div>
    </section>
  );
}
