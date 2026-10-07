"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Mail } from "lucide-react";
import { FacebookLoginButton } from "./facebook-login-button";
import { loginDestination } from "@/lib/login-redirect";

export function LoginMethods({ callbackUrl }: { callbackUrl: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const destination = loginDestination(callbackUrl);

  async function oauth(provider: "google" | "linkedin") {
    setPending(provider);
    setError(null);
    try {
      if (provider === "google") {
        await signIn("google", { callbackUrl: "/spaces" });
      } else {
        await signIn("linkedin", { callbackUrl: "/spaces" });
      }
    } catch {
      setError("Sign-in could not start. Please try again.");
      setPending(null);
    }
  }

  async function emailSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("resend");
    setError(null);
    setSent(false);
    try {
      const result = await signIn("resend", { email: email.trim(), callbackUrl: "/spaces", redirect: false });
      if (!result?.ok || result.error || (result.url && new URL(result.url, window.location.origin).searchParams.has("error"))) {
        setError("We couldn’t send your sign-in link. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("We couldn’t send your sign-in link. Please try again.");
    } finally {
      setPending(null);
    }
  }

  const button = "flex min-h-12 w-full items-center justify-center gap-3 rounded-md px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-wait disabled:opacity-60";
  return <div className="space-y-3">
    <FacebookLoginButton callbackUrl={destination} />
    <button type="button" disabled={pending !== null} onClick={() => oauth("google")} className={`${button} border border-slate-200 bg-white text-black hover:bg-slate-50`}><span aria-hidden="true" className="text-xl font-bold text-blue-600">G</span>{pending === "google" ? "Connecting…" : "Continue with Google"}</button>
    <button type="button" disabled={pending !== null} onClick={() => oauth("linkedin")} className={`${button} bg-[#0A66C2] text-white hover:bg-[#004182]`}><span aria-hidden="true" className="text-xl font-bold">in</span>{pending === "linkedin" ? "Connecting…" : "Continue with LinkedIn"}</button>
    <div className="flex items-center gap-3 py-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or use your email<span className="h-px flex-1 bg-slate-200" /></div>
    <form aria-busy={pending === "resend"} onSubmit={emailSignIn} className="space-y-3">
      <label htmlFor="sign-in-email" className="block text-sm font-medium text-slate-700">Email address</label>
      <input id="sign-in-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setSent(false); }} placeholder="you@example.com" disabled={pending !== null} className="min-h-12 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 outline-brand-600" />
      <button type="submit" disabled={pending !== null} className={`${button} bg-slate-900 text-white hover:bg-slate-700`}><Mail size={18} aria-hidden="true" />{pending === "resend" ? "Sending link…" : "Sign in with Email"}</button>
    </form>
    {error && <p role="alert" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{error}</p>}
    {sent && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">Check your email for your sign-in link! It expires in 30 minutes and can be used once. Check your spam folder too.</p>}
    <p className="pt-1 text-xs leading-5 text-slate-400">New here? Your account is created after you verify your email. No password needed.</p>
  </div>;
}
