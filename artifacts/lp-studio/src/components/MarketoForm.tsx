import { useEffect, useRef, useState } from "react";
import { MunchkinLoader } from "./MunchkinLoader";
import { pushMarketoSubmissionToDataLayer } from "@/lib/gtm-datalayer";
// Scoped overlay that beats Marketo's CDN-injected stylesheet via
// [data-lp-marketo-form] specificity + targeted !important. Imported
// from the component (not a global stylesheet) so it only ships when
// MarketoForm is actually rendered.
import "./marketo-form.css";

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
  submit: () => void;
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
  /**
   * "Ghost form" mode: as soon as the Marketo form has loaded and `vals` has
   * been seeded with `prefill`, programmatically fire `form.submit()` so the
   * submission lands in Marketo without the visitor ever seeing the embed.
   * Caller is responsible for hiding the rendered container (e.g. wrapping
   * in `display:none`) and for guaranteeing the same `prefill` object is
   * only set once per intent — re-renders re-mount this component and
   * would otherwise double-submit.
   */
  submitOnReady?: boolean;
  /**
   * Fires when the Marketo loader script (or `loadForm`) fails. Lets callers
   * surface a "ghost submit failed" state in their own UI without having to
   * scrape the internal error message.
   */
  onLoadError?: (message: string) => void;
  /**
   * Telemetry hook for the `submitOnReady` ("ghost submit") path. Fires
   * exactly once per accepted submit attempt — i.e. right before the
   * deferred `form.submit()` is invoked, AFTER the one-shot
   * `submittedKeysRef` guard has accepted this (config + payload). Lets
   * callers POST a `ghost_submit_attempted` telemetry event so we can
   * compare attempts to actual Marketo deliveries and alert on regressions.
   */
  onGhostSubmitAttempted?: () => void;
  className?: string;
  /**
   * When true, emit the `data-lp-marketo-form` attribute on the wrapper so
   * the scoped overrides in `marketo-form.css` apply (single-column rows,
   * brand-token theming, brand submit button, native-style errors).
   *
   * Off by default so that non-modal MarketoForm renders (e.g. an inline
   * FormBlock embed on a published page) keep Marketo's own visual treatment
   * and we don't accidentally restyle every Marketo form a tenant ships.
   * EmailCaptureModal opts in because the popup needs to match the rest of
   * the modal's brand-aligned chrome.
   */
  scopedStyles?: boolean;
}

const SCRIPT_ID = "marketo-forms2-script";
const scriptLoadPromises = new Map<string, Promise<void>>();

