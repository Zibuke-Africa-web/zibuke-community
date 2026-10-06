interface BillingEnv { COMMUNITY: Fetcher; CRON_SECRET: string }
const billingWorker = {
  async scheduled(_event: ScheduledController, env: BillingEnv, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const response = await env.COMMUNITY.fetch("https://zibukecommunity.co.za/api/cron/billing", {
        method: "POST", headers: { Authorization: `Bearer ${env.CRON_SECRET}` }, redirect: "follow",
      });
      if (!response.ok) throw new Error(`Billing run failed: HTTP ${response.status}`);
    })());
  },
};
export default billingWorker;
