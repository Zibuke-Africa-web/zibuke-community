import Link from "next/link";
import { ArrowUpRight, Sparkles, MessageCircle } from "lucide-react";

const friends = [
  { name: "Thandi Mokoena", initials: "TM", color: "bg-rose-100 text-rose-700" },
  { name: "Sipho Dlamini", initials: "SD", color: "bg-amber-100 text-amber-800" },
  { name: "Lerato Nkosi", initials: "LN", color: "bg-violet-100 text-violet-700" },
];

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600";

function Avatar({ initials, small = false, color = "bg-brand-100 text-brand-700" }: { initials: string; small?: boolean; color?: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold ${small ? "size-9 text-xs" : "size-11 text-sm"} ${color}`}>
      {initials}
    </span>
  );
}

export function CommunityWidgets() {
  return (
    <div className="space-y-5">
      {/* AI Insights Card */}
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="grid size-9 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">
            <Sparkles size={19} />
          </span>
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold tracking-wider text-brand-700 uppercase">
            Your daily spark
          </span>
        </div>
        <h2 className="font-bold tracking-tight">Zibuke AI Insights</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">A little perspective. A new possibility.</p>
        <div className="mt-4 rounded-xl bg-white/80 p-3 text-sm leading-6 text-slate-600">
          Your personalised community insights will appear here as this feature becomes available.
        </div>
        <Link href="/groups" className={`mt-4 flex items-center gap-2 text-sm font-semibold text-brand-700 ${focus}`}>
          Explore your communities <ArrowUpRight size={16} />
        </Link>
      </section>

      {/* Sponsored Ad - Zibuke OnCall */}
      <section aria-labelledby="sponsored-title">
        <div className="mb-3 flex justify-between">
          <h2 id="sponsored-title" className="text-sm font-semibold text-slate-500">Sponsored</h2>
          <span className="text-xs text-slate-400">Partner</span>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-[#0d140e] border border-[#223824] p-5 text-white shadow-sm">
          {/* Subtle Lime Ambient Glow */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-8 -right-8 size-36 rounded-full bg-[#ccff00]/15 blur-2xl" />

          <span className="relative inline-block rounded-full bg-[#ccff00]/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#ccff00] uppercase">
            On-Demand Landscaping
          </span>

          <h3 className="relative mt-3 text-lg font-bold leading-snug tracking-tight text-white">
            Put Your Home on Complete Autopilot.
          </h3>

          <p className="relative mt-2 text-xs leading-5 text-slate-300">
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
        </div>
      </section>

      {/* Active Friends / Chat Card */}
      <section className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Active friends / Chat</h2>
          <span className="text-[10px] text-slate-400">Preview</span>
        </div>
        <ul className="mt-3 space-y-1">
          {friends.map((friend) => (
            <li key={friend.name}>
              <Link
                href="/messages"
                className={`flex items-center gap-3 rounded-xl p-2 transition hover:bg-white ${focus}`}
              >
                <span className="relative">
                  <Avatar initials={friend.initials} small color={friend.color} />
                  <span aria-hidden="true" className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-[#f4f6f8] bg-emerald-500" />
                </span>
                <span className="text-sm font-medium">{friend.name}</span>
                <MessageCircle size={15} className="ml-auto text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Sample contacts. Live chat presence is coming soon.
        </p>
      </section>
    </div>
  );
}