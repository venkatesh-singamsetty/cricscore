import { describe, it, expect } from "vitest";
import {
  calculateStrikeRate,
  calculateStrikeRateNumber,
  calculateEconomy,
  calculateEconomyNumber,
  resolvePOTM,
} from "../utils/scorecardUtils";
import { InningsState } from "../types";

describe("scorecardUtils", () => {
  describe("calculateStrikeRate & calculateStrikeRateNumber", () => {
    it("safely handles 0 runs off 0 balls without returning NaN", () => {
      expect(calculateStrikeRate(0, 0)).toBe("-");
      expect(calculateStrikeRate(0, 0, "0.0")).toBe("0.0");
      expect(calculateStrikeRateNumber(0, 0)).toBe(0);
    });

    it("handles null and undefined values safely", () => {
      expect(calculateStrikeRate(null, null)).toBe("-");
      expect(calculateStrikeRate(undefined, 0)).toBe("-");
      expect(calculateStrikeRate(10, undefined)).toBe("-");
      expect(calculateStrikeRateNumber(null, undefined)).toBe(0);
    });

    it("computes accurate strike rates formatted to one decimal place", () => {
      expect(calculateStrikeRate(25, 20)).toBe("125.0");
      expect(calculateStrikeRate(47, 31)).toBe("151.6");
      expect(calculateStrikeRate(6, 1)).toBe("600.0");
      expect(calculateStrikeRate(0, 5)).toBe("0.0");
    });
  });

  describe("calculateEconomy & calculateEconomyNumber", () => {
    it("safely handles 0 overs and 0 balls without returning NaN", () => {
      expect(calculateEconomy(0, 0, 0)).toBe("-");
      expect(calculateEconomy(10, 0, 0)).toBe("-");
      expect(calculateEconomyNumber(0, 0, 0)).toBe(0);
    });

    it("computes accurate economy rates including partial overs", () => {
      // 20 runs in 4.0 overs -> 5.0
      expect(calculateEconomy(20, 4, 0)).toBe("5.0");
      expect(calculateEconomyNumber(20, 4, 0)).toBe(5);

      // 10 runs in 1.3 overs (1.5 overs total) -> 6.7
      expect(calculateEconomy(10, 1, 3)).toBe("6.7");

      // 0 runs conceded in 2 overs -> 0.0
      expect(calculateEconomy(0, 2, 0)).toBe("0.0");
    });
  });

  describe("resolvePOTM", () => {
    it("returns the fallback POTM if already provided", () => {
      const explicit = "Player X - 50 (20b)";
      expect(resolvePOTM([], explicit)).toBe(explicit);
    });

    it("returns null if no innings are provided or no active stats", () => {
      expect(resolvePOTM([])).toBeNull();
      expect(resolvePOTM([null, undefined])).toBeNull();
    });

    it("correctly attributes bowling stats to the opposing team across innings", () => {
      // Inning 1: Team A bats, Team B bowls
      const inning1: InningsState = {
        id: "inn-1",
        inningNumber: 1,
        battingTeamName: "TEAM A",
        bowlingTeamName: "TEAM B",
        totalRuns: 60,
        totalWickets: 4,
        overs: 5,
        balls: 0,
        currentOver: [],
        allBalls: [],
        strikerId: "a1",
        nonStrikerId: "a2",
        currentBowlerId: "b1",
        battingOrder: ["a1", "a2"],
        bowlingOrder: ["b1"],
        players: {
          a1: {
            id: "a1",
            name: "Team A Batter",
            runs: 35,
            ballsFaced: 18,
            fours: 4,
            sixes: 1,
            isOut: false,
          },
        },
        bowlers: {
          b1: {
            id: "b1",
            name: "All-Rounder B",
            overs: 2,
            balls: 0,
            maidens: 1,
            runsConceded: 8,
            wickets: 3,
          },
        },
      };

      // Inning 2: Team B bats, Team A bowls
      const inning2: InningsState = {
        id: "inn-2",
        inningNumber: 2,
        battingTeamName: "TEAM B",
        bowlingTeamName: "TEAM A",
        totalRuns: 62,
        totalWickets: 1,
        overs: 4,
        balls: 2,
        currentOver: [],
        allBalls: [],
        strikerId: "b1",
        nonStrikerId: "b2",
        currentBowlerId: "a1",
        battingOrder: ["b1"],
        bowlingOrder: ["a1"],
        players: {
          b1: {
            id: "b1",
            name: "All-Rounder B",
            runs: 25,
            ballsFaced: 12,
            fours: 3,
            sixes: 1,
            isOut: false,
          },
        },
        bowlers: {
          a1: {
            id: "a1",
            name: "Team A Batter",
            overs: 1,
            balls: 0,
            maidens: 0,
            runsConceded: 15,
            wickets: 0,
          },
        },
      };

      // All-Rounder B took 3/8 for Team B in Inning 1 (opposing team's bowling array)
      // and scored 25 for Team B in Inning 2.
      // resolvePOTM must link them together to Team B's All-Rounder B!
      const potm = resolvePOTM([inning1, inning2]);
      expect(potm).toBe("All-Rounder B - 25 (12b) & 3/8");
    });

    it("resolves top bowler when wickets dominate the match", () => {
      const inning: InningsState = {
        id: "inn-1",
        inningNumber: 1,
        battingTeamName: "TEAM A",
        bowlingTeamName: "TEAM B",
        totalRuns: 40,
        totalWickets: 5,
        overs: 5,
        balls: 0,
        currentOver: [],
        allBalls: [],
        strikerId: "a1",
        nonStrikerId: "a2",
        currentBowlerId: "b1",
        battingOrder: ["a1"],
        bowlingOrder: ["b1"],
        players: {
          a1: {
            id: "a1",
            name: "Batter A",
            runs: 10,
            ballsFaced: 10,
            fours: 1,
            sixes: 0,
            isOut: true,
          },
        },
        bowlers: {
          b1: {
            id: "b1",
            name: "Star Bowler",
            overs: 3,
            balls: 0,
            maidens: 1,
            runsConceded: 6,
            wickets: 4,
          },
        },
      };

      const potm = resolvePOTM([inning]);
      expect(potm).toBe("Star Bowler - TOOK 4 WICKETS FOR 6 RUNS");
    });
  });
});
