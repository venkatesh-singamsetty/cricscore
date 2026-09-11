import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasCognitoAuthConfig } from "../authConfig";

describe("hasCognitoAuthConfig", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when Cognito env vars are missing", () => {
    vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "");
    vi.stubEnv("VITE_COGNITO_CLIENT_ID", "");

    expect(hasCognitoAuthConfig()).toBe(false);
  });

  it("returns true when both Cognito env vars are configured", () => {
    vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "us-east-1_example");
    vi.stubEnv("VITE_COGNITO_CLIENT_ID", "client-123");

    expect(hasCognitoAuthConfig()).toBe(true);
  });
});
