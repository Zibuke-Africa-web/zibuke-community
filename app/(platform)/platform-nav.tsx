"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MessageSquare, Users } from "lucide-react";

const platformLinks = [
  { href: "/directory", label: "Directory", icon: Compass },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

type NavVariant = "sidebar" | "tabs";

const listStyle: Record<NavVariant, string> = {
  sidebar: "flex flex-col gap-1",
  tabs: "mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 py-2",
};

const linkStyle: Record<NavVariant, string> = {
  sidebar: "gap-3 rounded-lg px-3",
  tabs: "gap-2 rounded-full px-3.5",
};

const iconStyle: Record<NavVariant, string> = {
  sidebar: "size-5",
  tabs: "size-4",
};

const ringOffsetStyle: Record<NavVariant, string> = {
  sidebar: "focus-visible:ring-offset-stone-100",
  tabs: "focus-visible:ring-offset-stone-50",
};

export function PlatformNav({ variant }: { variant: NavVariant }) {
  const pathname = usePathname();

  return (
    <ul className={listStyle[variant]}>
      {platformLinks.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center text-sm whitespace-nowrap transition-colors ${linkStyle[variant]} ${
                isActive
                  ? "bg-white font-semibold text-stone-900 ring-1 ring-stone-200"
                  : "font-medium text-stone-700 hover:bg-white/70 hover:text-stone-900"
              } focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${ringOffsetStyle[variant]}`}
            >
              <Icon
                aria-hidden="true"
                className={`${iconStyle[variant]} ${
                  isActive ? "text-brand-700" : "text-stone-500"
                }`}
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
