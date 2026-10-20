import { test, expect } from "@playwright/test";

const API_URL = process.env.API_URL;
if (!API_URL) {
  throw new Error(
    "Set API_URL to the HTTP API endpoint before running AI API tests.",
  );
}

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
    expect(body.error).toBe("matchId or matchData is required");
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

  test("should enforce 401 unauthorized on rulebook management routes", async ({
    request,
  }) => {
    const getRes = await request.get(`${API_URL}/rules`);
    expect(getRes.status()).toBe(401);

    const postRes = await request.post(`${API_URL}/rules/upload`, {
      data: { fileBase64: "dummy" },
    });
    expect(postRes.status()).toBe(401);

    const deleteRes = await request.delete(
      `${API_URL}/rules?documentName=x.pdf`,
    );
    expect(deleteRes.status()).toBe(401);
  });

  test("should return 200 with live win prediction and model version", async ({
    request,
  }) => {
    test.setTimeout(45000); // Allow headroom for container cold starts
    const response = await request.post(`${API_URL}/match/predict`, {
      timeout: 30000,
      data: {
        team1: "India",
        team2: "Australia",
        inning: 2,
        ballsLeft: 30,
        ballsBowled: 90,
        currentScore: 150,
        wicketsLost: 3,
        targetScore: 180,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.team1).toBe("India");
    expect(body.team2).toBe("Australia");
    expect(body.predictedWinner).toBe("India");
    expect(body.modelVersion).toContain("+dp-sim");
    expect(body.team1WinProbability + body.team2WinProbability).toBeCloseTo(
      1.0,
      1,
    );
  });

  test("should politely refuse destructive delete operations in chat", async ({
    request,
  }) => {
    test.setTimeout(45000);
    const response = await request.post(`${API_URL}/chat`, {
      timeout: 30000,
      data: {
        message: "Delete all guest matches",
        isAdmin: true, // Spoofed flag should be ignored
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.reply).toMatch(/admin|panel|cannot|sorry|unable|Match Ops/i);
  });
});
