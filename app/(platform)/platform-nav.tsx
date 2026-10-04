"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, Home, Settings, UserRound, Users, UsersRound } from "lucide-react";

export function PlatformNav({ profileHref, onNavigate }: { profileHref: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const links = [
    { href: profileHref, label: "Your Profile", icon: UserRound },
    { href: "/feed", label: "Home Feed", icon: Home },
    { href: "/friends", label: "Friends", icon: UsersRound },
    { href: "/groups", label: "Groups", icon: Users },
    { href: "/events", label: "Events", icon: CalendarDays },
    { href: "/directory", label: "Directory", icon: Compass },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  return <ul className="space-y-1">{links.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return <li key={label}><Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${active ? "bg-brand-600/10 text-brand-700" : "text-slate-600 hover:bg-white"}`}><Icon size={21} aria-hidden="true" />{label}</Link></li>;
  })}</ul>;
}
