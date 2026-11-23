import { getEnv } from "./utils/runtimeConfig";

export const hasCognitoAuthConfig = () => {
  const userPoolId = getEnv("VITE_COGNITO_USER_POOL_ID");
  const userPoolClientId = getEnv("VITE_COGNITO_CLIENT_ID");

  return Boolean(userPoolId && userPoolClientId);
};
