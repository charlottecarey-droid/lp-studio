import { useEffect, useState } from "react";

/**
 * Founding-beta line under the hero prompt card.
 *
 * Every number here comes from GET /api/lp/beta-offer, which reports the SAME
 * cap the signup path enforces — nothing is hardcoded in the copy, so the
 * site can never advertise spots that don't exist. Raise the cap
 * (BETA_SCALE_OFFER_CAP env) and this line updates on its own.
 *
 * Renders nothing until the fetch resolves and nothing when the offer is off,
 * so the prerendered homepage never bakes in a stale count.
 */
interface BetaStatus {
  enabled: boolean;
  cap: number;
  claimed: number;
  remaining: number;
  durationDays: number;
}

export default function BetaOfferCallout() {
  const [status, setStatus] = useState<BetaStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lp/beta-offer")
      .then((r) => (r.ok ? (r.json() as Promise<BetaStatus>) : null))
      .then((s) => {
        if (!cancelled && s && s.cap > 0) setStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  const months = Math.round(status.durationDays / 30.4);
  const full = status.remaining === 0;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "14px 20px 0",
      }}
    >
      <p
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          letterSpacing: "-0.005em",
          color: "var(--ink-2)",
          border: "1px solid var(--hairline)",
          borderRadius: 999,
          padding: "7px 14px",
          margin: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: full ? "var(--ink-2)" : "#10b981",
            flexShrink: 0,
          }}
        />
        {full ? (
          <span>
            The founding beta ({status.cap} teams) is full — thanks, everyone.
          </span>
        ) : (
          <span>
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>Founding beta:</strong>{" "}
            the first {status.cap} teams get Scale free for {months >= 12 ? "a year" : `${months} months`} —{" "}
            {status.remaining} spot{status.remaining === 1 ? "" : "s"} left
          </span>
        )}
      </p>
    </div>
  );
}
