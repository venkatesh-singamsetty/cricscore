import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatComponent, FormattedContent } from "../components/ChatComponent";

global.fetch = vi.fn();

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: {
        toString: () => "mock-jwt-token",
        payload: { "cognito:groups": ["Admin"] },
      },
    },
  }),
}));

describe("FormattedContent Component", () => {
  it("renders bold text and source badge chips", () => {
    const text =
      "**Rule 8:** Leg byes count as extras.\n[Source: tournament_rulebook.pdf]";
    render(<FormattedContent content={text} />);

    expect(screen.getByText("Rule 8:")).toBeInTheDocument();
    expect(
      screen.getByText("Source: tournament_rulebook.pdf"),
    ).toBeInTheDocument();
  });

  it("renders numbered list items correctly", () => {
    const text = "1. First rule\n2. Second rule";
    render(<FormattedContent content={text} />);

    expect(screen.getByText("First rule")).toBeInTheDocument();
    expect(screen.getByText("Second rule")).toBeInTheDocument();
  });

  it("renders markdown tables correctly into HTML table elements", () => {
    const markdownTable = `| Time | Condition | Temp (°F / °C) | Rain % | Wind |
|---|---|---|---|---|
| 1:00 AM | Clear sky | 46°F / 8°C | 0% | 2 mph |
| 2:00 AM | Partly cloudy | 45°F / 7°C | 10% | 3 mph |`;

    const { container } = render(<FormattedContent content={markdownTable} />);

    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Condition")).toBeInTheDocument();
    expect(screen.getByText("1:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Clear sky")).toBeInTheDocument();
    expect(screen.getByText("46°F / 8°C")).toBeInTheDocument();
    expect(screen.getByText("2:00 AM")).toBeInTheDocument();
  });

  it("safely sanitizes markdown links and avoids dangerous URL schemes", () => {
    const content =
      "[Safe Link](https://github.com/venkatesh-singamsetty/cricscore/issues/100)\n[Malicious Link](javascript:alert(1))";
    render(<FormattedContent content={content} />);

    const safeLink = screen.getByRole("link", { name: "Safe Link" });
    expect(safeLink).toHaveAttribute(
      "href",
      "https://github.com/venkatesh-singamsetty/cricscore/issues/100",
    );
    expect(
      screen.queryByRole("link", { name: "Malicious Link" }),
    ).not.toBeInTheDocument();
  });
});

