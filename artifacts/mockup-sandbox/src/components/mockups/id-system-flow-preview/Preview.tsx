import { BlockIdSystemFlow } from "../../../../../lp-studio/src/blocks/BlockIdSystemFlow";

export default function Preview() {
  return (
    <BlockIdSystemFlow
      props={{
        eyebrow: "SECTION 01 · THE SYSTEM",
        headline: "One connected system. <em>Powered by AI.</em>",
        metricLabel: "STATIONS",
        metricValue: "5 · <em>end to end</em>",
        activeIndex: 2,
        stations: [
          { timestamp: "00:00", label: "Scan", tag: "CAPTURE", category: "CHAIRSIDE", title: "AI <em>Scan</em>", description: "Better inputs, fewer remakes." },
          { timestamp: "00:24", label: "Design", tag: "AI STUDIO", category: "STUDIO", title: "AI <em>Design</em>", description: "Clinical consistency, every case." },
          { timestamp: "02:46", label: "Mill", tag: "ROBOTICS", category: "FLOOR", title: "Precision <em>Robotics</em>", description: "Micron precision, at scale.", activeCaseId: "CASE № D-4472 · CROWN #19" },
          { timestamp: "03:54", label: "QC", tag: "VERIFY", category: "QC LINE", title: "AI <em>QC</em>", description: "Four checkpoints, end to end." },
          { timestamp: "04:22", label: "Data", tag: "NETWORK", category: "NETWORK", title: "<em>Data</em> & Intelligence", description: "Case-level visibility, one pane." },
        ],
        footerBadge: "ONE SYSTEM",
        footerBody: "Not five products bolted together — <em>one connected line</em>, scan to ship, with AI running through every step.",
        footerMetricLabel: "MEDIAN TAT",
        footerMetricValue: "3.2 days",
        ctaText: "Tour the system",
        ctaUrl: "#",
      }}
    />
  );
}
