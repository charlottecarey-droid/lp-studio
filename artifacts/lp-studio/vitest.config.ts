import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
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
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
