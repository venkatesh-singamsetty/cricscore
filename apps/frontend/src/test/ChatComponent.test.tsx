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

    const sendBtn = screen.getByRole("button", { name: "" }); // icon button
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Leg Byes count as extras.")).toBeInTheDocument();
    });
  });
});
