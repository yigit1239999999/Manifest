import { defineConfig, devices } from "@playwright/test";

// Playwright E2E config.
//
// Run locally:  npm run dev   (terminal 1)
//               npm run test:e2e   (terminal 2)
//
// The `webServer` block below auto-starts the app when nothing is already
// listening on `baseURL`. Locally it reuses your running `npm run dev`; in
// CI it boots the production server (`npm run start`, which needs a prior
// `npm run build`). Either way the tests expect a real, migrated database
// (the same one `DATABASE_URL` points at).

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Only the .spec.ts files: e2e/ also holds a vitest file (clinic-name.test.ts),
  // and Playwright's default pattern would load it, import vitest under
  // CommonJS and take the whole suite down before a single test runs.
  testMatch: /.*\.spec\.ts$/,
  // Against `npm run dev` the first hit on a route waits for it to compile,
  // which is far longer than Playwright's defaults allow for.
  timeout: 120_000,
  expect: { timeout: 20_000 },
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
  webServer: {
    command: "npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
