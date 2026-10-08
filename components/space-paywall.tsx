"use client";
import Link from "next/link";
import { useState } from "react";
import { membershipPlans, isPaidSlug } from "@/lib/payments";
import { CheckoutFeedback } from "@/components/checkout-feedback";

export type PaywallSpace = { slug: string; name: string; description: string | null; currency: string; monthlyPriceCents: number; annualPriceCents: number };
export function SpacePaywall({ space, signedIn }: { space: PaywallSpace; signedIn: boolean }) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly"); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const price = new Intl.NumberFormat("en-ZA", { style: "currency", currency: space.currency }).format((cycle === "monthly" ? space.monthlyPriceCents : space.annualPriceCents) / 100);
  async function checkout() {
    if (pending) return; setPending(true); setError("");
    try {
      const response = await fetch(`/api/checkout/${cycle === "monthly" ? "peach" : "ikhokha"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spaceSlug: space.slug }), signal: AbortSignal.timeout(60000) });
      const data = await response.json() as { error?: string; redirectUrl?: string };
      if (!response.ok || !data.redirectUrl) throw new Error(data.error || "Checkout could not be opened.");
      window.location.assign(data.redirectUrl);
    } catch (cause) { setError(cause instanceof Error && cause.name !== "TimeoutError" && cause.name !== "AbortError" ? cause.message : "Checkout timed out. Contact support before paying again; your request may still be processing."); setPending(false); }
  }
  return <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-black bg-white text-black">
    <header className="bg-[#0d140e] p-8 text-[#ccff00]"><span className="rounded-full bg-[#ccff00] px-3 py-1 text-xs font-bold text-black">MEMBERSHIP SPACE</span><h1 className="mt-6 text-3xl font-black">{space.name}</h1><p className="mt-4 leading-7">{space.description}</p></header>
    <div className="p-8"><CheckoutFeedback slug={space.slug} /><h2 className="text-xl font-bold">Choose your membership</h2><ul className="mt-4 list-disc space-y-2 pl-5">{(isPaidSlug(space.slug) ? membershipPlans[space.slug].perks : ["Member discussions", "Live workshops"]).map(perk => <li key={perk}>{perk}</li>)}</ul>
      <fieldset disabled={pending} className="mt-7 grid gap-3 sm:grid-cols-2"><legend className="mb-3 font-bold">Billing plan</legend>{(["monthly", "annual"] as const).map(value => <label key={value} className={`cursor-pointer rounded-xl border border-black p-4 hover:opacity-90 ${cycle === value ? "bg-[#ccff00] text-black" : "bg-white text-black"}`}><input className="mr-2 accent-black" type="radio" name="billing-cycle" checked={cycle === value} onChange={() => setCycle(value)} />{value === "monthly" ? "Monthly Recurring (Peach Payments)" : "Annual Pass (iKhokha - Best Value)"}</label>)}</fieldset>
      <p className="mt-6 text-3xl font-black">{price}<span className="text-base font-normal"> / {cycle === "monthly" ? "month" : "365 days"}</span></p><p className="mt-3 text-sm">{cycle === "monthly" ? "Renews monthly until you cancel. Cancel future renewals from this space; your paid access continues to the end of the period." : "One payment. Access for 365 days. No automatic renewal."}</p>
      {signedIn ? <button onClick={checkout} disabled={pending} className="mt-6 w-full rounded-full bg-[#ccff00] px-6 py-4 font-bold text-black hover:scale-[1.01] disabled:opacity-60">{pending ? "Opening secure checkout…" : "Continue to secure checkout →"}</button> : <Link href={`/login?callbackUrl=${encodeURIComponent(`/spaces/${space.slug}`)}`} className="mt-6 block rounded-full bg-[#ccff00] px-6 py-4 text-center font-bold text-black hover:opacity-90">Sign in to choose a plan →</Link>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-black p-4">{error}</p>}<p className="mt-4 text-sm">Already paid? Confirmation can take a moment. <button onClick={() => window.location.reload()} className="font-bold underline hover:opacity-90">Refresh access</button></p>
    </div>
  </section>;
}
