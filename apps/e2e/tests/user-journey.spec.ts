import { test, expect } from "@playwright/test";

test.describe("User Journey - Full Match Scoring", () => {
  test.afterEach(async ({ request }) => {
    const API_URL = "https://ispht71fh0.execute-api.us-east-1.amazonaws.com";
    const res = await request.get(`${API_URL}/matches`);
    if (res.ok()) {
      const matches = await res.json();
      const testMatches = matches.filter(
        (m: any) =>
          (m.team_a_name === "CHICAGO SPARTANS" &&
            m.team_b_name === "SHARK BLUE") ||
          (m.team_a_name === "SHARK BLUE" &&
            m.team_b_name === "CHICAGO SPARTANS"),
      );
      for (const m of testMatches) {
        await request.delete(`${API_URL}/match/${m.id}`);
      }
    }
  });

  test("should complete a full 2-over match with all possible scoring and wicket events", async ({
    page,
  }) => {
    test.setTimeout(300000); // 5 minutes for a 2-over match

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

    const squadInputs = page.getByPlaceholder(/Enter player name/i);
    // CHICAGO SPARTANS Squad
    await squadInputs
      .nth(0)
      .fill(
        "eega\nraju\nsunil\nraju\nsandy\nsrinath\ndonny\nparth\nsrini\nsrikanth\neega",
      );
    // SHARK BLUE Squad
    await squadInputs
      .nth(1)
      .fill(
        "yaswanth\ngopi\navinash\ngabriel\nsagar\namogh\nambarasan\ntejas\nraj\nsakthikumar\nashvin",
      );

    // Set 2 Over match
    await page.locator('input[type="number"]').first().fill("2");

    // Click to make SHARK BLUE bat first
    await page.getByRole("button", { name: "SHARK BLUE" }).click();

    // Click "Start Fresh Match"
    const startButton = page.getByRole("button", {
      name: /Start Fresh Match/i,
    });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // --- INNINGS 1: SHARK BLUE BATTING ---
    await expect(
      page.getByRole("heading", { name: /SELECT STRIKER/i }),
    ).toBeVisible({ timeout: 15000 });

    // Select Openers
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

    // Select Bowler
    await expect(
      page.getByRole("heading", { name: /Opening Bowler/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /raju/i })
      .first()
      .click({ force: true });

    await expect(page.getByText(/Live Timeline/i).first()).toBeVisible({
      timeout: 15000,
    });

    // --- NEW: Test Change Batter ---
    console.log("Clicking Change Batter...");
    await page.getByRole("button", { name: "Change Batter" }).click();
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible();
    console.log("Clicking gopi...");
    await page
      .getByRole("button", { name: /gopi/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);
    console.log("Clicking Change Batter again...");
    await page.getByRole("button", { name: "Change Batter" }).click();
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible();
    console.log("Clicking yaswanth...");
    await page
      .getByRole("button", { name: /yaswanth/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // --- NEW: Test Change Bowler ---
    console.log("Clicking Change Bowler...");
    await page.getByRole("button", { name: "Change Bowler" }).click();
    await expect(
      page.getByRole("heading", { name: /(Next|Opening) Bowler/i }),
    ).toBeVisible();
    console.log("Clicking eega...");
    await page
      .getByRole("button", { name: /eega/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);
    console.log("Clicking Change Bowler again...");
    await page.getByRole("button", { name: "Change Bowler" }).click();
    await expect(
      page.getByRole("heading", { name: /(Next|Opening) Bowler/i }),
    ).toBeVisible();
    console.log("Clicking raju...");
    await page
      .getByRole("button", { name: /raju/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // --- NEW: Test Undo ---
    console.log("Clicking 2 runs for Undo test...");
    await page
      .getByRole("button", { name: "2", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);
    console.log("Clicking Undo...");
    await page.getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(1000);

    console.log("Starting actual over...");
    // Ball 1.1: 2 runs
    await page
      .getByRole("button", { name: "2", exact: true })
      .first()
      .click({ force: true });
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
      .locator(".fixed")
      .getByRole("button", { name: "0", exact: true })
      .click();
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
    await page.getByRole("button", { name: /BOWLED/i }).click();
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /avinash/i })
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
      .locator(".fixed")
      .getByRole("button", { name: "0", exact: true })
      .click();
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
      .locator(".fixed")
      .getByRole("button", { name: "1", exact: true })
      .click();
    await page.waitForTimeout(1000);

    // End of Over 1. Select New Bowler.
    await expect(
      page.getByRole("heading", { name: /Next Bowler/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /eega/i })
      .first()
      .click({ force: true });

    // Ball 2.1: 3 runs
    await page
      .getByRole("button", { name: "3", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.2: CAUGHT
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await page.getByRole("button", { name: /CAUGHT/i }).click();
    await expect(
      page.getByRole("heading", { name: /Who took the catch\?/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /sandy/i })
      .first()
      .click({ force: true }); // Fielder
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /gabriel/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.3: LBW
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await page.getByRole("button", { name: /LBW/i }).click();
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /sagar/i })
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
    ).toBeVisible();
    await page
      .locator(".fixed")
      .getByRole("button", { name: "1", exact: true })
      .click();
    await page.waitForTimeout(1000);

    // Ball 2.5: STUMPED
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await page.getByRole("button", { name: /STUMPED/i }).click();
    await expect(
      page.getByRole("heading", { name: /Who performed the stumping\?/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /srinath/i })
      .first()
      .click({ force: true }); // Fielder
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /amogh/i })
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
    await page.getByRole("button", { name: /START 2ND INNINGS/i }).click();

    // --- INNINGS 2: CHICAGO SPARTANS BATTING ---
    await expect(
      page.getByRole("heading", { name: /SELECT STRIKER/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /eega/i })
      .first()
      .click({ force: true });

    await expect(
      page.getByRole("heading", { name: /SELECT NON-STRIKER/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /raju/i })
      .first()
      .click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Opening Bowler/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /yaswanth/i })
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
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await page.getByRole("button", { name: /HIT WICKET/i }).click();
    await expect(
      page.getByText(/Select (New Batter|Striker|Non-Striker)/i),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /sunil/i })
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
    await page
      .getByRole("button", { name: "W", exact: true })
      .first()
      .click({ force: true });
    await page.getByRole("button", { name: /RUN OUT/i }).click();
    await expect(page.getByText(/Runs completed before/i)).toBeVisible();
    await page
      .locator(".fixed")
      .getByRole("button", { name: "1", exact: true })
      .click();
    await expect(page.getByText(/Who was Run Out/i)).toBeVisible();
    await page
      .getByRole("button", { name: /sunil/i })
      .first()
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: /Who performed the run out\?/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /gopi/i })
      .first()
      .click({ force: true });
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /sandy/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Between balls: Retire Striker -> RETIRED HURT
    await page
      .getByRole("button", { name: "Retire" })
      .first()
      .click({ force: true });
    await expect(page.getByText("Retire Batsman")).toBeVisible();
    await page.locator("button").filter({ hasText: "Retired Hurt" }).click();
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /srinath/i })
      .first()
      .click({ force: true });
    // Wait for modal overlay to fully dismiss (CSS animate-in fade-in 300ms)
    await page
      .waitForSelector(".fixed.inset-0", { state: "hidden", timeout: 5000 })
      .catch(() => {});
    await page.waitForTimeout(500);

    // Ball 1.5: 6 runs (Score: 11)
    await page
      .getByRole("button", { name: "6", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 1.6: 0 runs
    await page
      .getByRole("button", { name: "0", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // End of Over 1. Select New Bowler.
    await expect(
      page.getByRole("heading", { name: /Next Bowler/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /avinash/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Between overs: Retire Striker -> RETIRED OUT
    await page
      .getByRole("button", { name: "Retire" })
      .first()
      .click({ force: true });
    await expect(page.getByText("Retire Batsman")).toBeVisible();
    await page.locator("button").filter({ hasText: "Retired Out" }).click();
    await expect(
      page.getByRole("heading", {
        name: /Select (New Batter|Striker|Non-Striker)/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /raju/i })
      .first()
      .click({ force: true });
    // Wait for modal overlay to fully dismiss
    await page
      .waitForSelector(".fixed.inset-0", { state: "hidden", timeout: 5000 })
      .catch(() => {});
    await page.waitForTimeout(500);

    // Ball 2.1: 2 runs (added to adjust target due to 2 runs in 1st innings)
    await page
      .getByRole("button", { name: "2", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.2: 4 runs (Score: 15)
    await page
      .getByRole("button", { name: "4", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.3: 1 run (Score: 16)
    await page
      .getByRole("button", { name: "1", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.4: 1 run (Score: 17)
    await page
      .getByRole("button", { name: "1", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Ball 2.5: 1 run (Score: 18)
    await page
      .getByRole("button", { name: "1", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(1000);

    // Target is 24, score is 18. They need 6 runs off 1 ball.
    // Ball 2.6: 6 runs! MATCH WON.
    await page
      .getByRole("button", { name: "6", exact: true })
      .first()
      .click({ force: true });
    await page.waitForTimeout(2000);

    // Assert Chicago Spartans won
    await expect(page.getByText(/CHICAGO SPARTANS WON/i)).toBeVisible({
      timeout: 15000,
    });
  });
});
