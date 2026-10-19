import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiMatchPrediction } from "../components/AiMatchPrediction";

global.fetch = vi.fn();

describe("AiMatchPrediction Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 50-50 baseline at start of 1st innings before first ball", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        team1: "CHICAGO SPARTANS",
        team2: "ILLINOIS THUNDERS",
        team1WinProbability: 0.5,
        team2WinProbability: 0.5,
        predictedWinner: "Balanced (50-50)",
        modelVersion: "v2+dp-sim",
      }),
    });

    render(
      <AiMatchPrediction
        matchId="match_1"
        teamA="CHICAGO SPARTANS"
        teamB="ILLINOIS THUNDERS"
        totalOvers={1}
        compact={true}
        inning={1}
        currentScore={0}
        wicketsLost={0}
        ballsBowled={0}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/CHICAGO SPARTANS 50% - 50% ILLINOIS THUNDERS/i),
      ).toBeInTheDocument();
    });
  });

  it("overrides impossible chase (runsNeeded > ballsLeft * 6) to 0% - 100% without calling API", async () => {
    render(
      <AiMatchPrediction
        matchId="match_1"
        teamA="ILLINOIS THUNDERS"
        teamB="CHICAGO SPARTANS"
        totalOvers={1}
        compact={true}
        inning={2}
        currentScore={0}
        wicketsLost={0}
        targetScore={20}
        ballsBowled={4}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/ILLINOIS THUNDERS 0% - 100% CHICAGO SPARTANS/i),
      ).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends ballsLeft and ballsBowled derived from totalOvers to /match/predict", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team1: "ILLINOIS THUNDERS",
        team2: "CHICAGO SPARTANS",
        team1WinProbability: 0.57,
        team2WinProbability: 0.43,
        predictedWinner: "ILLINOIS THUNDERS",
        modelVersion: "v2+dp-sim",
      }),
    });

    render(
      <AiMatchPrediction
        matchId="match_1"
        teamA="ILLINOIS THUNDERS"
        teamB="CHICAGO SPARTANS"
        totalOvers={1}
        compact={true}
        inning={2}
        currentScore={6}
        wicketsLost={0}
        targetScore={15}
        ballsBowled={2}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/ILLINOIS THUNDERS 57% - 43% CHICAGO SPARTANS/i),
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/match/predict"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"ballsLeft":4,"ballsBowled":2'),
      }),
    );
  });
});
