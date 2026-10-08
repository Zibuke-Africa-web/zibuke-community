"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, HeartPulse } from "lucide-react";

const adminLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/health", label: "System health", icon: HeartPulse },
];

type NavVariant = "sidebar" | "tabs";

const listStyle: Record<NavVariant, string> = {
  sidebar: "flex flex-col gap-0.5 p-2",
  tabs: "flex gap-1 overflow-x-auto px-3 py-2",
};

const linkStyle: Record<NavVariant, string> = {
  sidebar: "gap-2.5 rounded-md px-2.5",
  tabs: "gap-2 rounded-md px-3",
};

const ringOffsetStyle: Record<NavVariant, string> = {
  sidebar: "focus-visible:ring-offset-gray-900",
  tabs: "focus-visible:ring-offset-gray-950",
};

export function AdminNav({ variant }: { variant: NavVariant }) {
  const pathname = usePathname();

  return (
    <ul className={listStyle[variant]}>
      {adminLinks.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-9 items-center text-sm whitespace-nowrap transition-colors ${linkStyle[variant]} ${
                isActive
                  ? "bg-gray-800 font-medium text-white"
                  : variant === "tabs" ? "text-slate-800 hover:bg-slate-100" : "text-gray-300 hover:bg-gray-800/60 hover:text-gray-100"
              } focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${ringOffsetStyle[variant]}`}
            >
              <Icon
                aria-hidden="true"
                className={`size-4 ${isActive ? "text-brand-400" : "text-gray-500"}`}
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
