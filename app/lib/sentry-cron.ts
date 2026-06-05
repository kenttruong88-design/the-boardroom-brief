import * as Sentry from "@sentry/nextjs";

export interface CronConfig {
  monitorSlug: string;
  schedule: string;
  checkinMargin: number;
  maxRuntime: number;
  timezone?: string;
}

export async function withCronMonitoring<T>(
  config: CronConfig,
  job: () => Promise<T>
): Promise<T> {
  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: config.monitorSlug, status: "in_progress" },
    {
      schedule: { type: "crontab", value: config.schedule },
      checkinMargin: config.checkinMargin,
      maxRuntime: config.maxRuntime,
      timezone: config.timezone ?? "UTC",
    }
  );

  const startTime = Date.now();

  try {
    const result = await job();
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: config.monitorSlug,
      status: "ok",
      duration: (Date.now() - startTime) / 1000,
    });
    return result;
  } catch (error) {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: config.monitorSlug,
      status: "error",
      duration: (Date.now() - startTime) / 1000,
    });
    Sentry.captureException(error, {
      tags: {
        cron: config.monitorSlug,
        cron_schedule: config.schedule,
      },
    });
    throw error;
  }
}
