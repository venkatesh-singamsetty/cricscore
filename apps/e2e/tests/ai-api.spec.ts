import { test, expect } from "@playwright/test";

// Define the API URL (matching the core API setup)
const API_URL =
  process.env.API_URL ||
  "https://ispht71fh0.execute-api.us-east-1.amazonaws.com";

test.describe("AI (Agentic RAG) API Integration Tests", () => {
  test("should return successful response for OPTIONS request on /chat", async ({
    request,
  }) => {
    const response = await request.fetch(`${API_URL}/chat`, {
      method: "OPTIONS",
    });

    // API Gateway typically returns 204 for mock OPTIONS integrations or 200 from Lambda
    expect(response.status() === 200 || response.status() === 204).toBeTruthy();
  });

  test("should return 400 for POST /chat if message is missing", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/chat`, {
      data: {
        // Missing "message" field
      },
    });

    // Expecting the Lambda to gracefully catch the missing message and return 400 Bad Request
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Message is required");
  });

  test("should return 400 for POST /chat/summary if matchId is missing", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/chat/summary`, {
      data: {
        // Missing "matchId" field
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("matchId is required");
  });

  test("should return 404 for POST /chat/summary for a non-existent match", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/chat/summary`, {
      data: {
        matchId: "00000000-0000-0000-0000-000000000000",
      },
    });

    // A 404 response proves that the Lambda successfully executed, established a DB connection,
    // queried the matches table, and returned the correct logical Not Found error.
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });
});
