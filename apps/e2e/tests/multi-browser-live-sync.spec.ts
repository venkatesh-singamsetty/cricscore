import { test, expect } from "@playwright/test";

test.describe("Multi-Browser Real-Time Live Score Sync", () => {
  test("should synchronize live ball events, boundaries, and undo across independent scorer and spectator browser contexts in real-time", async ({
    browser,
  }) => {
    test.setTimeout(120000); // 2 minutes

    const baseURL =
      process.env.BASE_URL || "https://cricscoredev.venkateshsingamsetty.com";

    // 1. Create two isolated browser contexts (simulating two distinct users on separate devices)
    const scorerContext = await browser.newContext({ baseURL });
    const spectatorContext = await browser.newContext({ baseURL });

    const scorerPage = await scorerContext.newPage();
    const spectatorPage = await spectatorContext.newPage();

    let createdMatchId: string | null = null;
    scorerPage.on("response", async (response) => {
      if (
        response.url().includes("/match") &&
        response.request().method() === "POST"
      ) {
        try {
          const data = await response.json();
          if (data && data.matchId) {
            createdMatchId = data.matchId;
          }
        } catch {
          // ignore non-json or unparseable response
        }
      }
    });

    const uniqueId = Date.now().toString().slice(-4);
    const teamA = `SYNC TIGERS ${uniqueId}`;
    const teamB = `SYNC LIONS ${uniqueId}`;

    try {
      // 2. Scorer setup: Open site, enter Guest Mode, configure 1-over match
      await scorerPage.goto(baseURL);
      await scorerPage
        .getByRole("button", { name: /SCORER/i })
        .click({ force: true });

      const guestBtn = scorerPage.getByRole("button", {
        name: /Continue as Guest/i,
      });
      await expect(guestBtn).toBeVisible({ timeout: 15000 });
      await guestBtn.click({ force: true });

      await expect(
        scorerPage.getByRole("heading", { name: /Match Configuration/i }),
      ).toBeVisible({ timeout: 15000 });

      // Configure Teams & Overs
      const desktopLayout = scorerPage.locator(".hidden.md\\:flex");
      const teamInputs = desktopLayout.locator('input[type="text"][required]');
      await teamInputs.nth(0).fill(teamA);
      await teamInputs.nth(1).fill(teamB);

      // Fill Rosters
      const squadInputs = desktopLayout.getByPlaceholder(/Enter player name/i);
      await squadInputs
        .nth(0)
        .fill(
          "Tiger 1\nTiger 2\nTiger 3\nTiger 4\nTiger 5\nTiger 6\nTiger 7\nTiger 8\nTiger 9\nTiger 10\nTiger 11",
        );
      await squadInputs
        .nth(1)
        .fill(
          "Lion 1\nLion 2\nLion 3\nLion 4\nLion 5\nLion 6\nLion 7\nLion 8\nLion 9\nLion 10\nLion 11",
        );

      // Set 1 Over
      await desktopLayout
        .locator('input[inputMode="numeric"]')
        .first()
        .fill("1");

      // Start Match
      const startBtn = desktopLayout.getByRole("button", {
        name: /Start Fresh Match/i,
      });
      await expect(startBtn).toBeEnabled();
      await startBtn.click({ force: true });

      // Pick Openers & Bowler
      await expect(
        scorerPage.getByRole("heading", { name: /SELECT STRIKER/i }),
      ).toBeVisible({ timeout: 15000 });
      await scorerPage
        .getByRole("button", { name: /Tiger 1/i })
        .first()
        .click({ force: true });

      await expect(
        scorerPage
          .getByRole("heading", { name: /SELECT NON-STRIKER/i })
          .first(),
      ).toBeVisible();
      await scorerPage
        .getByRole("button", { name: /Tiger 2/i })
        .first()
        .click({ force: true });

      await expect(
        scorerPage.getByRole("heading", { name: /Opening Bowler/i }).first(),
      ).toBeVisible();
      await scorerPage
        .getByRole("button", { name: /Lion 1/i })
        .first()
        .click({ force: true });

      // Scorer should now be on the live match cockpit
      await expect(
        scorerPage.getByText(/Live Timeline|This Over/i).first(),
      ).toBeVisible({ timeout: 15000 });
      await expect(scorerPage.getByText(/0\/0/).first()).toBeVisible();

      // 3. Spectator setup: Open spectator view in second browser context
      await spectatorPage.goto(baseURL);
      await expect(spectatorPage).toHaveTitle(/CricScore/i);

      // Locate the newly created match card in MatchList and click into LiveScoreboard
      const matchCard = spectatorPage.getByText(new RegExp(teamA, "i")).first();
      await expect(matchCard).toBeVisible({ timeout: 15000 });
      await matchCard.click({ force: true });

      // Spectator is now on LiveScoreboard viewing the match
      await expect(
        spectatorPage.getByText(new RegExp(teamA, "i")).first(),
      ).toBeVisible({
        timeout: 15000,
      });
      await expect(spectatorPage.getByText(/0\/0/).first()).toBeVisible({
        timeout: 10000,
      });

      // 4. Scorer scores a FOUR (4 runs)
      console.log("Scorer delivering Ball 1: 4 runs...");
      const fourBtn = scorerPage.getByRole("button", {
        name: "4",
        exact: true,
      });
      await expect(fourBtn).toBeEnabled();
      await fourBtn.click({ force: true });

      // Verify Scorer page reflects 4/0
      await expect(scorerPage.getByText(/4\/0/).first()).toBeVisible({
        timeout: 10000,
      });

      // Verify Spectator page reflects 4/0 via WebSocket in real-time (WITHOUT page refresh)
      console.log(
        "Asserting Spectator page receives real-time WebSocket update for 4/0...",
      );
      await expect(spectatorPage.getByText(/4\/0/).first()).toBeVisible({
        timeout: 15000,
      });

      // 5. Scorer scores a SINGLE (1 run)
      console.log("Scorer delivering Ball 2: 1 run...");
      await scorerPage.waitForTimeout(1000);
      const oneBtn = scorerPage.getByRole("button", { name: "1", exact: true });
      await expect(oneBtn).toBeEnabled();
      await oneBtn.click({ force: true });

      // Verify Scorer page reflects 5/0
      await expect(scorerPage.getByText(/5\/0/).first()).toBeVisible({
        timeout: 10000,
      });

      // Verify Spectator page reflects 5/0 via WebSocket in real-time
      console.log(
        "Asserting Spectator page receives real-time WebSocket update for 5/0...",
      );
      await expect(spectatorPage.getByText(/5\/0/).first()).toBeVisible({
        timeout: 15000,
      });

      // 6. Scorer clicks UNDO
      console.log("Scorer clicking Undo...");
      await scorerPage.waitForTimeout(1000);
      const undoBtn = scorerPage.getByRole("button", { name: "Undo" });
      await expect(undoBtn).toBeEnabled();
      await undoBtn.click({ force: true });

      // Verify Scorer page reverts to 4/0
      await expect(scorerPage.getByText(/4\/0/).first()).toBeVisible({
        timeout: 10000,
      });

      // Verify Spectator page reverts to 4/0 in real-time
      console.log(
        "Asserting Spectator page reverts to 4/0 via WebSocket in real-time...",
      );
      await expect(spectatorPage.getByText(/4\/0/).first()).toBeVisible({
        timeout: 15000,
      });

      console.log(
        "✅ Multi-browser real-time live synchronization verified successfully!",
      );
    } finally {
      if (createdMatchId) {
        try {
          console.log(`Cleaning up test match ${createdMatchId}...`);
          const authData = await scorerPage.evaluate(() => {
            const keys = Object.keys(localStorage);
            const idTokenKey = keys.find(
              (key) => key.endsWith(".idToken") || key.includes("idToken"),
            );
            return idTokenKey ? localStorage.getItem(idTokenKey) : null;
          });
          const apiUrl =
            process.env.API_URL ||
            "https://api.cricscoredev.venkateshsingamsetty.com";
          const deleteRes = await scorerPage.request.delete(
            `${apiUrl}/match/${createdMatchId}`,
            {
              headers: authData ? { Authorization: `Bearer ${authData}` } : {},
            },
          );
          console.log(
            `Test match ${createdMatchId} cleanup response: ${deleteRes.status()}`,
          );
        } catch (cleanupErr) {
          console.warn("Test match cleanup warning:", cleanupErr);
        }
      }
      await scorerContext.close();
      await spectatorContext.close();
    }
  });
});
