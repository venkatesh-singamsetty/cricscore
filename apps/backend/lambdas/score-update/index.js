const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const snsClient = new SNSClient({});
const sqsClient = new SQSClient({});
const TOPIC_ARN = process.env.MATCH_EVENTS_TOPIC;
const QUEUE_URL = process.env.STORAGE_BUFFER_QUEUE;

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || "").split("?")[0],
  // Required for Aiven managed PostgreSQL unless an explicit CA bundle is provided.
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
pool.on("error", (err) => console.error("Idle PostgreSQL client error:", err));

const getClaims = (event) => {
  const claims =
    event.requestContext?.authorizer?.jwt?.claims ||
    event.requestContext?.authorizer?.claims ||
    {};
  // SECURITY: identity comes only from the verified JWT, never from client headers.
  return claims;
};

const isAdminClaims = (claims) => {
  if (!claims || typeof claims !== "object") return false;
  const userEmail = claims.email;
  const isSuperAdmin = Boolean(
    userEmail &&
    process.env.ADMIN_REPORT_EMAIL &&
    userEmail.toLowerCase() === process.env.ADMIN_REPORT_EMAIL.toLowerCase(),
  );
  const groups = claims["cognito:groups"] || [];
  const groupList = Array.isArray(groups)
    ? groups
    : String(groups)
        .replace(/[[\]"]/g, "")
        .split(/[\s,]+/)
        .map((g) => g.trim())
        .filter(Boolean);
  const hasAdminGroup = groupList.includes("Admin");
  return isSuperAdmin || hasAdminGroup;
};

exports.handler = async (event, context) => {
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

  if (context) context.callbackWaitsForEmptyEventLoop = false;

  let body;
  try {
    body =
      typeof event?.body === "string" ? JSON.parse(event.body) : event?.body;
  } catch (parseErr) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  if (!body || typeof body !== "object") {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Missing or invalid payload" }),
    };
  }

  const { matchId, inningId, syncOnly, undo } = body;
  if (!matchId || !inningId) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Missing required fields: matchId and inningId",
      }),
    };
  }

  let client;
  try {
    client = await pool.connect();
    if (process.env.DB_SCHEMA) {
      const cleanSchema = String(process.env.DB_SCHEMA).replace(
        /[^a-zA-Z0-9_]/g,
        "",
      );
      if (cleanSchema) {
        await client.query(`SET search_path TO ${cleanSchema}, public`);
      }
    }

    // Auth Check
    const claims = getClaims(event);
    const isAdmin = isAdminClaims(claims);

    if (!isAdmin) {
      const matchRes = await client.query(
        "SELECT scorer_email FROM matches WHERE id = $1",
        [matchId],
      );
      if (
        matchRes.rows.length === 0 ||
        !claims.email ||
        claims.email !== matchRes.rows[0].scorer_email
      ) {
        return {
          statusCode: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Forbidden" }),
        };
      }
    }

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
      MessageDeduplicationId: `${matchId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    });

    let snsRes, sqsRes;
    try {
      [snsRes, sqsRes] = await Promise.all([
        snsClient.send(snsCommand),
        sqsClient.send(sqsCommand),
      ]);
      console.log(
        `SNS Published: ${snsRes?.MessageId}, SQS Sent: ${sqsRes?.MessageId}`,
      );
    } catch (sendErr) {
      console.error("Error sending SNS/SQS events:", sendErr);
      throw sendErr;
    }

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
  } finally {
    if (client) client.release();
  }
};
