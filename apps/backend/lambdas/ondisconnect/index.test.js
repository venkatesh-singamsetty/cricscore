import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const ddbMock = mockClient(DynamoDBClient);

let handler;

describe("ondisconnect Lambda", () => {
  beforeEach(async () => {
    ddbMock.reset();
    vi.resetModules();
    process.env.TABLE_NAME = "TestTable";
    const mod = await import("./index.js");
    handler = mod.handler;
  });

  afterEach(() => {
    delete process.env.TABLE_NAME;
  });

  it("should return 200 on successful connection removal", async () => {
    ddbMock.on(DeleteItemCommand).resolves({});

    const event = {
      requestContext: { connectionId: "test-connection-123" },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("Disconnected");

    const deleteCalls = ddbMock.commandCalls(DeleteItemCommand);
    expect(deleteCalls.length).toBe(1);
    expect(deleteCalls[0].args[0].input).toEqual({
      TableName: "TestTable",
      Key: {
        connectionId: { S: "test-connection-123" },
      },
    });
  });

  it("should return 500 if DynamoDB fails", async () => {
    ddbMock.on(DeleteItemCommand).rejects(new Error("DynamoDB error"));

    const event = {
      requestContext: { connectionId: "test-connection-123" },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(response.body).toContain("Failed to disconnect");
  });
});
