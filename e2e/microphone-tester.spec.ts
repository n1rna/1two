import { test, expect } from "@playwright/test";

test.describe("Microphone Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/microphone");
  });

  test("shows toolbar with title", async ({ page }) => {
    await expect(
      page.getByText("Microphone Test", { exact: true })
    ).toBeVisible();
  });

  test("shows empty state", async ({ page }) => {
    await expect(
      page.getByText(
        /No microphones detected|Click Start|Microphone permission denied/
      )
    ).toBeVisible();
  });

  test("has start button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Start/i }).first()
    ).toBeVisible();
  });
});
