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
