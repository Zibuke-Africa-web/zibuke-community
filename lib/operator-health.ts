import { getCloudflareContext } from "@opennextjs/cloudflare";
import { paymentEnv } from "@/lib/payment-server";

export async function operatorHealth() {
  const context = await getCloudflareContext({ async: true }).catch(() => null);
  const env = context?.env;
  const config = await paymentEnv();
  const db = env?.DB;
  const [connectivity, publisher, subscriptions, history] = await Promise.allSettled([
    db ? db.prepare("SELECT 1 AS connected").first<{ connected: number }>() : Promise.reject(),
    db ? db.prepare("SELECT max(created_at) AS latest FROM published_articles").first<{ latest: number | null }>() : Promise.reject(),
    db ? db.prepare("SELECT count(*) AS total FROM subscriptions WHERE status='active'").first<{ total: number }>() : Promise.reject(),
    db ? db.prepare("SELECT service,finished_at,status,http_status FROM service_runs ORDER BY service").all<{ service: string; finished_at: number; status: string; http_status: number }>() : Promise.reject(),
  ]);
  const credentials = ["PEACH_ENTITY_ID", "PEACH_ACCESS_TOKEN", "PEACH_CLIENT_ID", "PEACH_CLIENT_SECRET", "PEACH_MERCHANT_ID", "IKHOKHA_APP_KEY", "IKHOKHA_APP_SECRET", "IKHOKHA_ENTITY_ID", "PAYMENTS_APP_URL", "CRON_SECRET"]
    .map(name => ({ name, present: Boolean(config[name]) }));
  credentials.push({ name: "Peach webhook signing secret", present: Boolean(config.PEACH_WEBHOOK_SECRET || config.PEACH_SECRET_TOKEN) });
  return {
    checkedAt: new Date().toISOString(),
    bindings: { d1: connectivity.status === "fulfilled" && connectivity.value?.connected === 1,
      r2: typeof env?.ZIBUKE_BUCKET?.head === "function", ai: typeof env?.AI?.run === "function" },
    lastArticle: publisher.status === "fulfilled" ? publisher.value?.latest ?? null : null,
    articleQueryOk: publisher.status === "fulfilled",
    activeSubscriptions: subscriptions.status === "fulfilled" ? subscriptions.value?.total ?? 0 : null,
    runs: history.status === "fulfilled" ? history.value.results : [], historyAvailable: history.status === "fulfilled",
    credentials, recurringEnabled: config.PEACH_RECURRING_ENABLED === "true",
    mode: config.PAYMENTS_MODE === "live" ? "live" : "sandbox",
    manualRunsAvailable: Boolean(config.CRON_SECRET && env?.WORKER_SELF_REFERENCE),
  };
}
