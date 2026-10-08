import { getDb } from "@/db";
import { sql } from "drizzle-orm";

export function observeServiceRun(service: "publisher" | "billing", handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const started = Date.now();
    const response = await handler(request);
    // Authentication failures must not write operational history.
    if (response.status === 401 || response.status === 403 || response.status === 405) return response;
    try {
      const body = await response.clone().json() as { skipped?: unknown };
      const status = response.ok ? (body.skipped ? "disabled" : "success") : "failed";
      await (await getDb()).run(sql`insert into service_runs(service,started_at,finished_at,status,http_status)
        values(${service},${started},${Date.now()},${status},${response.status})
        on conflict(service) do update set started_at=excluded.started_at,finished_at=excluded.finished_at,status=excluded.status,http_status=excluded.http_status
        where excluded.started_at>=service_runs.started_at`);
    } catch { console.error("Service run history could not be recorded", { service }); }
    // Observability failures must never cause a settled payment to be retried.
    return response;
  };
}
