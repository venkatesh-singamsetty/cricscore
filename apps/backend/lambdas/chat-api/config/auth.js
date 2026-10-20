/**
 * Server-side authorization helpers for chat-api.
 *
 * Identity is read ONLY from claims that API Gateway's Cognito JWT authorizer
 * has already verified (`requestContext.authorizer.jwt.claims`). Request bodies
 * and headers are never trusted for identity or roles.
 */
function getVerifiedClaims(event) {
  const authorizer = event?.requestContext?.authorizer || {};
  return authorizer.jwt?.claims || authorizer.claims || {};
}

function isAdmin(event) {
  const claims = getVerifiedClaims(event);
  const email = claims.email;
  if (
    email &&
    process.env.ADMIN_REPORT_EMAIL &&
    email === process.env.ADMIN_REPORT_EMAIL
  ) {
    return true;
  }
  const groups = claims["cognito:groups"] || [];
  // HTTP API serializes array claims as "[Admin Other]".
  const list = Array.isArray(groups)
    ? groups
    : String(groups)
        .replace(/[[\]"]/g, "")
        .split(/[\s,]+/);
  return list.includes("Admin");
}

/** Returns a 403 response unless the caller is a verified admin, else null. */
function requireAdmin(event, corsHeaders) {
  if (isAdmin(event)) return null;
  return {
    statusCode: 403,
    headers: corsHeaders,
    body: JSON.stringify({ error: "Admin privileges required" }),
  };
}

module.exports = { getVerifiedClaims, isAdmin, requireAdmin };
