import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

process.env.TABLE_NAME = "mock-table";
process.env.WEBSOCKET_URL =
  "wss://mock-api.execute-api.us-east-1.amazonaws.com";

const dynamoMock = mockClient(DynamoDBClient);
const apiMock = mockClient(ApiGatewayManagementApiClient);

const { handler } = await import("./index.js");

describe("Broadcaster Lambda", () => {
  beforeEach(() => {
    dynamoMock.reset();
    apiMock.reset();
  });

  it("should ignore if there are no active connections", async () => {
    dynamoMock.on(ScanCommand).resolves({ Items: [] });

    const res = await handler({ Records: [] });

    expect(res).toBeUndefined(); // Returns early
    expect(dynamoMock.calls().length).toBe(1);
  });

  it("should broadcast SNS events to active connections", async () => {
    dynamoMock.on(ScanCommand).resolves({
      Items: [
        { connectionId: { S: "conn123" } },
        { connectionId: { S: "conn456" } },
      ],
    });
    apiMock.on(PostToConnectionCommand).resolves({});

    const event = {
      Records: [
        {
          EventSource: "aws:sns",
          Sns: {
            Message: JSON.stringify({
              type: "LIVE_SCORE_UPDATE",
              data: "mockData",
            }),
          },
        },
      ],
    };

    const res = await handler(event);

    expect(res.statusCode).toBe(200);
    expect(apiMock.calls().length).toBe(2); // Sent to both connections
  });

  it("should gracefully handle GoneException for disconnected users", async () => {
    dynamoMock.on(ScanCommand).resolves({
      Items: [{ connectionId: { S: "conn-stale" } }],
    });

    const goneError = new Error("Gone");
    goneError.name = "GoneException";
    apiMock.on(PostToConnectionCommand).rejects(goneError);

    const event = {
      Records: [{ EventSource: "aws:sns", Sns: { Message: "{}" } }],
    };

    const res = await handler(event);

    expect(res.statusCode).toBe(200); // Should not crash
    expect(apiMock.calls().length).toBe(1);
  });
});
