import { test, expect } from "@playwright/test";

test.describe("Enterprise Critical User Journey", () => {
  test("should complete a full match lifecycle", async ({ page }) => {
    // 1. Visit the home page
    await page.goto("/");

    // 2. Click Scorer mode
    await page.getByRole("button", { name: /SCORER/i }).click();

    // Handle Authentication Modal
    const emailInput = page.getByPlaceholder(/EMAIL ADDRESS\.\.\./i);
    await expect(emailInput).toBeVisible();
    await emailInput.fill("e2e.test@gmail.com");
    await page.getByRole("button", { name: /CONTINUE/i }).click();

    // 3. Fill Match Setup
    // Ensure the page loads MatchSetup component
    await expect(
      page.getByRole("heading", { name: /Match Configurations/i }),
    ).toBeVisible();

    // Explicitly set deterministic squads
    const squadInputs = page.getByPlaceholder(/Enter player name/i);
    await squadInputs.nth(0).fill("BATTER_A\nBATTER_B\nBATTER_C");
    await squadInputs.nth(1).fill("BOWLER_A\nBOWLER_B\nBOWLER_C");

    // Click "Start Fresh Match"
    const startButton = page.getByRole("button", {
      name: /Start Fresh Match/i,
    });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // Toss is handled on the Match Setup form natively, skipping to Openers.

    // 5. Select Openers
    await expect(
      page.getByRole("heading", { name: /SELECT STRIKER/i }),
    ).toBeVisible({ timeout: 15000 });

    // Select Striker
    await page
      .getByRole("button", { name: "BATTER_A" })
      .first()
      .click({ force: true });

    // Select Non-Striker
    await expect(
      page.getByRole("heading", { name: /SELECT NON-STRIKER/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "BATTER_B" })
      .first()
      .click({ force: true });

    // Select Bowler
    await expect(
      page.getByRole("heading", { name: /Opening Bowler/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "BOWLER_A" })
      .first()
      .click({ force: true });

    // 6. Score some runs on the Scoreboard
    await expect(page.getByText(/Live Timeline/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Hit 4 runs and wait briefly for the background sync API to finish to release the isProcessing lock
    await page.getByRole("button", { name: "4", exact: true }).click();
    await page.waitForTimeout(2000);

    // Take a wicket
    await page.getByRole("button", { name: "W", exact: true }).click();
    await page.getByRole("button", { name: /BOWLED/i }).click();

    // Select new batter
    await page
      .getByRole("button", { name: "BATTER_C" })
      .first()
      .click({ force: true });

    // We confirm the total runs is correctly aggregated.
    await expect(page.getByText("4/1")).toBeVisible({ timeout: 15000 });

    console.log("✅ User Journey Completed Successfully");
  });
});
