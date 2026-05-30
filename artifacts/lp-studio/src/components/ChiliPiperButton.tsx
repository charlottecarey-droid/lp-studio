import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { usePageContext } from "@/lib/page-context";

const API_BASE = "/api";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface ChiliPiperButtonProps {
  url: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ChiliPiperButton({ url, children, className, style }: ChiliPiperButtonProps) {
  const [open, setOpen] = useState(false);
  const submittedRef = useRef(false);
  const { pageId, testId, variantId, sessionId } = usePageContext();

  useEffect(() => {
    if (!open) return;

    const handler = async (event: MessageEvent) => {
      if (submittedRef.current) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      const d = data as Record<string, unknown>;
      const isBookingConfirmed =
        d.action === "booking-confirmed" ||
        d.type === "booking-confirmed" ||
        d.event === "booking-confirmed" ||
        (typeof d.action === "string" && d.action.toLowerCase().includes("booking"));

      if (!isBookingConfirmed) return;

      const rawLead =
        (d.args as Record<string, unknown>)?.lead ??
        d.lead ??
        d.data ??
        d;

      const fields: Record<string, string> = {};
      if (rawLead && typeof rawLead === "object") {
        const l = rawLead as Record<string, unknown>;
        const firstName = (l.firstName ?? l.first_name ?? "") as string;
        const lastName = (l.lastName ?? l.last_name ?? "") as string;
        const name = [firstName, lastName].filter(Boolean).join(" ") ||
          (typeof l.name === "string" ? l.name : "");
        if (name) fields["Name"] = name;
        if (typeof l.email === "string" && l.email) fields["Email"] = l.email;
        if (typeof l.phone === "string" && l.phone) fields["Phone"] = l.phone;
      }
      // Only require that THIS instance owns a scheduler URL. The listener is
      // already gated on the modal being open (see `if (!open) return` in the
      // effect), so a booking confirmed here genuinely originated from this
      // button. Do NOT also require PII: direct-scheduler bookings (the
      // visitor types their details inside the Chili Piper iframe, with no
      // preceding lead-capture form) frequently post a `booking-confirmed`
      // with no lead payload, and gating on identity silently dropped every
      // one of those — losing the lead AND the conversion. Record the booking
      // regardless; url-less sibling instances never reach here.
      if (!url) return;
      submittedRef.current = true;
      fields["Booking Source"] = "Chili Piper";
      fields["Chili Piper URL"] = url;

      if (pageId != null) {
        try {
          await fetch(`${API_BASE}/lp/leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields, pageId, variantId }),
          });
        } catch { }

        try {
          // Omit testId/variantId unless this page is actually rendering an
          // A/B test variant. Hardcoding `testId: 0` violated the lp_events
          // FK and 500'd the conversion on every plain builder page — the
          // error was swallowed by the catch below, silently dropping the
          // booking from funnel reports. (Same bug the modal hook already
          // fixed by omitting the keys when there's no test.)
          const trackBody: Record<string, unknown> = {
            sessionId: sessionId ?? `anon-${Date.now()}`,
            eventType: "conversion",
            conversionType: "chilipiper_booking",
          };
          if (testId != null) trackBody.testId = testId;
          if (variantId != null) trackBody.variantId = variantId;
          await fetch(`${API_BASE}/lp/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trackBody),
          });
        } catch { }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [open, url, pageId, testId, variantId, sessionId]);

  const handleOpen = () => {
    submittedRef.current = false;
    setOpen(true);
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => url && handleOpen()}
        className={className}
        style={{ cursor: "pointer", ...style }}
        whileHover={{ scale: 1.04, y: -1 }}
        whileTap={{ scale: 0.96 }}
        transition={SPRING}
      >
        {children}
      </motion.button>

      {open && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 880,
              height: "min(90vh, 720px)",
              background: "#fff",
              borderRadius: "1.25rem",
              overflow: "hidden",
              boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.875rem 1.25rem",
                borderBottom: "1px solid #e5e7eb",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar style={{ width: 16, height: 16, color: "var(--brand-primary)" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--brand-primary)", fontFamily: "'Inter',system-ui,sans-serif" }}>
                  Schedule a Meeting
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem",
                  borderRadius: "0.375rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <iframe
              src={url}
              style={{ flex: 1, width: "100%", border: "none", minHeight: 0 }}
              allow="camera; microphone; clipboard-write"
              title="Schedule a Meeting"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
