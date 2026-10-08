"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, Home, LayoutGrid, Settings, UserRound, UsersRound } from "lucide-react";

const pinnedSpaces = [
  { href: "/spaces/welcome", label: "Welcome" },
  { href: "/spaces/business", label: "Local Business" },
  { href: "/spaces/home-and-garden", label: "Home & Garden Care", partner: true },
];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

export function PlatformNav({ profileHref, onNavigate }: { profileHref: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const links = [
    { href: profileHref, label: "Your Profile", icon: UserRound },
    { href: "/feed", label: "Home Feed", icon: Home },
    { href: "/friends", label: "Friends", icon: UsersRound },
    { href: "/spaces", label: "Spaces", icon: LayoutGrid },
    { href: "/events", label: "Events", icon: CalendarDays },
    { href: "/directory", label: "Directory", icon: Compass },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  return <ul className="space-y-1">{links.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return <li key={label}>
      <Link href={href} onClick={onNavigate} aria-current={active ? (pathname === href ? "page" : "location") : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-transform hover:scale-[1.01] ${focus} ${active ? "bg-[#ccff00] text-black" : "bg-white text-black"}`}><Icon size={21} aria-hidden="true" />{label}</Link>
      {href === "/spaces" && <ul aria-label="Pinned spaces" className="my-2 ml-6 space-y-1 border-l border-black pl-3">
        {pinnedSpaces.map(space => {
          const selected = pathname === space.href || pathname.startsWith(`${space.href}/`);
          return <li key={space.href}><Link href={space.href} onClick={onNavigate} aria-current={selected ? "page" : undefined} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold hover:opacity-90 ${focus} ${selected ? "bg-[#ccff00] text-black" : "bg-white text-black"}`}>
            {space.partner && <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-black bg-[#ccff00]" />}{space.label}
          </Link></li>;
        })}
        <li><Link href="/spaces" onClick={onNavigate} className={`flex min-h-10 items-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-black hover:opacity-90 ${focus}`}>+ Explore Spaces</Link></li>
      </ul>}
    </li>;
  })}</ul>;
}
