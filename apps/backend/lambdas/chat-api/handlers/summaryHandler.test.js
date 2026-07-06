import { describe, it, expect, vi, beforeEach } from "vitest";
import { Pool } from "pg";
const { summaryHandler } = require("../handlers/summaryHandler.js");
const { openai } = require("../config/llm.js");

describe("summaryHandler", () => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*" };
  let querySpy, connectSpy, mockCreate;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://openrouter.ai/api/v1";
    process.env.DB_SCHEMA = "dev";

    querySpy = vi.fn();
    connectSpy = vi.spyOn(Pool.prototype, "connect").mockResolvedValue({
      query: querySpy,
      release: vi.fn(),
    });
    vi.spyOn(Pool.prototype, "query").mockImplementation(querySpy);

    mockCreate = vi.spyOn(openai.chat.completions, "create");
  });

  it("returns 400 if matchId is not provided", async () => {
    const res = await summaryHandler(null, corsHeaders);
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 if match not found in DB", async () => {
    querySpy.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [] });
    const res = await summaryHandler("non-existent-id", corsHeaders);
    expect(res.statusCode).toBe(404);
  });

  it("returns cached summary if ai_summary already exists", async () => {
    querySpy.mockResolvedValueOnce({}).mockResolvedValueOnce({
      rows: [
        {
          id: "match-1",
          ai_summary: "Cached text.",
          team_a_name: "A",
          team_b_name: "B",
          status: "COMPLETED",
        },
      ],
    });
    const res = await summaryHandler("match-1", corsHeaders);
    expect(res.statusCode).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("generates summary via LLM and caches it when no prior summary", async () => {
    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({
        rows: [
          {
            id: "m2",
            team_a_name: "A",
            team_b_name: "B",
            status: "COMPLETED",
            team_a_score: 50,
            team_a_wickets: 3,
            team_b_score: 51,
            team_b_wickets: 2,
            toss_winner: "A",
            toss_decision: "BAT",
            match_winner: "B",
          },
        ],
      }) // match query
      .mockResolvedValueOnce({
        rows: [
          {
            name: "Rohit",
            runs: 30,
            balls_faced: 20,
            fours: 3,
            sixes: 1,
            batting_team_name: "A",
          },
        ],
      }) // batters
      .mockResolvedValueOnce({
        rows: [
          {
            name: "Bumrah",
            wickets: 2,
            runs_conceded: 10,
            bowling_team_name: "B",
          },
        ],
      }) // bowlers
      .mockResolvedValueOnce({
        rows: [
          { inning_number: 1, legal_balls: 6 },
          { inning_number: 2, legal_balls: 6 },
        ],
      }) // ball count query
      .mockResolvedValueOnce({}); // UPDATE cache

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Thrilling match." } }],
    });

    const res = await summaryHandler("m2", corsHeaders);
    expect(res.statusCode).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on LLM failure", async () => {
    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({
        rows: [
          { id: "m3", team_a_name: "A", team_b_name: "B", status: "COMPLETED" },
        ],
      }) // match query
      .mockResolvedValueOnce({ rows: [] }) // batters
      .mockResolvedValueOnce({ rows: [] }) // bowlers
      .mockResolvedValueOnce({ rows: [] }); // ball count query

    mockCreate.mockRejectedValue(new Error("LLM API error"));
    const res = await summaryHandler("m3", corsHeaders);
    expect(res.statusCode).toBe(500);
  });
});
