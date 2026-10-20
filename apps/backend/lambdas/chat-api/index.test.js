import { describe, it, expect, vi, beforeEach } from "vitest";
import { Pool } from "pg";

const { handler } = require("./index.js");
const { isAdmin } = require("./config/auth.js");

const ev = (method, path, claims, extra = {}) => ({
  httpMethod: method,
  path,
  requestContext: { authorizer: claims ? { claims } : undefined },
  ...extra,
});

describe("rulebook routes are admin-only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_REPORT_EMAIL = "root@example.com";
    vi.spyOn(Pool.prototype, "connect").mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    });
  });

  it.each([
    ["POST", "/rules/upload"],
    ["GET", "/rules"],
    ["DELETE", "/rules"],
  ])("%s %s returns 403 without a token", async (m, p) => {
    expect((await handler(ev(m, p, null, { body: "{}" }))).statusCode).toBe(
      403,
    );
  });

  it("returns 403 for a signed-in non-admin", async () => {
    const r = await handler(
      ev("DELETE", "/rules", {
        email: "a@b.com",
        "cognito:groups": "[Scorer]",
      }),
    );
    expect(r.statusCode).toBe(403);
  });

  it("ignores admin hints in body/headers", async () => {
    const r = await handler(
      ev("DELETE", "/rules", null, {
        body: JSON.stringify({ isAdmin: true }),
        headers: { "x-scorer-email": "root@example.com" },
      }),
    );
    expect(r.statusCode).toBe(403);
  });

  it("allows an Admin group member", async () => {
    const r = await handler(
      ev(
        "DELETE",
        "/rules",
        { email: "a@b.com", "cognito:groups": "[Admin]" },
        {
          queryStringParameters: { documentName: "x.pdf" },
        },
      ),
    );
    expect(r.statusCode).toBe(200);
  });

  it("does not treat similarly named groups as Admin", () => {
    expect(
      isAdmin(
        ev("GET", "/rules", { "cognito:groups": "[SuperAdmin NotAdmin]" }),
      ),
    ).toBe(false);
  });

  it("allows the configured super admin email", () => {
    expect(isAdmin(ev("GET", "/rules", { email: "root@example.com" }))).toBe(
      true,
    );
  });
});
