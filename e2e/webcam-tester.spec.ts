import { test, expect } from "@playwright/test";

test.describe("Webcam Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/webcam");
  });

  test("shows toolbar with title", async ({ page }) => {
    await expect(page.getByText("Webcam Test", { exact: true })).toBeVisible();
  });

  test("shows empty state when no camera permission", async ({ page }) => {
    // Without granting camera permission, should show a message
    await expect(
      page.getByText(/No cameras detected|Click Start|Camera permission denied/)
    ).toBeVisible();
  });

  test("has start button", async ({ page }) => {
    // Start button should exist (may be in toolbar or in empty state)
    await expect(
      page.getByRole("button", { name: /Start/i }).first()
    ).toBeVisible();
  });

  test("has mirror toggle", async ({ page }) => {
    await expect(page.getByText("Mirror")).toBeVisible();
  });
});
