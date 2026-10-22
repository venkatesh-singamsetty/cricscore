import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LiveScoreboard from "../components/LiveScoreboard";
import { ExtraType, WicketType } from "../types";

let mockLastMessage: any = null;

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    lastMessage: mockLastMessage,
    isConnected: true,
  }),
}));

vi.mock("../components/MatchList", () => ({
  default: () => <div data-testid="match-list">MatchList</div>,
}));

vi.mock("../components/AiMatchPrediction", () => ({
  AiMatchPrediction: () => <div data-testid="ai-prediction">AI Prediction</div>,
}));

global.fetch = vi.fn();

describe("LiveScoreboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLastMessage = null;
  });

  const buildInitialDetailsResponse = () => ({
    match: {
      id: "match_5b80826d",
      status: "LIVE",
      team_a_name: "CHICAGO SPARTANS",
      team_b_name: "ILLINOIS THUNDERS",
      total_overs: 1,
    },
    innings: [
      {
        id: "inn_1",
        inning_number: 1,
        batting_team_name: "ILLINOIS THUNDERS",
        bowling_team_name: "CHICAGO SPARTANS",
        total_runs: 8,
        total_wickets: 0,
        overs: 0,
        balls: 3,
        striker_name: "THUNDER 3",
        non_striker_name: "THUNDER 5",
        current_bowler_name: "SPARTAN 11",
        players: [
          {
            id: "p_t3",
            name: "THUNDER 3",
            runs: 8,
            balls_faced: 3,
            fours: 2,
            sixes: 0,
            is_out: false,
            batting_position: 1,
          },
          {
            id: "p_t5",
            name: "THUNDER 5",
            runs: 0,
            balls_faced: 0,
            fours: 0,
            sixes: 0,
            is_out: false,
            batting_position: 2,
          },
        ],
        bowlers: [
          {
            id: "b_s11",
            name: "SPARTAN 11",
            overs_completed: 0,
            balls: 3,
            maidens: 0,
            runs_conceded: 8,
            wickets: 0,
          },
        ],
        allBalls: [],
      },
    ],
  });

  it("attributes batter runs to ballData.batterName on odd-run strike rotation instead of inflating new striker", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => buildInitialDetailsResponse(),
    });

    const { rerender } = render(
      <LiveScoreboard initialMatchId="match_5b80826d" />,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/ILLINOIS THUNDERS/i).length).toBeGreaterThan(
        0,
      );
    });

    // Ball 4: THUNDER 3 hits 3 runs (reaches 11), strike rotates so strikerName is now THUNDER 5
    await act(async () => {
      mockLastMessage = {
        type: "LIVE_SCORE_UPDATE",
        data: {
          matchId: "match_5b80826d",
          inningId: "inn_1",
          battingTeamName: "ILLINOIS THUNDERS",
          strikerName: "THUNDER 5",
          nonStrikerName: "THUNDER 3",
          bowlerName: "SPARTAN 11",
          currentOvers: 0,
          currentBalls: 4,
          explicitTotalRuns: 11,
          explicitTotalWickets: 0,
          runs: 11,
          ballsFaced: 4,
          fours: 2,
          sixes: 0,
          bowlerRuns: 11,
          bowlerWickets: 0,
          bowlerOvers: 0,
          bowlerBalls: 4,
          ballData: {
            id: "ball_4",
            batterName: "THUNDER 3",
            bowlerName: "SPARTAN 11",
            runs: 3,
            isExtra: false,
            extraType: ExtraType.NONE,
            extraRuns: 0,
            isWicket: false,
            wicketType: WicketType.NONE,
            overNumber: 0,
            ballNumber: 4,
          },
        },
      };
      rerender(<LiveScoreboard initialMatchId="match_5b80826d" />);
    });

    // Ball 5: THUNDER 5 hits 1 run (reaches 1), strike rotates back to THUNDER 3
    await act(async () => {
      mockLastMessage = {
        type: "LIVE_SCORE_UPDATE",
        data: {
          matchId: "match_5b80826d",
          inningId: "inn_1",
          battingTeamName: "ILLINOIS THUNDERS",
          strikerName: "THUNDER 3",
          nonStrikerName: "THUNDER 5",
          bowlerName: "SPARTAN 11",
          currentOvers: 0,
          currentBalls: 5,
          explicitTotalRuns: 12,
          explicitTotalWickets: 0,
          runs: 1,
          ballsFaced: 1,
          fours: 0,
          sixes: 0,
          bowlerRuns: 12,
          bowlerWickets: 0,
          bowlerOvers: 0,
          bowlerBalls: 5,
          ballData: {
            id: "ball_5",
            batterName: "THUNDER 5",
            bowlerName: "SPARTAN 11",
            runs: 1,
            isExtra: false,
            extraType: ExtraType.NONE,
            extraRuns: 0,
            isWicket: false,
            wicketType: WicketType.NONE,
            overNumber: 0,
            ballNumber: 5,
          },
        },
      };
      rerender(<LiveScoreboard initialMatchId="match_5b80826d" />);
    });

    // Ball 6: THUNDER 3 hits 2 runs (reaches 13), end of over rotates strike to THUNDER 5
    await act(async () => {
      mockLastMessage = {
        type: "LIVE_SCORE_UPDATE",
        data: {
          matchId: "match_5b80826d",
          inningId: "inn_1",
          battingTeamName: "ILLINOIS THUNDERS",
          strikerName: "THUNDER 5",
          nonStrikerName: "THUNDER 3",
          bowlerName: "SPARTAN 11",
          currentOvers: 1,
          currentBalls: 0,
          explicitTotalRuns: 14,
          explicitTotalWickets: 0,
          runs: 13,
          ballsFaced: 5,
          fours: 2,
          sixes: 0,
          bowlerRuns: 14,
          bowlerWickets: 0,
          bowlerOvers: 1,
          bowlerBalls: 0,
          ballData: {
            id: "ball_6",
            batterName: "THUNDER 3",
            bowlerName: "SPARTAN 11",
            runs: 2,
            isExtra: false,
            extraType: ExtraType.NONE,
            extraRuns: 0,
            isWicket: false,
            wicketType: WicketType.NONE,
            overNumber: 0,
            ballNumber: 6,
          },
        },
      };
      rerender(<LiveScoreboard initialMatchId="match_5b80826d" />);
    });

    // Total must be 14/0, never 24/0
    expect(screen.getAllByText("14").length).toBeGreaterThan(0);
    expect(screen.queryByText("24")).toBeNull();
  });

  it("handles undo WebSocket messages by lowering innings totalRuns and overs/balls", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => buildInitialDetailsResponse(),
    });

    const { container, rerender } = render(
      <LiveScoreboard initialMatchId="match_5b80826d" />,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/ILLINOIS THUNDERS/i).length).toBeGreaterThan(
        0,
      );
    });

    await act(async () => {
      mockLastMessage = {
        type: "LIVE_SCORE_UPDATE",
        data: {
          matchId: "match_5b80826d",
          inningId: "inn_1",
          battingTeamName: "ILLINOIS THUNDERS",
          undo: true,
          strikerName: "THUNDER 3",
          nonStrikerName: "THUNDER 5",
          bowlerName: "SPARTAN 11",
          currentOvers: 0,
          currentBalls: 2,
          explicitTotalRuns: 4,
          explicitTotalWickets: 0,
          runs: 4,
          ballsFaced: 2,
          fours: 1,
          sixes: 0,
          bowlerRuns: 4,
          bowlerWickets: 0,
          bowlerOvers: 0,
          bowlerBalls: 2,
        },
      };
      rerender(<LiveScoreboard initialMatchId="match_5b80826d" />);
    });

    expect(container.textContent).toContain("0.2");
  });

  it("renders 2nd innings prominent header with single-line team name, target equation, and Scorecard button", async () => {
    const secondInningsResponse = {
      match: {
        id: "match_5b80826d",
        status: "LIVE",
        team_a_name: "CHICAGO SPARTANS",
        team_b_name: "ILLINOIS THUNDERS",
        total_overs: 1,
      },
      innings: [
        {
          id: "inn_1",
          inning_number: 1,
          batting_team_name: "CHICAGO SPARTANS",
          bowling_team_name: "ILLINOIS THUNDERS",
          total_runs: 11,
          total_wickets: 1,
          overs: 1,
          balls: 0,
          players: [],
          bowlers: [],
          allBalls: [],
        },
        {
          id: "inn_2",
          inning_number: 2,
          target: 12,
          batting_team_name: "ILLINOIS THUNDERS",
          bowling_team_name: "CHICAGO SPARTANS",
          total_runs: 10,
          total_wickets: 1,
          overs: 0,
          balls: 5,
          striker_name: "THUNDER 1",
          non_striker_name: "THUNDER 7",
          current_bowler_name: "SPARTAN 2",
          players: [
            {
              id: "p_t1",
              name: "THUNDER 1",
              runs: 7,
              balls_faced: 3,
              fours: 1,
              sixes: 0,
              is_out: false,
            },
            {
              id: "p_t7",
              name: "THUNDER 7",
              runs: 3,
              balls_faced: 2,
              fours: 0,
              sixes: 0,
              is_out: false,
            },
          ],
          bowlers: [
            {
              id: "b_s2",
              name: "SPARTAN 2",
              overs_completed: 0,
              balls: 5,
              maidens: 0,
              runs_conceded: 10,
              wickets: 1,
            },
          ],
          allBalls: [],
        },
      ],
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => secondInningsResponse,
    });

    render(<LiveScoreboard initialMatchId="match_5b80826d" />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /ILLINOIS THUNDERS/i }),
      ).toBeInTheDocument();
    });

    // Scorecard button is present
    expect(
      screen.getByRole("button", { name: /Scorecard 📋/i }),
    ).toBeInTheDocument();

    // Target equation
    expect(screen.getByText(/Need 2 off 1/i)).toBeInTheDocument();
    expect(screen.getByText(/\(Tgt 12\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1st Inn: CHICAGO SPARTANS/i)).toBeInTheDocument();
  });
});
