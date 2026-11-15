import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
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
    await act(async () => {
      render(<MatchSetup onStartMatch={vi.fn()} onResumeMatch={vi.fn()} />);
    });

    // Both mobile and desktop layouts render the team name inputs
    // Use getAllByDisplayValue since both layouts are in the DOM
    const teamAInputs = screen.getAllByDisplayValue("CHICAGO SPARTANS");
    const teamBInputs = screen.getAllByDisplayValue("MIDWEST GLADIATORS");
    expect(teamAInputs.length).toBeGreaterThanOrEqual(1);
    expect(teamBInputs.length).toBeGreaterThanOrEqual(1);

    // Check Settings label exists
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();

    // Check Toss UI is rendered
    expect(screen.getByText(/Toss Winner/i)).toBeInTheDocument();
    expect(screen.getByText(/Decision/i)).toBeInTheDocument();
    // Both BAT and BOWL buttons should be present (may have multiple instances due to responsive layout)
    const batBtns = screen.getAllByRole("button", { name: /BAT/i });
    const bowlBtns = screen.getAllByRole("button", { name: /BOWL/i });
    expect(batBtns.length).toBeGreaterThanOrEqual(1);
    expect(bowlBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("shows validation error if squad has less than 2 players", async () => {
    await act(async () => {
      render(<MatchSetup onStartMatch={vi.fn()} onResumeMatch={vi.fn()} />);
    });

    // Clear squad textareas
    const squadInputs = screen.getAllByPlaceholderText(/Enter player name/i);

    // Fire event to change first team's squad to 1 player
    fireEvent.change(squadInputs[0], { target: { value: "Player1" } });
    fireEvent.blur(squadInputs[0]);

    // Get first disabled submit button
    const submitBtns = screen.getAllByRole("button", {
      name: /Start Fresh Match/i,
    });
    expect(submitBtns[0]).toBeDisabled();

    // Validation warning should be visible
    expect(
      screen.getByText(/Requires min. 2 players per team/i),
    ).toBeInTheDocument();
  });

  it("submits valid form data and triggers onStartMatch without token (guest mode)", async () => {
    const mockStartMatch = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [], // Initial fetch recent matches
    });

    await act(async () => {
      render(
        <MatchSetup onStartMatch={mockStartMatch} onResumeMatch={vi.fn()} />,
      );
    });

    // Click the first Submit button found (desktop layout)
    const submitBtns = screen.getAllByRole("button", {
      name: /Start Fresh Match/i,
    });
    const submitBtn = submitBtns[0];
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    // In guest mode (no token prop), the POST fetch is skipped
    // onStartMatch should still be called with generated guest IDs
    await waitFor(() => {
      expect(mockStartMatch).toHaveBeenCalledWith(
        expect.objectContaining({ name: "CHICAGO SPARTANS" }),
        expect.objectContaining({ name: "MIDWEST GLADIATORS" }),
        1, // Default overs is 1
        "CHICAGO SPARTANS", // Default: Toss Winner=Team A + Decision=BAT → Team A bats first
        expect.stringContaining("guest_match_"), // Guest match ID
        expect.stringContaining("guest_inning_"), // Guest inning ID
        expect.any(String),
      );
    });
  });

  it("submits valid form data and triggers POST /match when token is provided", async () => {
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

    await act(async () => {
      render(
        <MatchSetup
          onStartMatch={mockStartMatch}
          onResumeMatch={vi.fn()}
          token="test-jwt-token"
          initialEmail="scorer@example.com"
        />,
      );
    });

    const submitBtns = screen.getAllByRole("button", {
      name: /Start Fresh Match/i,
    });
    const submitBtn = submitBtns[0];
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    // Wait for async submission to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockStartMatch).toHaveBeenCalledWith(
        expect.objectContaining({ name: "CHICAGO SPARTANS" }),
        expect.objectContaining({ name: "MIDWEST GLADIATORS" }),
        1, // Default overs is 1
        "CHICAGO SPARTANS", // Default: Toss Winner=Team A + Decision=BAT → Team A bats first
        "123",
        "inn1",
        expect.any(String),
      );

      // Verify POST body includes toss fields
      const fetchCall = (
        global.fetch as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (call: any[]) =>
          call[0].includes("/match") && call[1]?.method === "POST",
      );
      expect(fetchCall).toBeTruthy();
      const fetchBody = JSON.parse(fetchCall![1].body);
      expect(fetchBody.tossWinner).toBe("CHICAGO SPARTANS");
      expect(fetchBody.tossDecision).toBe("BAT");
    });
  });

  it("navigates mobile wizard steps without showing test-match-toggle on Step 3 and enforces single-line squad headers", async () => {
    await act(async () => {
      render(<MatchSetup onStartMatch={vi.fn()} onResumeMatch={vi.fn()} />);
    });

    // Check squad header has whitespace-nowrap and ROSTER pill
    const squadLabels = screen.getAllByText(/Squad \(one player per line\)/i);
    expect(squadLabels.length).toBeGreaterThanOrEqual(1);
    expect(squadLabels[0]).toHaveClass("whitespace-nowrap");

    const rosterBadges = screen.getAllByText(/ROSTER/i);
    expect(rosterBadges.length).toBeGreaterThanOrEqual(1);
    expect(rosterBadges[0]).toHaveClass("whitespace-nowrap");

    // Navigate to Step 2
    const nextToStep2 = screen.getByRole("button", {
      name: /NEXT: SECOND TEAM ➔/i,
    });
    fireEvent.click(nextToStep2);

    // Verify Step 2 is active
    expect(screen.getByText(/Step 2: Second Team/i)).toBeInTheDocument();

    // Navigate to Step 3
    const nextToStep3 = screen.getByRole("button", {
      name: /NEXT: OVERS & TOSS ➔/i,
    });
    fireEvent.click(nextToStep3);

    // Verify Step 3 is active
    expect(screen.getByText(/Step 3: Overs & Toss/i)).toBeInTheDocument();

    // Verify test-match-toggle-mobile has been removed from Step 3
    expect(
      screen.queryByTestId("test-match-toggle-mobile"),
    ).not.toBeInTheDocument();

    // Verify Start Match button is available
    expect(
      screen.getByRole("button", { name: /Start Match/i }),
    ).toBeInTheDocument();

    // Verify squad textarea uses responsive mobile 24px line-height for viewport clearance
    const squadTextareas = screen.getAllByPlaceholderText(/Enter player name/i);
    expect(squadTextareas[0]).toHaveClass("leading-[24px]");
  });
});
