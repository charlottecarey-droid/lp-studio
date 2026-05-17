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
      style={{ background: "var(--cream)", borderTop: "1px solid var(--hairline)" }}
    >
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div className="max-w-2xl mb-12">
          <div className="marker marker-rule mb-6">Plays nice with your stack</div>
          <h2 className="font-display text-display-md" style={{ color: "var(--ink)" }}>
            Drops into the tools you already use.
          </h2>
          <p className="mt-5 text-[16px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
            CRM, MAP, analytics, scheduling — read from where your data lives, write back to where your team works.
          </p>
        </div>

        <div
          className="grid grid-cols-3 md:grid-cols-6"
          style={{ borderTop: "1px solid var(--hairline)", borderLeft: "1px solid var(--hairline)" }}
        >
          {integrations.map((name) => (
            <div
              key={name}
              className="flex items-center justify-center font-mono uppercase py-9 transition-all"
              style={{
                background: "transparent",
                color: "var(--ink-soft)",
                fontSize: 12,
                letterSpacing: "0.08em",
                borderRight: "1px solid var(--hairline)",
                borderBottom: "1px solid var(--hairline)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--cream-2)";
                e.currentTarget.style.color = "var(--ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--ink-soft)";
              }}
            >
              {name}
            </div>
          ))}
        </div>

        <div className="mt-6 text-[13.5px]" style={{ color: "var(--ink-mute)" }}>
          + open API and Zapier — wire up anything else.
        </div>
      </div>
    </section>
  );
}
