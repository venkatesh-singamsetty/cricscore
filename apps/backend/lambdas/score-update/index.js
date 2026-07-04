const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const snsClient = new SNSClient({});
const sqsClient = new SQSClient({});
const TOPIC_ARN = process.env.MATCH_EVENTS_TOPIC;
const QUEUE_URL = process.env.STORAGE_BUFFER_QUEUE;

exports.handler = async (event) => {
  const { httpMethod } = event || {};
  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
      body: "",
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { matchId, inningId, syncOnly, undo } = body;

    console.log(
      `Producing v2.0 Fan-Out event for match: ${matchId}, Inning: ${inningId}, Type: ${syncOnly ? "SYNC" : "SCORE"}`,
    );

    // Construct the unified match event message
    const message = {
      ...body,
      timestamp: new Date().toISOString(),
      type: syncOnly || undo ? "STATE_SYNC" : "LIVE_SCORE_UPDATE",
    };

    // 1. Publish to character-perfectly technically shard SNS Topic (The Fan-Out Hub)
    const snsCommand = new PublishCommand({
      TopicArn: TOPIC_ARN,
      Message: JSON.stringify(message),
      MessageAttributes: {
        EventType: {
          DataType: "String",
          StringValue: syncOnly || undo ? "STATE_SYNC" : "LIVE_SCORE_UPDATE",
        },
      },
    });

    // 2. Send strictly ordered message to Storage Worker Buffer (FIFO SQS)
    const sqsCommand = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(message),
      MessageGroupId: matchId, // Ensure strict FIFO ordering per match!
    });

    const [snsRes, sqsRes] = await Promise.all([
      snsClient.send(snsCommand),
      sqsClient.send(sqsCommand),
    ]);

    console.log(
      `SNS Published: ${snsRes.MessageId}, SQS Sent: ${sqsRes.MessageId}`,
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        messageId: snsRes.MessageId,
        note: "v2.0 Decoupled Fan-Out Active",
      }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    };
  } catch (error) {
    console.error("Producer Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { "Access-Control-Allow-Origin": "*" },
    };
  }
};
