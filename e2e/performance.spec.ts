import { readFileSync } from "node:fs";
import { join } from "node:path";
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
//
// Backlog 35: a number on its own does not say the page worked. This file
// used to measure duration and nothing else, and during one measuring run
// `/clients` was falling into the error boundary — a column missing from the
// database — and the suite recorded it at 182 ms and passed. A broken
// application measures fast, and the faster it is broken the better it
// scores. So every route now has to show a mark that only that route
// renders, and the timing is only reported for a page that showed it.

const BUDGET_MS = Number(process.env.PERF_BUDGET_MS ?? 6000);

// Resolved from the repo root: Playwright compiles specs to CommonJS, where
// `import.meta` is not available, and always runs them with cwd at the root.
const messages = (locale: string) =>
  JSON.parse(
    readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
  ) as Record<string, Record<string, string>>;

const TR = messages("tr");
const EN = messages("en");

/**
 * The route's own heading, read from the message files rather than copied
 * here: a heading that gets reworded should not quietly stop being checked,
 * and the suite runs in whichever locale the browser asks for.
 */
function heading(namespace: string, key: string): RegExp {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = (source: Record<string, Record<string, string>>) =>
    // `{name}` and friends are filled in at render time.
    escape(source[namespace][key]).replace(/\\\{\w+\\\}/g, ".+");
  return new RegExp(`^(${pattern(TR)}|${pattern(EN)})$`, "i");
}

const ROUTES: { path: string; heading: RegExp }[] = [
  { path: "/", heading: heading("dashboard", "greeting") },
  { path: "/clients", heading: heading("client", "title") },
  { path: "/clients/new", heading: heading("client", "new") },
  { path: "/pets", heading: heading("pet", "title") },
  { path: "/pets/new", heading: heading("pet", "new") },
  { path: "/visits", heading: heading("visit", "title") },
  { path: "/appointments", heading: heading("appointment", "title") },
  { path: "/prescriptions", heading: heading("prescription", "title") },
  { path: "/reminders", heading: heading("reminder", "title") },
  { path: "/invoices", heading: heading("invoice", "title") },
  { path: "/settings", heading: heading("settings", "title") },
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

async function measure(page: Page, route: { path: string; heading: RegExp }) {
  const started = Date.now();
  const response = await page.goto(route.path, { waitUntil: "load" });
  const wall = Date.now() - started;
  const nav = await page.evaluate(() => {
    const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    return entry
      ? { ttfb: Math.round(entry.responseStart), load: Math.round(entry.loadEventEnd) }
      : null;
  });

  // Checked after the clock is read, so waiting for the assertion can never
  // be mistaken for page-load time.
  expect(response?.status(), `${route.path} answered ${response?.status()}`).toBeLessThan(400);
  await expect(
    page.getByRole("heading", { level: 1, name: route.heading }),
    `${route.path} did not render its own heading — an error page, a redirect ` +
      `or an empty shell would time just as well`,
  ).toBeVisible();

  return { wall, ...nav };
}

test.describe("Performance budget", () => {
  test.setTimeout(BUDGET_MS * ROUTES.length + 60_000);

  test(`every key page loads within ${BUDGET_MS} ms`, async ({ page }) => {
    await signUp(page);

    const results: { route: string; wall: number; load?: number; ttfb?: number }[] = [];
    for (const route of ROUTES) {
      results.push({ route: route.path, ...(await measure(page, route)) });
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
