import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BatterSelectModal } from "../components/MatchView/BatterSelectModal";
import { BowlerChangeModal } from "../components/MatchView/BowlerChangeModal";

const player = (id: string, name: string) => ({
  id,
  name,
  runs: 0,
  ballsFaced: 0,
  fours: 0,
  sixes: 0,
  isOut: false,
});
const bowler = (id: string, name: string, overs = 0) => ({
  id,
  name,
  overs,
  balls: 0,
  maidens: 0,
  runs: 0,
  wickets: 0,
});

const innings: any = {
  strikerId: "a",
  nonStrikerId: "b",
  currentBowlerId: "x",
  balls: 2,
  allBalls: [{}],
  battingOrder: ["a", "b", "c"],
  players: {
    a: player("a", "ALICE"),
    b: player("b", "BOB"),
    c: player("c", "CARL"),
  },
  bowlingOrder: ["x", "y"],
  bowlers: { x: bowler("x", "XAVI"), y: bowler("y", "YARA") },
};

describe("player change dropdowns", () => {
  it("batter: only offers non-active players and saves on click", () => {
    const onReplace = vi.fn();
    render(
      <BatterSelectModal
        innings={innings}
        onSelect={vi.fn()}
        onReplace={onReplace}
        onRename={vi.fn()}
        onQuickAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("New Batter") as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual([
      "Select batter...",
      "CARL",
    ]);
    const save = screen.getByText("Save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByText("BOB"));
    fireEvent.change(select, { target: { value: "c" } });
    fireEvent.click(save);
    expect(onReplace).toHaveBeenCalledWith("c", "nonStriker");
  });

  it("bowler: excludes the current bowler and saves on click", () => {
    const onSelect = vi.fn();
    render(
      <BowlerChangeModal
        innings={innings}
        totalOvers={20}
        onSelect={onSelect}
        onQuickAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("Bowler") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["", "y"]);
    fireEvent.change(select, { target: { value: "y" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSelect).toHaveBeenCalledWith("y");
  });
});
