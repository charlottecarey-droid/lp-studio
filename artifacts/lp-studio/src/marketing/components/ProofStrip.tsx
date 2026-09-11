import { useEffect, useState } from "react";

/**
 * ProofStrip — thin proof band directly under the hero prompt card.
 *
 * Honesty contract: every demo company on this site is fictional, so there is
 * deliberately NO "trusted by" logo wall here. Until real customer logos / a
 * G2 profile exist, proof is (a) the live founding-beta counter and (b) true
 * product stats. When real proof lands, it slots into this strip.
 *
 * The beta segment reuses GET /api/lp/beta-offer — the same source the signup
 * cap enforces (see BetaOfferCallout, which this strip replaced on the
 * homepage) — and renders nothing until the fetch resolves, so the prerender
 * never bakes in a stale count.
 */
interface BetaStatus {
  enabled: boolean;
  cap: number;
  claimed: number;
  remaining: number;
  durationDays: number;
}

const STATS: string[] = [
  "47s median generation",
  "60+ block library",
  "A/B testing built in",
];

export default function ProofStrip() {
  const [beta, setBeta] = useState<BetaStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lp/beta-offer")
      .then((r) => (r.ok ? (r.json() as Promise<BetaStatus>) : null))
      .then((s) => {
        if (!cancelled && s && s.cap > 0 && s.remaining > 0) setBeta(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const item = (text: string, color: string, key: string) => (
    <span
      key={key}
      className="font-mono uppercase"
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.12em",
        color,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );

  return (
    <div
      style={{
        marginTop: 56,
        borderTop: "1px solid var(--hairline)",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--cream-2)",
      }}
    >
      <div
        className="max-w-[1180px] mx-auto px-6 flex flex-wrap items-center justify-center"
        style={{ gap: "12px 18px", paddingTop: 18, paddingBottom: 18 }}
      >
        {beta &&
          item(
            `Founding beta · ${beta.remaining} of ${beta.cap} Scale seats left`,
            "var(--gold)",
            "beta",
          )}
        {beta && <Dot />}
        {STATS.map((s, i) => (
          <span key={s} className="inline-flex items-center" style={{ gap: 18 }}>
            {item(s, "var(--ink-soft)", s)}
            {i < STATS.length - 1 && <Dot />}
          </span>
        ))}
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      className="hidden sm:inline-block"
      style={{ width: 4, height: 4, borderRadius: 999, background: "var(--ink-faint)" }}
    />
  );
}
