export const hasCognitoAuthConfig = () => {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || "";
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID || "";

  return Boolean(userPoolId && userPoolClientId);
};
