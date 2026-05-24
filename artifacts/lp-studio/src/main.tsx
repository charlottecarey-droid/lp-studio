import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";
import { installCsrfFetchInterceptor, ensureCsrfToken } from "./lib/api-fetch";

// Install the CSRF fetch interceptor before any React code runs so every
// state-changing /api/* request automatically carries the X-CSRF-Token
// header. ensureCsrfToken() warms the cache so the first POST doesn't pay
// the round-trip cost of fetching a token.
installCsrfFetchInterceptor();
void ensureCsrfToken();

// Per-tenant favicon: LP Studio (cream + indigo "LP" mark) is the default,
// served statically from index.html. On Dandy-branded hosts we swap to the
// existing Dandy "d" favicon so the browser tab still reads as Dandy for
// dental-customer-facing surfaces (meetdandy.com, partners.meetdandy.com,
// inside.dandy.com, etc.). Production hosts only — replit.dev/.app and
// localhost always show the LP mark for development.
(function applyTenantFavicon() {
  if (typeof window === "undefined") return;
  const h = window.location.hostname.toLowerCase();
  const isDandyHost = h.endsWith("meetdandy.com") || h.endsWith(".dandy.com") || h === "dandy.com";
  if (!isDandyHost) return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = "/favicon.svg";
})();

const sentryDsn = import.meta.env.VITE_SENTRY_DSN_FRONTEND as string | undefined;
// Third-party script origins/hosts whose errors we deliberately drop from
// Sentry. These libraries throw inside their own internals (network blips,
// extension interference, race conditions in their async loaders) and the
// browser surfaces them as uncaught exceptions on OUR page, which then
// trip the root ErrorBoundary and show visitors the
// "Something went wrong, please refresh" fallback even though our app is
// fine. Filtering at the Sentry layer also stops these errors from
// drowning out real bugs in the issue tracker.
const THIRD_PARTY_SCRIPT_HOSTS = [
  "marketo.com",
  "mktoresp.com",
  "munchkin.marketo",
  "chilipiper.com",
  "googletagmanager.com",
  "google-analytics.com",
  "googleadservices.com",
  "doubleclick.net",
  "hsforms.com",
  "hubspot.com",
  "reb2b.com",
  "getrb2b.com",
  "sentry.io",
];

function isThirdPartyScriptError(event: Sentry.ErrorEvent): boolean {
  const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
  // Only filter when the error originated EXCLUSIVELY in third-party
  // frames. If any of our own frames are in the stack, keep the event —
  // it means our code called into the third party and we want to know.
  if (frames.length === 0) return false;
  const hasOurFrame = frames.some((f) => {
    const file = f.filename ?? "";
    return file.includes("/assets/") || file.includes(window.location.host);
  });
  if (hasOurFrame) return false;
  return frames.some((f) => {
    const file = f.filename ?? "";
    return THIRD_PARTY_SCRIPT_HOSTS.some((host) => file.includes(host));
  });
}

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Drop common noise from browser extensions and cross-origin scripts
    // we don't control. These never indicate a real bug in our app but
    // pollute the issue tracker and (more importantly) used to bubble
    // up to the root ErrorBoundary, blanking the visitor's page.
    ignoreErrors: [
      // Script error from a cross-origin file we can't introspect — almost
      // always a browser extension or a third-party tag.
      "Script error.",
      // Safari's "this page is taking too long" idle error.
      "Non-Error promise rejection captured",
      // Common extension noise.
      /extension:\/\//i,
      /chrome-extension:\/\//i,
      /moz-extension:\/\//i,
      // ResizeObserver loop warnings are harmless and very chatty.
      /ResizeObserver loop/i,
      // AbortError from our own 10 s fetch timeout — expected, not a bug.
      "AbortError",
      // Marketo/Munchkin internal noise we can't fix from our side.
      /MktoForms2/i,
      // Third-party tag (loaded via GTM / Marketo / Facebook in-app
      // browser) probes `window.webkit.messageHandlers` without a guard.
      // We also install a defensive stub in `index.html` so the probe
      // succeeds silently — this entry is belt-and-braces for any tag
      // injected BEFORE our stub runs (e.g. very old cached pages).
      /window\.webkit\.messageHandlers/i,
    ],
    denyUrls: [
      /\/\/.*\.marketo\.com\//,
      /\/\/.*\.mktoresp\.com\//,
      /\/\/.*munchkin\./,
      /\/\/.*chilipiper\.com\//,
      /\/\/.*googletagmanager\.com\//,
      /\/\/.*google-analytics\.com\//,
      /\/\/.*doubleclick\.net\//,
      /\/\/.*hsforms\.com\//,
      /\/\/.*hubspot\.com\//,
      /\/\/.*reb2b\.com\//,
      /\/\/.*getrb2b\.com\//,
      /extensions?\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
    ],
    beforeSend(event) {
      // Defense-in-depth: strip user PII even though we set sendDefaultPii=false.
      if (event.user) {
        const { id, tenantId } = event.user as { id?: unknown; tenantId?: unknown };
        event.user = {
          ...(id !== undefined ? { id: String(id) } : {}),
          ...(tenantId !== undefined ? { tenantId: String(tenantId) } : {}),
        };
      }
      // Stack-based filter for third-party errors that slipped past
      // denyUrls/ignoreErrors (e.g. the error message itself looks like
      // ours but every stack frame is from a vendor script).
      if (isThirdPartyScriptError(event)) return null;
      return event;
    },
  });
}

