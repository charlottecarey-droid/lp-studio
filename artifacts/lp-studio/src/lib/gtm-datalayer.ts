// Helpers for reporting successful form submissions to marketing analytics.
// Two channels, one call:
//
//   1. GTM `dataLayer` push — GTM (loaded on `lp.meetdandy.com`) exposes a
//      global `window.dataLayer` array; container tags (GA4, ads
//      conversions) key off the pushed `event` string.
//   2. Webflow Optimize `sendEvent` — the Intellimize snippet (loaded via a
//      GTM Custom HTML tag) counts A/B-test conversions ONLY through its own
//      API (`window.wf.sendEvent(apiName)` — the project's "Marketo Form
//      Submission" event is type "custom", apiName "marketoFormSubmission").
//      It never reads dataLayer pushes for conversions — that part was read
//      out of the Optimize snippet config, so it's solid, and it's the whole
//      reason this second channel exists.
//
// WHY conversions broke in May 2026 is NOT settled, despite what the commit
// that added the sendEvent channel (0c1282982) claims. That message blamed
// disabling the hidden Marketo Forms2 ghost-submit
// (GHOST_SUBMIT_ENABLED=false, 2026-05-16) for silently killing Webflow A/B
// tracking. Corrected 2026-08-03: the ghost submit was an ATTEMPTED FIX added
// 2026-05-14 — before the dataLayer push landed on 2026-05-15 — so the two
// adjacent dates were a correlation, not a demonstrated cause. The dataLayer
// push has also fired continuously since then (no lp_forms row sets
// `enabled:false`), which rules out a form-level disable.
//
// Don't rewrite this comment into a tidy causal story without evidence. The
// fix doesn't depend on knowing: both channels fire on every submit, so
// whichever one Optimize actually listens to gets the event.
//
// The default payload is the EXACT one the SMB trios5 page on
// lp.meetdandy.com (global form 6) has fired since this feature shipped:
//   { event: "Marketo Form Submission", formName: "Demo Form" }
// Every form across every tenant gets this push by default. A form can
// override the payload (or disable the push entirely) by setting
// `gtm_data_layer_config` on the lp_forms row; the public form fetch
// surfaces that config to BlockForm / MarketoForm.
//
// Two invariants this module owns:
//   1. The push only ever fires when `window.dataLayer` exists (don't crash
//      preview / SSR / test environments that haven't loaded GTM).
//   2. The event only fires once per page load. The dedupe sentinel is
//      module-level (not a `useRef`) so a parent React unmount/remount
//      during the success window cannot double-push — mirrors the
//      `ghostSubmittedKeys` pattern in `MarketoForm.tsx`. A full page
//      reload resets the module and thus the guard, which matches GTM's
//      treatment of a reload as a new session.

// Webflow Optimize (the rebranded Intellimize snippet, loaded on
// lp.meetdandy.com via a GTM Custom HTML tag).
//
// It does NOT expose the same API on both globals, which cost us a day.
// Reading the live snippet, the bootstrap creates:
//     window.intellimize = { ready, push }
//     window.wf          = { ready }
// and only later, in ExternalApi.initialize(), installs the real methods:
//     i.sendEvent = c;  if (s !== undefined) s.sendEvent = c;
// — i.e. `window.intellimize` is the PRIMARY namespace and `window.wf` is an
// optional mirror. The snippet even logs "window.wf is undefined: Can only
// initialize External API on the window.intellimize namespace".
//
// So `window.wf` exists almost immediately as a stub carrying only `ready`.
// Resolving the API as `window.wf ?? window.intellimize` bound to that stub,
// found no sendEvent, and gave up — while the real, callable API sat on
// window.intellimize the whole time. Resolve by CAPABILITY, never by name.
interface WebflowOptimizeApi {
  sendEvent?: (apiName: string) => void;
  /** Bootstrap queue: runs the callback once the External API is initialised. */
  ready?: (cb: () => void) => void;
}

/** The first global carrying a callable `sendEvent`, or null if none has
 *  initialised yet. Order is irrelevant — capability is the test. */
function resolveOptimizeApi(): WebflowOptimizeApi | null {
  for (const candidate of [window.intellimize, window.wf]) {
    if (candidate && typeof candidate.sendEvent === "function") return candidate;
  }
  return null;
}

/** A bootstrap stub we can defer through when the API isn't ready yet. */
function resolveOptimizeQueue(): WebflowOptimizeApi | null {
  for (const candidate of [window.intellimize, window.wf]) {
    if (candidate && typeof candidate.ready === "function") return candidate;
  }
  return null;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    wf?: WebflowOptimizeApi;
    intellimize?: WebflowOptimizeApi;
  }
}

/**
 * Per-form override surfaced from `lp_forms.gtm_data_layer_config`.
 * Every field is optional so a partial override falls through to the
 * built-in defaults below; an explicit `enabled: false` disables the
 * push entirely for that form.
 */
export interface GtmDataLayerConfig {
  enabled?: boolean;
  event?: string;
  formName?: string;
}

/**
 * The EXACT hardcoded payload the SMB trios5 page on lp.meetdandy.com
 * (global form 6) has been firing since this feature launched. Used as
 * the default for every form across every tenant when no per-form
 * override is set, so existing behavior is preserved out of the box.
 */
export const DEFAULT_GTM_DATALAYER_CONFIG: Required<GtmDataLayerConfig> = {
  enabled: true,
  event: "Marketo Form Submission",
  formName: "Demo Form",
};

let hasPushed = false;

