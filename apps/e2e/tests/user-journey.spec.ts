import { test, expect } from "@playwright/test";

test.describe("Enterprise Critical User Journey", () => {
  test("should complete a full match lifecycle", async ({ page }) => {
    test.setTimeout(180000); // 180s for 12 balls

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
    await expect(
      page.getByRole("heading", { name: /Match Configurations/i }),
    ).toBeVisible();

    // Explicitly set deterministic squads so it works on production before deployment
    const squadInputs = page.getByPlaceholder(/Enter player name/i);
    await squadInputs
      .nth(0)
      .fill(
        "suri\nsunil\nvenky\nraju\nsandy\nsrinath\ndonny\nparth\nsrini\nsrikanth\neega",
      );
    await squadInputs
      .nth(1)
      .fill(
        "yaswanth\ngopi\navinash\ngabriel\nsagar\namogh\nambarasan\ntejas\nraj\nsakthikumar\nashvin",
      );

    // Set 1 Over match
    await page.locator('input[type="number"]').first().fill("1");

    // Click "Start Fresh Match" (Leave CHICAGO SPARTANS to bat first)
    const startButton = page.getByRole("button", {
      name: /Start Fresh Match/i,
    });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // 5. Select Openers (Innings 1 - CHICAGO SPARTANS Batting)
    await expect(
      page.getByRole("heading", { name: /SELECT STRIKER/i }),
    ).toBeVisible({ timeout: 15000 });
    await page
      .getByRole("button", { name: /suri/i })
      .first()
      .click({ force: true });

    await expect(
      page.getByRole("heading", { name: /SELECT NON-STRIKER/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /sunil/i })
      .first()
      .click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Opening Bowler/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /yaswanth/i })
      .first()
      .click({ force: true });

    // 6. Score Inning 1 (CHICAGO SPARTANS Batting)
    await expect(page.getByText(/Live Timeline/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Ball 1: 6 Runs
    await page.getByRole("button", { name: "6", exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Ball 2: 6 Runs
    await page.getByRole("button", { name: "6", exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Ball 3: 4 Runs
    await page.getByRole("button", { name: "4", exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Ball 4: 2 Runs
    await page.getByRole("button", { name: "2", exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Ball 5: 0 Runs
    await page.getByRole("button", { name: "0", exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Ball 6: 1 Run (Innings ends, Total 19, Target 20)
    await page.getByRole("button", { name: "1", exact: true }).first().click();
    await page.waitForTimeout(2000);

    // 7. Transition to Inning 2
    await expect(page.getByText(/Innings Break/i)).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: /START 2ND INNINGS/i }).click();

    // Innings 2 Openers (SHARK BLUE Batting)
    await expect(
      page.getByRole("heading", { name: /SELECT STRIKER/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /yaswanth/i })
      .first()
      .click({ force: true });

    await expect(
      page.getByRole("heading", { name: /SELECT NON-STRIKER/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /gopi/i })
      .first()
      .click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Opening Bowler/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /venky/i })
      .first()
      .click({ force: true });

    // 8. Chase Target (Target: 20)
    await expect(page.getByText(/Live Timeline/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Ball 1: Wicket (BOWLED)
    await page.getByRole("button", { name: "W", exact: true }).first().click();
    await page.getByRole("button", { name: /BOWLED/i }).click();
    await page
      .getByRole("button", { name: /avinash/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2: Wicket (CAUGHT)
    await page.getByRole("button", { name: "W", exact: true }).first().click();
    await page.getByRole("button", { name: /CAUGHT/i }).click();
    // Select Fielder (CHICAGO SPARTANS)
    await expect(
      page.getByRole("heading", { name: /Who took the catch\?/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /suri/i })
      .first()
      .click({ force: true });
    // Select New Batter (SHARK BLUE)
    await expect(
      page.getByRole("heading", { name: /Select New Batter/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /gabriel/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 3: Wicket (RUN OUT)
    await page.getByRole("button", { name: "W", exact: true }).first().click();
    await page.getByRole("button", { name: /RUN OUT/i }).click();
    // Run Out Modal -> Runs scored before run out
    await expect(page.getByText(/Runs completed before/i)).toBeVisible();
    await page
      .locator(".fixed")
      .getByRole("button", { name: "1", exact: true })
      .click();

    // Select who is out (Striker or Non-Striker) -> click gabriel
    await expect(page.getByText(/Who was Run Out/i)).toBeVisible();
    await page
      .getByRole("button", { name: /gabriel/i })
      .first()
      .click();

    // Select Fielder
    await expect(
      page.getByRole("heading", { name: /Who performed the run out\?/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /sandy/i })
      .first()
      .click({ force: true });

    // Select New Batter (SHARK BLUE)
    await expect(
      page.getByRole("heading", { name: /Select New Batter/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /sagar/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 4: 0 Runs
    await page.getByRole("button", { name: "0", exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Ball 5: 0 Runs
    await page.getByRole("button", { name: "0", exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Ball 6: 1 Run (Match ends, SHARK BLUE loses)
    await page.getByRole("button", { name: "1", exact: true }).first().click();
    await page.waitForTimeout(2000);

    // 9. Verify Match Completed
    await expect(page.getByText(/Official Result/i)).toBeVisible({
      timeout: 15000,
    });
    console.log("✅ Full 1-Over Match Journey Completed Successfully");
  });
});
