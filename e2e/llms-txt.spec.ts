import { test, expect } from "@playwright/test";

test.describe("llms.txt Generator", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/llms-txt", { timeout: 45_000 });
  });

  // ── Page & layout ──────────────────────────────────────────────────────

  test("renders the tool page with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/llms\.txt Generator/);
  });

  test("shows ToolInfo sections", async ({ page }) => {
    await expect(page.getByText("What is llms.txt?")).toBeVisible();
    await expect(page.getByText("How it works")).toBeVisible();
    await expect(page.getByText("How to use this tool")).toBeVisible();
    await expect(page.getByText("Common use cases")).toBeVisible();
  });

  test("appears in the launcher search", async ({ page }) => {
    await page.keyboard.press("Control+p");
    await page.getByPlaceholder("Search tools...").fill("llms");
    await expect(
      page.getByRole("option", { name: /llms\.txt Generator/i })
    ).toBeVisible();
  });

  // ── Step 1: URL input ──────────────────────────────────────────────────

  test("shows URL input on initial load", async ({ page }) => {
    await expect(
      page.getByPlaceholder("https://docs.example.com or https://github.com/org/repo")
    ).toBeVisible();
  });

  test("shows sign-in prompt when not authenticated", async ({ page }) => {
    await expect(
      page.getByText("Sign in to generate llms.txt files")
    ).toBeVisible();
  });

  test("Continue button is disabled with empty URL", async ({ page }) => {
    const btn = page.getByRole("button", { name: "Continue" });
    await expect(btn).toBeDisabled();
  });

  test("Continue button is disabled with invalid URL", async ({ page }) => {
    await page
      .getByPlaceholder("https://docs.example.com or https://github.com/org/repo")
      .fill("not-a-url");
    const btn = page.getByRole("button", { name: "Continue" });
    await expect(btn).toBeDisabled();
  });

  test("shows validation error for invalid URL", async ({ page }) => {
    await page
      .getByPlaceholder("https://docs.example.com or https://github.com/org/repo")
      .fill("ftp://example.com");
    await expect(
      page.getByText("Enter a valid URL starting with http:// or https://")
    ).toBeVisible();
  });

  test("Continue button enables with valid URL", async ({ page }) => {
    await page
      .getByPlaceholder("https://docs.example.com or https://github.com/org/repo")
      .fill("https://docs.example.com");
    const btn = page.getByRole("button", { name: "Continue" });
    await expect(btn).toBeEnabled();
  });

  test("clicking Continue without auth opens sign-in dialog", async ({ page }) => {
    await page
      .getByPlaceholder("https://docs.example.com or https://github.com/org/repo")
      .fill("https://docs.example.com");
    const btn = page.getByRole("button", { name: "Continue" });
    await expect(btn).toBeEnabled();
    await btn.click();
    // Sign-in dialog should appear
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  });

  // ── Step indicators ────────────────────────────────────────────────────

  test("shows step indicator dots", async ({ page }) => {
    // 4 step dots should be visible
    const dots = page.locator(".rounded-full.h-1\\.5");
    await expect(dots).toHaveCount(4);
  });

  // ── Step 2: Options (requires mock auth - test structure visibility) ───

  test.describe("Options step", () => {
    // We can't easily authenticate in e2e without mocking, but we can test
    // that the options UI renders correctly by manipulating the step.
    // Instead, we test the structure is correct by checking URL accepts
    // various GitHub and website URLs.

    test("accepts GitHub repo URL", async ({ page }) => {
      const input = page.getByPlaceholder(
        "https://docs.example.com or https://github.com/org/repo"
      );
      await input.fill("https://github.com/anthropics/anthropic-sdk-go");
      await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    });

    test("accepts documentation site URL", async ({ page }) => {
      const input = page.getByPlaceholder(
        "https://docs.example.com or https://github.com/org/repo"
      );
      await input.fill("https://developers.cloudflare.com/workers/");
      await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    });

    test("accepts URL with path", async ({ page }) => {
      const input = page.getByPlaceholder(
        "https://docs.example.com or https://github.com/org/repo"
      );
      await input.fill("https://github.com/org/repo/tree/main/docs");
      await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    });
  });

  // ── Navigation from home ───────────────────────────────────────────────

  test("can navigate to llms-txt tool from home", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+p");
    await page.getByPlaceholder("Search tools...").fill("llms");
    await page.getByRole("option", { name: /llms\.txt/i }).click();
    await expect(page).toHaveURL("/tools/llms-txt");
  });
});
