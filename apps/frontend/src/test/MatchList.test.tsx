import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MatchList from "../components/MatchList";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: { idToken: { toString: () => "mock-token" } },
  }),
}));

const mockMatches = [
  {
    id: "79b8e3b1-1111-2222-3333-444444444444",
    team_a_name: "TEAM A",
    team_b_name: "TEAM B",
    total_overs: 2,
    status: "COMPLETED",
    created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    scorer_email: "guest-1792377815972@cricscore.local",
    innings: [
      {
        inning_number: 1,
        batting_team_name: "TEAM B",
        total_runs: 25,
        total_wickets: 4,
        overs: 2,
        balls: 0,
      },
      {
        inning_number: 2,
        batting_team_name: "TEAM A",
        total_runs: 26,
        total_wickets: 3,
        overs: 2,
        balls: 0,
      },
    ],
  },
  {
    id: "e04d5d18-bced-4b42-95c9-0bd67db6dac9",
    team_a_name: "CHICAGO SPARTANS",
    team_b_name: "ILLINOIS THUNDERS",
    total_overs: 1,
    status: "COMPLETED",
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    scorer_email: "venky.2k57@gmail.com",
    innings: [
      {
        inning_number: 1,
        batting_team_name: "CHICAGO SPARTANS",
        total_runs: 12,
        total_wickets: 3,
        overs: 1,
        balls: 0,
      },
      {
        inning_number: 2,
        batting_team_name: "ILLINOIS THUNDERS",
        total_runs: 11,
        total_wickets: 4,
        overs: 1,
        balls: 0,
      },
    ],
  },
];

describe("MatchList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMatches,
      }),
    );
  });

  it("shows all matches in Viewer mode (showDeleteControls=false) with GUEST 👻 badge on guest cards", async () => {
    render(<MatchList onSelectMatch={vi.fn()} showDeleteControls={false} />);

    await waitFor(() => {
      expect(
        screen.getAllByText("CHICAGO SPARTANS").length,
      ).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText("TEAM B").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("ILLINOIS THUNDERS").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("guest-match-badge")).toHaveLength(1);
    expect(screen.queryByText("GUESTS")).not.toBeInTheDocument();
  });

  it("shows all matches by default in Admin Panel (showDeleteControls=true) with GUEST 👻 badge, and filters to guest-only when GUESTS 👻 is toggled", async () => {
    render(
      <MatchList
        onSelectMatch={vi.fn()}
        isAdmin={true}
        showDeleteControls={true}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getAllByText("CHICAGO SPARTANS").length,
      ).toBeGreaterThanOrEqual(1);
    });

    // Default Admin view shows both guest and signed-in matches
    expect(screen.getByText("LATEST FIXTURES")).toBeInTheDocument();
    expect(screen.getAllByText("TEAM B").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("CHICAGO SPARTANS").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("guest-match-badge")).toHaveLength(1);

    // Click GUESTS 👻 toggle button -> filter to guest-only
    const guestsBtn = screen.getByRole("button", { name: /GUESTS/i });
    fireEvent.click(guestsBtn);

    expect(screen.getByText("GUEST FIXTURES")).toBeInTheDocument();
    expect(screen.getAllByText("TEAM B").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("CHICAGO SPARTANS")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("guest-match-badge")).toHaveLength(1);

    // Click GUESTS 👻 again -> back to all matches
    fireEvent.click(guestsBtn);
    expect(screen.getByText("LATEST FIXTURES")).toBeInTheDocument();
    expect(
      screen.getAllByText("CHICAGO SPARTANS").length,
    ).toBeGreaterThanOrEqual(1);
  });
});
