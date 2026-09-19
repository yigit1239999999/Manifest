import { test, expect, type Page } from "@playwright/test";

// Page-load performance budget.
//
// Every key screen must render within PERF_BUDGET_MS (default 6000 ms, the
// product's hard ceiling) measured from navigation start to the `load`
// event, on a cold client against the production build CI boots. Runs with
// the rest of the E2E suite on every push and on every PR into main, so a
// regression fails the build before it ships.
//
// Tighten the budget by setting PERF_BUDGET_MS in the workflow env.

const BUDGET_MS = Number(process.env.PERF_BUDGET_MS ?? 6000);

const ROUTES = [
  "/",
  "/clients",
  "/clients/new",
  "/pets",
  "/pets/new",
  "/visits",
  "/appointments",
  "/prescriptions",
  "/reminders",
  "/invoices",
  "/settings",
];

async function signUp(page: Page) {
  const stamp = Date.now();
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Perf Clinic ${stamp}`);
  await page.getByLabel(/your name|adınız/i).fill("Perf Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`perf+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await page
    .getByRole("button", { name: /create account|hesap oluştur/i })
    .click();
  await page.waitForURL(/\/$/);
}

async function measure(page: Page, route: string) {
  const started = Date.now();
  await page.goto(route, { waitUntil: "load" });
  const wall = Date.now() - started;
  const nav = await page.evaluate(() => {
    const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    return entry
      ? { ttfb: Math.round(entry.responseStart), load: Math.round(entry.loadEventEnd) }
      : null;
  });
  return { wall, ...nav };
}

test.describe("Performance budget", () => {
  test.setTimeout(BUDGET_MS * ROUTES.length + 60_000);

  test(`every key page loads within ${BUDGET_MS} ms`, async ({ page }) => {
    await signUp(page);

    const results: { route: string; wall: number; load?: number; ttfb?: number }[] = [];
    for (const route of ROUTES) {
      results.push({ route, ...(await measure(page, route)) });
    }

    // One table in the report, then one assertion per route so the failing
    // screen is named.
    console.table(results);
    for (const r of results) {
      expect(r.wall, `${r.route} took ${r.wall} ms (budget ${BUDGET_MS} ms)`).toBeLessThan(
        BUDGET_MS,
      );
    }
  });

  test("the health endpoint answers quickly", async ({ request }) => {
    const started = Date.now();
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
