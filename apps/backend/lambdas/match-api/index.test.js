import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handler,
  stripPlayerOfMatchLine,
  sendMatchReportEmail,
} from "./index.js";

// Mock the AWS SDK Clients
vi.mock("@aws-sdk/client-lambda", () => {
  return {
    LambdaClient: vi.fn().mockImplementation(function () {
      this.send = vi.fn().mockResolvedValue({});
    }),
    InvokeCommand: vi.fn(),
  };
});

vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn(),
    PutObjectCommand: vi.fn(),
  };
});

vi.mock("@aws-sdk/client-cognito-identity-provider", () => {
  return {
    CognitoIdentityProviderClient: vi.fn(),
    AdminAddUserToGroupCommand: vi.fn(),
  };
});

const { MockSendEmailCommand, MockSESClient } = vi.hoisted(() => {
  const MockSendEmailCommand = vi.fn(function (input) {
    this.input = input;
  });
  const MockSESClient = vi.fn().mockImplementation(function () {
    this.send = vi.fn().mockResolvedValue({});
  });
  return { MockSendEmailCommand, MockSESClient };
});

vi.mock("@aws-sdk/client-ses", () => {
  return {
    SESClient: MockSESClient,
    SendEmailCommand: MockSendEmailCommand,
  };
});

// Mock the pooled PG client
import pg from "pg";

export const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
export const mockRelease = vi.fn();
const mockClient = { query: mockQuery, release: mockRelease };
export const mockConnect = vi
  .spyOn(pg.Pool.prototype, "connect")
  .mockResolvedValue(mockClient);

