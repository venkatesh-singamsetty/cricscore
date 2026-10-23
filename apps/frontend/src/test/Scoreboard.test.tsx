import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Scoreboard from "../components/Scoreboard";
import { InningsState, WicketType, ExtraType } from "../types";

describe("Scoreboard Component", () => {
  const mockCurrentInnings: InningsState = {
    id: "inn-2",
    inningNumber: 2,
    target: 150,
    battingTeamName: "MIDWEST GLADIATORS",
    bowlingTeamName: "CHICAGO CHIEFS",
    totalRuns: 20,
    totalWickets: 1,
    overs: 2,
    balls: 4,
    currentOver: [],
    allBalls: [],
    strikerId: "p1",
    nonStrikerId: "p2",
    currentBowlerId: "b1",
    battingOrder: ["p1", "p2", "p3", "p4", "p5"],
    bowlingOrder: ["b1"],
    players: {
      p1: {
        id: "p1",
        name: "GLADIATOR 1",
        runs: 10,
        ballsFaced: 8,
        fours: 1,
        sixes: 0,
        isOut: false,
      },
      p2: {
        id: "p2",
        name: "GLADIATOR 2",
        runs: 5,
        ballsFaced: 4,
        fours: 1,
        sixes: 0,
        isOut: false,
      },
      p3: {
        id: "p3",
        name: "GLADIATOR 3",
        runs: 4,
        ballsFaced: 3,
        fours: 0,
        sixes: 0,
        isOut: true,
        wicketType: WicketType.BOWLED,
        wicketBy: "Bowler 1",
      },
      p4: {
        id: "p4",
        name: "GLADIATOR 4",
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
      },
      p5: {
        id: "p5",
        name: "GLADIATOR 5",
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
        name: "Bowler 1",
        overs: 2,
        balls: 4,
        maidens: 0,
        runsConceded: 18,
        wickets: 1,
      },
    },
  };

  const mockPreviousInnings: InningsState = {
    id: "inn-1",
    inningNumber: 1,
    battingTeamName: "CHICAGO CHIEFS",
    bowlingTeamName: "MIDWEST GLADIATORS",
    totalRuns: 149,
    totalWickets: 6,
    overs: 20,
    balls: 0,
    currentOver: [],
    allBalls: [],
    strikerId: "cp1",
    nonStrikerId: "cp2",
    currentBowlerId: "b1",
    battingOrder: ["cp1", "cp2"],
    bowlingOrder: ["b1"],
    players: {
      cp1: {
        id: "cp1",
        name: "CHIEF 1",
        runs: 80,
        ballsFaced: 50,
        fours: 8,
        sixes: 3,
        isOut: false,
      },
      cp2: {
        id: "cp2",
        name: "CHIEF 2",
        runs: 60,
        ballsFaced: 45,
        fours: 5,
        sixes: 2,
        isOut: true,
        wicketType: WicketType.CAUGHT,
        wicketBy: "Bowler A",
        fielderName: "Fielder B",
      },
    },
    bowlers: {
      b1: {
        id: "b1",
        name: "Bowler A",
        overs: 4,
        balls: 0,
        maidens: 0,
        runsConceded: 30,
        wickets: 1,
      },
    },
  };

  it("renders all batsmen in second innings including active, dismissed, and unbatted squad members", () => {
    render(
      <Scoreboard
        currentInnings={mockCurrentInnings}
        previousInnings={mockPreviousInnings}
        onClose={vi.fn()}
      />,
    );

    // Active striker & non-striker
    expect(screen.getByText(/GLADIATOR 1/i)).toBeInTheDocument();
    expect(screen.getByText(/GLADIATOR 2/i)).toBeInTheDocument();

    // Dismissed batter
    expect(screen.getByText(/GLADIATOR 3/i)).toBeInTheDocument();
    expect(screen.getByText(/b Bowler 1/i)).toBeInTheDocument();

    // Unbatted squad members are grouped together in a compact YET TO BAT strip
    const thunder4Elements = screen.getAllByText(/GLADIATOR 4/i);
    expect(thunder4Elements.length).toBeGreaterThanOrEqual(1);

    const thunder5Elements = screen.getAllByText(/GLADIATOR 5/i);
    expect(thunder5Elements.length).toBeGreaterThanOrEqual(1);

    const yetToBatBadges = screen.getAllByText(/YET TO BAT/i);
    expect(yetToBatBadges.length).toBe(1);

    // Target equation & banner
    expect(screen.getByText(/Target Equation/i)).toBeInTheDocument();
    expect(screen.getByText(/150/i)).toBeInTheDocument();
    expect(screen.getByText(/Need 130 runs/i)).toBeInTheDocument();

    // Bowler table
    expect(screen.getAllByText(/Bowler 1/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2.4/i).length).toBeGreaterThanOrEqual(1);
  });

  it("switches tabs to 1st innings and displays 1st innings batsmen and bowlers", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <Scoreboard
        currentInnings={mockCurrentInnings}
        previousInnings={mockPreviousInnings}
        onClose={vi.fn()}
      />,
    );

    const inns1Tab = screen.getByText(/CHICAGO CHIEFS \(Inns 1\)/i);
    fireEvent.click(inns1Tab);

    // CHIEF 1 and CHIEF 2 appear
    expect(screen.getByText(/CHIEF 1/i)).toBeInTheDocument();
    expect(screen.getByText(/CHIEF 2/i)).toBeInTheDocument();
    expect(screen.getByText(/c Fielder B b Bowler A/i)).toBeInTheDocument();

    // Bowler A appears
    expect(screen.getAllByText(/Bowler A/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows DID NOT BAT status for unbatted players when innings is completed", () => {
    const completedInnings: InningsState = {
      ...mockCurrentInnings,
      isCompleted: true,
    };

    render(<Scoreboard currentInnings={completedInnings} onClose={vi.fn()} />);

    const dnbBadges = screen.getAllByText(/DID NOT BAT/i);
    expect(dnbBadges.length).toBe(1);
  });

  it("merges Player of the Match into the MATCH RESULT banner and suppresses duplicate Target Equation on completed matches", () => {
    // 2nd innings reached target 150 (scored 151)
    const wonInnings: InningsState = {
      ...mockCurrentInnings,
      totalRuns: 151,
      totalWickets: 3,
      isCompleted: true,
    };

    render(
      <Scoreboard
        currentInnings={wonInnings}
        previousInnings={mockPreviousInnings}
        onClose={vi.fn()}
        playerOfTheMatch="GLADIATOR 1"
        totalOvers={20}
      />,
    );

    // Match Result banner shows winner
    expect(screen.getByText(/WON BY 7 WICKETS/i)).toBeInTheDocument();

    // POTM is integrated into the result banner
    expect(screen.getByText(/POTM: GLADIATOR 1/i)).toBeInTheDocument();

    // Duplicate Target Equation is suppressed on completed match
    expect(screen.queryByText(/Target Equation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Target Reached/i)).not.toBeInTheDocument();

    // Batters table is immediately visible
    expect(screen.getAllByText(/GLADIATOR 1/i).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("renders singular '1 WICKET' and '1 RUN' victory margins correctly", () => {
    // 1-wicket victory: 9 wickets down, target 150 reached with 151
    const oneWicketWonInnings: InningsState = {
      ...mockCurrentInnings,
      totalRuns: 151,
      totalWickets: 9,
      isCompleted: true,
    };

    const { rerender } = render(
      <Scoreboard
        currentInnings={oneWicketWonInnings}
        previousInnings={mockPreviousInnings}
        onClose={vi.fn()}
        totalOvers={20}
      />,
    );

    expect(screen.getByText(/WON BY 1 WICKET$/i)).toBeInTheDocument();

    // 1-run victory: 1st inns 150, 2nd inns 149 (20.0 overs completed)
    const oneRunLostInnings: InningsState = {
      ...mockCurrentInnings,
      totalRuns: 149,
      totalWickets: 5,
      overs: 20,
      balls: 0,
      isCompleted: true,
    };

    rerender(
      <Scoreboard
        currentInnings={oneRunLostInnings}
        previousInnings={{ ...mockPreviousInnings, totalRuns: 150 }}
        onClose={vi.fn()}
        totalOvers={20}
      />,
    );

    expect(screen.getByText(/WON BY 1 RUN$/i)).toBeInTheDocument();
  });

  it("resets scorecard scroll position to top when switching innings tabs", () => {
    const { container } = render(
      <Scoreboard
        currentInnings={mockCurrentInnings}
        previousInnings={mockPreviousInnings}
        onClose={vi.fn()}
      />,
    );

    // Find the scrollable container
    const scrollContainer = container.querySelector(".overflow-y-auto");
    expect(scrollContainer).toBeTruthy();

    if (scrollContainer) {
      // Simulate scrolling down
      scrollContainer.scrollTop = 350;
      expect(scrollContainer.scrollTop).toBe(350);

      // Switch tab to previous innings
      const prevTabBtn = screen.getByRole("button", {
        name: new RegExp(mockPreviousInnings.battingTeamName, "i"),
      });
      fireEvent.click(prevTabBtn);

      // Scroll position should reset to 0
      expect(scrollContainer.scrollTop).toBe(0);
    }
  });

  it("applies whitespace-nowrap and mobile padding to innings tab button titles", () => {
    render(
      <Scoreboard
        currentInnings={mockCurrentInnings}
        previousInnings={mockPreviousInnings}
        onClose={vi.fn()}
      />,
    );

    const prevTabText = screen.getByText(/CHICAGO CHIEFS \(Inns 1\)/i);
    const currTabText = screen.getByText(/MIDWEST GLADIATORS \(Inns 2\)/i);

    expect(prevTabText).toHaveClass("whitespace-nowrap");
    expect(currTabText).toHaveClass("whitespace-nowrap");
  });

  it("renders extras breakdown items with flex-nowrap and whitespace-nowrap", () => {
    const inningsWithExtras: InningsState = {
      ...mockCurrentInnings,
      allBalls: [
        {
          id: "b_wide",
          bowlerName: "Bowler 1",
          batterName: "GLADIATOR 1",
          runs: 0,
          isExtra: true,
          extraType: ExtraType.WIDE,
          extraRuns: 1,
          isWicket: false,
          wicketType: WicketType.NONE,
          overNumber: 0,
          ballNumber: 0,
        },
      ],
    };

    render(
      <Scoreboard
        currentInnings={inningsWithExtras}
        previousInnings={mockPreviousInnings}
        onClose={vi.fn()}
      />,
    );

    const wdBadge = screen.getByText(/WD: 1/i);
    expect(wdBadge).toHaveClass("whitespace-nowrap");
    expect(wdBadge.parentElement).toHaveClass("flex-nowrap");

    // Verify Innings Total and Extras container is flex-row to prevent 2-line vertical stacking
    const inningsTotalLabel = screen.getByText(/^Innings Total$/i);
    const summaryRow = inningsTotalLabel.closest(".flex-row");
    expect(summaryRow).toHaveClass("flex-row");
    expect(summaryRow).toHaveClass("justify-between");
  });

  it("applies whitespace-nowrap to partnerships and did-not-bat squad members", () => {
    const inningsWithPartnership: InningsState = {
      ...mockCurrentInnings,
      allBalls: [
        {
          id: "b1",
          bowlerName: "Bowler 1",
          batterName: "GLADIATOR 1",
          runs: 4,
          isExtra: false,
          extraType: ExtraType.NONE,
          extraRuns: 0,
          isWicket: true,
          wicketType: WicketType.BOWLED,
          overNumber: 0,
          ballNumber: 1,
        },
      ],
    };

    render(
      <Scoreboard
        currentInnings={inningsWithPartnership}
        previousInnings={mockPreviousInnings}
        onClose={vi.fn()}
      />,
    );

    const outBatterCell = screen.getByText("GLADIATOR 1", { selector: "td" });
    expect(outBatterCell).toHaveClass("whitespace-nowrap");
  });
});
