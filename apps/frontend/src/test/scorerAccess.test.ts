import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  buildGuestCredentials,
  canAccessScorer,
  getStoredAuthFromLocalStorage,
  isGuestEmail,
} from "../App";

describe("canAccessScorer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("allows a signed-in user with an email even before token hydration completes", () => {
    expect(
      canAccessScorer({
        shouldBypassAuth: false,
        isGuestScorer: false,
        userToken: null,
        userEmail: "venky.2k57@gmail.com",
      }),
    ).toBe(true);
  });

  it("prefers the active Cognito user over stale guest auth tokens", () => {
    const guestEmail = "guest-123@cricscore.local";
    const userEmail = "venky.2k57@gmail.com";
    const guestToken = `header.${btoa(JSON.stringify({ email: guestEmail }))}.signature`;
    const activeUserToken = `header.${btoa(JSON.stringify({ email: userEmail }))}.signature`;

    window.localStorage.setItem(
      "CognitoIdentityServiceProvider.test-client.guest-user.idToken",
      guestToken,
    );
    window.localStorage.setItem(
      "CognitoIdentityServiceProvider.test-client.LastAuthUser",
      "real-user-id",
    );
    window.localStorage.setItem(
      "CognitoIdentityServiceProvider.test-client.real-user-id.idToken",
      activeUserToken,
    );

    const auth = getStoredAuthFromLocalStorage();

    expect(auth.token).toBe(activeUserToken);
    expect(auth.email).toBe(userEmail);
  });

  it("treats guest accounts as guest-only and real accounts as authenticated", () => {
    expect(isGuestEmail("guest-123@cricscore.local")).toBe(true);
    expect(isGuestEmail("venky.2k57@gmail.com")).toBe(false);
    expect(
      canAccessScorer({
        shouldBypassAuth: false,
        isGuestScorer: false,
        userToken: null,
        userEmail: "venky.2k57@gmail.com",
      }),
    ).toBe(true);
  });

  it("blocks access when there is no auth and no guest mode", () => {
    expect(
      canAccessScorer({
        shouldBypassAuth: false,
        isGuestScorer: false,
        userToken: null,
        userEmail: null,
      }),
    ).toBe(false);
  });
});

describe("buildGuestCredentials", () => {
  it("creates a guest shadow email recognised as guest and a strong password", () => {
    const { email, password } = buildGuestCredentials(1700000000000);
    expect(email).toBe("guest-1700000000000@cricscore.local");
    expect(isGuestEmail(email)).toBe(true);
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it("generates a unique password per guest", () => {
    expect(buildGuestCredentials(1).password).not.toBe(
      buildGuestCredentials(1).password,
    );
  });

  it("uses Web Crypto when randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(15);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    try {
      expect(buildGuestCredentials(1).password).toBe(
        `Gs!${"0f".repeat(24)}Aa1`,
      );
      expect(getRandomValues).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not generate guest credentials without secure randomness", () => {
    vi.stubGlobal("crypto", {});

    try {
      expect(() => buildGuestCredentials(1)).toThrow(
        "Secure randomness is unavailable",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
