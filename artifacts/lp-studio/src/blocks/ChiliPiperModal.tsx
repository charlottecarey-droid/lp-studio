import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { usePageContext } from "@/lib/page-context";
import { safeNavigate } from "@/lib/safe-url";

const API_BASE = "/api";

interface ChiliPiperLead {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  [key: string]: string | undefined;
}

interface Props {
  url: string;
  pageId?: number;
  /**
   * A/B test attribution. See BlockForm.tsx for the contract — both ids flow
   * straight into the `chilipiper_booking` conversion POST and are omitted
   * from the body when undefined so the API doesn't reject the row.
   */
  testId?: number;
  variantId?: number;
  sessionId?: string;
  onClose: () => void;
}

function extractLeadFromEvent(data: unknown): ChiliPiperLead | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  const lead: ChiliPiperLead = {};

  const rawLead =
    (d.args as Record<string, unknown>)?.lead ??
    d.lead ??
    d.data ??
    d;

  if (rawLead && typeof rawLead === "object") {
    const l = rawLead as Record<string, unknown>;
    if (typeof l.email === "string") lead.email = l.email;
    if (typeof l.firstName === "string") lead.firstName = l.firstName;
    if (typeof l.first_name === "string") lead.firstName = l.first_name as string;
    if (typeof l.lastName === "string") lead.lastName = l.lastName;
    if (typeof l.last_name === "string") lead.lastName = l.last_name as string;
    if (typeof l.phone === "string") lead.phone = l.phone;
    if (typeof l.name === "string") {
      const [first, ...rest] = (l.name as string).split(" ");
      lead.firstName = lead.firstName ?? first;
      lead.lastName = lead.lastName ?? rest.join(" ");
    }
  }

  return Object.keys(lead).length > 0 ? lead : null;
}

