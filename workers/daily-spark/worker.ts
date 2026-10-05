interface SparkSchedulerEnv {
  COMMUNITY: Fetcher;
  CRON_SECRET: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: SparkSchedulerEnv) {
    if (!env.CRON_SECRET) throw new Error("CRON_SECRET is not configured");
    const response = await env.COMMUNITY.fetch("https://community.internal/api/cron/daily-spark", {
      method: "POST", headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    if (!response.ok) throw new Error(`Daily Spark generation returned HTTP ${response.status}`);
  },
} satisfies ExportedHandler<SparkSchedulerEnv>;
