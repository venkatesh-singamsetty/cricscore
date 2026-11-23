export type CricScoreEnvKey =
  | "VITE_API_URL"
  | "VITE_WS_URL"
  | "VITE_APP_TITLE"
  | "VITE_COGNITO_REGION"
  | "VITE_COGNITO_USER_POOL_ID"
  | "VITE_COGNITO_CLIENT_ID"
  | "VITE_COGNITO_DOMAIN"
  | "VITE_SENTRY_DSN"
  | "VITE_DEFAULT_EMAIL";

declare global {
  interface Window {
    __CRICSCORE_CONFIG__?: Partial<Record<CricScoreEnvKey, string>>;
  }
}

/**
 * Reads runtime environment config injected via `/env-config.js` (12-Factor
 * build-once, deploy-anywhere) with transparent fallback to Vite build-time
 * `import.meta.env` for local development and Vitest.
 */
export function getEnv(key: CricScoreEnvKey): string {
  if (typeof window !== "undefined") {
    const runtimeVal = window.__CRICSCORE_CONFIG__?.[key];
    if (typeof runtimeVal === "string" && runtimeVal.length > 0) {
      return runtimeVal;
    }
  }
  const viteEnv = import.meta.env as Record<string, string | undefined>;
  return viteEnv?.[key] || "";
}