// Listens for the Chili Piper "booking-confirmed" postMessage from any
// embedded scheduler iframe and emits the second-conversion analytics +
// best-effort lead persistence. Used by the legacy modal AND the new
// inline-iframe handoff path so both routes record `chilipiper_booking`.
export function useChiliPiperBookingTracking({
  url,
  pageId,
  testId,
  variantId,
  sessionId,
  onBookingConfirmed,
  origin,
}: {
  url: string;
  pageId?: number;
  /**
   * Optional A/B test attribution. Both ids are present together (real test
   * variant render) or both absent (plain builder page); the conversion POST
   * omits whichever is missing so the API accepts the row.
   */
  testId?: number;
  variantId?: number;
  sessionId?: string;
  /**
   * Fires once per scheduler URL when the booking-confirmed message arrives,
   * BEFORE the best-effort lead/conversion POSTs (UI feedback shouldn't wait
   * on analytics). The chat block uses it to close the in-panel scheduler
   * and post its booking-confirmation message.
   */
  onBookingConfirmed?: () => void;
  /**
   * Which flow hosts this scheduler ("form" hand-off, page "chat", "email"
   * capture modal, standalone "cta" button/modal). Stamped on the booking
   * lead as hidden `_bookingOrigin` (underscore keys never surface as lead
   * columns/CSV/merge vars) so booking analytics can attribute the flow.
   * Rows recorded before this shipped have no stamp and report as unknown.
   */
  origin?: "form" | "chat" | "email" | "cta";
}) {
  const submittedRef = useRef(false);
  useEffect(() => { submittedRef.current = false; }, [url]);
  // Held in a ref so a new callback identity each render doesn't tear down
  // and re-attach the window listener.
  const onConfirmedRef = useRef(onBookingConfirmed);
  useEffect(() => { onConfirmedRef.current = onBookingConfirmed; });

  useEffect(() => {
    // Skip entirely when this instance has no configured scheduler URL —
    // it can't have produced the booking and would otherwise write a blank
    // sibling lead row when the real booking iframe broadcasts on window.
    if (!url) return;
    const handler = async (event: MessageEvent) => {
      if (submittedRef.current) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;

      const d = data as Record<string, unknown>;
      // Calendly embeds broadcast `{event: "calendly.event_scheduled"}` on
      // booking; treat it as booking-confirmed so a Calendly URL in
      // chiliPiperConfig.url records the same conversion + lead.
      const isCalendly = d.event === "calendly.event_scheduled";
      const isBookingConfirmed =
        isCalendly ||
        d.action === "booking-confirmed" ||
        d.type === "booking-confirmed" ||
        d.event === "booking-confirmed" ||
        (typeof d.action === "string" && d.action.toLowerCase().includes("booking"));

      if (!isBookingConfirmed) return;

      // The url-less sibling case is already excluded at the effect level
      // (`if (!url) return` before the listener attaches), so any booking that
      // reaches here originated from THIS instance's scheduler. Record it even
      // when Chili Piper's postMessage carries no lead payload — direct-
      // scheduler bookings frequently omit PII, and gating on identity
      // silently dropped the lead AND the conversion for every one of them.
      const lead = extractLeadFromEvent(data);
      submittedRef.current = true;
      onConfirmedRef.current?.();

      const fields: Record<string, string> = {};
      if (lead?.firstName && lead?.lastName) {
        fields["Name"] = `${lead.firstName} ${lead.lastName}`.trim();
      } else if (lead?.firstName) {
        fields["Name"] = lead.firstName;
      }
      if (lead?.email) fields["Email"] = lead.email;
      if (lead?.phone) fields["Phone"] = lead.phone;
      fields["Booking Source"] = isCalendly ? "Calendly" : "Chili Piper";
      fields["Chili Piper URL"] = url;
      if (origin) fields["_bookingOrigin"] = origin;

      if (pageId != null && Object.keys(fields).length > 0) {
        try {
          await fetch(`${API_BASE}/lp/leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields, pageId, variantId }),
          });
        } catch {
        }
      }

      if (pageId != null) {
        try {
          // Mirror BlockForm's omission rule: when this booking happens on a
          // builder page that isn't part of an A/B test we have no test/variant
          // to attribute to, so omit those keys instead of stuffing 0 — that
          // used to violate the FK and 500 the request silently.
          const trackBody: Record<string, unknown> = {
            sessionId: sessionId ?? `anon-${Date.now()}`,
            eventType: "conversion",
            conversionType: "chilipiper_booking",
          };
          if (testId != null) trackBody.testId = testId;
          if (variantId != null) trackBody.variantId = variantId;
          // Page attribution on the event row itself (lp_events.page_id) —
          // booking analytics reads the lead, but funnel/event queries
          // shouldn't have to session-join to find the page.
          trackBody.pageId = pageId;
          await fetch(`${API_BASE}/lp/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trackBody),
          });
        } catch {
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [url, pageId, testId, variantId, sessionId, origin]);
}

export function ChiliPiperModal({ url, pageId: pageIdProp, testId: testIdProp, variantId: variantIdProp, sessionId: sessionIdProp, onClose }: Props) {
  const ctx = usePageContext();
  const pageId = pageIdProp ?? ctx.pageId;
  const testId = testIdProp ?? ctx.testId;
  const variantId = variantIdProp ?? ctx.variantId;
  const sessionId = sessionIdProp ?? ctx.sessionId;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useChiliPiperBookingTracking({ url, pageId, testId, variantId, sessionId, origin: "cta" });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-white shrink-0">
          <span className="text-sm font-semibold text-gray-700">Schedule a Meeting</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ChiliPiperIframe url={url} onUnavailable={() => {
          // Iframe failed to load (network error, X-Frame-Options/CSP block,
          // ad-blocker, etc.). Fall back to opening the scheduler URL in a
          // new tab so the visitor can still book — the worst case is a
          // blocked popup, which is materially better than silently dropping
          // the handoff.
          safeNavigate(url, "_blank");
          onClose();
        }} />
      </div>
    </div>,
    document.body
  );
}

// Renders the Chili Piper iframe with a load-failure escape hatch. If the
// iframe never fires `load` within `LOAD_TIMEOUT_MS`, OR the browser fires
// `error` (rare; iframe error events are inconsistent across browsers), we
// surface the failure to the parent so it can fall back to opening the
// scheduler URL in a new tab.
const LOAD_TIMEOUT_MS = 8000;

export function ChiliPiperIframe({ url, onUnavailable, className }: { url: string; onUnavailable: () => void; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const failedRef = useRef(false);

  useEffect(() => {
    if (loaded) return;
    const t = window.setTimeout(() => {
      if (loaded || failedRef.current) return;
      failedRef.current = true;
      onUnavailable();
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [loaded, onUnavailable]);

  return (
    <iframe
      src={url}
      className={className ?? "flex-1 w-full border-0"}
      allow="camera; microphone"
      title="Schedule a meeting"
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (failedRef.current) return;
        failedRef.current = true;
        onUnavailable();
      }}
    />
  );
}
