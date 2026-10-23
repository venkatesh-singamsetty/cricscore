import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HighlightedResult from "../components/HighlightedResult";

describe("HighlightedResult Component", () => {
  it("highlights winning team before ' WON BY ' with default green styling", () => {
    const { container } = render(
      <HighlightedResult text="MIDWEST GLADIATORS WON BY 5 WICKETS" />,
    );

    const highlightedSpan = container.querySelector("span");
    expect(highlightedSpan).toBeInTheDocument();
    expect(highlightedSpan).toHaveTextContent("MIDWEST GLADIATORS");
    expect(highlightedSpan).toHaveClass("text-emerald-400");
    expect(container).toHaveTextContent("MIDWEST GLADIATORS WON BY 5 WICKETS");
  });

  it("applies custom teamClassName when provided", () => {
    const { container } = render(
      <HighlightedResult
        text="CHICAGO SPARTANS WON BY 24 RUNS"
        teamClassName="text-amber-400 font-bold"
      />,
    );

    const highlightedSpan = container.querySelector("span");
    expect(highlightedSpan).toHaveClass("text-amber-400", "font-bold");
    expect(highlightedSpan).toHaveTextContent("CHICAGO SPARTANS");
  });

  it("renders plain text without wrapping span when ' WON BY ' is not present", () => {
    const { container } = render(
      <HighlightedResult text="Match Tied (Scores Level)" />,
    );

    expect(container.querySelector("span")).toBeNull();
    expect(container).toHaveTextContent("Match Tied (Scores Level)");
  });

  it("renders plain text if ' WON BY ' is at the start (index <= 0)", () => {
    const { container } = render(<HighlightedResult text=" WON BY 10 RUNS" />);

    expect(container.querySelector("span")).toBeNull();
    expect(container.textContent).toBe(" WON BY 10 RUNS");
  });
});
