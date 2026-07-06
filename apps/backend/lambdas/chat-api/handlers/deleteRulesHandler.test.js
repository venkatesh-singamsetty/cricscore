import { describe, it, expect, vi, beforeEach } from "vitest";
import { Pool } from "pg";
const { deleteRulesHandler } = require("./deleteRulesHandler.js");

describe("deleteRulesHandler", () => {
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

  it("should return 400 if documentName is missing", async () => {
    const response = await deleteRulesHandler(
      { queryStringParameters: {} },
      { "Access-Control-Allow-Origin": "*" },
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("No documentName provided");
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("should delete rules matching documentName", async () => {
    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({ rowCount: 15 });

    const event = { queryStringParameters: { documentName: "rules2025.pdf" } };
    const response = await deleteRulesHandler(event, {
      "Access-Control-Allow-Origin": "*",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Successfully deleted document rules2025.pdf");
    expect(body.deletedChunks).toBe(15);

    expect(querySpy).toHaveBeenCalledTimes(2);
    expect(releaseSpy).toHaveBeenCalled();
  });

  it("should handle database errors gracefully", async () => {
    querySpy.mockRejectedValueOnce(new Error("DB error"));

    const event = { queryStringParameters: { documentName: "rules2025.pdf" } };
    const response = await deleteRulesHandler(event, {
      "Access-Control-Allow-Origin": "*",
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Failed to delete document");
    expect(releaseSpy).toHaveBeenCalled();
  });
});
