import { redirect } from "next/navigation";
import { adminAccess } from "@/lib/admin-access";
import { operatorHealth } from "@/lib/operator-health";
import { HealthControls } from "@/components/health-controls";
export const dynamic = "force-dynamic";
export const metadata = { title: "System Health | Zibuke Admin" };
function Indicator({ ready, label }: { ready: boolean; label: string }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${ready ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{label}: {ready ? "Detected / ready" : "Needs attention"}</span>;
}
export default async function HealthPage() {
  const access = await adminAccess();
  if (!access.allowed) redirect(access.status === 401 ? "/login?callbackUrl=%2Fhealth" : "/directory");
  const health = await operatorHealth();
  return <div className="space-y-6 text-slate-900"><header><h1 className="text-3xl font-black">System health</h1><p className="mt-2">Checked {health.checkedAt} (UTC). Presence checks do not verify merchant approval or provider availability.</p></header>
    <section className="space-y-4 rounded-2xl border border-slate-300 bg-white p-6"><h2 className="text-xl font-bold">Edge bindings</h2><div className="flex flex-wrap gap-3"><Indicator label="D1 SELECT 1" ready={health.bindings.d1} /><Indicator label="R2 media binding" ready={health.bindings.r2} /><Indicator label="Workers AI binding" ready={health.bindings.ai} /></div><p className="text-sm">R2 and AI are inspected without uploading files or running paid inference.</p></section>
    <section className="space-y-4 rounded-2xl border border-slate-300 bg-white p-6"><h2 className="text-xl font-bold">Automated services</h2><p>Latest published article: {health.articleQueryOk ? health.lastArticle ? new Date(health.lastArticle * 1000).toISOString() : "No articles published yet" : "Unavailable"}</p><p>Active subscriptions: {health.activeSubscriptions ?? "Unavailable"}</p>
      <ul className="space-y-2">{(["publisher", "billing"] as const).map(service => { const run = health.runs.find(row => row.service === service); return <li key={service}><strong>{service === "publisher" ? "Feed publisher" : "Billing scheduler"}</strong> — expected every {service === "publisher" ? "4 hours" : "15 minutes"}. Last completed run: {run ? `${new Date(run.finished_at).toISOString()} · ${run.status} (HTTP ${run.http_status})` : health.historyAvailable ? "Not recorded yet" : "History unavailable; check migration 0012"}.</li>; })}</ul><p className="text-sm">Run history comes from authenticated service executions; it does not independently verify Cloudflare trigger configuration.</p><HealthControls available={health.manualRunsAvailable} recurringEnabled={health.recurringEnabled} /></section>
    <section className="space-y-4 rounded-2xl border border-slate-300 bg-white p-6"><h2 className="text-xl font-bold">Payment configuration</h2><p>Mode: {health.mode}. Recurring billing: {health.recurringEnabled ? "enabled" : "disabled"}.</p><ul className="flex flex-wrap gap-3">{health.credentials.map(item => <li key={item.name}><Indicator label={item.name} ready={item.present} /></li>)}</ul><p className="text-sm">Credential aliases are resolved server-side. Values and card details are never displayed.</p></section>
  </div>;
}
