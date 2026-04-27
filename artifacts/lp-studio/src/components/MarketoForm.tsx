import { useEffect, useRef, useState } from "react";

interface MktoFormsGlobal {
  loadForm: (
    baseUrl: string,
    munchkinId: string,
    formId: number,
    callback?: (form: MktoFormInstance) => void,
  ) => void;
  whenReady: (cb: (form: MktoFormInstance) => void) => void;
}
interface MktoFormInstance {
  vals: (values: Record<string, string>) => void;
  getId: () => number;
  onSuccess: (cb: (values: unknown, followUpUrl: string) => boolean) => void;
}

declare global {
  interface Window {
    MktoForms2?: MktoFormsGlobal;
  }
}

export interface MarketoFormProps {
  /** Marketo instance URL, e.g. "//app-XXX.marketo.com" or "https://app-XXX.marketo.com". */
  baseUrl: string;
  /** Munchkin ID, e.g. "123-ABC-456". */
  munchkinId: string;
  /** Numeric form ID. */
  formId: number;
  /** Pre-fill values keyed by Marketo field name (e.g. { Email: "x@y.com" }). */
  prefill?: Record<string, string>;
  /** Optional follow-up URL to redirect to on submit. */
  followUpUrl?: string;
  /**
   * When set, prevents Marketo's default redirect on submit.
   * Receives the submitted field map (Marketo passes us the form's REST values
   * — keys are the Marketo field names, e.g. `Email`, `FirstName`, `Phone`).
   */
  onSuccess?: (vals: Record<string, string>) => void;
  className?: string;
}

const SCRIPT_ID = "marketo-forms2-script";
const scriptLoadPromises = new Map<string, Promise<void>>();

function loadMarketoScript(baseUrl: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MktoForms2) return Promise.resolve();
  const existing = scriptLoadPromises.get(baseUrl);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const existingEl = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingEl) {
      existingEl.addEventListener("load", () => resolve());
      existingEl.addEventListener("error", () => reject(new Error("Failed to load Marketo script")));
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `${baseUrl.replace(/\/$/, "")}/js/forms2/js/forms2.min.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Marketo script"));
    document.head.appendChild(script);
  });
  scriptLoadPromises.set(baseUrl, promise);
  return promise;
}

export function MarketoForm({
  baseUrl,
  munchkinId,
  formId,
  prefill,
  followUpUrl,
  onSuccess,
  className,
}: MarketoFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!baseUrl || !munchkinId || !formId) {
      setError("Marketo form is not configured.");
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);

    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    // Reset container — Marketo replaces the inner <form>, but we re-mount on prop changes.
    container.innerHTML = `<form id="mktoForm_${formId}"></form>`;

    // If the Marketo loader is already on the page (preloaded by the host,
    // or stubbed by a test) skip the network fetch. Otherwise pull it in.
    const ready = window.MktoForms2 ? Promise.resolve() : loadMarketoScript(baseUrl);
    ready
      .then(() => {
        if (cancelled || !window.MktoForms2) return;
        window.MktoForms2.loadForm(baseUrl, munchkinId, formId, (form) => {
          if (cancelled) return;
          setLoading(false);
          if (prefill && Object.keys(prefill).length > 0) {
            try {
              form.vals(prefill);
            } catch {
              // ignore
            }
          }
          if (onSuccess || followUpUrl) {
            form.onSuccess((rawVals, defaultFollowUp) => {
              // Normalise: Marketo always passes a plain object of strings, but
              // type it loosely upstream and coerce here so an unexpected
              // value doesn't crash the handoff.
              const vals: Record<string, string> = {};
              if (rawVals && typeof rawVals === "object") {
                for (const [k, v] of Object.entries(rawVals as Record<string, unknown>)) {
                  if (v == null) continue;
                  vals[k] = typeof v === "string" ? v : String(v);
                }
              }
              // Always invoke the handler first (if provided) so callers can
              // run side effects (lead persistence, analytics, Chili Piper
              // hand-off, etc.) before any navigation. The handler is
              // synchronous wrt Marketo's own follow-up.
              if (onSuccess) {
                onSuccess(vals);
              }
              // After the handler runs, honour an explicit followUpUrl. This
              // preserves the prior non-handoff behaviour where a Marketo form
              // with a configured redirect URL navigates after submit, even
              // when an onSuccess handler is also wired up (e.g. for analytics).
              if (followUpUrl) {
                window.location.href = followUpUrl;
                return false;
              }
              // No explicit follow-up. If onSuccess was wired up at all, it
              // owns the post-submit UX, so cancel Marketo's default redirect.
              if (onSuccess) {
                return false;
              }
              return Boolean(defaultFollowUp);
            });
          }
        });
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load the Marketo form. Please try again later.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Stringify prefill so re-mount happens when values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, munchkinId, formId, JSON.stringify(prefill ?? {}), followUpUrl]);

  return (
    <div className={className}>
      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <>
          {loading && (
            <p className="text-sm text-slate-400 mb-2">Loading form…</p>
          )}
          <div ref={containerRef} />
        </>
      )}
    </div>
  );
}
