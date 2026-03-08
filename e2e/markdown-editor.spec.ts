import { test, expect } from "@playwright/test";

test.describe("Markdown Editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/markdown");
  });

  test("shows toolbar and panes", async ({ page }) => {
    await expect(page.getByText("Markdown", { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Editor")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Preview", { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test("renders markdown preview", async ({ page }) => {
    await page.locator("textarea").fill("# Hello World\n\nThis is **bold** text.");
    // Preview should show rendered heading
    await expect(page.locator("h1").filter({ hasText: "Hello World" })).toBeVisible();
    // Preview should show bold text
    await expect(page.locator("strong").filter({ hasText: "bold" })).toBeVisible();
  });

  test("renders lists", async ({ page }) => {
    await page.locator("textarea").fill("- Item 1\n- Item 2\n- Item 3");
    await expect(page.locator("li").filter({ hasText: "Item 1" })).toBeVisible();
    await expect(page.locator("li")).toHaveCount(3);
  });

  test("renders code blocks", async ({ page }) => {
    await page.locator("textarea").fill("```js\nconsole.log('hello');\n```");
    await expect(page.locator("pre code")).toBeVisible();
  });

  test("renders tables", async ({ page }) => {
    await page
      .locator("textarea")
      .fill("| Name | Age |\n| ---- | --- |\n| Alice | 30 |");
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("th").filter({ hasText: "Name" })).toBeVisible();
    await expect(page.locator("td").filter({ hasText: "Alice" })).toBeVisible();
  });

  test("clear button resets editor", async ({ page }) => {
    await page.locator("textarea").fill("# Test");
    await expect(page.locator("h1")).toBeVisible();

    const clearBtn = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-x") })
      .first();
    await clearBtn.click();
    await expect(page.locator("textarea")).toHaveValue("");
    await expect(
      page.getByText("Write markdown on the left")
    ).toBeVisible();
  });

  test("toolbar bold button inserts syntax", async ({ page }) => {
    await page.locator("textarea").click();
    // Click the bold button
    const boldBtn = page.locator("button[title*='Bold']");
    await boldBtn.click();
    await expect(page.locator("textarea")).toHaveValue("**bold**");
  });
});
