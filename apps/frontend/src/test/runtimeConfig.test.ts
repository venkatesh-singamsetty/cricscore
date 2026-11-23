import { describe, it, expect, afterEach } from "vitest";
import { getEnv } from "../utils/runtimeConfig";

describe("runtimeConfig.getEnv", () => {
  afterEach(() => {
    delete window.__CRICSCORE_CONFIG__;
  });

  it("prefers window.__CRICSCORE_CONFIG__ over build-time env when set", () => {
    window.__CRICSCORE_CONFIG__ = {
      VITE_API_URL: "https://api.cricscore.example.com",
      VITE_APP_TITLE: "CricScore Prod",
    };

    expect(getEnv("VITE_API_URL")).toBe("https://api.cricscore.example.com");
    expect(getEnv("VITE_APP_TITLE")).toBe("CricScore Prod");
  });

  it("falls back cleanly to import.meta.env or empty string when runtime config is unset", () => {
    window.__CRICSCORE_CONFIG__ = {};
    expect(typeof getEnv("VITE_API_URL")).toBe("string");
    expect(getEnv("VITE_SENTRY_DSN")).toBe("");
  });
});
