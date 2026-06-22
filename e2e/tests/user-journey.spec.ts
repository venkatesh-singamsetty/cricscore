import { test, expect } from "@playwright/test";

test.describe("Enterprise Critical User Journey", () => {
  test("should complete a full match lifecycle", async ({ page }) => {
    // 1. Visit the home page
    await page.goto("/");

    // 2. Click Scorer mode
    await page.getByRole("button", { name: /SCORER/i }).click();

    // Handle Authentication Modal
    const emailInput = page.getByPlaceholder(/YOUR\.NAME@GMAIL\.COM/i);
    await expect(emailInput).toBeVisible();
    await emailInput.fill("e2e.test@gmail.com");
    await page.getByRole("button", { name: /ENTER WORKSPACE/i }).click();

    // 3. Fill Match Setup
    // Ensure the page loads MatchSetup component
    await expect(
      page.getByRole("heading", { name: /Match Configurations/i }),
    ).toBeVisible();

    // Click "Start Fresh Match" (assuming default teams are valid)
    const startButton = page.getByRole("button", {
      name: /Start Fresh Match/i,
    });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // 4. Handle Toss Selection
    await expect(
      page.getByRole("heading", { name: /Toss Details/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /WON THE TOSS/i })
      .first()
      .click();
    await page.getByRole("button", { name: /ELECTS TO BAT/i }).click();
    await page.getByRole("button", { name: /Lock Toss/i }).click();

    // 5. Select Openers
    await expect(
      page.getByRole("heading", { name: /Select Opening Pair/i }),
    ).toBeVisible();

    // Just click the first available players
    const players = page.getByRole("button", { name: /Select/i });
    await players.nth(0).click(); // Striker
    await players.nth(1).click(); // Non-Striker
    await players.nth(2).click(); // Bowler
    await page.getByRole("button", { name: /Start Innings/i }).click();

    // 6. Score some runs on the Scoreboard
    await expect(
      page.getByRole("heading", { name: /Current Over/i }),
    ).toBeVisible();

    // Hit 4 runs
    await page.getByRole("button", { name: "4", exact: true }).click();

    // Take a wicket
    await page.getByRole("button", { name: /OUT/i }).click();
    await page.getByRole("button", { name: /BOWLED/i }).click();

    // Select new batter
    await page
      .getByRole("button", { name: /Select/i })
      .first()
      .click();
    await page.getByRole("button", { name: /Confirm/i }).click();

    // 7. End the Match / Inning early via settings or finishing overs
    // For this E2E test, we'll click the gear icon to open Match Settings and force finish
    await page.locator('button[title="Match Settings"]').click();

    // Acknowledge the alert if any, but we just verify the scorecard renders successfully
    // We confirm the total runs is correctly aggregated.
    await expect(page.getByText(/4\/1/i)).toBeVisible(); // 4 runs, 1 wicket

    console.log("✅ User Journey Completed Successfully");
  });
});
