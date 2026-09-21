import { test, expect } from "@playwright/test";

// /appointments answers "what is happening today", so the default view is
// the clinic's own day rather than the oldest page of every appointment
// ever booked.

async function signUp(page: import("@playwright/test").Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adın/i).fill("E2E Tester");
  await page.getByLabel(/^email$/i).fill(`e2e+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await page
    .getByRole("button", { name: /create account|hesap oluştur/i })
    .click();
  await expect(page).toHaveURL("/");
}

async function createPet(page: import("@playwright/test").Page, name: string) {
  await page.goto("/clients/new");
  await page.getByLabel(/first name/i).fill("Ayse");
  await page.getByLabel(/last name/i).fill("Yilmaz");
  await page.getByLabel(/^phone$/i).fill("+905321112233");
  await page.getByRole("button", { name: /create client/i }).click();
  await expect(page.getByRole("heading", { name: /ayse yilmaz/i })).toBeVisible();

  await page.goto("/pets/new");
  await page.getByLabel(/owner/i).selectOption({ index: 1 });
  await page.getByLabel(/^name$/i).fill(name);
  await page.getByRole("button", { name: /^cat$/i }).click();
  await page.getByRole("button", { name: /create pet/i }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(name, "i") }),
  ).toBeVisible();
}

async function book(page: import("@playwright/test").Page, wallTime: string) {
  await page.goto("/appointments/new");
  await page.getByLabel(/^pet$/i).selectOption({ index: 1 });
  await page.getByLabel(/starts at/i).fill(wallTime);
  await page.getByRole("button", { name: /create appointment/i }).click();
  await expect(page).toHaveURL(/\/appointments\/(?!new)[\w-]+$/);
}

/** "YYYY-MM-DD" for today (and neighbours) in the clinic's zone. */
function dayKey(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = parts.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

test.describe("Appointments day plan", () => {
  test("opens on today and moves a day at a time", async ({ page }) => {
    await signUp(page, Date.now());
    await createPet(page, "Boncuk");

    await book(page, `${dayKey(0)}T09:15`);
    await book(page, `${dayKey(1)}T14:00`);
    await book(page, `${dayKey(-30)}T08:00`);

    // Today by default: today's appointment, and nothing from the past.
    await page.goto("/appointments");
    await expect(page.getByText(/\b0?9:15\b/)).toBeVisible();
    await expect(page.getByText(/\b(14:00|2:00 PM)\b/)).toHaveCount(0);
    await expect(page.getByText(/\b(08:00|8:00 AM)\b/)).toHaveCount(0);
    // The phone rides along for reception.
    await expect(page.getByText("+905321112233").last()).toBeVisible();

    // Tomorrow, via the arrow, and the day stays in the URL.
    await page.getByRole("link", { name: /next day/i }).click();
    await expect(page).toHaveURL(new RegExp(`date=${dayKey(1)}`));
    await expect(page.getByText(/\b(14:00|2:00 PM)\b/)).toBeVisible();
    await expect(page.getByText(/\b0?9:15\b/)).toHaveCount(0);

    // Refreshing keeps the same day.
    await page.reload();
    await expect(page.getByText(/\b(14:00|2:00 PM)\b/)).toBeVisible();

    // A day with nothing on it says so. The URL first, so a failure here
    // says whether the day moved at all or moved and rendered wrongly.
    await page.getByRole("link", { name: /next day/i }).click();
    await expect(page).toHaveURL(new RegExp(`date=${dayKey(2)}`));
    await expect(page.getByText(/no appointments on|randevu bulunmuyor/i)).toBeVisible();

    // Back to today.
    await page.getByRole("link", { name: /^today$/i }).click();
    await expect(page.getByText(/\b0?9:15\b/)).toBeVisible();

    // All dates brings back the full list, including the past.
    await page.getByRole("link", { name: /all dates/i }).click();
    await expect(page.getByText(/\b(08:00|8:00 AM)\b/)).toBeVisible();
    await expect(page.getByText(/\b(14:00|2:00 PM)\b/)).toBeVisible();
  });

  test("fits a phone screen without scrolling sideways", async ({ page }) => {
    await signUp(page, Date.now() + 2);
    await createPet(page, "Tarcin");
    await book(page, `${dayKey(0)}T11:45`);

    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto("/appointments");
    await expect(page.getByText(/\b11:45\b/)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the status filter narrows the day rather than replacing it", async ({
    page,
  }) => {
    await signUp(page, Date.now() + 1);
    await createPet(page, "Pamuk");
    await book(page, `${dayKey(0)}T10:30`);

    await page.goto("/appointments");
    await page.getByRole("link", { name: /^scheduled$/i }).click();
    await expect(page).toHaveURL(new RegExp(`date=${dayKey(0)}`));
    await expect(page).toHaveURL(/status=SCHEDULED/);
    await expect(page.getByText(/\b10:30\b/)).toBeVisible();

    await page.getByRole("link", { name: /^completed$/i }).click();
    await expect(page).toHaveURL(new RegExp(`date=${dayKey(0)}`));
    // A filter that matches nothing says so as a filter, with a way out.
    await expect(
      page.getByText(/nothing matches this filter|bu filtreye uyan kayıt yok/i),
    ).toBeVisible();
  });
});