// Auto-recover from stale chunk filenames after a deploy. When a user keeps a
// tab open across deploys, their cached `index.html` references hashed chunk
// URLs (e.g. `/assets/Foo-abc123.js`) that no longer exist on the server.
// `lazy(() => import(...))` then throws a TypeError / "Failed to fetch dynamically
// imported module". We catch that case once per session and force-reload so the
// tab gets the fresh entrypoint instead of staying stuck on a white screen.
function isChunkLoadError(reason: unknown): boolean {
  const msg =
    reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : typeof reason === "string"
        ? reason
        : "";
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}
function tryReloadOnce() {
  try {
    const key = "lp-studio-chunk-reload";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // sessionStorage blocked — still attempt the reload, just without the guard.
  }
  window.location.reload();
}
window.addEventListener("error", (e) => {
  if (isChunkLoadError(e.error ?? e.message)) tryReloadOnce();
});
window.addEventListener("unhandledrejection", (e) => {
  if (isChunkLoadError(e.reason)) tryReloadOnce();
});

// Sentry's ErrorBoundary catches errors thrown by React.lazy() before our
// global `error` / `unhandledrejection` listeners ever see them, so when a
// stale tab loads a hashed chunk that no longer exists post-deploy, the user
// gets stuck on the Sentry fallback screen until they manually refresh.
// This fallback component checks the caught error and triggers the same
// one-shot reload we use elsewhere.
function RootErrorFallback({ error }: { error: unknown }) {
  if (isChunkLoadError(error)) {
    tryReloadOnce();
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Loading latest version…</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center bg-background">
      <p className="text-base font-medium">Something went wrong.</p>
      <p className="text-sm text-muted-foreground">
        The error has been reported. Please refresh the page to try again.
      </p>
    </div>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error(
    'Failed to find the root element with id "root". Ensure index.html contains <div id="root"></div>.',
  );
}

createRoot(rootElement).render(
  <Sentry.ErrorBoundary fallback={({ error }) => <RootErrorFallback error={error} />}>
    <App />
  </Sentry.ErrorBoundary>,
);

// Reveal the document after React has rendered. The inline script in
// index.html hides <html> on non-marketing hosts to prevent a flash of
// the prerendered marketing homepage while the SaaS bundle replaces
// #root. Once React has mounted (and either kept the marketing content
// or replaced it with the SaaS shell), it's safe to reveal again.
requestAnimationFrame(() => {
  if (document.documentElement.style.visibility === "hidden") {
    document.documentElement.style.visibility = "";
  }
});
