import { defineConfig } from "@playwright/test";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function detectChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const out = execSync(`command -v ${name} 2>/dev/null`, { encoding: "utf8" }).trim();
      if (out && existsSync(out)) return out;
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}

const PORT = Number(process.env.E2E_PORT ?? "4318");
const API_PORT = Number(process.env.E2E_API_PORT ?? "4319");
const HOST = "127.0.0.1";
const SYSTEM_CHROMIUM = detectChromium();

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "line" : [["list"]],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    launchOptions: SYSTEM_CHROMIUM ? { executablePath: SYSTEM_CHROMIUM } : {},
  },
  webServer: [
    // ── 1. The Express API server. Required by the tenant-backed leak spec
    //      (no-dandy-leak-tenant.spec.ts) which logs in as a real Royal-style
    //      tenant and exercises /api/block-catalog + /api/lp/pages + /api/lp/brand.
    //      The dev script (`pnpm run dev`) is build-then-start, so allow extra
    //      time. The Vite dev-server proxy below forwards /api/* here.
    {
      command: "pnpm --filter @workspace/api-server run dev",
      url: `http://${HOST}:${API_PORT}/api/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        PORT: String(API_PORT),
        HOST,
        NODE_ENV: "development",
      },
    },
    // ── 2. The Vite dev server hosting the lp-studio app. We deliberately
    //      *unset* REPL_ID so vite.config.ts enables its `/api → API_PORT`
    //      proxy (the proxy block is gated off when REPL_ID is defined, since
    //      Replit's platform proxy handles routing in that environment).
    //      `env -u REPL_ID` removes the variable from the inherited
    //      environment entirely — Playwright's `env` option only adds /
    //      overrides keys, and the cartographer/dev-banner plugins in
    //      vite.config.ts gate on `process.env.REPL_ID !== undefined`,
    //      which would still trip on `REPL_ID=""`.
    {
      command: "env -u REPL_ID pnpm run dev",
      url: `http://${HOST}:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        PORT: String(PORT),
        HOST,
        NODE_ENV: "development",
        API_PORT: String(API_PORT),
      },
    },
  ],
});
