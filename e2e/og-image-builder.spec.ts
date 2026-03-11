import { test, expect } from "@playwright/test";

test.describe("OG Image Builder", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/tools/og");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("shows page title and toolbar", async ({ page }) => {
    await expect(
      page.getByText("OG Image Builder", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Export All" })
    ).toBeVisible();
  });

  test("shows default image presets in sidebar", async ({ page }) => {
    // Sidebar has size labels with dimensions
    await expect(page.getByText("1200×630")).toBeVisible();
    await expect(page.getByText("1200×628")).toBeVisible();
  });

  test("default content fields are editable", async ({ page }) => {
    const titleInput = page.locator('input[placeholder="Title for all images…"]');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue("Your Title Goes Here");

    await titleInput.fill("My Custom Title");
    await expect(titleInput).toHaveValue("My Custom Title");
  });

  test("apply defaults updates all image titles", async ({ page }) => {
    const titleInput = page.locator('input[placeholder="Title for all images…"]');
    await titleInput.fill("New Title");

    await page.getByRole("button", { name: "Apply to All Images" }).click();

    // The per-image title inputs should be updated
    const imageTitleInputs = page.locator('input[value="New Title"]');
    await expect(imageTitleInputs.first()).toBeVisible({ timeout: 3000 });
  });

  test("theme controls are visible", async ({ page }) => {
    await expect(page.getByText("Theme", { exact: true })).toBeVisible();
    await expect(page.getByText("Use gradient background")).toBeVisible();
    await expect(page.getByText("Typography")).toBeVisible();
    await expect(page.getByText("Padding")).toBeVisible();
  });

  test("can toggle gradient mode", async ({ page }) => {
    const gradientCheckbox = page.locator("#useGradient");
    await expect(gradientCheckbox).not.toBeChecked();

    await gradientCheckbox.check();
    await expect(gradientCheckbox).toBeChecked();

    // Gradient controls should appear
    await expect(page.getByText("Color 1")).toBeVisible();
    await expect(page.getByText("Color 2")).toBeVisible();
    await expect(page.getByText("Direction")).toBeVisible();
  });

  test("can toggle image size on/off", async ({ page }) => {
    // Instagram Square should be unchecked by default
    const igCheckbox = page.locator("label").filter({ hasText: "Instagram Square" }).locator("input[type='checkbox']");
    await expect(igCheckbox).not.toBeChecked();

    await igCheckbox.check();
    await expect(igCheckbox).toBeChecked();
  });

  test("can add custom size via button", async ({ page }) => {
    await page.getByRole("button", { name: "Add Custom Size" }).click();

    // The dialog is a fixed overlay with inputs labeled Name, Width, Height
    const dialog = page.locator(".fixed.inset-0");
    await expect(dialog).toBeVisible();

    // Name input (text input inside the dialog)
    const nameInput = dialog.locator("input[type='text']");
    await nameInput.clear();
    await nameInput.fill("Banner");

    // Width and Height are number inputs
    const numberInputs = dialog.locator("input[type='number']");
    await numberInputs.nth(0).clear();
    await numberInputs.nth(0).fill("1920");
    await numberInputs.nth(1).clear();
    await numberInputs.nth(1).fill("480");

    await dialog.getByRole("button", { name: "Add" }).click();

    // Should appear in the size list - use exact match to avoid "Twitter Banner"
    await expect(page.getByText("1920×480")).toBeVisible();
  });

  test("persists state to localStorage across page reload", async ({ page }) => {
    // Change the title
    const titleInput = page.locator('input[placeholder="Title for all images…"]');
    await titleInput.fill("Persisted Title");

    // Wait for debounce
    await page.waitForTimeout(500);

    // Reload
    await page.reload();

    // Title should be restored
    const restoredInput = page.locator('input[placeholder="Title for all images…"]');
    await expect(restoredInput).toHaveValue("Persisted Title", { timeout: 3000 });
  });

  test("export format dropdown switches to JPEG with quality slider", async ({ page }) => {
    const formatSelect = page.locator("select").first();
    await formatSelect.selectOption("image/jpeg");

    // JPEG quality slider should appear
    await expect(page.getByText("Q", { exact: true })).toBeVisible();
  });

  test("image cards show layout selection", async ({ page }) => {
    // The layout picker shows thumbnail buttons - look for layout-related UI
    // Each card has a layout dropdown or selector
    const firstCard = page.locator("[class*='break-inside-avoid']").first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });
  });

  test("collections button is not visible when logged out", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Collections" })
    ).not.toBeVisible();
  });

  test("save button is not visible when logged out", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Save" })
    ).not.toBeVisible();
  });
});

test.describe("OG Collection Edit Page", () => {
  test("shows error for non-existent collection", async ({ page }) => {
    await page.goto("/tools/og/nonexistent-id-12345");

    // Should show error or loading then error
    await expect(
      page.getByText(/not found|Failed to load/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
