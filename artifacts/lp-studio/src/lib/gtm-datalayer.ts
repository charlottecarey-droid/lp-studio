// Helpers for pushing landing-page events into the GTM `dataLayer`.
//
// GTM (Google Tag Manager) is loaded by the host site (`lp.meetdandy.com`)
// and exposes a global `window.dataLayer` array. Tags configured in the GTM
// container key off `event` strings pushed onto this array. Marketing needs
// every successful Marketo form submission to push a documented event so
// downstream ads-conversion and analytics tags can fire.
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

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
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
  const dl = window.dataLayer;
  if (!dl || typeof dl.push !== "function") {
    // eslint-disable-next-line no-console
    console.warn("[lp-studio] dataLayer push skipped: window.dataLayer not present (GTM not loaded?)");
    return;
  }
  hasPushed = true;
  try {
    const payload = {
      formName: merged.formName,
      event: merged.event,
    };
    dl.push(payload);
    // eslint-disable-next-line no-console
    console.log("[lp-studio] dataLayer push fired:", payload);
  } catch {
    // dataLayer.push is just an Array.push under the hood, but if a GTM
    // proxy has overridden it and throws, drop the dedupe sentinel so a
    // future submit can retry. The submit UX itself must never break on
    // analytics failures.
    hasPushed = false;
  }
}

/**
 * Test-only: clear the in-page dedupe sentinel so a Playwright spec can
 * exercise the "second submit must NOT push" guard and then reset between
 * cases. Not exported from any public surface — tests import it directly.
 */
export function __resetMarketoDataLayerDedupeForTests(): void {
  hasPushed = false;
}
