"use client";

import Link from "next/link";
import { Sparkles, MessageCircle } from "lucide-react";
import { fallbackSpark, type DailySpark } from "@/lib/daily-spark";
import { useCoHost } from "@/components/cohost-drawer";

const friends = [
  { name: "Thandi Mokoena", initials: "TM", color: "bg-[#ccff00] text-black" },
  { name: "Sipho Dlamini", initials: "SD", color: "bg-black text-[#ccff00]" },
  { name: "Lerato Nkosi", initials: "LN", color: "bg-white text-black border border-black" },
];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current";

function Avatar({ initials, small = false, color = "bg-[#ccff00] text-black" }: { initials: string; small?: boolean; color?: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold ${small ? "size-9 text-xs" : "size-11 text-sm"} ${color}`}>
      {initials}
    </span>
  );
}

export function CommunityWidgets({ spark = fallbackSpark }: { spark?: DailySpark }) {
  const openCoHost = useCoHost();
  return (
    <div className="space-y-5 bg-white text-black">
      {/* AI Insights Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-black">
        <div className="mb-4 flex items-center justify-between">
          <span className="grid size-9 place-items-center rounded-xl bg-[#ccff00] text-black shadow-sm">
            <Sparkles size={19} />
          </span>
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold tracking-wider text-black uppercase">
            Today&apos;s Community Spark
          </span>
        </div>
        <h2 className="font-bold tracking-tight">Zibuke AI Insights</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-black">{spark.topic}</p>
        <div className="mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-black">
          {spark.prompt}
        </div>
        <p className="mt-2 text-[10px] text-black">{spark.createdAt ? "AI-generated conversation starter" : "Curated conversation starter"}</p>
        <button type="button" aria-haspopup="dialog" aria-controls="cohost-drawer" onClick={() => openCoHost()} className={`mt-4 inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-4 py-2 text-sm font-bold text-black hover:scale-[1.01] ${focus}`}>
          <Sparkles size={16} aria-hidden="true" /> Open Co-Host
        </button>
        <Link href={`/spaces/${spark.targetSpaceSlug}`} className={`mt-4 flex items-center gap-2 text-sm font-semibold text-black hover:opacity-90 ${focus}`}>
          Join today&apos;s conversation →
        </Link>
      </section>

      {/* Sponsored Ad - Zibuke OnCall */}
      <section aria-labelledby="sponsored-title">
        <div className="mb-3 flex justify-between">
          <h2 id="sponsored-title" className="text-sm font-semibold text-black">Sponsored</h2>
          <span className="text-xs text-black">Partner</span>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-[#0d140e] border border-[#223824] p-5 text-[#ccff00] shadow-sm">
          <span className="relative inline-block rounded-full bg-[#ccff00] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-black uppercase">
            On-Demand Landscaping
          </span>

          <h3 className="relative mt-3 text-lg font-bold leading-snug tracking-tight text-[#ccff00]">
            Put Your Home on Complete Autopilot.
          </h3>

          <p className="relative mt-2 text-xs leading-5 text-[#ccff00]">
            One trusted team for your garden. Fixed monthly standards, zero surprise fees, and year-round care.
          </p>

          <div className="relative mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#ccff00]">
              Zibuke OnCall
            </span>
            <Link
              href="https://zibukeoncall.co.za/"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center rounded-lg bg-[#ccff00] px-3.5 py-1.5 text-xs font-bold text-black transition-transform hover:scale-105 active:scale-95 shadow-sm ${focus}`}
            >
              Book OnCall &rarr;
            </Link>
          </div>
          <Link href="/spaces/home-and-garden" className={`relative mt-4 block text-xs font-semibold leading-5 text-[#ccff00] hover:opacity-90 ${focus}`}>
            Join the Home &amp; Garden Care space →
          </Link>
        </div>
      </section>

      {/* Active Friends / Chat Card */}
      <section className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Active friends / Chat</h2>
          <span className="text-[10px] text-black">Preview</span>
        </div>
        <ul className="mt-3 space-y-1">
          {friends.map((friend) => (
            <li key={friend.name}>
              <Link
                href="/messages"
                className={`flex items-center gap-3 rounded-xl bg-white p-2 text-black hover:opacity-90 ${focus}`}
              >
                <span className="relative">
                  <Avatar initials={friend.initials} small color={friend.color} />
                  <span aria-hidden="true" className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-black bg-[#ccff00]" />
                </span>
                <span className="text-sm font-medium">{friend.name}</span>
                <MessageCircle size={15} className="ml-auto text-black" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-black">
          Sample contacts. Live chat presence is coming soon.
        </p>
      </section>
    </div>
  );
}
