import { test, expect } from "@playwright/test";

test.describe("Base64 Encoder/Decoder", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/b64");
  });

  test("shows page title", async ({ page }) => {
    await expect(
      page.getByText("Base64 Encoder/Decoder", { exact: true })
    ).toBeVisible();
  });

  test("decodes a base64 string", async ({ page }) => {
    const input = page.getByPlaceholder("Paste Base64 string...");
    await input.fill("SGVsbG8sIFdvcmxkIQ==");
    await page.getByRole("button", { name: "Decode" }).click();

    const output = page.locator("textarea[readonly]");
    await expect(output).toHaveValue("Hello, World!");
  });

  test("encodes a text string", async ({ page }) => {
    await page.getByRole("tab", { name: "Encode" }).click();

    const input = page.getByPlaceholder("Enter text to encode...");
    await input.fill("Hello, World!");
    await page.getByRole("button", { name: "Encode" }).click();

    const output = page.locator("textarea[readonly]");
    await expect(output).toHaveValue("SGVsbG8sIFdvcmxkIQ==");
  });

  test("shows error for invalid base64 input", async ({ page }) => {
    const input = page.getByPlaceholder("Paste Base64 string...");
    await input.fill("!!!invalid!!!");
    await page.getByRole("button", { name: "Decode" }).click();

    await expect(page.getByText("Failed to decode")).toBeVisible();
  });

  test("swap button switches mode and moves output to input", async ({ page }) => {
    const input = page.getByPlaceholder("Paste Base64 string...");
    await input.fill("SGVsbG8sIFdvcmxkIQ==");
    await page.getByRole("button", { name: "Decode" }).click();

    await page.getByRole("button", { name: "Swap" }).click();

    // Mode should now be encode, and the input should have the decoded text
    await expect(page.getByPlaceholder("Enter text to encode...")).toHaveValue(
      "Hello, World!"
    );
  });
});
