import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const ddbMock = mockClient(DynamoDBClient);

let handler;

describe("onconnect Lambda", () => {
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

  it("should return 200 on successful connection save", async () => {
    ddbMock.on(PutItemCommand).resolves({});

    const event = {
      requestContext: { connectionId: "test-connection-123" },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("Connected");

    const putCalls = ddbMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);
    expect(putCalls[0].args[0].input).toEqual({
      TableName: "TestTable",
      Item: {
        connectionId: { S: "test-connection-123" },
        timestamp: expect.any(Object),
      },
    });
  });

  it("should return 500 if DynamoDB fails", async () => {
    ddbMock.on(PutItemCommand).rejects(new Error("DynamoDB error"));

    const event = {
      requestContext: { connectionId: "test-connection-123" },
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(response.body).toContain("Failed to connect");
  });
});
