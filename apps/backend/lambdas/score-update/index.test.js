import { describe, it, expect, vi, beforeEach } from "vitest";
process.env.MATCH_EVENTS_TOPIC =
  "arn:aws:sns:us-east-1:123456789012:test-topic";
process.env.STORAGE_BUFFER_QUEUE =
  "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue.fifo";
import { handler } from "./index.js";
import { SNSClient } from "@aws-sdk/client-sns";
import { SQSClient } from "@aws-sdk/client-sqs";

import pg from "pg";

export const mockQuery = vi
  .fn()
  .mockResolvedValue({ rows: [{ scorer_email: "scorer@test.com" }] });
export const mockRelease = vi.fn();
const mockClient = { query: mockQuery, release: mockRelease };
export const mockConnect = vi
  .spyOn(pg.Pool.prototype, "connect")
  .mockResolvedValue(mockClient);

// Mock SNS Client using prototype
export const mockSend = vi
  .spyOn(SNSClient.prototype, "send")
  .mockResolvedValue({ MessageId: "mock-sns-id-123" });

// Mock SQS Client using prototype
export const mockSqsSend = vi
  .spyOn(SQSClient.prototype, "send")
  .mockResolvedValue({ MessageId: "mock-sqs-id-123" });

describe("score-update Lambda handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MATCH_EVENTS_TOPIC =
      "arn:aws:sns:us-east-1:123456789012:test-topic";
  });

  it("should return CORS preflight response for OPTIONS method", async () => {
    const event = { httpMethod: "OPTIONS" };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Methods"]).toContain(
      "POST,OPTIONS",
    );
  });

  it("should publish STATE_SYNC event to SNS and return success", async () => {
    const event = {
      requestContext: {
        authorizer: { jwt: { claims: { email: "scorer@test.com" } } },
      },
      body: JSON.stringify({
        matchId: "match_123",
        inningId: "inning_123",
        syncOnly: true,
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.messageId).toBe("mock-sns-id-123");
  });

  it("should publish LIVE_SCORE_UPDATE event to SNS and return success", async () => {
    const event = {
      requestContext: {
        authorizer: { jwt: { claims: { email: "scorer@test.com" } } },
      },
      body: JSON.stringify({
        matchId: "match_123",
        inningId: "inning_123",
        runs: 4,
        ball: 1,
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.messageId).toBe("mock-sns-id-123");
    expect(mockRelease).toHaveBeenCalled();
  });

  it("should reject payload missing matchId or inningId without connecting to DB", async () => {
    const event = {
      requestContext: {
        authorizer: { jwt: { claims: { email: "scorer@test.com" } } },
      },
      body: JSON.stringify({ matchId: "match_123" }), // Missing inningId
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain(
      "Missing required fields",
    );
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("should reject invalid JSON body with 400 Bad Request", async () => {
    const event = {
      requestContext: {
        authorizer: { jwt: { claims: { email: "scorer@test.com" } } },
      },
      body: "invalid-json{",
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain("Invalid JSON");
  });

  it("should reject unauthorized user who is not scorer or admin with 403", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ scorer_email: "different-scorer@test.com" }],
    });

    const event = {
      requestContext: {
        authorizer: { jwt: { claims: { email: "attacker@test.com" } } },
      },
      body: JSON.stringify({
        matchId: "match_123",
        inningId: "inning_123",
        runs: 1,
      }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(403);
    expect(mockRelease).toHaveBeenCalled();
  });

  it("should reject user with group 'NotAdmin' or 'OrgAdmin' if not the scorer", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ scorer_email: "scorer@test.com" }],
    });

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "imposter@test.com",
              "cognito:groups": "[NotAdmin, OrgAdmin]",
            },
          },
        },
      },
      body: JSON.stringify({
        matchId: "match_123",
        inningId: "inning_123",
        runs: 1,
      }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(403);
  });

  it("should permit user in exact 'Admin' cognito group even if not the scorer", async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "admin@test.com",
              "cognito:groups": "[Admin]",
            },
          },
        },
      },
      body: JSON.stringify({
        matchId: "match_123",
        inningId: "inning_123",
        runs: 1,
      }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).success).toBe(true);
  });

  it("should permit superadmin matching ADMIN_REPORT_EMAIL even if not the scorer", async () => {
    process.env.ADMIN_REPORT_EMAIL = "superadmin@cricscore.test";
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "superadmin@cricscore.test",
            },
          },
        },
      },
      body: JSON.stringify({
        matchId: "match_123",
        inningId: "inning_123",
        runs: 1,
      }),
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).success).toBe(true);
  });
});
