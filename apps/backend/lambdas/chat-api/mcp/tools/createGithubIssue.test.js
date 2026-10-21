import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  createGithubIssueTool,
  validateGithubIssueInput,
} = require("./createGithubIssue.js");

describe("createGithubIssue MCP tool", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: "ghp_test_token_123",
      GITHUB_REPO: "venkatesh-singamsetty/cricscore",
      DB_SCHEMA: "dev",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("validates short titles and descriptions", () => {
    expect(
      validateGithubIssueInput({
        title: "abc",
        description: "valid description",
      }).error,
    ).toMatch(/at least 5 characters/i);
    expect(
      validateGithubIssueInput({ title: "Valid title", description: "short" })
        .error,
    ).toMatch(/at least 10 characters/i);
  });

  it("returns error when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    const res = await createGithubIssueTool({
      title: "Scoreboard button alignment issue",
      description: "On mobile view, the button overlaps when text is long.",
      category: "bug",
    });
    expect(res.content[0].text).toContain("not configured");
  });

  it("creates a GitHub issue via REST API and returns issueNumber and url", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        number: 277,
        html_url:
          "https://github.com/venkatesh-singamsetty/cricscore/issues/277",
        title: "[AI Report] Scoreboard button alignment issue",
      }),
    });

    const res = await createGithubIssueTool({
      title: "Scoreboard button alignment issue",
      description: "On mobile view, the button overlaps when text is long.",
      category: "bug",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/venkatesh-singamsetty/cricscore/issues",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer ghp_test_token_123",
        }),
      }),
    );

    const parsed = JSON.parse(res.content[0].text);
    expect(parsed).toEqual({
      created: true,
      issueNumber: 277,
      url: "https://github.com/venkatesh-singamsetty/cricscore/issues/277",
      title: "[AI Report] Scoreboard button alignment issue",
    });
  });
});
