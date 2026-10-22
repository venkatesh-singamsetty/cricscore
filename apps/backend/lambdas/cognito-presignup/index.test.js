import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "./index.js";

describe("cognito-presignup Lambda", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("auto-confirms and verifies guest shadow accounts ending with @cricscore.local", async () => {
    const event = {
      request: {
        userAttributes: {
          email: "guest-1729584000000@cricscore.local",
        },
      },
      response: {},
    };

    const result = await handler(event);

    expect(result.response.autoConfirmUser).toBe(true);
    expect(result.response.autoVerifyEmail).toBe(true);
  });

  it("does not auto-confirm regular user accounts with standard email addresses", async () => {
    const event = {
      request: {
        userAttributes: {
          email: "cricketfan@gmail.com",
        },
      },
      response: {},
    };

    const result = await handler(event);

    expect(result.response.autoConfirmUser).toBeUndefined();
    expect(result.response.autoVerifyEmail).toBeUndefined();
  });

  it("safely handles missing or empty email attributes without crashing", async () => {
    const event = {
      request: {
        userAttributes: {},
      },
      response: {},
    };

    const result = await handler(event);

    expect(result.response.autoConfirmUser).toBeUndefined();
    expect(result.response.autoVerifyEmail).toBeUndefined();
  });
});
