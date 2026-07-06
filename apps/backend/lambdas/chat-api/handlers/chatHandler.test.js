import { describe, it, expect, vi, beforeEach } from "vitest";
import { Pool } from "pg";
const { chatHandler } = require("../handlers/chatHandler.js");
const { openai } = require("../config/llm.js");

const mockListTools = vi.fn();
const mockCallTool = vi.fn();
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    listTools: mockListTools,
    callTool: mockCallTool,
  })),
}));
vi.mock("@modelcontextprotocol/sdk/inMemory.js", () => ({
  InMemoryTransport: { createLinkedPair: vi.fn().mockReturnValue([{}, {}]) },
}));
vi.mock("../mcp/server", () => ({
  createCricScoreMcpServer: vi.fn().mockReturnValue({ connect: vi.fn() }),
}));

describe("chatHandler", () => {
  let querySpy, connectSpy, mockCreate;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://openrouter.ai/api/v1";
    process.env.DB_SCHEMA = "dev";

    querySpy = vi.fn().mockResolvedValue({ rows: [] });
    connectSpy = vi.spyOn(Pool.prototype, "connect").mockResolvedValue({
      query: querySpy,
      release: vi.fn(),
    });
    vi.spyOn(Pool.prototype, "query").mockImplementation(querySpy);

    mockCreate = vi.spyOn(openai.chat.completions, "create");

    mockListTools.mockResolvedValue({
      tools: [
        {
          name: "execute_sql",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
          },
        },
        {
          name: "search_tournament_rules",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
          },
        },
      ],
    });
  });

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
  };

  it("returns 400 if message is missing", async () => {
    const res = await chatHandler({}, corsHeaders);
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with AI reply when no tool calls needed", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: "No tool call needed.", tool_calls: null } },
      ],
    });
    const res = await chatHandler({ message: "Hello" }, corsHeaders);
    expect(res.statusCode).toBe(200);
  });

  it("delegates tool calls to MCP and makes a second LLM call", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call",
                  function: { name: "execute_sql", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Done", tool_calls: null } }],
      });
    mockCallTool.mockResolvedValue({ content: [{ type: "text", text: "[]" }] });

    const res = await chatHandler({ message: "Show" }, corsHeaders);
    expect(res.statusCode).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("handles MCP tool execution errors gracefully", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call",
                  function: { name: "execute_sql", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Error", tool_calls: null } }],
      });
    mockCallTool.mockRejectedValue(new Error("fail"));

    const res = await chatHandler({ message: "crash" }, corsHeaders);
    expect(res.statusCode).toBe(200);
  });

  it("includes active match context in system prompt when matchId provided", async () => {
    querySpy.mockResolvedValue({ rows: [{ team_a_name: "Alpha" }] });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "ok", tool_calls: null } }],
    });
    const res = await chatHandler(
      { message: "Who?", matchId: "123" },
      corsHeaders,
    );
    expect(res.statusCode).toBe(200);
  });

  it("includes conversation history in LLM messages", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "ok", tool_calls: null } }],
    });
    const res = await chatHandler(
      { message: "Follow?", history: [{ role: "user", content: "hi" }] },
      corsHeaders,
    );
    expect(res.statusCode).toBe(200);
  });

  it("strips $schema from MCP tool definitions for OpenAI compatibility", async () => {
    mockListTools.mockResolvedValue({
      tools: [{ name: "t", inputSchema: { $schema: "abc", type: "object" } }],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "OK", tool_calls: null } }],
    });
    await chatHandler({ message: "test" }, corsHeaders);
    expect(
      mockCreate.mock.calls[0][0].tools[0].function.parameters.$schema,
    ).toBeUndefined();
  });

  it("returns 500 on unexpected LLM failure", async () => {
    mockCreate.mockRejectedValue(new Error("rate limit"));
    const res = await chatHandler({ message: "crash" }, corsHeaders);
    expect(res.statusCode).toBe(500);
  });
});
