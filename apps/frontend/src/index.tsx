import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import { Amplify } from "aws-amplify";
import { ThemeProvider } from "@aws-amplify/ui-react";
import App from "./App";
import { hasCognitoAuthConfig } from "./authConfig";
import { getEnv } from "./utils/runtimeConfig";
// App styles first — Amplify styles loaded AFTER so they don't override app UI
import "./index.css";
import "@aws-amplify/ui-react/styles.css";

const appTitle = getEnv("VITE_APP_TITLE");
if (appTitle && typeof document !== "undefined") {
  document.title = appTitle;
}

if (hasCognitoAuthConfig()) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: getEnv("VITE_COGNITO_USER_POOL_ID"),
        userPoolClientId: getEnv("VITE_COGNITO_CLIENT_ID"),
      },
    },
  });
}

const sentryDsn = getEnv("VITE_SENTRY_DSN");
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Tracing
    tracesSampleRate: 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider colorMode="dark">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
