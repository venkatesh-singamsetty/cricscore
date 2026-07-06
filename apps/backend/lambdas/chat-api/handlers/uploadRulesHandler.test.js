import { describe, it, expect, vi, beforeEach } from "vitest";
import { Pool } from "pg";
const { uploadRulesHandler } = require("./uploadRulesHandler.js");

vi.mock("pdf-parse", () => {
  class MockPDFParse {
    constructor() {}
    async getText() {
      return { text: "This is chunk one.\n\nThis is chunk two." };
    }
  }
  return {
    __esModule: true,
    default: { PDFParse: MockPDFParse },
    PDFParse: MockPDFParse,
  };
});

describe("uploadRulesHandler", () => {
  let querySpy, releaseSpy, connectSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    querySpy = vi.fn();
    releaseSpy = vi.fn();
    connectSpy = vi.spyOn(Pool.prototype, "connect").mockResolvedValue({
      query: querySpy,
      release: releaseSpy,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
      }),
    });
  });

  it("should return 400 if fileBase64 is missing", async () => {
    const response = await uploadRulesHandler(
      { body: JSON.stringify({ fileName: "rules.pdf" }) },
      { "Access-Control-Allow-Origin": "*" },
    );
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("No PDF file provided");
  });

  it("should process pdf and store chunks with documentName", async () => {
    querySpy
      .mockResolvedValueOnce({}) // SET search_path
      .mockResolvedValueOnce({ rowCount: 1 }); // DELETE matching document chunks

    const body = {
      fileBase64:
        "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAwALJMLY31jBQU0gGNIwWtCmVuZHN0cmVhbQplbmRvYmoKMyAwIG9iago0MgplbmRvYmoKMSAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL1Jlc291cmNlczw8L0ZvbnQ8PC9GMCA0IDAgUj4+Pj4vQ29udGVudHMgMiAwIFIvUGFyZW50IDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvVGltZXMtUm9tYW4+PgplbmRvYmoKNSAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1sxIDAgUl0+PgplbmRvYmoKNiAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgNSAwIFI+PgplbmRvYmoKNyAwIG9iago8PC9Qcm9kdWNlcihqc3BkZiAodmVyc2lvbiAyLjUuMykpL0NyZWF0aW9uRGF0ZShEOjIwMjMwMTAxMDAwMDAwWik+PgplbmRvYmoKeHJlZgowIDgKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMTUyIDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDEwNSAwMDAwMCBuIAowMDAwMDAwMjQ5IDAwMDAwIG4gCjAwMDAwMDAzMzggMDAwMDAgbiAKMDAwMDAwMDM5NSAwMDAwMCBuIAowMDAwMDAwNDQ0IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA4L1Jvb3QgNiAwIFIvSW5mbyA3IDAgUj4+CnN0YXJ0eHJlZgo1NDIKJSVFT0YK",
      fileName: "rules2026.pdf",
    };

    const response = await uploadRulesHandler(
      { body: JSON.stringify(body) },
      { "Access-Control-Allow-Origin": "*" },
    );

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toBe("Rules successfully parsed and embedded");

    expect(querySpy).toHaveBeenCalledTimes(3); // SET, DELETE, INSERT
    expect(releaseSpy).toHaveBeenCalled();
  });

  it("should handle processing errors", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network Error"));

    const body = {
      fileBase64: "dGVzdA==",
      fileName: "test.pdf",
    };

    const response = await uploadRulesHandler(
      { body: JSON.stringify(body) },
      { "Access-Control-Allow-Origin": "*" },
    );

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toBe("Failed to process PDF");
    expect(connectSpy).not.toHaveBeenCalled();
  });
});
