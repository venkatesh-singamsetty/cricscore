import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MatchSetup from "../components/MatchSetup";

// Mock fetch
global.fetch = vi.fn();

describe("MatchSetup Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it("renders correctly with default teams", async () => {
    render(<MatchSetup onStartMatch={vi.fn()} onResumeMatch={vi.fn()} />);

    expect(screen.getByDisplayValue("CHICAGO SPARTANS")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SHARK BLUE")).toBeInTheDocument();

    // Check Settings
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("20")).toBeInTheDocument(); // Default overs
  });

  it("shows validation error if squad has less than 2 players", async () => {
    render(<MatchSetup onStartMatch={vi.fn()} onResumeMatch={vi.fn()} />);

    // Clear squad textareas
    const squadInputs = screen.getAllByPlaceholderText(/Enter player name/i);

    // Fire event to change first team's squad to 1 player
    fireEvent.change(squadInputs[0], { target: { value: "Player1" } });
    fireEvent.blur(squadInputs[0]);

    const submitBtn = screen.getByRole("button", {
      name: /Start Fresh Match/i,
    });
    expect(submitBtn).toBeDisabled();

    // Validation warning should be visible
    expect(
      screen.getByText(/Requires min. 2 players per team/i),
    ).toBeInTheDocument();
  });

  it("submits valid form data and triggers onStartMatch", async () => {
    const mockStartMatch = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [], // Initial fetch recent matches
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ matchId: "123", inningId: "inn1" }), // Match POST response
      });

    render(
      <MatchSetup onStartMatch={mockStartMatch} onResumeMatch={vi.fn()} />,
    );

    const submitBtn = screen.getByRole("button", {
      name: /Start Fresh Match/i,
    });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    expect(submitBtn).toHaveTextContent(/Provisioning/i);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockStartMatch).toHaveBeenCalledWith(
        expect.objectContaining({ name: "CHICAGO SPARTANS" }),
        expect.objectContaining({ name: "SHARK BLUE" }),
        20,
        "CHICAGO SPARTANS", // Default bat first
        "123",
        "inn1",
        expect.any(String),
      );
    });
  });
});