/**
 * Webflow Optimize "custom event" apiNames are the auto-generated camelCase
 * of the event's display name ("Marketo Form Submission" →
 * "marketoFormSubmission"). Deriving it from the configured event name keeps
 * per-form event-name overrides working for both channels without a second
 * config field.
 */
export function toWebflowApiName(eventName: string): string {
  const words = eventName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

/**
 * Push the configured GTM dataLayer event. Idempotent within a page
 * load — subsequent calls are no-ops.
 *
 * Pass the form's `gtmDataLayerConfig` (from the public form fetch).
 * When omitted, or any field is missing, the SMB trios5 / form 6
 * defaults (event "Marketo Form Submission", formName "Demo Form")
 * fill the gap.
 *
 * Call this from a Marketo `form.onSuccess` handler — never from a
 * button click handler — so that Marketo's own validation has accepted
 * the submission and we don't emit phantom GTM events for failed
 * submits.
 */
export function pushMarketoSubmissionToDataLayer(config?: GtmDataLayerConfig | null): void {
  if (typeof window === "undefined") return;

  const merged: Required<GtmDataLayerConfig> = {
    enabled: config?.enabled ?? DEFAULT_GTM_DATALAYER_CONFIG.enabled,
    event: config?.event?.trim() || DEFAULT_GTM_DATALAYER_CONFIG.event,
    formName: config?.formName?.trim() || DEFAULT_GTM_DATALAYER_CONFIG.formName,
  };

  if (!merged.enabled) {
    // eslint-disable-next-line no-console
    console.log("[lp-studio] dataLayer push skipped (disabled for this form)");
    return;
  }

  if (hasPushed) {
    // eslint-disable-next-line no-console
    console.log("[lp-studio] dataLayer push skipped (already fired this page load)");
    return;
  }

  // Whether at least one channel accepted the event. Only then does the
  // dedupe sentinel latch — if both channels are unavailable (GTM not loaded
  // yet), a later submit on the same page load can still deliver.
  let delivered = false;

  // Channel 1 — GTM dataLayer. Fans out to the GA4 / ads-conversion tags
  // configured in the container (GTM custom-event trigger "Marketo Form
  // Submission").
  const dl = window.dataLayer;
  if (!dl || typeof dl.push !== "function") {
    // eslint-disable-next-line no-console
    console.warn("[lp-studio] dataLayer push skipped: window.dataLayer not present (GTM not loaded?)");
  } else {
    try {
      const payload = {
        formName: merged.formName,
        event: merged.event,
      };
      dl.push(payload);
      delivered = true;
      // eslint-disable-next-line no-console
      console.log("[lp-studio] dataLayer push fired:", payload);
    } catch {
      // dataLayer.push is just an Array.push under the hood, but if a GTM
      // proxy has overridden it and throws, don't latch the sentinel so a
      // future submit can retry. The submit UX itself must never break on
      // analytics failures.
    }
  }

  // Channel 2 — Webflow Optimize (Intellimize). Its conversion events are
  // "custom" API events fired via `wf.sendEvent(apiName)`; it does NOT
  // consume GTM dataLayer pushes, and its built-in Marketo Forms2 hook only
  // sees real MktoForms2 submits. Calling the API directly is the channel
  // Webflow actually counts. (On WHY conversions broke in May 2026, see the
  // file header — that causation is unconfirmed, not the tidy story an earlier
  // version of this comment told.)
  //
  // NOTE for debugging: sendEvent doesn't report back. An apiName that doesn't
  // exist in the Optimize project is accepted silently, so the "fired" log
  // below means "we called the API", NOT "Webflow recorded a conversion".
  // Confirm the name exists in the snippet config before trusting it:
  //   curl --compressed -s https://cdn.intellimize.co/snippet/117656075.js \
  //     | grep -o 'marketoFormSubmission'
  const apiName = toWebflowApiName(merged.event);
  const wfApi = resolveOptimizeApi();
  if (wfApi) {
    try {
      wfApi.sendEvent!(apiName);
      delivered = true;
      // eslint-disable-next-line no-console
      console.log("[lp-studio] Webflow Optimize sendEvent fired:", apiName);
    } catch {
      // Same contract as above: analytics failures never break the submit.
    }
  } else {
    // The API isn't initialised yet. Don't drop the conversion — the snippet's
    // own bootstrap queue exists for exactly this, and a submit that lands
    // before Optimize finishes booting is otherwise lost for good.
    const queue = resolveOptimizeQueue();
    if (queue) {
      try {
        queue.ready!(() => {
          const late = resolveOptimizeApi();
          if (!late) return;
          try {
            late.sendEvent!(apiName);
            // eslint-disable-next-line no-console
            console.log("[lp-studio] Webflow Optimize sendEvent fired (deferred via ready):", apiName);
          } catch { /* never break the page from a queued callback */ }
        });
        delivered = true;
        // eslint-disable-next-line no-console
        console.log("[lp-studio] Webflow Optimize sendEvent queued until ready:", apiName);
      } catch { /* fall through to the log below */ }
    } else {
      // Genuinely absent: the snippet never loaded on this page.
      // eslint-disable-next-line no-console
      console.log(
        "[lp-studio] Webflow Optimize sendEvent skipped: no intellimize/wf API on this page",
      );
    }
  }

  hasPushed = delivered;
}

/**
 * Test-only: clear the in-page dedupe sentinel so a Playwright spec can
 * exercise the "second submit must NOT push" guard and then reset between
 * cases. Not exported from any public surface — tests import it directly.
 */
export function __resetMarketoDataLayerDedupeForTests(): void {
  hasPushed = false;
}
