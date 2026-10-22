import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App, {
  isGuestEmail,
  buildGuestCredentials,
  decodeJwtPayload,
} from "../App";

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
  Authenticator: ({ children }: any) => (
    <div>
      {typeof children === "function"
        ? children({ signOut: vi.fn(), user: null })
        : children}
    </div>
  ),
  useAuthenticator: () => ({
    user: null,
    signOut: vi.fn(),
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
      render(<App />);

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

    it("switches to CHAT BOT tab when clicked", async () => {
      render(<App />);

      const chatTabButton = screen.getByRole("button", {
        name: /CHAT BOT ✨/i,
      });
      fireEvent.click(chatTabButton);

      await waitFor(() => {
        expect(chatTabButton).toHaveClass("text-amber-400");
      });
    });
  });
});
