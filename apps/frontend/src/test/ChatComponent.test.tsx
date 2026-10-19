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

    expect(screen.getByText("CricScore AI Assistant")).toBeInTheDocument();
    expect(
      screen.getByText(/Ask questions about the live score/i),
    ).toBeInTheDocument();
  });

  it("renders quick prompt chips and populates chat when clicked", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: "Current run rate is 7.5 per over." }),
    });

    render(
      <ChatComponent
        matchId={null}
        apiUrl="https://api.test.com"
        setAlertMessage={vi.fn()}
      />,
    );

    const chip = screen.getByRole("button", { name: "Current run rate?" });
    expect(chip).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(chip);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Current run rate is 7.5 per over."),
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
    expect(screen.getByText("CricScore AI Assistant")).toBeInTheDocument();
  });
});
