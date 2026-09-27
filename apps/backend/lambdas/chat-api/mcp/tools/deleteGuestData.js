const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminDeleteUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const { pool } = require("../../config/db");

async function deleteGuestDataTool(args) {
  try {
    const client = await pool.connect();
    let deletedMatches = 0;
    try {
      const res = await client.query(
        "DELETE FROM matches WHERE scorer_email LIKE 'guest-%' RETURNING id",
      );
      deletedMatches = res.rowCount || 0;
    } finally {
      client.release();
    }

    let deletedUsers = 0;
    try {
      const cognito = new CognitoIdentityProviderClient({
        region: "us-east-1",
      });
      let allGuests = [];
      let paginationToken = undefined;
      do {
        const res = await cognito.send(
          new ListUsersCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID,
            PaginationToken: paginationToken,
          }),
        );
        const guests = (res.Users || []).filter((u) => {
          const emailAttr = (u.Attributes || []).find(
            (a) => a.Name === "email",
          );
          const email = emailAttr ? emailAttr.Value : "";
          const username = u.Username || "";
          return (
            email.startsWith("guest-") ||
            email.startsWith("guest_") ||
            email.includes("guest") ||
            username.startsWith("guest-") ||
            username.startsWith("guest_") ||
            username.includes("guest")
          );
        });
        allGuests = allGuests.concat(guests);
        paginationToken = res.PaginationToken;
      } while (paginationToken);

      for (const guest of allGuests) {
        try {
          await cognito.send(
            new AdminDeleteUserCommand({
              UserPoolId: process.env.COGNITO_USER_POOL_ID,
              Username: guest.Username,
            }),
          );
          deletedUsers++;
        } catch (e) {
          console.error(`Failed to delete guest ${guest.Username}:`, e);
        }
      }
    } catch (cognitoErr) {
      console.error("Cognito delete error:", cognitoErr);
      return {
        content: [
          {
            type: "text",
            text: `Deleted ${deletedMatches} guest matches from the database. However, failed to delete guest users from Cognito: ${cognitoErr.message}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully deleted ${deletedMatches} guest matches from DB and ${deletedUsers} guest users from Cognito.`,
        },
      ],
    };
  } catch (error) {
    console.error("deleteGuestDataTool error:", error);
    return {
      content: [
        {
          type: "text",
          text: `Error deleting guest data: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

module.exports = { deleteGuestDataTool };
