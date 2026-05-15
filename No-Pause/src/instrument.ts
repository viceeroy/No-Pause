import * as Sentry from "@sentry/react";

const sentryDsn = "https://8ce2b4b133030b9a186a05ceabee5417@o4511392880590848.ingest.de.sentry.io/4511392912375888";

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
  });
}
