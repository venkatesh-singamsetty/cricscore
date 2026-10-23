import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WicketTypeModal } from "../components/MatchView/WicketTypeModal";
import { BatterSelectModal } from "../components/MatchView/BatterSelectModal";
import { BowlerSelectModal } from "../components/MatchView/BowlerSelectModal";
import { ExtraRunsModal } from "../components/MatchView/ExtraRunsModal";
import { RetireModal } from "../components/MatchView/RetireModal";
import { RunOutModal } from "../components/MatchView/RunOutModal";
import { WicketType, ExtraType, InningsState } from "../types";

describe("MatchView Modal Components", () => {
  describe("WicketTypeModal", () => {
    it("renders all 6 standard dismissal modes on a normal delivery", () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <WicketTypeModal
          pendingExtra={ExtraType.NONE}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(
        screen.getByRole("button", { name: /BOWLED/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /CAUGHT/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /LBW/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /RUN OUT/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /STUMPED/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /HIT WICKET/i }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /BOWLED/i }));
      expect(onSelect).toHaveBeenCalledWith(WicketType.BOWLED);
    });

    it("restricts dismissal types to Run Out, Stumped, and Hit Wicket on WIDE", () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <WicketTypeModal
          pendingExtra={ExtraType.WIDE}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(
        screen.getByRole("button", { name: /RUN OUT/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /STUMPED/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /HIT WICKET/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /BOWLED/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /CAUGHT/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /LBW/i })).toBeNull();
    });

    it("restricts dismissal types strictly to RUN OUT on NO_BALL", () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <WicketTypeModal
          pendingExtra={ExtraType.NO_BALL}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(
        screen.getByRole("button", { name: /RUN OUT/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /STUMPED/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /BOWLED/i })).toBeNull();
    });
  });

  describe("BatterSelectModal", () => {
    const mockInnings: InningsState = {
      id: "inn-1",
      inningNumber: 1,
      battingTeamName: "CHICAGO SPARTANS",
      bowlingTeamName: "MIDWEST GLADIATORS",
      overs: 0,
      balls: 0,
      totalRuns: 0,
      totalWickets: 0,
      strikerId: "",
      nonStrikerId: "",
      currentBowlerId: "",
      currentOver: [],
      battingOrder: ["p1", "p2", "p3"],
      bowlingOrder: [],
      players: {
        p1: {
          id: "p1",
          name: "Batter 1",
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        },
        p2: {
          id: "p2",
          name: "Batter 2",
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        },
        p3: {
          id: "p3",
          name: "Batter 3",
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        },
      },
      bowlers: {},
      allBalls: [],
    };

    it("renders available batters and calls onSelect when clicked", () => {
      const onSelect = vi.fn();
      const onRename = vi.fn();
      const onQuickAdd = vi.fn();
      const onClose = vi.fn();

      render(
        <BatterSelectModal
          innings={mockInnings}
          onSelect={onSelect}
          onRename={onRename}
          onQuickAdd={onQuickAdd}
          onClose={onClose}
        />,
      );

      expect(screen.getByText("Batter 1")).toBeInTheDocument();
      expect(screen.getByText("Batter 2")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Batter 1"));
      expect(onSelect).toHaveBeenCalledWith("p1");
    });
  });

  describe("BowlerSelectModal", () => {
    const mockInnings: InningsState = {
      id: "inn-1",
      inningNumber: 1,
      battingTeamName: "CHICAGO SPARTANS",
      bowlingTeamName: "MIDWEST GLADIATORS",
      overs: 0,
      balls: 0,
      totalRuns: 0,
      totalWickets: 0,
      strikerId: "p1",
      nonStrikerId: "p2",
      currentBowlerId: "",
      currentOver: [],
      battingOrder: ["p1", "p2"],
      bowlingOrder: ["b1", "b2"],
      players: {},
      bowlers: {
        b1: {
          id: "b1",
          name: "Bowler 1",
          overs: 0,
          balls: 0,
          maidens: 0,
          runsConceded: 0,
          wickets: 0,
        },
        b2: {
          id: "b2",
          name: "Bowler 2",
          overs: 0,
          balls: 0,
          maidens: 0,
          runsConceded: 0,
          wickets: 0,
        },
      },
      allBalls: [],
    };

    it("renders opening bowler title when no balls have been bowled", () => {
      const onSelect = vi.fn();
      const onRename = vi.fn();
      const onQuickAdd = vi.fn();
      const onClose = vi.fn();

      render(
        <BowlerSelectModal
          innings={mockInnings}
          totalOvers={20}
          onSelect={onSelect}
          onRename={onRename}
          onQuickAdd={onQuickAdd}
          onClose={onClose}
        />,
      );

      expect(screen.getByText(/Opening Bowler/i)).toBeInTheDocument();
      expect(screen.getByText("Bowler 1")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Bowler 1"));
      expect(onSelect).toHaveBeenCalledWith("b1");
    });
  });

  describe("ExtraRunsModal", () => {
    it("renders extra run options and invokes onScore with selected runs", () => {
      const onScore = vi.fn();
      const onIgnore = vi.fn();

      render(
        <ExtraRunsModal
          pendingExtra={ExtraType.WIDE}
          onScore={onScore}
          onIgnore={onIgnore}
        />,
      );

      expect(screen.getByText(/Additional Runs\?/i)).toBeInTheDocument();
      const fourRunsButton = screen.getByRole("button", { name: "4" });
      fireEvent.click(fourRunsButton);

      expect(onScore).toHaveBeenCalledWith(4);
    });
  });

  describe("RetireModal", () => {
    it("allows choosing between Retired Hurt and Retired Out", () => {
      const onRetire = vi.fn();
      const onClose = vi.fn();

      render(
        <RetireModal
          strikerName="Virat Kohli"
          onRetire={onRetire}
          onClose={onClose}
        />,
      );

      expect(screen.getByText(/Retire Batsman/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Select retirement type for Virat Kohli/i),
      ).toBeInTheDocument();

      const hurtButton = screen.getByRole("button", { name: /Retired Hurt/i });
      fireEvent.click(hurtButton);

      expect(onRetire).toHaveBeenCalledWith(WicketType.RETIRED_HURT);
    });
  });

  describe("RunOutModal", () => {
    const mockInnings: InningsState = {
      id: "inn-1",
      inningNumber: 1,
      battingTeamName: "CHICAGO SPARTANS",
      bowlingTeamName: "MIDWEST GLADIATORS",
      overs: 0,
      balls: 0,
      totalRuns: 0,
      totalWickets: 0,
      strikerId: "p1",
      nonStrikerId: "p2",
      currentBowlerId: "",
      currentOver: [],
      battingOrder: ["p1", "p2"],
      bowlingOrder: [],
      players: {
        p1: {
          id: "p1",
          name: "Rohit Sharma",
          runs: 10,
          ballsFaced: 5,
          fours: 2,
          sixes: 0,
          isOut: false,
        },
        p2: {
          id: "p2",
          name: "Virat Kohli",
          runs: 5,
          ballsFaced: 3,
          fours: 1,
          sixes: 0,
          isOut: false,
        },
      },
      bowlers: {},
      allBalls: [],
    };

    it("allows selecting runs completed and then selecting which batter was run out", () => {
      const setRunOutRuns = vi.fn();
      const onSelect = vi.fn();
      const onClose = vi.fn();

      // Stage 1: runOutRuns is null -> choose runs completed
      const { rerender } = render(
        <RunOutModal
          innings={mockInnings}
          runOutRuns={null}
          setRunOutRuns={setRunOutRuns}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(
        screen.getByText(/Runs Completed Before Run Out\?/i),
      ).toBeInTheDocument();
      const oneRunButton = screen.getByRole("button", { name: "1" });
      fireEvent.click(oneRunButton);
      expect(setRunOutRuns).toHaveBeenCalledWith(1);

      // Stage 2: runOutRuns is set to 1 -> choose striker or non-striker
      rerender(
        <RunOutModal
          innings={mockInnings}
          runOutRuns={1}
          setRunOutRuns={setRunOutRuns}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(screen.getByText(/Who was Run Out\?/i)).toBeInTheDocument();
      const strikerButton = screen.getByRole("button", {
        name: /Rohit Sharma/i,
      });
      fireEvent.click(strikerButton);

      expect(onSelect).toHaveBeenCalledWith(1, "p1");
    });
  });
});
