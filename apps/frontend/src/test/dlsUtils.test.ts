import { describe, it, expect } from "vitest";
import { calculateDlsResource, calculateDlsParScore } from "../utils/dlsUtils";

describe("DLS Utility (calculateDlsResource & calculateDlsParScore)", () => {
  it("calculates 100% resource at the start of an innings for any match length", () => {
    for (const overs of [1, 2, 5, 10, 15, 20]) {
      expect(calculateDlsResource(overs, 0, overs)).toBeCloseTo(100.0, 5);
    }
  });

  it("matches the published Standard Edition 0-wicket curve (relative to 50 overs)", () => {
    expect(calculateDlsResource(20, 0, 50)).toBeCloseTo(56.6, 0);
    expect(calculateDlsResource(10, 0, 50)).toBeCloseTo(32.1, 0);
    expect(calculateDlsResource(5, 0, 50)).toBeCloseTo(17.2, 0);
  });

  it("reproduces the published 50-over row for wickets lost", () => {
    expect(calculateDlsResource(50, 3, 50)).toBeCloseTo(74.9, 1);
    expect(calculateDlsResource(50, 9, 50)).toBeCloseTo(4.7, 1);
  });

  it("calculates lower resource when wickets are lost", () => {
    const res0 = calculateDlsResource(10, 0);
    const res2 = calculateDlsResource(10, 2);
    const res5 = calculateDlsResource(10, 5);

    expect(res2).toBeLessThan(res0);
    expect(res5).toBeLessThan(res2);
    expect(calculateDlsResource(10, 10)).toBe(0);
  });

  it("is continuous (no jump after the first ball of a 20-over chase)", () => {
    // Old model jumped from 100% to ~91.6% after one ball (par 13 off 1 ball).
    const dls = calculateDlsParScore(160, 0, 0, 1, 20);
    expect(dls.parScore).toBeLessThanOrEqual(2);
  });

  it("scales par proportionally in a 1-over match", () => {
    // 1-over match, 1st innings 24. After 3 balls with no wicket, par ~ half.
    const dls = calculateDlsParScore(24, 12, 0, 3, 1);
    expect(dls.parScore).toBeGreaterThanOrEqual(11);
    expect(dls.parScore).toBeLessThanOrEqual(13);
    // Full allocation bowled -> par equals team 1 score
    expect(calculateDlsParScore(24, 20, 0, 6, 1).parScore).toBe(24);
  });

  it("works for 5 and 10 over matches", () => {
    const five = calculateDlsParScore(60, 30, 1, 15, 5);
    expect(five.parScore).toBeGreaterThan(25);
    expect(five.parScore).toBeLessThan(40);
    const ten = calculateDlsParScore(100, 50, 2, 30, 10);
    expect(ten.parScore).toBeGreaterThan(45);
    expect(ten.parScore).toBeLessThan(65);
  });

  it("correctly identifies Team 2 ahead of DLS Par Score", () => {
    // Team 1: 160 in 20 overs. Team 2: 90/2 after 10 overs.
    const dls = calculateDlsParScore(160, 90, 2, 60, 20);
    expect(dls.parScore).toBeGreaterThan(70);
    expect(dls.parScore).toBeLessThan(85);
    expect(dls.isAhead).toBe(true);
    expect(dls.isTied).toBe(false);
    expect(dls.statusText).toContain("AHEAD BY");
  });

  it("correctly identifies Team 2 behind DLS Par Score", () => {
    const dls = calculateDlsParScore(160, 40, 4, 60, 20);

    expect(dls.isAhead).toBe(false);
    expect(dls.isTied).toBe(false);
    expect(dls.statusText).toContain("BEHIND BY");
  });

  it("correctly identifies DLS Par Score tie", () => {
    const par = calculateDlsParScore(160, 0, 2, 60, 20).parScore;
    const dls = calculateDlsParScore(160, par, 2, 60, 20);

    expect(dls.isTied).toBe(true);
    expect(dls.isAhead).toBe(false);
    expect(dls.statusText).toBe("PAR SCORE TIED (DLS)");
  });
});
