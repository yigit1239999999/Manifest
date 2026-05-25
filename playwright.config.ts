import { defineConfig, devices } from "@playwright/test";

// Playwright E2E config.
//
// Run locally:  npm run dev   (terminal 1)
//               npm run test:e2e   (terminal 2)
//
// The tests hit a running app; they expect a real database (the same
// one your DATABASE_URL points at). The tests SHARE the dev DB by
// default — use a dedicated test database in CI before turning these
// on for required checks.

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
