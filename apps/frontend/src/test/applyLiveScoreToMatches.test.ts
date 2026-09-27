import { describe, it, expect } from "vitest";
import {
  applyLiveScoreToMatches,
  unwrapLiveScoreMessage,
  isScoreEventType,
  isHubRefreshType,
  MatchListItem,
} from "../utils/applyLiveScoreToMatches";

const matches: MatchListItem[] = [
  {
    id: "f5a1f6d4-b4d5-4568-992d-9403d1e2a532",
    team_a_name: "TEAM A",
    team_b_name: "TEAM B",
    updated_at: "2026-09-26T00:00:00.000Z",
    innings: [
      {
        id: "inn-1",
        batting_team_name: "TEAM A",
        total_runs: 9,
        total_wickets: 0,
        overs: 1,
        balls: 0,
      },
      {
        id: "inn-2",
        batting_team_name: "TEAM B",
        total_runs: 2,
        total_wickets: 0,
        overs: 0,
        balls: 4,
      },
    ],
  },
];

describe("unwrapLiveScoreMessage", () => {
  it("reads the broadcaster { type, data } envelope", () => {
    const unwrapped = unwrapLiveScoreMessage({
      type: "LIVE_SCORE_UPDATE",
      data: {
        matchId: "abc",
        inningId: "inn-2",
        explicitTotalRuns: 3,
      },
    });
    expect(unwrapped?.type).toBe("LIVE_SCORE_UPDATE");
    expect(unwrapped?.payload.matchId).toBe("abc");
    expect(unwrapped?.payload.explicitTotalRuns).toBe(3);
  });

  it("unwraps a double-nested data payload", () => {
    const unwrapped = unwrapLiveScoreMessage({
      type: "LIVE_SCORE_UPDATE",
      data: {
        type: "LIVE_SCORE_UPDATE",
        data: {
          matchId: "abc",
          explicitTotalRuns: 4,
        },
      },
    });
    expect(unwrapped?.payload.matchId).toBe("abc");
    expect(unwrapped?.payload.explicitTotalRuns).toBe(4);
  });
});

describe("applyLiveScoreToMatches", () => {
  it("patches the matching innings from a live score event", () => {
    const { matches: next, applied } = applyLiveScoreToMatches(matches, {
      matchId: "f5a1f6d4-b4d5-4568-992d-9403d1e2a532",
      inningId: "inn-2",
      explicitTotalRuns: 3,
      explicitTotalWickets: 0,
      currentOvers: 0,
      currentBalls: 5,
    });
    expect(applied).toBe(true);
    const innings = next[0].innings as { total_runs: number; balls: number }[];
    expect(innings[1].total_runs).toBe(3);
    expect(innings[1].balls).toBe(5);
    expect(innings[0].total_runs).toBe(9);
  });

  it("falls back to the current (last) innings when inning id is missing", () => {
    const { matches: next, applied } = applyLiveScoreToMatches(matches, {
      matchId: "f5a1f6d4-b4d5-4568-992d-9403d1e2a532",
      explicitTotalRuns: 6,
      currentOvers: 1,
      currentBalls: 0,
    });
    expect(applied).toBe(true);
    const innings = next[0].innings as { total_runs: number }[];
    expect(innings[1].total_runs).toBe(6);
  });

  it("parses innings when the API returned a JSON string", () => {
    const stringified: MatchListItem[] = [
      {
        ...matches[0],
        innings: JSON.stringify(matches[0].innings),
      },
    ];
    const { applied, matches: next } = applyLiveScoreToMatches(stringified, {
      matchId: matches[0].id,
      inningId: "inn-2",
      explicitTotalRuns: 8,
    });
    expect(applied).toBe(true);
    const innings = next[0].innings as { total_runs: number }[];
    expect(innings[1].total_runs).toBe(8);
  });

  it("returns applied=false when the match is not on the hub list", () => {
    const { applied, matches: next } = applyLiveScoreToMatches(matches, {
      matchId: "missing",
      explicitTotalRuns: 10,
    });
    expect(applied).toBe(false);
    expect(next).toBe(matches);
  });
});

describe("event type helpers", () => {
  it("recognizes score and hub events", () => {
    expect(isScoreEventType("LIVE_SCORE_UPDATE")).toBe(true);
    expect(isScoreEventType("STATE_SYNC")).toBe(true);
    expect(isHubRefreshType("HUB_UPDATE")).toBe(true);
    expect(isHubRefreshType("LIVE_SCORE_UPDATE")).toBe(false);
  });
});