// Module-level "already auto-submitted" set keyed by baseUrl|munchkinId|
// formId|payload. Hoisted out of the component (it used to live in a
// useRef and was therefore instance-scoped) so that a parent unmount/
// remount of the same hidden ghost form during its submit window cannot
// fire a second submit. Required to keep the ghost-submit guarantee
// invariant under React auto-batching edge cases and future host
// refactors that might change the parent JSX structure.
const ghostSubmittedKeys = new Set<string>();

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
  submitOnReady,
  onLoadError,
  onGhostSubmitAttempted,
  className,
  scopedStyles,
}: MarketoFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!baseUrl || !munchkinId || !formId) {
      const msg = "Marketo form is not configured.";
      setError(msg);
      setLoading(false);
      onLoadError?.(msg);
      return;
    }
    setError(null);
    setLoading(true);

    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    // Reset container — Marketo replaces the inner <form>, but we re-mount on prop changes.
    container.innerHTML = `<form id="mktoForm_${formId}"></form>`;

    // Bounded watchdog: Marketo's Forms2 `loadForm` doesn't return a
    // Promise, and when it fails internally (form unapproved, wrong
    // formId, domain whitelist mismatch) it logs "Error loading form"
    // and never invokes our success callback. Without this guard the
    // component would spin on "Loading form…" indefinitely. After the
    // timeout we surface a real error so the visitor sees something
    // actionable and so `onLoadError` telemetry fires.
    const LOAD_TIMEOUT_MS = 10_000;
    let resolved = false;
    const watchdog = window.setTimeout(() => {
      if (cancelled || resolved) return;
      const msg = "Could not load the Marketo form. Please try again later.";
      setError(msg);
      setLoading(false);
      onLoadError?.(msg);
    }, LOAD_TIMEOUT_MS);

    // If the Marketo loader is already on the page (preloaded by the host,
    // or stubbed by a test) skip the network fetch. Otherwise pull it in.
    const ready = window.MktoForms2 ? Promise.resolve() : loadMarketoScript(baseUrl);
    ready
      .then(() => {
        if (cancelled || !window.MktoForms2) return;
        window.MktoForms2.loadForm(baseUrl, munchkinId, formId, (form) => {
          if (cancelled) return;
          resolved = true;
          window.clearTimeout(watchdog);
          setLoading(false);
          if (prefill && Object.keys(prefill).length > 0) {
            try {
              form.vals(prefill);
            } catch {
              // ignore
            }
          }
          if (submitOnReady) {
            // CRITICAL: register a guaranteed "cancel default redirect"
            // handler BEFORE we queue form.submit(), and BEFORE the
            // caller-provided onSuccess registration below. Marketo
            // Forms2's default behaviour after a successful POST is to
            // navigate the page to the form's configured Thank You /
            // follow-up URL — for an approved form with no explicit
            // follow-up URL this collapses to a full-page reload, which
            // wipes out the Chili Piper handoff (the visitor watches the
            // page refresh and the scheduler iframe never appears).
            //
            // Marketo cancels the redirect if ANY registered onSuccess
            // returns false. Registering this no-op guard first means the
            // cancel happens regardless of what BlockForm's resolver
            // callback returns, and regardless of the order Marketo
            // invokes the handlers in.
            try {
              form.onSuccess(() => false);
            } catch {
              // ignore
            }
          }
          if (submitOnReady) {
            // Build a stable key from the form coordinates AND the prefill
            // payload, then short-circuit if we have already fired for it.
            // Without this guard, an unmount/remount of the host (e.g.
            // BlockForm switching to its `submitted` success branch with
            // the same ghostSubmitVals in state) would auto-submit a
            // second time.
            const key = `${baseUrl}|${munchkinId}|${formId}|${JSON.stringify(prefill ?? {})}`;
            if (!ghostSubmittedKeys.has(key)) {
              ghostSubmittedKeys.add(key);
              // Telemetry: report the *attempt* before we defer to the
              // microtask. Reporting here (rather than inside the
              // setTimeout) ensures the event is emitted exactly once per
              // accepted (config, payload) pair regardless of whether the
              // deferred submit() throws synchronously.
              try {
                onGhostSubmitAttempted?.();
              } catch {
                // ignore — telemetry must never break the submit path.
              }
              // Fire the hidden submit on the next tick so Marketo's own
              // internal post-load wiring (validators, hidden field
              // population, Munchkin association) has finished. Without
              // the microtask gap, a too-early submit() can race the form
              // setup and silently no-op.
              try {
                setTimeout(() => {
                  try {
                    form.submit();
                  } catch {
                    // ignore — visible UX has already moved on, the
                    // server-side Marketo REST sync is the canonical record.
                  }
                }, 0);
              } catch {
                // ignore
              }
            }
          }
          // Register the GTM `Marketo Form Submission` dataLayer push for
          // visible Marketo embeds. We deliberately skip the `submitOnReady`
          // ("ghost submit") path: there the visitor is interacting with
          // a native lp-studio form and the Marketo POST is a
          // fire-and-forget mirror — it's not a "Marketo form submission"
          // from the visitor's perspective and marketing keys their tag
          // off the visible embed only. Registered as a dedicated
          // handler (independent of the caller-provided onSuccess /
          // followUpUrl) so the push lands even when neither is wired.
          // The helper pushes a hardcoded `formName: "Demo Form"` payload
          // (marketing's GTM tag keys off that exact string) and dedupes
          // once per page load so remounts can't double-fire.
          if (!submitOnReady) {
            form.onSuccess(() => {
              try {
                pushMarketoSubmissionToDataLayer();
              } catch {
                // Analytics must never break the submit path.
              }
              // Returning true leaves Marketo's redirect decision to the
              // other handlers below (or its default if none) — Marketo
              // honours the redirect only if every handler returns truthy.
              return true;
            });
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
        resolved = true;
        window.clearTimeout(watchdog);
        const msg = "Could not load the Marketo form. Please try again later.";
        setError(msg);
        setLoading(false);
        onLoadError?.(msg);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
    };
    // Stringify prefill so re-mount happens when values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, munchkinId, formId, JSON.stringify(prefill ?? {}), followUpUrl, submitOnReady]);

  return (
    <div className={className} data-lp-marketo-form={scopedStyles ? "" : undefined}>
      {/* Initialise Munchkin alongside the form so the Forms2 submit
          carries the visitor's _mkto_trk cookie. Idempotent — multiple
          MarketoForm instances on the same page only init once. */}
      {munchkinId ? <MunchkinLoader munchkinId={munchkinId} /> : null}
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
