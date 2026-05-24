import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { sentryVitePlugin } from "@sentry/vite-plugin";

/**
 * Force the SPA shell (index.html) to revalidate on every visit so returning
 * visitors don't render a stale HTML that points to old hashed asset bundles
 * after a deploy. Symptom without this: a white page on first load that "fixes
 * itself" when the user hits refresh — the cached HTML referenced
 * `/assets/index-<oldhash>.js` which 404s after the new build replaces it.
 *
 * Hashed assets under `/assets/*` keep their long-lived immutable cache (Vite
 * default), so this only affects the small HTML shell, not bundle re-downloads.
 */
function noCacheHtmlPlugin(): PluginOption {
  const setHeaders = (url: string | undefined, setHeader: (k: string, v: string) => void) => {
    // Only the HTML shell — never touch /assets/* (hashed, immutable).
    if (!url) return;
    const path = url.split("?")[0];
    if (path.startsWith("/assets/")) return;
    if (/\.[a-z0-9]+$/i.test(path) && !path.endsWith(".html")) return;
    setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    setHeader("Pragma", "no-cache");
    setHeader("Expires", "0");
  };
  return {
    name: "lp-studio:no-cache-html",
    apply: () => true,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        setHeaders(req.url, (k, v) => res.setHeader(k, v));
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        setHeaders(req.url, (k, v) => res.setHeader(k, v));
        next();
      });
    },
  };
}

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    noCacheHtmlPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
    // Upload source maps to Sentry at build time so production stack traces
    // are readable. No-ops (silent: true) when SENTRY_AUTH_TOKEN is missing,
    // so local builds don't fail without Sentry credentials.
    ...(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: process.env.SENTRY_RELEASE },
            sourcemaps: { filesToDeleteAfterUpload: ["**/*.map"] },
            telemetry: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Emit source maps so the Sentry vite plugin can upload them. They are
    // deleted from the final bundle by `filesToDeleteAfterUpload` when the
    // upload runs, so production users never download them.
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-charts": ["recharts"],
          "vendor-motion": ["framer-motion"],
          "vendor-editor": ["@tiptap/core", "@tiptap/react", "@tiptap/starter-kit"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-popover", "@radix-ui/react-select", "@radix-ui/react-tooltip", "@radix-ui/react-tabs"],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/utilities", "@dnd-kit/sortable"],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    // In Replit the proxy is handled by the platform; locally forward /api to the API server
    ...(process.env.REPL_ID ? {} : {
      proxy: {
        "/api": {
          target: `http://localhost:${process.env.API_PORT ?? "3001"}`,
          changeOrigin: true,
        },
      },
    }),
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
