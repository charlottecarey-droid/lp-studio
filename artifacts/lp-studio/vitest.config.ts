import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
  },
  // Tests are plain `.test.ts` files, but some import real `.tsx` components
  // (e.g. SSR render tests). Use the automatic JSX runtime so those components
  // transform without a global `React` in scope.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Pure-logic tests default to `node`; render tests opt into a DOM
    // environment per-file via a `// @vitest-environment jsdom` docblock.
    environment: "node",
  },
});
