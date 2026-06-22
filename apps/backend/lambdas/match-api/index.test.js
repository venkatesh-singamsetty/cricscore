import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.js";

// Mock the AWS SDK Clients
vi.mock("@aws-sdk/client-lambda", () => {
  return {
    LambdaClient: vi.fn().mockImplementation(function () {
      this.send = vi.fn().mockResolvedValue({});
    }),
    InvokeCommand: vi.fn(),
  };
});

vi.mock("@aws-sdk/client-ses", () => {
  return {
    SESClient: vi.fn().mockImplementation(function () {
      this.send = vi.fn().mockResolvedValue({});
    }),
    SendEmailCommand: vi.fn(),
  };
});

// Mock the PG Client
import pg from "pg";

export const mockQuery = vi
  .spyOn(pg.Client.prototype, "query")
  .mockResolvedValue({ rows: [] });
export const mockConnect = vi
  .spyOn(pg.Client.prototype, "connect")
  .mockResolvedValue();
export const mockEnd = vi.spyOn(pg.Client.prototype, "end").mockResolvedValue();

describe("match-api Lambda handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue();
    mockEnd.mockResolvedValue();
  });

  it("should return CORS preflight response for OPTIONS method", async () => {
    const event = { httpMethod: "OPTIONS" };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Methods"]).toContain(
      "OPTIONS",
    );
  });

  it("should delete a match and notify broadcaster", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // Mock delete success

    const event = {
      httpMethod: "DELETE",
      pathParameters: { matchId: "123" },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      "Match deleted successfully",
    );
    expect(mockQuery).toHaveBeenCalledWith(
      "DELETE FROM matches WHERE id = $1",
      ["123"],
    );
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should create a new match successfully", async () => {
    // Mock the insertion of match and innings
    mockQuery
      .mockResolvedValueOnce() // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: "match_123" }] }) // Insert match
      .mockResolvedValueOnce({ rows: [{ id: "inning_123" }] }) // Insert inning
      .mockResolvedValueOnce(); // COMMIT

    const event = {
      httpMethod: "POST",
      path: "/match",
      body: JSON.stringify({
        teamA: "India",
        teamB: "Australia",
        totalOvers: 20,
        batFirstTeam: "India",
        teamASquad: ["Player1"],
        teamBSquad: [],
      }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).matchId).toBe("match_123");
    expect(mockQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("should return healthy status for GET /health if DB is connected", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ok: 1 }] });

    const event = { httpMethod: "GET", path: "/health" };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("healthy");
    expect(body.database).toBe("connected");
  });

  it("should return unhealthy status for GET /health if DB fails", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Connection refused"));

    const event = { httpMethod: "GET", path: "/health" };
    const response = await handler(event);

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("unhealthy");
    expect(body.database).toBe("disconnected");
  });

  it("should fetch all matches for GET /matches", async () => {
    mockQuery
      .mockResolvedValueOnce() // Mock the proactive cleanup UPDATE
      .mockResolvedValueOnce({
        rows: [
          { id: "match_1", team_a_name: "India", team_b_name: "Australia" },
        ],
      }); // Mock the SELECT

    const event = { httpMethod: "GET", path: "/matches" };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).length).toBe(1);
    expect(JSON.parse(response.body)[0].id).toBe("match_1");
  });

  it("should update match metadata for PATCH /match/{matchId}", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "match_123", status: "COMPLETED" }],
    }); // UPDATE
    // Since status is COMPLETED, it will also trigger two more queries
    mockQuery.mockResolvedValueOnce(); // UPDATE innings
    mockQuery.mockResolvedValueOnce(); // Sync scores

    const event = {
      httpMethod: "PATCH",
      pathParameters: { matchId: "match_123" },
      body: JSON.stringify({ status: "COMPLETED" }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).status).toBe("COMPLETED");
  });
});
