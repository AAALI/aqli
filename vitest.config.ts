import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // The markdown round-trip properties run tens of thousands of cases.
    testTimeout: 120_000,
    include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", ".open-next/**"],
  },
});
