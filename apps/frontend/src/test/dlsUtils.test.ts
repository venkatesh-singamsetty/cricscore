import { describe, it, expect } from "vitest";
import { calculateDlsResource, calculateDlsParScore } from "../utils/dlsUtils";

describe("DLS Utility (calculateDlsResource & calculateDlsParScore)", () => {
  it("calculates 100% resource for 20 overs with 0 wickets lost", () => {
    const resource = calculateDlsResource(20, 0);
    expect(resource).toBeCloseTo(100.0, 1);
  });

  it("calculates lower resource when wickets are lost", () => {
    const res0 = calculateDlsResource(10, 0);
    const res2 = calculateDlsResource(10, 2);
    const res5 = calculateDlsResource(10, 5);

    expect(res2).toBeLessThan(res0);
    expect(res5).toBeLessThan(res2);
  });

  it("correctly identifies Team 2 ahead of DLS Par Score", () => {
    // Team 1: 160 runs in 20 overs.
    // Team 2: 75/2 after 10 overs (60 balls bowled out of 120 total). Par score = 57.
    const dls = calculateDlsParScore(160, 75, 2, 60, 20);

    expect(dls.parScore).toBe(57);
    expect(dls.isAhead).toBe(true);
    expect(dls.isTied).toBe(false);
    expect(dls.statusText).toContain("AHEAD BY 18 RUNS (DLS)");
  });

  it("correctly identifies Team 2 behind DLS Par Score", () => {
    // Team 1: 160 runs in 20 overs.
    // Team 2: 40/4 after 10 overs (60 balls bowled). Par score = 57.
    const dls = calculateDlsParScore(160, 40, 4, 60, 20);

    expect(dls.isAhead).toBe(false);
    expect(dls.isTied).toBe(false);
    expect(dls.statusText).toContain("BEHIND BY");
  });

  it("correctly identifies DLS Par Score tie", () => {
    // Team 1: 160 runs.
    // Team 2: Par score 57. Current score 57.
    const dls = calculateDlsParScore(160, 57, 2, 60, 20);

    expect(dls.parScore).toBe(57);
    expect(dls.isTied).toBe(true);
    expect(dls.isAhead).toBe(false);
    expect(dls.statusText).toBe("PAR SCORE TIED (DLS)");
  });
});
