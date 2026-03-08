import { test, expect } from "@playwright/test";

test.describe("Keyboard Tester", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/keyboard");
  });

  test("shows toolbar with title", async ({ page }) => {
    await expect(
      page.getByText("Keyboard Tester", { exact: true })
    ).toBeVisible();
  });

  test("shows keyboard keys", async ({ page }) => {
    // Should show common keys like Esc, Tab, Caps, Shift, Ctrl, Space
    await expect(page.getByText("Esc", { exact: true })).toBeVisible();
    await expect(page.getByText("Tab", { exact: true })).toBeVisible();
  });

  test("shows prompt before any key press", async ({ page }) => {
    await expect(
      page.getByText("Press any key to start testing")
    ).toBeVisible();
  });

  test("highlights key on press and shows key info", async ({ page }) => {
    await page.keyboard.press("a");
    // Should show the code info
    await expect(page.getByText("KeyA")).toBeVisible();
  });

  test("clear button resets highlights", async ({ page }) => {
    await page.keyboard.press("a");
    await expect(page.getByText("KeyA")).toBeVisible();
    await page.getByRole("button", { name: /Clear/i }).click();
    await expect(
      page.getByText("Press any key to start testing")
    ).toBeVisible();
  });

  test("shows key count", async ({ page }) => {
    await expect(page.getByText("0/")).toBeVisible();
  });
});
