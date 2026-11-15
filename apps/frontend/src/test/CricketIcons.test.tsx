import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BatIcon, BallIcon } from "../components/icons/CricketIcons";

describe("CricketIcons", () => {
  it("renders the bat as an accessible inline SVG (not an emoji glyph)", () => {
    render(<BatIcon />);
    const icon = screen.getByTestId("cricket-bat-icon");
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveAttribute("aria-label", "Bat");
  });

  it("renders the ball as a red cricket ball SVG (not a tennis ball)", () => {
    const { container } = render(<BallIcon />);
    const icon = screen.getByTestId("cricket-ball-icon");
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveAttribute("aria-label", "Ball");
    expect(container.querySelector("circle")).toHaveAttribute(
      "fill",
      "#dc2626",
    );
  });

  it("accepts custom classes and labels", () => {
    render(<BallIcon className="w-6 h-6" title="Change bowler" />);
    const icon = screen.getByTestId("cricket-ball-icon");
    expect(icon).toHaveAttribute("aria-label", "Change bowler");
    expect(icon.getAttribute("class")).toContain("w-6");
  });
});
