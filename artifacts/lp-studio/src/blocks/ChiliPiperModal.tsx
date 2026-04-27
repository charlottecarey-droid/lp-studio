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
  variantId,
  sessionId,
}: {
  url: string;
  pageId?: number;
  variantId?: number;
  sessionId?: string;
}) {
  const submittedRef = useRef(false);
  useEffect(() => { submittedRef.current = false; }, [url]);

  useEffect(() => {
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
      submittedRef.current = true;

      const lead = extractLeadFromEvent(data);
      const fields: Record<string, string> = {};
      if (lead?.firstName && lead?.lastName) {
        fields["Name"] = `${lead.firstName} ${lead.lastName}`.trim();
      } else if (lead?.firstName) {
        fields["Name"] = lead.firstName;
      }
      if (lead?.email) fields["Email"] = lead.email;
      if (lead?.phone) fields["Phone"] = lead.phone;
      fields["Booking Source"] = "Chili Piper";
      fields["Chili Piper URL"] = url;

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
          await fetch(`${API_BASE}/lp/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sessionId ?? `anon-${Date.now()}`,
              testId: 0,
              variantId: variantId ?? 0,
              eventType: "conversion",
              conversionType: "chilipiper_booking",
            }),
          });
        } catch {
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [url, pageId, variantId, sessionId]);
}

export function ChiliPiperModal({ url, pageId: pageIdProp, variantId: variantIdProp, sessionId: sessionIdProp, onClose }: Props) {
  const ctx = usePageContext();
  const pageId = pageIdProp ?? ctx.pageId;
  const variantId = variantIdProp ?? ctx.variantId;
  const sessionId = sessionIdProp ?? ctx.sessionId;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useChiliPiperBookingTracking({ url, pageId, variantId, sessionId });

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
