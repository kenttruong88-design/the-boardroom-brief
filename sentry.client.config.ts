import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",

  // 10% of transactions, 100% of errors
  tracesSampleRate: 0.1,

  // 10% of sessions replayed, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],

  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error exception captured",
    /^Network Error/,
    /^Request aborted/,
    /ChunkLoadError/,
  ],

  beforeSend(event) {
    if (event.request?.cookies) {
      event.request.cookies = "[filtered]";
    }
    return event;
  },
});
