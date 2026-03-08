import { test, expect } from "@playwright/test";

test.describe("JSON Tool", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/json");
  });

  test("shows toolbar", async ({ page }) => {
    await expect(page.getByText("JSON", { exact: true })).toBeVisible();
    await expect(page.getByText("Editor")).toBeVisible();
    await expect(page.getByText("Preview")).toBeVisible();
  });

  test("parses valid JSON and shows tree view", async ({ page }) => {
    await page.locator("textarea").fill('{"name":"John","age":30}');
    // Wait for debounced parse
    await expect(page.getByText("Valid")).toBeVisible({ timeout: 5000 });
    // Tree should show keys
    await expect(page.getByText('"name"', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('"John"', { exact: false }).first()).toBeVisible();
  });

  test("auto-corrects single quotes", async ({ page }) => {
    await page.locator("textarea").fill("{'name': 'John'}");
    await expect(page.getByText("Auto-corrected")).toBeVisible({ timeout: 5000 });
    // Tree should still render
    await expect(page.getByText('"John"', { exact: false }).first()).toBeVisible();
  });

  test("auto-corrects trailing commas", async ({ page }) => {
    await page.locator("textarea").fill('{"a": 1, "b": 2,}');
    await expect(page.getByText("Auto-corrected")).toBeVisible({ timeout: 5000 });
  });

  test("shows error for truly invalid JSON", async ({ page }) => {
    await page.locator("textarea").fill('{"a": }');
    await expect(page.getByText("Invalid JSON")).toBeVisible({ timeout: 5000 });
  });

  test("collapse all and expand all buttons work", async ({ page }) => {
    await page
      .locator("textarea")
      .fill('{"users": [{"name": "Alice"}, {"name": "Bob"}]}');
    // Wait for parse to complete — search input appears when result is valid
    await expect(page.getByPlaceholder("Search keys… (Enter)")).toBeVisible({ timeout: 5000 });

    // Collapse all — icon-only button in preview header
    const previewHeader = page.getByText("Preview").locator("..");
    await previewHeader.locator("button").last().click();
    await expect(page.getByText("1 item")).toBeVisible({ timeout: 5000 });

    // Expand all
    await previewHeader.locator("button").last().click();
    await expect(page.getByText('"Alice"', { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });

  test("search highlights matching keys", async ({ page }) => {
    await page
      .locator("textarea")
      .fill('{"firstName": "John", "lastName": "Doe", "age": 30}');
    // Wait for parse to complete so search input appears
    await expect(page.getByPlaceholder("Search keys… (Enter)")).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder("Search keys… (Enter)").fill("name");
    await page.getByPlaceholder("Search keys… (Enter)").press("Enter");
    // Both firstName and lastName should be highlighted
    const highlights = page.locator(".bg-yellow-500\\/20");
    await expect(highlights).toHaveCount(2);
  });

  test("clear button resets everything", async ({ page }) => {
    await page.locator("textarea").fill('{"a": 1}');
    await expect(page.getByText("Valid")).toBeVisible({ timeout: 5000 });

    // Clear is the X icon button
    const clearBtn = page.locator("button").filter({ has: page.locator("svg.lucide-x") }).first();
    await clearBtn.click();
    await expect(page.locator("textarea")).toHaveValue("");
    await expect(page.getByText("Paste JSON on the left")).toBeVisible();
  });
});
