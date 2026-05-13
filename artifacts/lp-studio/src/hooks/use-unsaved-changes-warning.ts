import { useEffect, useRef } from "react";

const SENTINEL_KEY = "__lpUnsavedSentinel" as const;

interface SentinelState {
  [SENTINEL_KEY]?: boolean;
}

/**
 * Warn the user before they navigate away from the page with unsaved changes.
 *
 * Covers three exit paths:
 *   1. Closing the tab / hard reload / external navigation — handled by the
 *      browser's native `beforeunload` confirmation prompt.
 *   2. In-app navigation via wouter (`<Link>`, `setLocation`, etc.), which
 *      ultimately calls `history.pushState` / `history.replaceState`. We patch
 *      those while dirty and `confirm()` before letting them through.
 *   3. Browser back/forward (popstate) — handled with a sentinel history entry
 *      pushed on mount. Because the sentinel duplicates the current URL, a
 *      back press fires popstate without actually leaving the route, giving us
 *      a chance to confirm and then continue (or stay).
 *
 * Does nothing while `isDirty` is false, so clean pages navigate freely.
 */
export function useUnsavedChangesWarning(isDirty: boolean, message = "You have unsaved changes that will be lost. Leave anyway?") {
  const messageRef = useRef(message);
  messageRef.current = message;

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    const origPush = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);

    function sameLocation(url: string | URL | null | undefined): boolean {
      if (url == null) return true;
      try {
        const next = new URL(String(url), window.location.href);
        return (
          next.pathname === window.location.pathname &&
          next.search === window.location.search &&
          next.hash === window.location.hash
        );
      } catch {
        return false;
      }
    }

    function isAtSentinel(): boolean {
      const state = window.history.state as SentinelState | null;
      return !!(state && state[SENTINEL_KEY]);
    }

    // Patch pushState/replaceState so wouter (and anything else using the
    // History API) routes through our confirmation. When the user confirms a
    // navigation while sitting on the sentinel entry, we *replace* the
    // sentinel with the target URL rather than pushing on top of it — that
    // keeps the sentinel from lingering in the history stack and showing up
    // again when the user later presses Back from the new page.
    window.history.pushState = function (state, title, url) {
      if (sameLocation(url)) {
        return origPush(state, title, url as string);
      }
      if (!window.confirm(messageRef.current)) return;
      if (isAtSentinel()) {
        return origReplace(state, title, url as string);
      }
      return origPush(state, title, url as string);
    };
    window.history.replaceState = function (state, title, url) {
      // Same-URL replaceState is used by libraries for housekeeping (scroll
      // restoration, etc.) — let those through without prompting.
      if (sameLocation(url)) {
        return origReplace(state, title, url as string);
      }
      if (!window.confirm(messageRef.current)) return;
      return origReplace(state, title, url as string);
    };

    // Push a sentinel duplicate of the current URL so a browser Back press
    // lands on a same-URL entry and triggers popstate without actually
    // leaving the editor. Wouter's route-matching keys off the URL, so the
    // route stays mounted and we can prompt synchronously.
    origPush({ [SENTINEL_KEY]: true } satisfies SentinelState, "", window.location.href);

    let teardown: (() => void) | null = null;
    let suppressPopstate = false;

    const onPopState = () => {
      if (suppressPopstate) {
        suppressPopstate = false;
        return;
      }
      if (window.confirm(messageRef.current)) {
        // The sentinel has already been popped (we're now at the original
        // builder entry). Tear down our guards and step back once more so
        // the user actually lands on the previous page they wanted.
        teardown?.();
        window.history.back();
      } else {
        // Re-push the sentinel so the next Back press is trapped again. The
        // resulting (synthetic) popstate from this push doesn't fire because
        // pushState doesn't dispatch popstate — but be defensive anyway.
        suppressPopstate = true;
        origPush({ [SENTINEL_KEY]: true } satisfies SentinelState, "", window.location.href);
        // pushState doesn't trigger popstate, so reset the guard immediately.
        suppressPopstate = false;
      }
    };
    window.addEventListener("popstate", onPopState);

    teardown = () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };

    return () => {
      teardown?.();
      teardown = null;
      // If the sentinel is still on top of the stack (the common case — the
      // user saved without ever pressing Back), pop it so the history doesn't
      // end up with a stray duplicate URL.
      if (isAtSentinel()) {
        window.history.back();
      }
    };
  }, [isDirty]);
}
