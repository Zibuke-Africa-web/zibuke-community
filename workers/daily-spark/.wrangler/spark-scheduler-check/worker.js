// worker.ts
var worker_default = {
  async scheduled(_controller, env) {
    if (!env.CRON_SECRET) throw new Error("CRON_SECRET is not configured");
    const response = await env.COMMUNITY.fetch("https://community.internal/api/cron/daily-spark", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` }
    });
    if (!response.ok) throw new Error(`Daily Spark generation returned HTTP ${response.status}`);
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
