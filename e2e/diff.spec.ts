import { test, expect } from "@playwright/test";

test.describe("Diff Tool", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/diff");
  });

  test("shows diff toolbar", async ({ page }) => {
    await expect(page.getByText("Diff", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add pane" })).toBeVisible();
  });

  test("starts with two editable panes", async ({ page }) => {
    const textareas = page.locator("textarea");
    await expect(textareas).toHaveCount(2);
    // Both should be editable
    await textareas.nth(0).fill("hello");
    await expect(textareas.nth(0)).toHaveValue("hello");
    await textareas.nth(1).fill("world");
    await expect(textareas.nth(1)).toHaveValue("world");
  });

  test("shows diff stats when comparing", async ({ page }) => {
    const textareas = page.locator("textarea");
    await textareas.nth(0).fill("line1\nline2\nline3");
    await textareas.nth(1).fill("line1\nchanged\nline3\nline4");

    await expect(page.locator("text=+2").first()).toBeVisible();
    await expect(page.locator("text=-1").first()).toBeVisible();
  });

  test("panes remain editable after diff is shown", async ({ page }) => {
    const textareas = page.locator("textarea");
    await textareas.nth(0).fill("aaa");
    await textareas.nth(1).fill("bbb");

    // Both textareas should still be there and editable
    await expect(textareas).toHaveCount(2);
    await textareas.nth(1).fill("ccc");
    await expect(textareas.nth(1)).toHaveValue("ccc");
  });

  test("can add and remove panes", async ({ page }) => {
    await page.getByRole("button", { name: "Add pane" }).click();
    await expect(page.locator("textarea")).toHaveCount(3);

    // Remove buttons appear when > 2 panes
    const removeButtons = page.locator("button.text-destructive");
    await removeButtons.first().click();
    await expect(page.locator("textarea")).toHaveCount(2);
  });
});
