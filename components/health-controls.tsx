"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function HealthControls({ available, recurringEnabled }: { available: boolean; recurringEnabled: boolean }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const router = useRouter();
  async function run(service: "publisher" | "billing") {
    if (pending) return;
    setPending(true); setMessage("Running. Keep this page open; this may take a few minutes.");
    try {
      const response = await fetch("/api/admin/health/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service }), signal: AbortSignal.timeout(305000) });
      const result = await response.json() as { message?: string; error?: string; count?: number };
      setMessage(response.ok ? `${result.message} Processed: ${result.count ?? 0}.` : result.error || "The run could not be confirmed.");
    } catch { setMessage("The run could not be confirmed. Refresh health before trying again."); }
    finally { setPending(false); router.refresh(); }
  }
  const button = "rounded-full border border-black bg-[#ccff00] px-5 py-3 font-bold text-black hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60";
  return <div className="space-y-3"><p className="text-sm">Publisher runs create public posts. {recurringEnabled ? "Billing is enabled: running a check can charge due subscriptions." : "Billing is disabled: checks will not submit charges."}</p><div className="flex flex-wrap gap-3"><button className={button} disabled={!available || pending} onClick={() => void run("publisher")}>Run Publisher Now</button><button className={button} disabled={!available || pending} onClick={() => void run("billing")}>Run Billing Check Now</button><button className={button} disabled={pending} onClick={() => router.refresh()}>Refresh health</button></div><p role="status" aria-live="polite">{message}</p></div>;
}
