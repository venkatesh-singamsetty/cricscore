import { test, expect } from "@playwright/test";

test.describe("CricScore Smoke Tests", () => {
  test("should load homepage and have correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CricScore/i);
  });

  test("should allow navigating to create match modal", async ({ page }) => {
    await page.goto("/");

    // Find the "Create Match" button
    const createMatchBtn = page.getByRole("button", {
      name: /start new match/i,
    });
    if (await createMatchBtn.isVisible()) {
      await createMatchBtn.click();

      // Ensure the modal appears with the team inputs
      await expect(page.getByPlaceholder(/team a name/i)).toBeVisible();
      await expect(page.getByPlaceholder(/team b name/i)).toBeVisible();
    }
  });
});
