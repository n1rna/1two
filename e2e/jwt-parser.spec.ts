import { test, expect } from "@playwright/test";

const SAMPLE_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

test.describe("JWT Parser", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/jwt");
  });

  test("shows page title", async ({ page }) => {
    await expect(page.getByText("JWT Parser", { exact: true })).toBeVisible();
  });

  test("shows placeholder when no token is entered", async ({ page }) => {
    await expect(page.getByText("Paste a JWT token on the left")).toBeVisible();
  });

  test("decodes a valid JWT and shows all sections", async ({ page }) => {
    await page.locator("textarea").fill(SAMPLE_TOKEN);

    // Header section
    await expect(page.getByText('"HS256"')).toBeVisible();

    // Payload section
    await expect(page.getByText('"John Doe"')).toBeVisible();
    await expect(page.getByText("1234567890", { exact: true }).first()).toBeVisible();

    // Signature section
    await expect(page.locator("[class*=bg-muted]").getByText("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c")).toBeVisible();
  });

  test("highlights token sections with colors", async ({ page }) => {
    await page.locator("textarea").fill(SAMPLE_TOKEN);
    // Legend items
    await expect(page.getByText("Header").first()).toBeVisible();
    await expect(page.getByText("Payload").first()).toBeVisible();
    await expect(page.getByText("Signature").first()).toBeVisible();
  });

  test("shows error for invalid token", async ({ page }) => {
    await page.locator("textarea").fill("not.a.jwt");
    await expect(page.getByText("Invalid JWT token format")).toBeVisible();
  });

  test("clear button removes token", async ({ page }) => {
    await page.locator("textarea").fill(SAMPLE_TOKEN);
    await expect(page.getByText('"John Doe"')).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.locator("textarea")).toHaveValue("");
    await expect(page.getByText("Paste a JWT token on the left")).toBeVisible();
  });
});
