import { test, expect } from "@playwright/test";

test.describe("Random Generator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/random");
  });

  test("shows toolbar and generator tabs", async ({ page }) => {
    await expect(page.getByText("Random", { exact: true })).toBeVisible();
    for (const label of ["UUID", "Password", "Secret Key", "Hex String", "Base64", "Number"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("generates UUID v4 by default", async ({ page }) => {
    await page.getByRole("button", { name: /Generate/i }).click();
    const result = page.locator(".font-mono.select-all").first();
    await expect(result).toBeVisible();
    const value = await result.textContent();
    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  test("generates UUID v7", async ({ page }) => {
    // Open the version select trigger and pick v7
    await page.locator("[data-slot='select-trigger']").filter({ hasText: /v4/ }).click();
    await page.locator("[data-slot='select-item']").filter({ hasText: /v7/ }).click();
    await page.getByRole("button", { name: /Generate/i }).click();
    const result = page.locator(".font-mono.select-all").first();
    const value = await result.textContent();
    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  test("generates password", async ({ page }) => {
    await page.getByText("Password", { exact: true }).click();
    await page.getByRole("button", { name: /Generate/i }).click();
    const result = page.locator(".font-mono.select-all").first();
    await expect(result).toBeVisible();
    const value = await result.textContent();
    expect(value?.length).toBe(20);
  });

  test("generates multiple values", async ({ page }) => {
    // The count select is the last trigger on the page (after version select)
    await page.locator("[data-slot='select-trigger']").last().click();
    await page.locator("[data-slot='select-item']").filter({ hasText: /^5$/ }).click();
    await page.getByRole("button", { name: /Generate/i }).click();
    const results = page.locator(".font-mono.select-all");
    await expect(results).toHaveCount(5);
  });

  test("copies value to clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: /Generate/i }).click();
    const row = page.locator(".font-mono.select-all").first();
    await expect(row).toBeVisible();
    // Hover to reveal copy button
    await row.locator("..").hover();
    await row.locator("..").locator("button").first().click();
    // Check icon should appear
    await expect(page.locator(".text-green-500").first()).toBeVisible();
  });

  test("clears results", async ({ page }) => {
    await page.getByRole("button", { name: /Generate/i }).click();
    await expect(page.locator(".font-mono.select-all").first()).toBeVisible();
    await page.getByRole("button", { name: /Clear/i }).click();
    await expect(page.locator(".font-mono.select-all")).toHaveCount(0);
  });

  test("switches between generator types", async ({ page }) => {
    await page.getByText("Hex String", { exact: true }).click();
    await expect(page.getByText("Random hexadecimal string")).toBeVisible();
    await page.getByText("Number", { exact: true }).click();
    await expect(page.getByText("Random integer in range")).toBeVisible();
  });
});
