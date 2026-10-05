import type { Metadata } from "next";
import { ArrowUpRight, HeartHandshake, Sparkles, UsersRound } from "lucide-react";
import { LoginMethods } from "@/components/login-methods";
import { loginDestination } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Welcome · Zibuke Community", description: "Find your people. Share your ideas. Grow together with Zibuke Community." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  return <main className="relative grid min-h-dvh overflow-hidden bg-[#f4f6f8] text-slate-800 lg:grid-cols-[1.1fr_1fr]">
    <section className="relative flex flex-col justify-between overflow-hidden bg-[#e8efff] px-6 py-8 sm:px-12 lg:min-h-dvh lg:px-16 lg:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -right-36 bottom-[-10rem] size-[38rem] rounded-full border-[5rem] border-blue-200/40" />
      <div className="relative flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-3xl font-black text-white">z</span><span><span className="block text-2xl font-extrabold tracking-tight">zibuke<span className="text-brand-600">.</span></span><span className="text-[10px] font-bold tracking-[.22em] text-slate-500 uppercase">Community</span></span></div>
      <div className="relative max-w-xl py-12 lg:py-20"><p className="mb-5 text-xs font-bold tracking-[.2em] text-brand-700 uppercase">Your people. Your possibilities.</p><h1 className="text-4xl leading-[1.12] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">Good things<br />grow <span className="text-brand-600">together.</span></h1><p className="mt-6 max-w-md text-base leading-8 text-slate-600">A conversation can open a door. An idea can bring people together. Find your community and see what’s possible.</p><div className="mt-9 flex flex-wrap gap-3">{["Make connections", "Share ideas", "Grow together"].map(label => <span key={label} className="rounded-full border border-white/80 bg-white/60 px-4 py-2 text-xs font-semibold text-brand-800">{label}</span>)}</div></div>
      <p className="relative hidden text-xs text-slate-500 lg:block">Built for connection. Made for community.</p>
    </section>
    <section aria-labelledby="login-heading" className="flex items-center justify-center px-5 py-12 sm:px-12 lg:py-16"><div className="w-full max-w-md"><span className="mb-6 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><HeartHandshake size={25} /></span><h2 id="login-heading" className="text-3xl font-bold tracking-tight">Welcome to your community.</h2><p className="mt-4 text-sm leading-7 text-slate-500">Connect with people who inspire you, discover local groups, and be part of something bigger.</p>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="mb-2 font-semibold">Come on in.</h3><p className="mb-5 text-sm leading-6 text-slate-500">Choose how you’d like to join or sign in.</p>{params.error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{params.error === "OAuthAccountNotLinked" ? "This email is already connected to another sign-in method. Use your original method or sign in with an email link." : params.error === "Verification" ? "This sign-in link has expired or has already been used. Request a new email link below." : "We couldn’t complete sign-in. Please try again."}</p>}<LoginMethods callbackUrl={loginDestination(params.callbackUrl)} /></div>
      <div className="mt-7 grid grid-cols-3 gap-3 text-center text-xs text-slate-500"><div><UsersRound className="mx-auto mb-2 text-brand-500" size={20} />Find your people</div><div><Sparkles className="mx-auto mb-2 text-brand-500" size={20} />Fresh perspectives</div><div><ArrowUpRight className="mx-auto mb-2 text-brand-500" size={20} />New possibilities</div></div>
    </div></section>
  </main>;
}