describe("match-api Lambda handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(mockClient);
  });

  it("should return CORS preflight response for OPTIONS method", async () => {
    const event = { httpMethod: "OPTIONS" };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Methods"]).toContain(
      "OPTIONS",
    );
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("should delete a match and notify broadcaster", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ scorer_email: "test@example.com" }],
    }); // Mock Auth check
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // Mock delete success

    const event = {
      httpMethod: "DELETE",
      pathParameters: { matchId: "123" },
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
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
    expect(mockRelease).toHaveBeenCalled();
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
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
      body: JSON.stringify({
        teamA: "India",
        teamB: "Australia",
        totalOvers: 20,
        batFirstTeam: "India",
        tossWinner: "India",
        tossDecision: "BAT",
        teamASquad: ["Player1"],
        teamBSquad: [],
        scorerEmail: "test@example.com",
      }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).matchId).toBe("match_123");

    // Verify that toss fields, scorer_email, and is_test were passed to the INSERT query
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO matches"),
      [
        "India",
        "Australia",
        20,
        "India",
        "India",
        "BAT",
        "LIVE",
        "test@example.com",
        false,
      ],
    );
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

  it("should remove a separate Player of the Match line from an email summary", () => {
    const summary =
      "🏆 Player of the Match: PLAYER A1 - took 3 wickets for 8 runs\n\nTEAM A won the toss.";

    expect(stripPlayerOfMatchLine(summary)).toBe("TEAM A won the toss.");
  });

  it("should remove decorated POM lines and preserve regular mentions", () => {
    const summary =
      "🏏 # POM – PLAYER A1\nPlayer of the Matchday: keep this line\n# pom: PLAYER B2\nMatch summary";

    expect(stripPlayerOfMatchLine(summary)).toBe(
      "Player of the Matchday: keep this line\nMatch summary",
    );
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
      rows: [{ scorer_email: "test@example.com" }],
    }); // Mock Auth check
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "match_123", status: "COMPLETED" }],
    }); // UPDATE
    // Since status is COMPLETED, it will also trigger two more queries
    mockQuery.mockResolvedValueOnce(); // UPDATE innings
    mockQuery.mockResolvedValueOnce(); // Sync scores

    const event = {
      httpMethod: "PATCH",
      pathParameters: { matchId: "match_123" },
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
      body: JSON.stringify({ status: "COMPLETED" }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).status).toBe("COMPLETED");
  });

  it("should return 403 Forbidden if user is unauthorized", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ scorer_email: "owner@example.com" }],
    }); // Mock Auth check

    const event = {
      httpMethod: "DELETE",
      pathParameters: { matchId: "123" },
      requestContext: {
        authorizer: { jwt: { claims: { email: "attacker@example.com" } } },
      },
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(403);
    expect(response.body).toBe("Forbidden");
  });

  it("should allow admin group member to delete any match", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ scorer_email: "owner@example.com" }],
    }); // Auth check — owner is different
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // Delete success

    const event = {
      httpMethod: "DELETE",
      pathParameters: { matchId: "123" },
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "admin@example.com",
              "cognito:groups": ["Admin"],
            },
          },
        },
      },
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      "Match deleted successfully",
    );
  });

  it("should return 401 Unauthorized if POST /match has no JWT claims", async () => {
    const event = {
      httpMethod: "POST",
      path: "/match",
      requestContext: {
        authorizer: { jwt: { claims: {} } }, // No email claim
      },
      body: JSON.stringify({
        teamA: "India",
        teamB: "Australia",
        totalOvers: 20,
        batFirstTeam: "India",
        tossWinner: "India",
        tossDecision: "BAT",
        teamASquad: ["Player1"],
        teamBSquad: ["Player2"],
        scorerEmail: "notset@example.com",
      }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(401);
  });

  it("should return 403 if non-admin tries to purge DELETE /matches", async () => {
    const event = {
      httpMethod: "DELETE",
      path: "/matches",
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "regular@example.com",
              "cognito:groups": [],
            },
          },
        },
      },
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(403);
  });

  it("should return 403 if user with substring group 'NotAdmin' tries to purge DELETE /matches", async () => {
    const event = {
      httpMethod: "DELETE",
      path: "/matches",
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "attacker@example.com",
              "cognito:groups": "[NotAdmin, OrgAdmin]",
            },
          },
        },
      },
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(403);
    expect(response.body).toContain("Admins only");
  });

  it("should allow admin with serialized '[Admin]' cognito:groups to call DELETE /matches", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // TRUNCATE query
    const event = {
      httpMethod: "DELETE",
      path: "/matches",
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "admin@example.com",
              "cognito:groups": "[Admin]",
            },
          },
        },
      },
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("TRUNCATE table ball_events"),
    );
  });

  it("should return 403 if non-admin calls GET /admin/users", async () => {
    const event = {
      httpMethod: "GET",
      path: "/admin/users",
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "regular@example.com",
              "cognito:groups": [],
            },
          },
        },
      },
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error).toContain("Admins only");
  });

  it("should idempotently upsert 2nd innings via ON CONFLICT (match_id, inning_number) when restarting 2nd innings", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ scorer_email: "test@example.com" }],
      }) // Auth check
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // UPDATE innings SET is_completed = true
      .mockResolvedValueOnce({ rows: [{ id: "inning_2_uuid" }] }) // INSERT ... ON CONFLICT DO UPDATE RETURNING id
      .mockResolvedValueOnce({ rows: [] }) // INSERT player 1
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const event = {
      httpMethod: "POST",
      path: "/match/match_123/innings",
      pathParameters: { id: "match_123", matchId: "match_123" },
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
      body: JSON.stringify({
        matchId: "match_123",
        inningNumber: 2,
        battingTeam: "Australia",
        bowlingTeam: "India",
        target: 15,
        battingSquad: ["Warner"],
        bowlingSquad: [],
        previousInnings: {
          id: "inn_1",
          totalRuns: 14,
          totalWickets: 2,
          overs: 2,
          balls: 0,
        },
      }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).inningId).toBe("inning_2_uuid");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET is_completed = TRUE"),
      ["match_123", 1, 14, 2, 2, 0],
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (match_id, inning_number)"),
      ["match_123", 2, "Australia", "India", 15],
    );
  });

  it("should resolve optimistic inn2_ id by match_id and inning_number=2 when completing a match", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ scorer_email: "test@example.com" }],
      }) // Auth check
      .mockResolvedValueOnce({
        rows: [{ id: "match_123", status: "COMPLETED" }],
      }); // UPDATE matches

    const event = {
      httpMethod: "PATCH",
      pathParameters: { matchId: "match_123" },
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
      body: JSON.stringify({
        status: "COMPLETED",
        finalInnings: {
          id: "inn2_1729290000000",
          totalRuns: 16,
          totalWickets: 1,
          overs: 0,
          balls: 5,
        },
        previousInnings: {
          id: "inning_1_uuid",
          totalRuns: 14,
          totalWickets: 0,
          overs: 1,
          balls: 0,
        },
      }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      "UPDATE innings SET total_runs = $1, total_wickets = $2, overs = $3, balls = $4 WHERE match_id = $5 AND inning_number = 2",
      [16, 1, 0, 5, "match_123"],
    );
  });

  it("should allow admin to delete all test matches", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 4 });

    const event = {
      httpMethod: "DELETE",
      path: "/admin/matches/test",
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "admin@example.com",
              "cognito:groups": ["Admin"],
            },
          },
        },
      },
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.deletedMatchesCount).toBe(4);
    expect(body.message).toContain("Deleted 4 test matches");
  });

  it("should forbid non-admin from deleting test matches", async () => {
    const event = {
      httpMethod: "DELETE",
      path: "/admin/matches/test",
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "regular@example.com",
            },
          },
        },
      },
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error).toContain("Forbidden");
  });

  it("generates match report email with table-layout: fixed and white-space: nowrap on player names", async () => {
    const mockClientInstance = {
      query: vi.fn().mockImplementation((query) => {
        if (typeof query === "string" && query.includes("FROM matches")) {
          return Promise.resolve({
            rows: [
              {
                id: "match_abc",
                team_a_name: "CHICAGO SPARTANS",
                team_b_name: "MIDWEST GLADIATORS",
                scorer_email: "scorer@example.com",
                status: "COMPLETED",
                created_at: new Date().toISOString(),
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    };

    const reportState = {
      innings: [
        {
          id: "inn_1",
          battingTeamName: "CHICAGO SPARTANS",
          totalRuns: 100,
          totalWickets: 2,
          overs: 10,
          balls: 0,
          players: [
            {
              name: "SPARTAN 1",
              runs: 45,
              ballsFaced: 30,
              fours: 4,
              sixes: 1,
              isOut: false,
            },
          ],
          bowlers: [
            {
              name: "GLADIATOR 1",
              overs: 2,
              balls: 0,
              runsConceded: 15,
              wickets: 1,
            },
          ],
        },
        {
          id: "inn_2",
          battingTeamName: "MIDWEST GLADIATORS",
          totalRuns: 99,
          totalWickets: 5,
          overs: 10,
          balls: 0,
          players: [
            {
              name: "GLADIATOR 1",
              runs: 40,
              ballsFaced: 28,
              fours: 3,
              sixes: 1,
              isOut: true,
              wicketType: "BOWLED",
              wicketBy: "SPARTAN 2",
            },
          ],
          bowlers: [
            {
              name: "SPARTAN 2",
              overs: 2,
              balls: 0,
              runsConceded: 12,
              wickets: 1,
            },
          ],
        },
      ],
    };

    const mockSend = vi.fn().mockResolvedValue({});
    const mockSes = { send: mockSend };

    await sendMatchReportEmail(
      "match_abc",
      "recipient@example.com",
      "https://cricscoredev.venkateshsingamsetty.com",
      reportState,
      mockClientInstance,
      false,
      mockSes,
    );

    expect(mockSend).toHaveBeenCalled();
    const sentCommand = mockSend.mock.calls[0][0];
    const htmlBody = sentCommand.input.Message.Body.Html.Data;

    // Verify table-layout: fixed is enforced for aligned scorecard columns
    expect(htmlBody).toContain("table-layout: fixed");

    // Verify white-space: nowrap and 13px font size are applied to player name cells
    expect(htmlBody).toContain("white-space: nowrap; font-size: 13px;");
    expect(htmlBody).toContain("SPARTAN 1 *");
    expect(htmlBody).toContain("GLADIATOR 1");
  });
});
