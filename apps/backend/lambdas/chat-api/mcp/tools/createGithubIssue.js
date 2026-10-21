const ALLOWED_CATEGORIES = new Set(["bug", "feature-request", "feedback"]);
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DEFAULT_GITHUB_REPO = "venkatesh-singamsetty/cricscore";

/**
 * Validates input parameters before creating a GitHub issue.
 *
 * @param {object} args
 * @param {string} args.title
 * @param {string} args.description
 * @param {string} [args.category]
 * @returns {{ error: string | null, sanitized?: { title: string, description: string, category: string } }}
 */
function validateGithubIssueInput({ title, description, category } = {}) {
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  const cleanDescription =
    typeof description === "string" ? description.trim() : "";
  const cleanCategory =
    typeof category === "string" && ALLOWED_CATEGORIES.has(category.trim())
      ? category.trim()
      : "bug";

  if (!cleanTitle || cleanTitle.length < 5) {
    return {
      error: "Issue title must be at least 5 characters long.",
    };
  }
  if (!cleanDescription || cleanDescription.length < 10) {
    return {
      error:
        "Issue description must be at least 10 characters long with clear details.",
    };
  }

  return {
    error: null,
    sanitized: {
      title: cleanTitle.slice(0, 120),
      description: cleanDescription.slice(0, 2000),
      category: cleanCategory,
    },
  };
}

/**
 * MCP Tool: create_github_issue
 *
 * Creates a GitHub issue in the configured CricScore repository on behalf of a user.
 * Security:
 * - GITHUB_TOKEN stays strictly inside the server-side MCP execution environment.
 * - Repository target is fixed server-side (never user-supplied) to prevent SSRF or cross-repo spam.
 * - Adds 'via-cricscore-ai' label for auditability.
 *
 * @param {object} args
 * @param {string} args.title - Short summary of the issue
 * @param {string} args.description - Detailed reproduction steps or feature request details
 * @param {string} [args.category] - 'bug' | 'feature-request' | 'feedback'
 * @returns {Promise<object>} MCP content response
 */
async function createGithubIssueTool(args = {}) {
  const { error, sanitized } = validateGithubIssueInput(args);
  if (error) {
    return {
      content: [
        { type: "text", text: `Error creating GitHub issue: ${error}` },
      ],
    };
  }

  const token = (process.env.GITHUB_TOKEN || "").trim();
  if (!token) {
    return {
      content: [
        {
          type: "text",
          text: "Error creating GitHub issue: GitHub integration is not configured on the server.",
        },
      ],
    };
  }

  const configuredRepo = (
    process.env.GITHUB_REPO || DEFAULT_GITHUB_REPO
  ).trim();
  const repo = REPO_PATTERN.test(configuredRepo)
    ? configuredRepo
    : DEFAULT_GITHUB_REPO;

  const issueBody = [
    `### Reported via CricScore AI Assistant`,
    `- **Category:** \`${sanitized.category}\``,
    `- **Environment:** \`${process.env.DB_SCHEMA || "dev"}\``,
    `- **Timestamp:** \`${new Date().toISOString()}\``,
    ``,
    `### Description`,
    sanitized.description,
  ].join("\n");

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "CricScore-MCP-Issue-Agent",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `[AI Report] ${sanitized.title}`,
          body: issueBody,
          labels: ["via-cricscore-ai", sanitized.category],
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "MCP Tool [create_github_issue] GitHub API status:",
        response.status,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error creating GitHub issue: GitHub API returned HTTP ${response.status}.`,
          },
        ],
      };
    }

    const data = await response.json();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            created: true,
            issueNumber: data.number,
            url: data.html_url,
            title: data.title,
          }),
        },
      ],
    };
  } catch (err) {
    console.error("MCP Tool [create_github_issue] error:", err.message);
    return {
      content: [
        {
          type: "text",
          text: "Error creating GitHub issue: Failed to reach GitHub API.",
        },
      ],
    };
  }
}

module.exports = {
  createGithubIssueTool,
  validateGithubIssueInput,
  DEFAULT_GITHUB_REPO,
};
