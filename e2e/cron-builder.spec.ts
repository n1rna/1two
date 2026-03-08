import { test, expect } from "@playwright/test";

test.describe("Cron Builder", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/cron");
  });

  test("shows toolbar with valid badge", async ({ page }) => {
    await expect(page.getByText("Cron", { exact: true })).toBeVisible();
    await expect(
      page.locator(".text-green-500").filter({ hasText: "Valid" })
    ).toBeVisible();
  });

  test("shows default expression with description", async ({ page }) => {
    const input = page.locator("input[placeholder='* * * * *']");
    await expect(input).toHaveValue("*/5 * * * *");
    await expect(page.locator("span.text-foreground").first()).toContainText(
      "5 minutes"
    );
  });

  test("parses custom expression", async ({ page }) => {
    const input = page.locator("input[placeholder='* * * * *']");
    await input.fill("0 9 * * 1-5");
    await expect(page.locator("span.text-foreground").first()).toContainText(
      "Monday through Friday"
    );
  });

  test("shows error for invalid expression", async ({ page }) => {
    const input = page.locator("input[placeholder='* * * * *']");
    await input.fill("invalid");
    await expect(page.locator(".text-destructive").first()).toBeVisible();
  });

  test("shows next execution with expand option", async ({ page }) => {
    // Next execution row visible
    const rows = page.locator(".tabular-nums");
    await expect(rows.first()).toBeVisible();
    // "Show more" button exists
    await expect(
      page.getByText(/Show \d+ more/)
    ).toBeVisible();
  });

  test("preset dropdown updates expression", async ({ page }) => {
    // Open presets dropdown
    await page.getByRole("button", { name: /Presets/i }).click();
    // Click "Every hour" preset
    await page.locator("button").filter({ hasText: "0 * * * *" }).click();
    const input = page.locator("input[placeholder='* * * * *']");
    await expect(input).toHaveValue("0 * * * *");
  });

  test("shows field breakdown labels", async ({ page }) => {
    for (const label of ["Minute", "Hour", "Day", "Month", "Weekday"]) {
      await expect(
        page.locator("div").filter({ hasText: new RegExp(`^${label}$`) }).first()
      ).toBeVisible();
    }
  });

  test("timezone toggle shows selector", async ({ page }) => {
    await page.getByRole("button", { name: /Timezone/i }).click();
    await expect(page.locator("select")).toBeVisible();
  });

  test("syntax guide is visible", async ({ page }) => {
    await expect(page.getByText("Syntax Guide")).toBeVisible();
  });
});
