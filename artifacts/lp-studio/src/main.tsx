import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

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

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error(
    'Failed to find the root element with id "root". Ensure index.html contains <div id="root"></div>.',
  );
}

createRoot(rootElement).render(
  <Sentry.ErrorBoundary
    fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center bg-background">
        <p className="text-base font-medium">Something went wrong.</p>
        <p className="text-sm text-muted-foreground">
          The error has been reported. Please refresh the page to try again.
        </p>
      </div>
    }
  >
    <App />
  </Sentry.ErrorBoundary>,
);
