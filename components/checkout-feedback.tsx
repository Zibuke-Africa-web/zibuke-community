"use client";
import { useEffect, useState } from "react";

export function CheckoutFeedback({ slug }: { slug: string }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hint = query.get("payment");
    if (!hint) return;
    let stopped = false, attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const deadline = Date.now() + 60000;
    const fallback = "Confirmation is taking longer than expected. Refresh access or contact support before paying again.";
    const reported = hint === "canceled" ? "You returned from a canceled checkout. " : hint === "failed" ? "The checkout reported a failed payment. " : "";
    async function check() {
      try {
        const params = new URLSearchParams({ space: slug });
        const order = query.get("order"); if (order) params.set("order", order);
        const response = await fetch(`/api/checkout/status?${params}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        const data = await response.json() as { status?: string; message?: string; error?: string };
        if (stopped) return;
        if (!response.ok) { setMessage(data.error || fallback); return; }
        attempts++;
        const continueChecking = attempts < 12 && Date.now() < deadline - 10000;
        setMessage(data.status === "pending" ? reported + (!continueChecking ? fallback : data.message || fallback) : data.message || fallback);
        if (data.status === "pending" && continueChecking) timer = setTimeout(check, 5000);
      } catch { if (!stopped) setMessage(fallback); }
    }
    void check();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [slug]);
  return message ? <div role="status" aria-live="polite" className="mb-6 rounded-xl border border-black bg-white p-4 text-black"><p>{message}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 font-bold underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">Refresh access</button></div> : null;
}
