import { describe, it, expect, vi, beforeEach } from "vitest";
import { Pool } from "pg";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { executeSqlTool, validateReadOnlySql } = require("./executeSql.js");
const { searchRulesTool } = require("./searchRules.js");

describe("execute_sql read-only guard", () => {
  it.each([
    "DELETE FROM matches",
    "SELECT 1; DROP TABLE matches",
    "WITH x AS (DELETE FROM matches RETURNING *) SELECT * FROM x",
    "SELECT pg_sleep(10)",
    "UPDATE matches SET status='X'",
    "SELECT scorer_email FROM matches",
    "SELECT id, scorer_email FROM matches",
    "",
  ])("rejects %s", (q) => {
    expect(validateReadOnlySql(q)).not.toBeNull();
  });

  it("allows SELECT and WITH, tolerating a trailing semicolon", () => {
    expect(validateReadOnlySql("SELECT * FROM matches;")).toBeNull();
    expect(
      validateReadOnlySql("WITH a AS (SELECT 1) SELECT * FROM a"),
    ).toBeNull();
  });

  it("does not touch the database for rejected queries", async () => {
    const connect = vi.spyOn(Pool.prototype, "connect");
    connect.mockClear();
    const r = await executeSqlTool({ query: "DELETE FROM matches" });
    expect(r.content[0].text).toContain("Error executing SQL");
    expect(connect).not.toHaveBeenCalled();
  });
});

describe("MCP Tool: execute_sql", () => {
  let querySpy, connectSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DB_SCHEMA = "dev";

    querySpy = vi.fn();
    connectSpy = vi.spyOn(Pool.prototype, "connect").mockResolvedValue({
      query: querySpy,
      release: vi.fn(),
    });
    vi.spyOn(Pool.prototype, "query").mockImplementation(querySpy);
  });

  it("executes a SELECT query and returns JSON rows", async () => {
    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // SET statement_timeout
      .mockResolvedValueOnce({ rows: [{ id: "match-1", status: "LIVE" }] }) // SELECT query
      .mockResolvedValueOnce({}); // COMMIT

    const result = await executeSqlTool({ query: "SELECT * FROM matches" });
    expect(result.content[0].text).toContain("match-1");
  });

  it("redacts scorer_email from result rows to prevent PII leakage", async () => {
    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // SET statement_timeout
      .mockResolvedValueOnce({
        rows: [
          {
            id: "match-1",
            status: "LIVE",
            scorer_email: "secret-scorer@example.com",
          },
        ],
      })
      .mockResolvedValueOnce({}); // COMMIT

    const result = await executeSqlTool({ query: "SELECT * FROM matches" });
    expect(result.content[0].text).toContain("match-1");
    expect(result.content[0].text).not.toContain("secret-scorer@example.com");
    expect(result.content[0].text).not.toContain("scorer_email");
  });

  it("rolls back and returns error message on SQL failure", async () => {
    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // SET statement_timeout
      .mockRejectedValueOnce(new Error("syntax error at or near DROP")); // Actual query

    const result = await executeSqlTool({ query: "DROP TABLE matches" });
    expect(result.content[0].text).toContain("Error executing SQL");
  });

  it("returns fallback message when no rows found", async () => {
    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // SET statement_timeout
      .mockResolvedValueOnce({ rows: [] }) // Actual query
      .mockResolvedValueOnce({}); // COMMIT

    const result = await executeSqlTool({ query: "SELECT 1" });
    expect(result.content[0].text).toBe("[]");
  });

  it("returns connection error if pool.connect fails", async () => {
    connectSpy.mockRejectedValueOnce(new Error("Pool exhausted"));
    const result = await executeSqlTool({ query: "SELECT 1" });
    expect(result.content[0].text).toBe("Failed to connect to database.");
  });
});

describe("MCP Tool: search_tournament_rules", () => {
  let querySpy, connectSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DB_SCHEMA = "dev";

    querySpy = vi.fn();
    connectSpy = vi.spyOn(Pool.prototype, "connect").mockResolvedValue({
      query: querySpy,
      release: vi.fn(),
    });
    vi.spyOn(Pool.prototype, "query").mockImplementation(querySpy);
  });

  const mockEmbedding = Array(1536).fill(0.1);

  it("returns matching rule chunks from pgvector search", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: mockEmbedding }] }),
    });

    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({
        rows: [
          { chunk_text: "LBW rule" },
          { chunk_text: "umpire raises finger" },
        ],
      });

    const result = await searchRulesTool({ query: "what is LBW?" });
    expect(result.content[0].text).toContain("LBW rule");
  });

  it("returns no-rules message when table is empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: mockEmbedding }] }),
    });

    querySpy.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [] });

    const result = await searchRulesTool({ query: "break timings?" });
    expect(result.content[0].text).toContain("No rules document");
  });

  it("returns error message when embedding API fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    const result = await searchRulesTool({ query: "LBW rules" });
    expect(result.content[0].text).toContain("Error searching rules");
  });

  it("passes correct embedding model to OpenRouter API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: mockEmbedding }] }),
    });
    querySpy
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ chunk_text: "rule" }] });

    await searchRulesTool({ query: "rules" });
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.model).toMatch(/text-embedding-3-small/);
  });
});
