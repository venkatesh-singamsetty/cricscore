import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MatchView from "../components/MatchView";
import { ExtraType, InningsState, WicketType } from "../types";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: { idToken: { toString: () => "mock-token" } },
  }),
}));

vi.mock("../components/AiMatchPrediction", () => ({
  AiMatchPrediction: () => <div data-testid="ai-prediction">AI Prediction</div>,
}));

global.fetch = vi.fn();

const createInningsState = (
  overrides: Partial<InningsState> = {},
): InningsState => ({
  id: "inn_1",
  inningNumber: 1,
  battingTeamName: "CHICAGO SPARTANS",
  bowlingTeamName: "ILLINOIS THUNDERS",
  totalRuns: 10,
  totalWickets: 0,
  overs: 0,
  balls: 5,
  strikerId: "p1",
  nonStrikerId: "p2",
  currentBowlerId: "b1",
  battingOrder: ["p1", "p2"],
  bowlingOrder: ["b1"],
  players: {
    p1: {
      id: "p1",
      name: "SPARTAN 1",
      runs: 10,
      ballsFaced: 5,
      fours: 2,
      sixes: 0,
      isOut: false,
    },
    p2: {
      id: "p2",
      name: "SPARTAN 2",
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
    },
  },
  bowlers: {
    b1: {
      id: "b1",
      name: "THUNDER 1",
      overs: 0,
      balls: 5,
      maidens: 0,
      runsConceded: 10,
      wickets: 0,
    },
  },
  currentOver: [
    {
      id: "ball_5",
      bowlerName: "THUNDER 1",
      batterName: "SPARTAN 1",
      runs: 4,
      isExtra: false,
      extraType: ExtraType.NONE,
      extraRuns: 0,
      isWicket: false,
      wicketType: WicketType.NONE,
      overNumber: 0,
      ballNumber: 5,
    },
  ],
  allBalls: [
    {
      id: "ball_5",
      bowlerName: "THUNDER 1",
      batterName: "SPARTAN 1",
      runs: 4,
      isExtra: false,
      extraType: ExtraType.NONE,
      extraRuns: 0,
      isWicket: false,
      wicketType: WicketType.NONE,
      overNumber: 0,
      ballNumber: 5,
    },
  ],
  ...overrides,
});

describe("MatchView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
  });

  it("auto-ends 1st innings on the final ball and shows Undo Last Ball + Proceed to 2nd Innings when returning to 1st innings", async () => {
    const onInningsEnd = vi.fn();
    const initialState = createInningsState({
      overs: 0,
      balls: 5,
      totalRuns: 10,
    });

    render(
      <MatchView
        initialState={initialState}
        totalOvers={1}
        matchId="match_123"
        userToken="test-token"
        onInningsEnd={onInningsEnd}
        onResetMatch={vi.fn()}
      />,
    );

    // Score 4 runs on the final ball (ball 6 of 1-over 1st innings)
    const fourBtn = screen.getByRole("button", { name: "4" });
    await act(async () => {
      fireEvent.click(fourBtn);
    });

    // 1st innings auto-triggers onInningsEnd(finalInnings) and renders inline completion panel
    expect(onInningsEnd).toHaveBeenCalledTimes(1);
    expect(onInningsEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        totalRuns: 14,
        overs: 1,
        balls: 0,
      }),
    );
    expect(screen.getByText(/1st Innings Complete/i)).toBeInTheDocument();
    const undoBtn = screen.getByRole("button", { name: /Undo Last Ball/i });
    const proceedBtn = screen.getByRole("button", {
      name: /Proceed to 2nd Innings/i,
    });
    expect(undoBtn).not.toBeDisabled();
    expect(proceedBtn).toBeInTheDocument();

    // Clicking Proceed to 2nd Innings after returning from Innings Break modal triggers onInningsEnd again
    fireEvent.click(proceedBtn);
    expect(onInningsEnd).toHaveBeenCalledTimes(2);
  });

  it("allows Undo Last Ball even when history is empty after page refresh by reconstructing from allBalls", async () => {
    const completedFirstInnings = createInningsState({
      overs: 1,
      balls: 0,
      totalRuns: 14,
      players: {
        p1: {
          id: "p1",
          name: "SPARTAN 1",
          runs: 14,
          ballsFaced: 6,
          fours: 3,
          sixes: 0,
          isOut: false,
        },
        p2: {
          id: "p2",
          name: "SPARTAN 2",
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        },
      },
      allBalls: [
        {
          id: "ball_6",
          bowlerName: "THUNDER 1",
          batterName: "SPARTAN 1",
          runs: 4,
          isExtra: false,
          extraType: ExtraType.NONE,
          extraRuns: 0,
          isWicket: false,
          wicketType: WicketType.NONE,
          overNumber: 0,
          ballNumber: 6,
        },
      ],
    });

    render(
      <MatchView
        initialState={completedFirstInnings}
        totalOvers={1}
        matchId="match_refresh_test"
        userToken="test-token"
        onInningsEnd={vi.fn()}
        onResetMatch={vi.fn()}
      />,
    );

    const undoBtn = screen.getByRole("button", { name: /Undo Last Ball/i });
    expect(undoBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(undoBtn);
    });

    // Score should revert to 10/0 (0.5 overs) and keypad should return
    await waitFor(() => {
      expect(screen.queryByText(/1st Innings Complete/i)).toBeNull();
      expect(screen.getByText("(0.5")).toBeInTheDocument();
    });
  });

  it("renders centered target equation under Scorecard button in 2nd innings", () => {
    const secondInnings = createInningsState({
      id: "inn2_temp",
      inningNumber: 2,
      battingTeamName: "ILLINOIS THUNDERS",
      bowlingTeamName: "CHICAGO SPARTANS",
      totalRuns: 8,
      totalWickets: 0,
      overs: 0,
      balls: 3,
      target: 15,
    });

    render(
      <MatchView
        initialState={secondInnings}
        totalOvers={1}
        matchId="match_target_test"
        userToken="test-token"
        onInningsEnd={vi.fn()}
        onResetMatch={vi.fn()}
      />,
    );

    expect(screen.getByText(/🎯 7 OFF 3/i)).toBeInTheDocument();
  });
});
