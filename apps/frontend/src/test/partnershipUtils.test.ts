import { describe, it, expect } from "vitest";
import {
  getPartnerships,
  getCurrentPartnership,
} from "../utils/partnershipUtils";
import { BallEvent, ExtraType, WicketType } from "../types";

describe("partnershipUtils", () => {
  const createBall = (overrides: Partial<BallEvent> = {}): BallEvent => ({
    id: "ball-1",
    overNumber: 0,
    ballNumber: 1,
    batterName: "Virat Kohli",
    bowlerName: "Pat Cummins",
    runs: 1,
    isExtra: false,
    extraRuns: 0,
    extraType: ExtraType.NONE,
    isWicket: false,
    wicketType: WicketType.NONE,
    ...overrides,
  });

  it("returns empty array and default partnership when there are no balls", () => {
    expect(getPartnerships([])).toEqual([]);
    expect(getCurrentPartnership([])).toEqual({ runs: 0, balls: 0 });
  });

  it("calculates an unbroken opening partnership correctly", () => {
    const balls = [
      createBall({ runs: 4 }),
      createBall({ runs: 1 }),
      createBall({ runs: 6 }),
    ];

    const partnerships = getPartnerships(balls);
    expect(partnerships).toHaveLength(1);
    expect(partnerships[0]).toEqual({
      wicketNumber: 1,
      runs: 11,
      balls: 3,
      outBatterName: null,
    });

    const current = getCurrentPartnership(balls);
    expect(current.runs).toBe(11);
    expect(current.balls).toBe(3);
  });

  it("handles fall of wicket and starts a new partnership", () => {
    const balls = [
      createBall({ runs: 4 }),
      createBall({
        runs: 0,
        isWicket: true,
        wicketType: WicketType.BOWLED,
        batterName: "Rohit Sharma",
      }),
      createBall({ runs: 2, batterName: "Virat Kohli" }),
      createBall({ runs: 1, batterName: "Suryakumar Yadav" }),
    ];

    const partnerships = getPartnerships(balls);
    expect(partnerships).toHaveLength(2);

    // 1st wicket partnership
    expect(partnerships[0]).toEqual({
      wicketNumber: 1,
      runs: 4,
      balls: 2,
      outBatterName: "Rohit Sharma",
    });

    // 2nd wicket unbroken partnership
    expect(partnerships[1]).toEqual({
      wicketNumber: 2,
      runs: 3,
      balls: 2,
      outBatterName: null,
    });

    const current = getCurrentPartnership(balls);
    expect(current.runs).toBe(3);
    expect(current.balls).toBe(2);
  });

  it("does not count illegal deliveries (WIDE, NO_BALL) toward partnership legal balls", () => {
    const balls = [
      createBall({ runs: 0, extraRuns: 1, extraType: ExtraType.WIDE }),
      createBall({ runs: 1, extraRuns: 1, extraType: ExtraType.NO_BALL }),
      createBall({ runs: 4, extraRuns: 0, extraType: ExtraType.NONE }),
    ];

    const partnerships = getPartnerships(balls);
    expect(partnerships).toHaveLength(1);
    // Runs = 1 (wide) + 2 (no-ball + run) + 4 = 7
    // Legal balls = 1 (only the normal ball)
    expect(partnerships[0].runs).toBe(7);
    expect(partnerships[0].balls).toBe(1);
  });

  it("handles RETIRED_HURT without terminating the partnership or incrementing wicket count", () => {
    const balls = [
      createBall({ runs: 4 }),
      createBall({
        runs: 0,
        isWicket: true,
        wicketType: WicketType.RETIRED_HURT,
        batterName: "Rohit Sharma",
      }),
      createBall({ runs: 6, batterName: "Virat Kohli" }),
    ];

    const partnerships = getPartnerships(balls);
    expect(partnerships).toHaveLength(1);
    expect(partnerships[0].wicketNumber).toBe(1);
    expect(partnerships[0].runs).toBe(10);
    expect(partnerships[0].balls).toBe(2);
    expect(partnerships[0].outBatterName).toBeNull();
  });

  it("handles RETIRED_OUT as an official wicket termination", () => {
    const balls = [
      createBall({ runs: 10 }),
      createBall({
        runs: 0,
        isWicket: true,
        wicketType: WicketType.RETIRED_OUT,
        batterName: "Player A",
      }),
      createBall({ runs: 5, batterName: "Player B" }),
    ];

    const partnerships = getPartnerships(balls);
    expect(partnerships).toHaveLength(2);
    expect(partnerships[0].wicketNumber).toBe(1);
    expect(partnerships[0].runs).toBe(10);
    expect(partnerships[0].outBatterName).toBe("Player A");
    expect(partnerships[1].wicketNumber).toBe(2);
    expect(partnerships[1].runs).toBe(5);
  });
});
