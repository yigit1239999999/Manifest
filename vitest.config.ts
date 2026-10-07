import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // `.claude/worktrees` holds other agents' checkouts, node_modules and all;
    // without this a run here tests their copies too and fails on them.
    exclude: ["**/node_modules/**", ".next", "generated", ".claude/**"],
  },
});
