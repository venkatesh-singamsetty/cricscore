import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App, {
  isGuestEmail,
  buildGuestCredentials,
  decodeJwtPayload,
} from "../App";

vi.mock("../authConfig", () => ({
  hasCognitoAuthConfig: vi.fn(() => true),
}));

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: undefined,
    },
  }),
  signOut: vi.fn().mockResolvedValue(undefined),
  signUp: vi.fn().mockResolvedValue(undefined),
  signIn: vi.fn().mockResolvedValue(undefined),
  fetchUserAttributes: vi.fn().mockResolvedValue({}),
}));

vi.mock("aws-amplify/utils", () => ({
  Hub: {
    listen: vi.fn(() => () => {}),
  },
}));

vi.mock("@aws-amplify/ui-react", () => ({
  Authenticator: ({ children, components }: any) => {
    const Footer = components?.SignIn?.Footer;
    return (
      <div data-amplify-authenticator>
        {Footer && <Footer />}
        {typeof children === "function"
          ? children({ signOut: vi.fn(), user: null })
          : children}
      </div>
    );
  },
  useAuthenticator: () => ({
    user: null,
    signOut: vi.fn(),
    toForgotPassword: vi.fn(),
  }),
}));

describe("App Component & Auth Utilities", () => {
  describe("isGuestEmail", () => {
    it("returns true for valid guest shadow account emails", () => {
      expect(isGuestEmail("guest-1729584000000@cricscore.local")).toBe(true);
      expect(isGuestEmail("GUEST-123@CRICSCORE.LOCAL")).toBe(true);
    });

    it("returns false for regular user emails or missing values", () => {
      expect(isGuestEmail("user@example.com")).toBe(false);
      expect(isGuestEmail("guest@gmail.com")).toBe(false);
      expect(isGuestEmail("")).toBe(false);
      expect(isGuestEmail(null)).toBe(false);
      expect(isGuestEmail(undefined)).toBe(false);
    });
  });

  describe("buildGuestCredentials", () => {
    it("generates credentials with expected email format and complex password", () => {
      const fixedTime = 1729584000000;
      const creds = buildGuestCredentials(fixedTime);

      expect(creds.email).toBe("guest-1729584000000@cricscore.local");
      expect(creds.password.startsWith("Gs!")).toBe(true);
      expect(creds.password.endsWith("Aa1")).toBe(true);
      expect(creds.password.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe("decodeJwtPayload", () => {
    it("returns null for null, undefined, or empty token", () => {
      expect(decodeJwtPayload(null)).toBeNull();
      expect(decodeJwtPayload(undefined)).toBeNull();
      expect(decodeJwtPayload("")).toBeNull();
    });

    it("decodes valid JWT payload into a JSON object", () => {
      // payload: { "email": "test@cricscore.com", "cognito:groups": ["Admin"] }
      const payloadObj = {
        email: "test@cricscore.com",
        "cognito:groups": ["Admin"],
      };
      const base64UrlPayload = btoa(JSON.stringify(payloadObj))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const fakeJwt = `header.${base64UrlPayload}.signature`;

      const decoded = decodeJwtPayload(fakeJwt);
      expect(decoded).toEqual(payloadObj);
    });

    it("returns null for corrupted JWT string", () => {
      expect(decodeJwtPayload("not-a-valid-jwt")).toBeNull();
    });
  });

  describe("App Rendering & Navigation", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
    });

    it("renders primary navigation tabs", async () => {
      await act(async () => {
        render(<App />);
      });

      expect(
        screen.getByRole("button", { name: /VIEWER 🌍/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /SCORER 🎮/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /CHAT BOT ✨/i }),
      ).toBeInTheDocument();
    });

    it("renders Continue as Guest without 'No account needed' subtext on Scorer sign-in", async () => {
      await act(async () => {
        render(<App />);
      });

      const scorerTabButton = screen.getByRole("button", {
        name: /SCORER 🎮/i,
      });
      fireEvent.click(scorerTabButton);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Continue as Guest/i }),
        ).toBeInTheDocument();
      });

      // Confirm old helper subtext has been removed
      expect(screen.queryByText(/No account needed/i)).not.toBeInTheDocument();
    });

    it("keeps top navigation bar clean with exactly 3 primary tabs and no standalone SIGN IN button", async () => {
      await act(async () => {
        render(<App />);
      });

      expect(
        screen.getByRole("button", { name: /VIEWER 🌍/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /SCORER 🎮/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /CHAT BOT ✨/i }),
      ).toBeInTheDocument();

      // Top nav bar should not contain a separate SIGN IN tab
      expect(
        screen.queryByRole("button", { name: /^SIGN IN$/i }),
      ).not.toBeInTheDocument();
    });
  });
});
