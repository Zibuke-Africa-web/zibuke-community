import Link from "next/link";
import { BriefcaseBusiness, House, Lightbulb, Users, type LucideIcon } from "lucide-react";
import type { SpaceSummary } from "@/lib/spaces";
import { joinSpace } from "@/app/(community)/spaces/actions";
import { JoinButton } from "./join-button";

export const spaceButton = "inline-flex items-center justify-center rounded-full bg-[#ccff00] px-5 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current";
const icons: Record<string, LucideIcon> = { Users, BriefcaseBusiness, House, Lightbulb };

export function SpaceIcon({ icon }: { icon: string | null }) {
  const Icon = icon ? icons[icon] : Users;
  return <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-current">{Icon ? <Icon size={24} /> : icon}</span>;
}

export function PrivacyBadge({ privacy }: { privacy: SpaceSummary["privacy"] }) {
  return <span className="inline-flex rounded-full border border-current px-3 py-1 text-xs font-semibold">{privacy === "members_only" ? "Members only" : privacy === "private" ? "Private" : "Public"}</span>;
}

export function SpaceAction({ space, detail = false }: { space: SpaceSummary; detail?: boolean }) {
  if (space.isMember) return detail
    ? <span className="inline-flex rounded-full bg-[#ccff00] px-5 py-3 text-sm font-bold text-black">You’re a member</span>
    : <Link className={spaceButton} href={`/spaces/${space.slug}`}>Enter Space</Link>;
  return <form action={joinSpace}><input type="hidden" name="slug" value={space.slug} /><JoinButton /></form>;
}
