import { describe, expect, it, beforeEach } from "vitest";
import {
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
