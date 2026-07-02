import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Probes the integration Postgres once and stamps process.env.DB_AVAILABLE
    // ("1"/"0") for the workers; DB-hitting suites gate on it via
    // src/test-utils/dbAvailable.ts (describe.skipIf) instead of dying with
    // ECONNREFUSED when no local Postgres is running.
    globalSetup: ["src/test-utils/dbGlobalSetup.ts"],
  },
});
