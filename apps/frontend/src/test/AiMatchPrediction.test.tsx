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
        team2: "MIDWEST GLADIATORS",
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
        teamB="MIDWEST GLADIATORS"
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
        screen.getByText(/CHICAGO SPARTANS 50% - 50% MIDWEST GLADIATORS/i),
      ).toBeInTheDocument();
    });
  });

  it("overrides impossible chase (runsNeeded > ballsLeft * 6) to 0% - 100% without calling API", async () => {
    render(
      <AiMatchPrediction
        matchId="match_1"
        teamA="MIDWEST GLADIATORS"
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
        screen.getByText(/MIDWEST GLADIATORS 0% - 100% CHICAGO SPARTANS/i),
      ).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends ballsLeft and ballsBowled derived from totalOvers to /match/predict", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team1: "MIDWEST GLADIATORS",
        team2: "CHICAGO SPARTANS",
        team1WinProbability: 0.57,
        team2WinProbability: 0.43,
        predictedWinner: "MIDWEST GLADIATORS",
        modelVersion: "v2+dp-sim",
      }),
    });

    render(
      <AiMatchPrediction
        matchId="match_1"
        teamA="MIDWEST GLADIATORS"
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
        screen.getByText(/MIDWEST GLADIATORS 57% - 43% CHICAGO SPARTANS/i),
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

  it("renders bat icon 🏏 before batting team percentage and ball icon 🎾 before bowling team percentage", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team1: "MIDWEST GLADIATORS",
        team2: "CHICAGO SPARTANS",
        team1WinProbability: 0.47,
        team2WinProbability: 0.53,
        predictedWinner: "CHICAGO SPARTANS",
        modelVersion: "v2+dp-sim",
      }),
    });

    render(
      <AiMatchPrediction
        matchId="match_1"
        teamA="CHICAGO SPARTANS"
        teamB="MIDWEST GLADIATORS"
        battingTeam="MIDWEST GLADIATORS"
        bowlingTeam="CHICAGO SPARTANS"
        totalOvers={1}
        compact={true}
        inning={2}
        currentScore={0}
        wicketsLost={0}
        targetScore={11}
        ballsBowled={0}
      />,
    );

    await waitFor(() => {
      // Batting team (MIDWEST GLADIATORS, 47%) should have 🏏 before 47%
      expect(screen.getByText("🏏")).toBeInTheDocument();
      expect(screen.getByText("47%")).toBeInTheDocument();

      // Bowling team (CHICAGO SPARTANS, 53%) should have 🎾 before 53%
      expect(screen.getByText("🎾")).toBeInTheDocument();
      expect(screen.getByText("53%")).toBeInTheDocument();
    });
  });
});