describe("ChatComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders assistant header and input box", () => {
    render(
      <ChatComponent
        matchId={null}
        apiUrl="https://api.test.com"
        setAlertMessage={vi.fn()}
      />,
    );
    expect(
      screen.getByPlaceholderText(/Ask about the match, score, or players/i),
    ).toBeInTheDocument();
  });

  it("sends chat message and renders response from API", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: "Leg Byes count as extras." }),
    });

    render(
      <ChatComponent
        matchId={null}
        apiUrl="https://api.test.com"
        setAlertMessage={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(
      /Ask about the match, score, or players/i,
    );
    fireEvent.change(input, { target: { value: "Are leg byes extras?" } });

    const sendBtn = screen.getByRole("button", { name: "Send message" });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Leg Byes count as extras.")).toBeInTheDocument();
    });
  });

  it("renders empty state graphic when there are no messages", () => {
    render(
      <ChatComponent
        matchId={null}
        apiUrl="https://api.test.com"
        setAlertMessage={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /CricScore AI Assistant/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/MATCH STATS/i)).toBeInTheDocument();
  });

  it("renders quick prompt chips and populates chat when clicked", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reply: "Chicago Spartans are 84/2 in 10 overs.",
      }),
    });

    render(
      <ChatComponent
        matchId={null}
        apiUrl="https://api.test.com"
        setAlertMessage={vi.fn()}
      />,
    );

    const chip = screen.getByRole("button", {
      name: "Can you analyze the current match details?",
    });
    const pomChip = screen.getByRole("button", {
      name: "Who won Player of the Match in the last match?",
    });
    const weatherChip = screen.getByRole("button", {
      name: "Can you check the weather report for our match?",
    });
    const issueChip = screen.getByRole("button", {
      name: "I want to report a bug or request a new feature",
    });
    expect(chip).toBeInTheDocument();
    expect(pomChip).toBeInTheDocument();
    expect(weatherChip).toBeInTheDocument();
    expect(issueChip).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Chicago Spartans are 84/2 in 10 overs."),
      ).toBeInTheDocument();
    });
  });

  it("copies message to clipboard when copy button is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: "Match Summary: Team A won by 10 runs." }),
    });

    render(
      <ChatComponent
        matchId={null}
        apiUrl="https://api.test.com"
        setAlertMessage={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(
      /Ask about the match, score, or players/i,
    );
    fireEvent.change(input, { target: { value: "Match summary" } });
    const sendBtn = screen.getByRole("button", { name: "Send message" });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Match Summary: Team A won by 10 runs."),
      ).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole("button", { name: "Copy message" });
    expect(copyButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(copyButtons[0]);
    });

    expect(writeTextMock).toHaveBeenCalled();
  });

  it("clears chat memory from localStorage when New Chat button is clicked", async () => {
    localStorage.setItem(
      "cricscore-chat-memory",
      JSON.stringify([
        { role: "user", content: "Previous question" },
        { role: "assistant", content: "Previous answer" },
      ]),
    );

    render(
      <ChatComponent
        matchId={null}
        apiUrl="https://api.test.com"
        setAlertMessage={vi.fn()}
      />,
    );

    expect(screen.getByText("Previous question")).toBeInTheDocument();
    expect(screen.getByText("Previous answer")).toBeInTheDocument();

    const newChatBtn = screen.getByRole("button", { name: /New Chat/i });
    await act(async () => {
      fireEvent.click(newChatBtn);
    });

    expect(screen.queryByText("Previous question")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /CricScore AI Assistant/i }),
    ).toBeInTheDocument();
  });

  it("fetches and displays uploaded docs count and list when isAdmin is true", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        documents: ["CCL2026SpringChampionshipRulebook.pdf"],
      }),
    });

    render(
      <ChatComponent
        matchId={null}
        apiUrl="https://api.test.com"
        isAdmin={true}
        setAlertMessage={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Docs (1)")).toBeInTheDocument();
    });

    const docsBtn = screen.getByRole("button", { name: /Docs \(1\)/i });
    fireEvent.click(docsBtn);

    expect(
      screen.getByText("CCL2026SpringChampionshipRulebook.pdf"),
    ).toBeInTheDocument();
  });

  describe("Multi-Agent prompts and responses (RAG, DB, Weather, GitHub)", () => {
    it("handles RAG prompts (Powerplay, Wide vs No-Ball, Fielders circle) and renders formatted answers", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply:
            "Under Tournament Rules, maximum 2 fielders are permitted outside the 30-yard circle in powerplay.",
        }),
      });

      render(
        <ChatComponent
          matchId={null}
          apiUrl="https://api.test.com"
          setAlertMessage={vi.fn()}
        />,
      );

      const promptChip = screen.getByRole("button", {
        name: "How many fielders are allowed outside the circle?",
      });
      await act(async () => {
        fireEvent.click(promptChip);
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            /maximum 2 fielders are permitted outside the 30-yard circle/i,
          ),
        ).toBeInTheDocument();
      });
    });

    it("handles DB prompts (Player of the Match, Match analysis) and renders results", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: "Player of the Match was Spartan 3 with 52 runs off 28 balls.",
        }),
      });

      render(
        <ChatComponent
          matchId={null}
          apiUrl="https://api.test.com"
          setAlertMessage={vi.fn()}
        />,
      );

      const pomChip = screen.getByRole("button", {
        name: "Who won Player of the Match in the last match?",
      });
      await act(async () => {
        fireEvent.click(pomChip);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Player of the Match was Spartan 3/i),
        ).toBeInTheDocument();
      });
    });

    it("handles Weather prompts and renders forecast data cleanly", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply:
            "Weather Forecast for Chicago: 68°F / 20°C, Clear Skies, 0% rain chance.",
        }),
      });

      render(
        <ChatComponent
          matchId={null}
          apiUrl="https://api.test.com"
          setAlertMessage={vi.fn()}
        />,
      );

      const weatherChip = screen.getByRole("button", {
        name: "Can you check the weather report for our match?",
      });
      await act(async () => {
        fireEvent.click(weatherChip);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Weather Forecast for Chicago: 68°F/i),
        ).toBeInTheDocument();
      });
    });

    it("handles GitHub Issue prompts and guides the user through reporting", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply:
            "I can help submit an issue to GitHub. Please provide a title and short description.",
        }),
      });

      render(
        <ChatComponent
          matchId={null}
          apiUrl="https://api.test.com"
          setAlertMessage={vi.fn()}
        />,
      );

      const issueChip = screen.getByRole("button", {
        name: "I want to report a bug or request a new feature",
      });
      await act(async () => {
        fireEvent.click(issueChip);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/I can help submit an issue to GitHub/i),
        ).toBeInTheDocument();
      });
    });
  });
});
