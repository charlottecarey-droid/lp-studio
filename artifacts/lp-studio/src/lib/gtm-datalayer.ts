// Helpers for pushing landing-page events into the GTM `dataLayer`.
//
// GTM (Google Tag Manager) is loaded by the host site (`lp.meetdandy.com`)
// and exposes a global `window.dataLayer` array. Tags configured in the GTM
// container key off `event` strings pushed onto this array. Marketing needs
// every successful Marketo form submission to push the documented
// `Marketo Form Submission` event so downstream ads-conversion and analytics
// tags can fire.
//
// Two invariants this module owns:
//   1. The push only ever fires when `window.dataLayer` exists (don't crash
//      preview / SSR / test environments that haven't loaded GTM).
//   2. A given `formName` only fires once per page load. The dedupe set is
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

const pushedFormNames = new Set<string>();

/**
 * Push a `Marketo Form Submission` event onto `window.dataLayer` for the
 * given form name. Idempotent within a page load: subsequent calls with
 * the same `formName` are no-ops.
 *
 * Call this from a Marketo `form.onSuccess` handler — never from a button
 * click handler — so that Marketo's own validation has accepted the
 * submission and we don't emit phantom GTM events for failed submits.
 */
export function pushMarketoSubmissionToDataLayer(formName: string): void {
  if (typeof window === "undefined") return;
  if (!formName) return;
  if (pushedFormNames.has(formName)) return;
  const dl = window.dataLayer;
  if (!dl || typeof dl.push !== "function") return;
  pushedFormNames.add(formName);
  try {
    dl.push({
      formName,
      event: "Marketo Form Submission",
    });
  } catch {
    // dataLayer.push is just an Array.push under the hood, but if a GTM
    // proxy has overridden it and throws, drop the dedupe entry so a
    // future submit can retry. The submit UX itself must never break on
    // analytics failures.
    pushedFormNames.delete(formName);
  }
}

/**
 * Test-only: clear the in-page dedupe set so a Playwright spec can exercise
 * the "second submit must NOT push" guard and then reset between cases.
 * Not exported from any public surface — tests import it directly.
 */
export function __resetMarketoDataLayerDedupeForTests(): void {
  pushedFormNames.clear();
}
