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

const sentryDsn = import.meta.env.VITE_SENTRY_DSN_FRONTEND as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // Defense-in-depth: strip user PII even though we set sendDefaultPii=false.
      if (event.user) {
        const { id, tenantId } = event.user as { id?: unknown; tenantId?: unknown };
        event.user = {
          ...(id !== undefined ? { id: String(id) } : {}),
          ...(tenantId !== undefined ? { tenantId: String(tenantId) } : {}),
        };
      }
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
