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
const HOST = "127.0.0.1";
const SYSTEM_CHROMIUM = detectChromium();

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "line" : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    launchOptions: SYSTEM_CHROMIUM ? { executablePath: SYSTEM_CHROMIUM } : {},
  },
  webServer: {
    command: "pnpm run dev",
    url: `http://${HOST}:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT: String(PORT),
      HOST,
      // Vite dev server picks up these. The /preview/template/* route bypasses
      // auth entirely and does not call /api, so no API server is required.
      NODE_ENV: "development",
    },
  },
});
