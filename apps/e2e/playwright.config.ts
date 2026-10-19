import { defineConfig, devices } from "@playwright/test";

process.env.BASE_URL =
  process.env.BASE_URL || "https://cricscoredev.venkateshsingamsetty.com";
process.env.API_URL =
  process.env.API_URL || "https://api.cricscoredev.venkateshsingamsetty.com";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL,
    trace: "on-first-retry",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
