import { test, expect } from "@playwright/test";

test.describe("User Journey - Full Match Scoring", () => {
  // NOTE: E2E test matches (TEAM A vs TEAM B) are intentionally preserved after each run
  // in both DEV and PROD environments so the team can visually verify the match UI,
  // scoreboard, and live updates before signing off on a release.

  test("should complete a full 2-over match with all possible scoring and wicket events", async ({
    page,
  }) => {
    test.setTimeout(300000); // 5 minutes for a 2-over match

    // 1. Visit the home page
    await page.goto("/");

    // 2. Click Scorer mode
    await page.getByRole("button", { name: /SCORER/i }).click({ force: true });

    // Handle Authentication Modal (Use Guest Mode for E2E Tests)
    const guestBtn = page.getByRole("button", { name: /Continue as Guest/i });
    await expect(guestBtn).toBeVisible();
    await guestBtn.click({ force: true });

    // 3. Fill Match Setup
    await expect(
      page.getByRole("heading", { name: /Match Configuration/i }),
    ).toBeVisible({ timeout: 15000 });

    const desktopLayout = page.locator(".hidden.md\\:flex");
    const squadInputs = desktopLayout.getByPlaceholder(/Enter player name/i);
    // TEAM A Squad
    await squadInputs
      .nth(0)
      .fill(
        "Player A1\nPlayer A2\nPlayer A3\nPlayer A4\nPlayer A5\nPlayer A6\nPlayer A7\nPlayer A8\nPlayer A9\nPlayer A10\nPlayer A11",
      );
    // TEAM B Squad
    await squadInputs
      .nth(1)
      .fill(
        "Player B1\nPlayer B2\nPlayer B3\nPlayer B4\nPlayer B5\nPlayer B6\nPlayer B7\nPlayer B8\nPlayer B9\nPlayer B10\nPlayer B11",
      );

    // Set 2 Over match
    await desktopLayout.locator('input[inputMode="numeric"]').first().fill("2");

    // Set Toss: TEAM B wins toss and elects to BAT (so TEAM B bats first)
    // The Toss Winner buttons appear first; click TEAM B
    const tossWinnerButtons = desktopLayout.getByRole("button", {
      name: "TEAM B",
    });
    await tossWinnerButtons.first().click({ force: true });
    // Decision is already defaulted to BAT — no change needed

    // Click "Start Fresh Match"
    const startButton = desktopLayout.getByRole("button", {
      name: /Start Fresh Match/i,
    });
    await expect(startButton).toBeEnabled();
    await startButton.click({ force: true });

    // --- INNINGS 1: TEAM B BATTING ---
    await expect(
      page.getByRole("heading", { name: /SELECT STRIKER/i }),
    ).toBeVisible({ timeout: 15000 });

    // Select Openers
    await page
      .getByRole("button", { name: /Player B1/i })
      .first()
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: /SELECT NON-STRIKER/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player B2/i })
      .first()
      .click({ force: true });

    // Select Bowler
    await expect(
      page.getByRole("heading", { name: /Opening Bowler/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player A2/i })
      .first()
      .click({ force: true });

    await expect(page.getByText(/Live Timeline/i).first()).toBeVisible({
      timeout: 15000,
    });

    // --- NEW: Test Change Batter ---
    console.log("Clicking Change Batter...");
    await page
      .getByRole("button", { name: "Change Batter" })
      .click({ force: true });
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible();
    console.log("Clicking Player B2...");
    await page
      .getByRole("button", { name: /Player B2/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);
    console.log("Clicking Change Batter again...");
    await page
      .getByRole("button", { name: "Change Batter" })
      .click({ force: true });
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible();
    console.log("Clicking Player B1...");
    await page
      .getByRole("button", { name: /Player B1/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // --- NEW: Test Change Bowler ---
    console.log("Clicking Change Bowler...");
    await page
      .getByRole("button", { name: "Change Bowler" })
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: /(Next|Opening) Bowler/i }),
    ).toBeVisible();
    console.log("Clicking Player A1...");
    await page
      .getByRole("button", { name: /Player A1/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);
    console.log("Clicking Change Bowler again...");
    await page
      .getByRole("button", { name: "Change Bowler" })
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: /(Next|Opening) Bowler/i }),
    ).toBeVisible();
    console.log("Clicking Player A2...");
    await page
      .getByRole("button", { name: /Player A2/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // --- NEW: Test Undo ---
    console.log("Clicking 2 runs for Undo test...");
    await expect(
      page.getByRole("button", { name: "2", exact: true }).first(),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "2", exact: true })
      .first()
      .click({ force: true });
    await expect(page.getByText(/2\/0/).first()).toBeVisible({ timeout: 5000 });

    console.log("Clicking Undo...");
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    await page.getByRole("button", { name: "Undo" }).click({ force: true });
    await expect(page.getByText(/0\/0/).first()).toBeVisible({ timeout: 5000 });
    // Wait extra time after Undo to ensure isProcessing resets before next click
    await page.waitForTimeout(2000);

    console.log("Starting actual over...");
    // Ball 1.1: 2 runs
    let clicked1_1 = false;
    for (let i = 0; i < 10; i++) {
      await page.screenshot({ path: "before-2.png" });
      await expect(
        page.getByRole("button", { name: "2", exact: true }).first(),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "2", exact: true })
        .first()
        .click({ force: true });
      try {
        await expect(page.getByText(/2\/0/).first()).toBeVisible({
          timeout: 2000,
        });
        clicked1_1 = true;
        break;
      } catch (e) {
        await page.waitForTimeout(1000);
      }
    }
    if (!clicked1_1) throw new Error("Failed to click 2 runs for Ball 1.1!");
    await page.waitForTimeout(1000);

    // Ball 1.2: 4 runs
    await page
      .getByRole("button", { name: "4", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.3: WIDE
    await page
      .getByRole("button", { name: "WIDE", exact: true })
      .first()
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: /Additional Runs/i }),
    ).toBeVisible();
    await page
      .locator(".backdrop-blur-md")
      .getByRole("button", { name: "0", exact: true })
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.3 (Re-bowl): 6 runs
    await page
      .getByRole("button", { name: "6", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.4: BOWLED
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await expect(page.getByRole("button", { name: /BOWLED/i })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("button", { name: /BOWLED/i }).click({ force: true });
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player B3/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.5: 1 run
    await page
      .getByRole("button", { name: "1", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.6: NO BALL
    await page
      .getByRole("button", { name: "NO BALL", exact: true })
      .first()
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: /Additional Runs/i }),
    ).toBeVisible();
    await page
      .locator(".backdrop-blur-md")
      .getByRole("button", { name: "0", exact: true })
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.6 (Re-bowl): BYE (0 runs from bat, 1 bye)
    await page
      .getByRole("button", { name: "BYE", exact: true })
      .first()
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: /Additional Runs/i }),
    ).toBeVisible();
    await page
      .locator(".backdrop-blur-md")
      .getByRole("button", { name: "1", exact: true })
      .click({ force: true });
    await page.waitForTimeout(1000);

    // End of Over 1. Select New Bowler.
    await expect(
      page.getByRole("heading", { name: /Next Bowler/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player A1/i })
      .first()
      .click({ force: true });

    // Ball 2.1: 3 runs
    await page
      .getByRole("button", { name: "3", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.2: CAUGHT
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await expect(page.getByRole("button", { name: /CAUGHT/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /CAUGHT/i }).click({ force: true });
    await expect(
      page.getByRole("heading", { name: /Who took the catch\?/i }),
    ).toBeVisible({ timeout: 10000 });
    await page
      .getByRole("button", { name: /Player A4/i })
      .first()
      .click({ force: true }); // Fielder
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible({ timeout: 10000 });
    await page
      .getByRole("button", { name: /Player B4/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.3: LBW
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await expect(page.getByRole("button", { name: /LBW/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /LBW/i }).click({ force: true });
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible({ timeout: 10000 });
    await page
      .getByRole("button", { name: /Player B5/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.4: LEG BYE (+1)
    await page
      .getByRole("button", { name: "LEG BYE", exact: true })
      .first()
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: /Additional Runs/i }),
    ).toBeVisible({ timeout: 10000 });
    await page
      .locator(".backdrop-blur-md")
      .getByRole("button", { name: "1", exact: true })
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.5: STUMPED
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await expect(page.getByRole("button", { name: /STUMPED/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /STUMPED/i }).click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Who performed the stumping\?/i }),
    ).toBeVisible({ timeout: 10000 });

    await page
      .getByRole("button", { name: /Player A5/i })
      .first()
      .click({ force: true }); // Fielder
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player B6/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.6: 5 runs
    await page
      .getByRole("button", { name: "5", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(2000);

    // --- INNINGS BREAK ---
    await expect(page.getByText(/Innings Break/i)).toBeVisible({
      timeout: 15000,
    });
    await page
      .getByRole("button", { name: /START 2ND INNINGS/i })
      .click({ force: true });

    // --- INNINGS 2: TEAM A BATTING ---
    await expect(
      page.getByRole("heading", { name: /SELECT STRIKER/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player A1/i })
      .first()
      .click({ force: true });

    await expect(
      page.getByRole("heading", { name: /SELECT NON-STRIKER/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player A2/i })
      .first()
      .click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Opening Bowler/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player B1/i })
      .first()
      .click({ force: true });

    await expect(page.getByText(/Live Timeline/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Ball 1.1: 4 runs (Score: 4)
    await page
      .getByRole("button", { name: "4", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.2: HIT WICKET
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await expect(page.getByRole("button", { name: /HIT WICKET/i })).toBeVisible(
      { timeout: 10000 },
    );
    await page
      .getByRole("button", { name: /HIT WICKET/i })
      .click({ force: true });
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible({ timeout: 10000 });
    await page
      .getByRole("button", { name: /Player A3/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.3: 0 runs
    await page
      .getByRole("button", { name: "0", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.4: RUN OUT (1 run scored before run out)
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await expect(page.getByRole("button", { name: /RUN OUT/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /RUN OUT/i }).click({ force: true });
    await expect(page.getByText(/Runs completed before/i)).toBeVisible({
      timeout: 10000,
    });
    await page
      .locator(".backdrop-blur-md")
      .getByRole("button", { name: "1", exact: true })
      .click({ force: true });
    await expect(page.getByText(/Who was Run Out/i)).toBeVisible({
      timeout: 10000,
    });
    await page
      .getByRole("button", { name: /Player A3/i })
      .first()
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: /Who performed the run out\?/i }),
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: /Player B2/i })
      .first()
      .click({ force: true });
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await page
      .getByRole("button", { name: /Player A4/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Between balls: Retire Striker -> RETIRED HURT
    await page
      .getByRole("button", { name: "Retire" })
      .first()
      .click({ force: true });
    await expect(page.getByText("Retire Batsman")).toBeVisible();
    await page
      .locator("button")
      .filter({ hasText: "Retired Hurt" })
      .click({ force: true });
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player A5/i })
      .first()
      .click({ force: true });
    // Wait for modal overlay to fully dismiss (CSS animate-in fade-in 300ms)
    await page
      .waitForSelector(".backdrop-blur-md", {
        state: "hidden",
        timeout: 5000,
      })
      .catch(() => {});
    await page.waitForTimeout(500);

    // Ball 1.5: 6 runs (Score: 11)
    // Add retry loop because React state transitions are swallowing the click
    let clicked6 = false;
    for (let i = 0; i < 5; i++) {
      await expect(
        page.getByRole("button", { name: "6", exact: true }).first(),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "6", exact: true })
        .first()
        .click({ force: true });

      // Wait to see if score updates to 11
      try {
        await expect(page.getByText(/11\/2/)).toBeVisible({ timeout: 1000 });
        clicked6 = true;
        break;
      } catch (e) {
        // Click was swallowed, try again
        await page.waitForTimeout(500);
      }
    }
    if (!clicked6) throw new Error("Failed to click 6 runs!");
    await page.waitForTimeout(1000);

    // Ball 1.6: 0 runs
    await expect(
      page.getByRole("button", { name: "0", exact: true }).first(),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "0", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // End of Over 1. Select New Bowler.
    await page.screenshot({
      path: "test-results/debug-missing-ball.png",
      fullPage: true,
    });
    await expect(
      page.getByRole("heading", { name: /Next Bowler/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player B3/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Between overs: Retire Striker -> RETIRED OUT
    await page
      .getByRole("button", { name: "Retire" })
      .first()
      .click({ force: true });
    await expect(page.getByText("Retire Batsman")).toBeVisible();
    await page
      .locator("button")
      .filter({ hasText: "Retired Out" })
      .click({ force: true });
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Player A2/i })
      .first()
      .click({ force: true });
    // Wait for modal overlay to fully dismiss
    await page
      .waitForSelector(".backdrop-blur-md", {
        state: "hidden",
        timeout: 5000,
      })
      .catch(() => {});
    await page.waitForTimeout(500);

    // Ball 2.1: 2 runs (added to adjust target due to 2 runs in 1st innings)
    // Add retry loop because React state transitions are swallowing the click
    let clicked2 = false;
    for (let i = 0; i < 5; i++) {
      await expect(
        page.getByRole("button", { name: "2", exact: true }).first(),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "2", exact: true })
        .first()
        .click({ force: true });

      try {
        await expect(page.getByText(/13\/3/)).toBeVisible({ timeout: 1000 });
        clicked2 = true;
        break;
      } catch (e) {
        await page.waitForTimeout(500);
      }
    }
    if (!clicked2) throw new Error("Failed to click 2 runs!");
    await page.waitForTimeout(1000);

    // Ball 2.2: 4 runs (Score: 15)
    await expect(
      page.getByRole("button", { name: "4", exact: true }).first(),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "4", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.3: 1 run (Score: 16)
    await expect(
      page.getByRole("button", { name: "1", exact: true }).first(),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "1", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.4: 1 run (Score: 17)
    await expect(
      page.getByRole("button", { name: "1", exact: true }).first(),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "1", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.5: 1 run (Score: 18)
    await expect(
      page.getByRole("button", { name: "1", exact: true }).first(),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "1", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Target is 26, score is 20. They need 6 runs off 1 ball.
    // Ball 2.6: 6 runs! MATCH WON.
    await expect(
      page.getByRole("button", { name: "6", exact: true }).first(),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "6", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(2000);

    // Assert Team B won (Team B batted first, scored 25/4; Team A only scored 20/3 chasing)
    await page.screenshot({ path: "match-end.png" });
    await expect(page.getByText(/TEAM B WON/i)).toBeVisible({
      timeout: 15000,
    });
  });
});
