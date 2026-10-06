import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { initials, safeHttps, type Champion } from "@/lib/community";

export function LeaderboardWidget({ members }: { members: Champion[] }) {
  return <section className="rounded-2xl border border-black bg-white p-5 text-black"><h2 className="flex items-center gap-2 font-bold"><Trophy size={20} aria-hidden="true" />Community Champions</h2>
    {!members.length ? <p className="mt-4 text-sm">Your next contribution could start a streak. Champions appear as members participate.</p> : <ol className="mt-4 space-y-4">{members.map((member, index) => <li key={member.id} className="flex items-center gap-2">
      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-[#ccff00] text-black" : "bg-black text-[#ccff00]"}`}>{index + 1}</span>
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ccff00] text-xs font-bold text-black">{safeHttps(member.image) ? <Image unoptimized src={safeHttps(member.image)!} alt="" width={36} height={36} /> : initials(member.name || "Member")}</span>
      <div className="min-w-0"><Link href={`/profile/${encodeURIComponent(member.id)}`} className="block truncate text-sm font-bold hover:opacity-90">{member.name || "Community member"}</Link><p className="text-xs">{member.badgeTitle || "Contributor"}</p><p className="mt-1 text-xs">{member.points} points · 🔥 {member.currentStreak} {member.currentStreak === 1 ? "day" : "days"}</p></div>
    </li>)}</ol>}</section>;
}
