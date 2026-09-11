exports.handler = async (event) => {
  const email = event.request.userAttributes.email || "";

  // Only auto-confirm if it's a generated guest shadow account
  if (email.endsWith("@cricscore.local")) {
    console.log(`Auto-confirming guest account: ${email}`);
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
  } else {
    console.log(`Normal signup, skipping auto-confirm for: ${email}`);
  }

  return event;
};
