"use client";
import { useState, useTransition } from "react";
import { cancelSubscriptionAction } from "@/actions/subscriptions";
export function SubscriptionControls({ id, end }: { id: string; end: string }) {
  const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  return <div className="mb-6 rounded-xl border border-black bg-white p-4 text-black"><p className="text-sm">Membership paid through {new Date(end).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })}.</p><button disabled={pending} onClick={() => start(async () => { try { setMessage((await cancelSubscriptionAction(id)).message); } catch { setMessage("Could not cancel. Please try again."); } })} className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-bold text-[#ccff00] hover:opacity-90 disabled:opacity-60">{pending ? "Canceling…" : "Cancel monthly renewal"}</button><p role="status" className="mt-2 text-sm">{message}</p></div>;
}
