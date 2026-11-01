import { describe, it, expect } from "vitest";
import {
  getTeamBrandColor,
  getTeamGlow,
  TEAM_BRAND_COLORS,
} from "../utils/teamColorUtils";

describe("teamColorUtils", () => {
  it("assigns TEAM_1 color to matchTeamA and TEAM_2 color to matchTeamB generically", () => {
    expect(getTeamBrandColor("India", "India", "Australia")).toBe(
      TEAM_BRAND_COLORS.TEAM_1,
    );
    expect(getTeamBrandColor("Australia", "India", "Australia")).toBe(
      TEAM_BRAND_COLORS.TEAM_2,
    );
  });

  it("handles Chicago Spartans and Midwest Gladiators fallback", () => {
    expect(getTeamBrandColor("CHICAGO SPARTANS")).toBe(
      TEAM_BRAND_COLORS.TEAM_1,
    );
    expect(getTeamBrandColor("MIDWEST GLADIATORS")).toBe(
      TEAM_BRAND_COLORS.TEAM_2,
    );
  });

  it("provides matching glow effects", () => {
    expect(getTeamGlow(TEAM_BRAND_COLORS.TEAM_1)).toContain("0,210,255");
    expect(getTeamGlow(TEAM_BRAND_COLORS.TEAM_2)).toContain("251,191,36");
  });
});
