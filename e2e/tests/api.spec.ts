import { test, expect } from "@playwright/test";

// Define the API URL
const API_URL = "https://ispht71fh0.execute-api.us-east-1.amazonaws.com";

test.describe("CricScore API Integration Tests", () => {
  test("should return healthy DB status from /health endpoint", async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/health`);

    // Health endpoint must return 200 — a 503 means DB is down
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.database).toBe("connected");
  });

  test("should return successful response for OPTIONS request on /matches", async ({
    request,
  }) => {
    const response = await request.fetch(`${API_URL}/matches`, {
      method: "OPTIONS",
    });

    // API Gateway typically returns 204 for mock OPTIONS integrations or 200 from Lambda
    expect(response.status() === 200 || response.status() === 204).toBeTruthy();
  });

  test("should fetch list of matches successfully", async ({ request }) => {
    const response = await request.get(`${API_URL}/matches`);

    // We expect a 200 OK since the DB is active
    expect(response.status()).toBe(200);

    const body = await response.json();
    // It should be an array of matches
    expect(Array.isArray(body)).toBeTruthy();
  });

  test("should return 404 for a non-existent match details", async ({
    request,
  }) => {
    // Must use valid UUID format so Postgres doesn't throw a 500 error
    const response = await request.get(
      `${API_URL}/match/00000000-0000-0000-0000-000000000000/details`,
    );

    expect(response.status()).toBe(404);
  });
});
