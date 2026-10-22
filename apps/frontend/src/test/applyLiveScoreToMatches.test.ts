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

  it("unwraps a direct lambda invocation payload with event.body", () => {
    const unwrapped = unwrapLiveScoreMessage({
      type: "LIVE_SCORE_UPDATE",
      data: {
        body: JSON.stringify({
          matchId: "hub-match-123",
          type: "HUB_UPDATE",
          syncOnly: true,
        }),
      },
    });
    expect(unwrapped?.type).toBe("HUB_UPDATE");
    expect(unwrapped?.payload.matchId).toBe("hub-match-123");
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

  it("does not double-count ballData runs when explicitTotalRuns is already provided", () => {
    const { applied, matches: next } = applyLiveScoreToMatches(matches, {
      matchId: matches[0].id,
      inningId: "inn-2",
      explicitTotalRuns: 6,
      currentOvers: 0,
      currentBalls: 5,
      ballData: {
        runs: 4,
        isExtra: false,
        overNumber: 0,
        ballNumber: 5,
      },
    });
    expect(applied).toBe(true);
    const innings = next[0].innings as { total_runs: number; balls: number }[];
    expect(innings[1].total_runs).toBe(6);
    expect(innings[1].balls).toBe(5);
  });

  it("decrements total_runs and balls when undo=true is received", () => {
    const { applied, matches: next } = applyLiveScoreToMatches(matches, {
      matchId: matches[0].id,
      inningId: "inn-2",
      explicitTotalRuns: 1,
      explicitTotalWickets: 0,
      currentOvers: 0,
      currentBalls: 3,
      undo: true,
      syncOnly: true,
    });
    expect(applied).toBe(true);
    const innings = next[0].innings as { total_runs: number; balls: number }[];
    expect(innings[1].total_runs).toBe(1);
    expect(innings[1].balls).toBe(3);
  });

  it("returns applied=false when 2nd innings battingTeam is not yet present in match.innings", () => {
    const singleInningMatches: MatchListItem[] = [
      {
        ...matches[0],
        innings: [
          {
            id: "inn-1",
            batting_team_name: "TEAM A",
            total_runs: 12,
            total_wickets: 0,
            overs: 1,
            balls: 0,
          },
        ],
      },
    ];
    const { applied, matches: next } = applyLiveScoreToMatches(
      singleInningMatches,
      {
        matchId: matches[0].id,
        inningId: "inn2_temp",
        battingTeamName: "TEAM B",
        explicitTotalRuns: 4,
        currentOvers: 0,
        currentBalls: 1,
      },
    );
    expect(applied).toBe(false);
    expect(next).toBe(singleInningMatches);
  });

  it("reconciles Innings 1 from previousInnings and appends 2nd innings when inningNumber=2 is provided", () => {
    const staleSingleInning: MatchListItem[] = [
      {
        id: matches[0].id,
        status: "LIVE",
        total_overs: 2,
        team_a_name: "TEAM A",
        team_b_name: "TEAM B",
        innings: [
          {
            id: "inn-1",
            inning_number: 1,
            batting_team_name: "TEAM B",
            total_runs: 13,
            total_wickets: 0,
            overs: 0,
            balls: 3,
          },
        ],
      },
    ];

    const { applied, matches: next } = applyLiveScoreToMatches(
      staleSingleInning,
      {
        matchId: matches[0].id,
        inningId: "inn2_temp",
        inningNumber: 2,
        battingTeamName: "TEAM A",
        explicitTotalRuns: 4,
        explicitTotalWickets: 0,
        currentOvers: 0,
        currentBalls: 1,
        previousInnings: {
          id: "inn-1",
          battingTeamName: "TEAM B",
          totalRuns: 25,
          totalWickets: 4,
          overs: 2,
          balls: 0,
        },
      },
    );

    expect(applied).toBe(true);
    const innings = next[0].innings as {
      batting_team_name: string;
      total_runs: number;
      total_wickets: number;
      overs: number;
      balls: number;
    }[];
    expect(innings).toHaveLength(2);
    expect(innings[0].batting_team_name).toBe("TEAM B");
    expect(innings[0].total_runs).toBe(25);
    expect(innings[0].total_wickets).toBe(4);
    expect(innings[0].overs).toBe(2);
    expect(innings[0].balls).toBe(0);
    expect(innings[1].batting_team_name).toBe("TEAM A");
    expect(innings[1].total_runs).toBe(4);
    expect(innings[1].balls).toBe(1);
  });

  it("automatically transitions match status to COMPLETED when 2nd innings chases target", () => {
    const liveSecondInnings: MatchListItem[] = [
      {
        id: matches[0].id,
        status: "LIVE",
        total_overs: 2,
        team_a_name: "TEAM A",
        team_b_name: "TEAM B",
        innings: [
          {
            id: "inn-1",
            inning_number: 1,
            batting_team_name: "TEAM B",
            total_runs: 25,
            total_wickets: 4,
            overs: 2,
            balls: 0,
          },
          {
            id: "inn-2",
            inning_number: 2,
            batting_team_name: "TEAM A",
            total_runs: 22,
            total_wickets: 3,
            overs: 1,
            balls: 5,
          },
        ],
      },
    ];

    const { applied, matches: next } = applyLiveScoreToMatches(
      liveSecondInnings,
      {
        matchId: matches[0].id,
        inningId: "inn-2",
        inningNumber: 2,
        battingTeamName: "TEAM A",
        explicitTotalRuns: 26,
        explicitTotalWickets: 3,
        currentOvers: 2,
        currentBalls: 0,
        matchCompleted: true,
      },
    );

    expect(applied).toBe(true);
    expect(next[0].status).toBe("COMPLETED");
    const innings = next[0].innings as { total_runs: number; overs: number }[];
    expect(innings[1].total_runs).toBe(26);
    expect(innings[1].overs).toBe(2);
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
