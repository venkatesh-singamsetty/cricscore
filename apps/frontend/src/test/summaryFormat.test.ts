import { describe, expect, it } from "vitest";
import { getPartnerships } from "../utils/partnershipUtils";
import { ExtraType, WicketType } from "../types";
import { stripPlayerOfMatchLine } from "../utils/summaryFormat";

describe("stripPlayerOfMatchLine", () => {
  it("removes the leading trophy POM line", () => {
    const input =
      "🏆 Player of the Match: Player B3 - scored 5 runs off 2 balls\n\nTEAM A won the toss.";
    expect(stripPlayerOfMatchLine(input)).toBe("TEAM A won the toss.");
  });

  describe("getPartnerships retirement events", () => {
    it("does not count retired hurt as a wicket or a legal ball", () => {
      const partnerships = getPartnerships([
        {
          id: "retired-hurt",
          bowlerName: "Bowler",
          batterName: "Batter 1",
          runs: 0,
          isExtra: false,
          extraType: ExtraType.NONE,
          extraRuns: 0,
          isWicket: true,
          wicketType: WicketType.RETIRED_HURT,
          overNumber: 0,
          ballNumber: 1,
        },
        {
          id: "delivery",
          bowlerName: "Bowler",
          batterName: "Batter 2",
          runs: 1,
          isExtra: false,
          extraType: ExtraType.NONE,
          extraRuns: 0,
          isWicket: false,
          wicketType: WicketType.NONE,
          overNumber: 0,
          ballNumber: 1,
        },
      ]);

      expect(partnerships).toEqual([
        {
          wicketNumber: 1,
          runs: 1,
          balls: 1,
          outBatterName: null,
        },
      ]);
    });

    it("counts retired out as a wicket but not as a legal ball", () => {
      const partnerships = getPartnerships([
        {
          id: "retired-out",
          bowlerName: "Bowler",
          batterName: "Batter 1",
          runs: 0,
          isExtra: false,
          extraType: ExtraType.NONE,
          extraRuns: 0,
          isWicket: true,
          wicketType: WicketType.RETIRED_OUT,
          overNumber: 0,
          ballNumber: 1,
        },
      ]);

      expect(partnerships).toEqual([
        {
          wicketNumber: 1,
          runs: 0,
          balls: 0,
          outBatterName: "Batter 1",
        },
      ]);
    });
  });

  it("removes markdown-bold POM lines", () => {
    expect(
      stripPlayerOfMatchLine("Great game.\n**Player of the Match:** X"),
    ).toBe("Great game.");
  });

  it("keeps summaries without a POM line intact", () => {
    expect(stripPlayerOfMatchLine("Team B won by 10 wickets.")).toBe(
      "Team B won by 10 wickets.",
    );
  });
});
