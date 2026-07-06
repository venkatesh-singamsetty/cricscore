import { describe, it, expect, vi, beforeEach } from "vitest";
import { Pool } from "pg";
const { listRulesHandler } = require("./listRulesHandler.js");

describe("listRulesHandler", () => {
  let querySpy, releaseSpy, connectSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    querySpy = vi.fn();
    releaseSpy = vi.fn();
    connectSpy = vi.spyOn(Pool.prototype, "connect").mockResolvedValue({
      query: querySpy,
      release: releaseSpy,
    });
  });

  it("should return list of unique document names", async () => {
    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({
        rows: [
          { document_name: "rules2025.pdf" },
          { document_name: "rules2026.pdf" },
        ],
      });

    const response = await listRulesHandler(
      {},
      { "Access-Control-Allow-Origin": "*" },
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.documents).toEqual(["rules2025.pdf", "rules2026.pdf"]);

    expect(querySpy).toHaveBeenCalledTimes(2);
    expect(releaseSpy).toHaveBeenCalled();
  });

  it("should handle database errors gracefully", async () => {
    querySpy.mockRejectedValueOnce(new Error("DB Connection failed"));

    const response = await listRulesHandler(
      {},
      { "Access-Control-Allow-Origin": "*" },
    );

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Failed to list documents");
    expect(releaseSpy).toHaveBeenCalled();
  });
});
