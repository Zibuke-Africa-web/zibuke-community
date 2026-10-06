"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Home, Menu, MessageCircle, Search, Sparkles, Users, X } from "lucide-react";
import { CommunityWidgets } from "@/components/community-widgets";
import type { Champion } from "@/lib/community";
import type { DailySpark } from "@/lib/daily-spark";
import { PlatformNav } from "./platform-nav";
import { CoHostProvider } from "@/components/cohost-drawer";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current";

export function PlatformShell({ children, userId, userName, spark, champions }: { children: React.ReactNode; userId?: string; userName: string; spark: DailySpark; champions: Champion[] }) {
  const pathname = usePathname();
  const profileHref = userId ? `/profile/${encodeURIComponent(userId)}` : "/api/auth/signin?callbackUrl=%2Fprofile";
  const initials = userId ? userName.split(/\s+/).slice(0, 2).map(word => word[0]).join("") : "Y";
  const content = useRef<HTMLElement>(null);
  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [pathname]);
  return <CoHostProvider><div className="h-dvh overflow-hidden bg-white font-sans text-black">
    <a href="#platform-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to content</a>
    <header className="relative z-30 h-18 border-b border-slate-200 bg-white"><div className="mx-auto flex h-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:gap-8">
      <Link href="/feed" className={`flex shrink-0 items-center gap-2.5 ${focus}`} aria-label="Zibuke Community home"><span className="grid size-10 place-items-center rounded-xl bg-[#ccff00] text-2xl font-black text-black">z</span><span className="hidden sm:block"><span className="block text-xl leading-5 font-extrabold tracking-tight">zibuke<span className="text-black">.</span></span><span className="text-[9px] font-semibold tracking-[.2em] text-black uppercase">Community</span></span></Link>
      <form action="/directory" role="search" className="relative max-w-sm flex-1"><Search size={17} aria-hidden="true" className="pointer-events-none absolute top-3.5 left-4 text-black" /><input type="search" name="q" aria-label="Search people, posts, or spaces" placeholder="Search people, posts, or spaces…" className="h-11 w-full rounded-full border border-black bg-white text-black placeholder:text-black pr-3 pl-11 text-sm outline-black" /></form>
      <div className="ml-auto flex items-center gap-2"><span className="mr-3 hidden text-xs text-black xl:block">A place to belong. A space to grow.</span><Link href="/messages" aria-label="Messages" aria-current={pathname === "/messages" ? "page" : undefined} className={`grid size-10 place-items-center rounded-full ${pathname === "/messages" ? "bg-[#ccff00] text-black" : "bg-white text-black border border-black"} ${focus}`}><MessageCircle size={19} /></Link><Link href={profileHref} aria-label="Your Profile" className={`hidden size-9 place-items-center rounded-full bg-[#ccff00] text-xs font-bold text-black sm:grid ${focus}`}>{initials}</Link></div>
    </div></header>
    <div className="mx-auto grid h-[calc(100dvh-4.5rem)] max-w-[1600px] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5 lg:px-6 xl:grid-cols-[230px_minmax(0,1fr)_270px] xl:gap-7">
      <aside className="hidden h-full overflow-y-auto pt-7 pb-8 lg:block"><nav aria-label="Primary navigation"><PlatformNav profileHref={profileHref} /></nav><div className="mx-4 mt-7 border-t border-slate-200 pt-6"><p className="text-[10px] font-bold tracking-[.16em] text-black uppercase">Better, together</p><p className="mt-3 text-sm leading-6 text-black">Connect with people.<br />Turn ideas into possibilities.</p><Link href="/groups" className={`mt-5 flex items-center gap-2 text-xs font-semibold text-black ${focus}`}>Discover a group <ArrowUpRight size={14} /></Link></div></aside>
      <main ref={content} id="platform-content" tabIndex={-1} className="min-w-0 overflow-y-auto overscroll-contain px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none sm:px-6 lg:px-0 lg:pt-7 lg:pb-8">{children}</main>
      <aside aria-label="Community widgets" className="hidden h-full overflow-y-auto pt-7 pb-8 xl:block"><CommunityWidgets spark={spark} champions={champions} /></aside>
    </div>
    <MobileNavigation champions={champions} spark={spark} key={pathname} profileHref={profileHref} pathname={pathname} />
  </div></CoHostProvider>;
}

function MobileNavigation({ profileHref, pathname, spark, champions }: { profileHref: string; pathname: string; spark: DailySpark; champions: Champion[] }) {
  const [panel, setPanel] = useState<"menu" | "widgets" | null>(null);
  const close = () => setPanel(null);
  return <>
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {[{ href: "/feed", label: "Feed", icon: Home }, { href: "/groups", label: "Groups", icon: Users }].map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={close} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${focus} ${pathname === href || pathname.startsWith(`${href}/`) ? "bg-[#ccff00] text-black" : "bg-white text-black"}`}><Icon size={21} />{label}</Link>)}
      <button aria-expanded={panel === "widgets"} aria-controls="mobile-platform-panel" onClick={() => setPanel(panel === "widgets" ? null : "widgets")} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-black ${focus}`}><Sparkles size={21} />Community</button><button aria-expanded={panel === "menu"} aria-controls="mobile-platform-panel" onClick={() => setPanel(panel === "menu" ? null : "menu")} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-black ${focus}`}><Menu size={21} />Menu</button>
    </nav>
    <button onClick={() => setPanel(panel === "widgets" ? null : "widgets")} aria-expanded={panel === "widgets"} aria-label="Community widgets" className={`fixed right-5 bottom-5 z-40 hidden size-12 place-items-center rounded-full bg-black text-[#ccff00] shadow-lg lg:grid xl:hidden ${focus}`}><Sparkles size={20} /></button>
    {panel && <section id="mobile-platform-panel" aria-label={panel === "menu" ? "Navigation menu" : "Community widgets"} onKeyDown={event => { if (event.key === "Escape") close(); }} className="fixed inset-x-0 top-18 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 overflow-y-auto bg-white text-black p-5 lg:inset-x-auto lg:right-0 lg:bottom-0 lg:w-80 lg:shadow-xl xl:hidden"><div className="mx-auto max-w-md"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{panel === "menu" ? "Your community" : "Community corner"}</h2><button autoFocus aria-label="Close panel" onClick={close} className={`grid size-11 place-items-center rounded-full bg-white ${focus}`}><X size={20} /></button></div>{panel === "menu" ? <nav aria-label="Primary navigation"><PlatformNav profileHref={profileHref} onNavigate={close} /></nav> : <CommunityWidgets spark={spark} champions={champions} />}</div></section>}
  </>;
}
