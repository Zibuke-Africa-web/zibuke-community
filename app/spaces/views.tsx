"use client";

import Link from "next/link";
import { useState } from "react";
import { BriefcaseBusiness, House, Lightbulb, Users, Search, type LucideIcon } from "lucide-react";
import { type Space } from "./space-data";

const limeButton = "inline-flex items-center justify-center rounded-full bg-[#ccff00] px-5 py-3 font-bold text-black transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current disabled:cursor-not-allowed";
const blackButton = "inline-flex items-center justify-center rounded-full bg-black px-5 py-3 font-bold text-[#ccff00] transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black";
const icons: Record<string, LucideIcon> = { Users, BriefcaseBusiness, House, Lightbulb };

export function SpaceIcon({ icon }: { icon: string }) {
  const Icon = icons[icon];
  return <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-current">{Icon ? <Icon size={24} /> : icon}</span>;
}

function Privacy({ space }: { space: Space }) {
  return <span className="rounded-full border border-current px-3 py-1 text-xs font-bold">{space.privacy === "members_only" ? "Members only" : space.privacy === "private" ? "Private" : "Public"}</span>;
}

export function SpacesDirectory({ spaces, preview }: { spaces: Space[]; preview: boolean }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const filtered = spaces.filter(space => `${space.name} ${space.tag}`.toLocaleLowerCase().includes(needle));
  return <>
    <header className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-widest">Find your people</p><h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Big community.<br />Your kind of space.</h1><p className="mt-5 text-lg leading-relaxed">Explore curated rooms for the things you care about. Meet neighbours, grow your business, or build something new with people who share your interests.</p></header>
    {preview && <p className="mt-5 text-sm">Explore our starter spaces. Member counts and activity are previews.</p>}
    <div className="my-8"><label htmlFor="space-search" className="mb-2 block text-sm font-bold">Find a space by name or tag</label><div className="flex max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-black"><Search aria-hidden="true" size={20} /><input id="space-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try business, garden, or Local Hub" className="min-w-0 flex-1 bg-white py-4 text-black placeholder:text-black focus-visible:outline-2 focus-visible:outline-black" /></div><p aria-live="polite" className="mt-3 text-sm">{filtered.length} {filtered.length === 1 ? "space" : "spaces"} to explore</p></div>
    <section aria-label="Spaces" className="grid gap-6 md:grid-cols-2">
      {filtered.map(space => <article key={space.id} className={`flex flex-col rounded-3xl border p-7 ${space.featured ? "border-[#223824] bg-[#0d140e] text-[#ccff00]" : "border-slate-200 bg-white text-black"}`}>
        <div className="flex items-center justify-between gap-4"><SpaceIcon icon={space.icon} /><span className="rounded-full border border-current px-3 py-1 text-xs font-bold">{space.members} members</span></div>
        <p className="mt-6 text-xs font-bold uppercase tracking-widest">{space.tag}</p><h2 className="mt-2 text-2xl font-bold">{space.name}</h2><p className="mt-3 flex-1 leading-relaxed">{space.description}</p>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><Privacy space={space} /><Link href={`/spaces/${space.slug}`} className={space.featured ? limeButton : blackButton}>Enter Space <span className="sr-only">: {space.name}</span></Link></div>
      </article>)}
    </section>
    {!filtered.length && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-black"><h2 className="text-xl font-bold">{query.trim() ? "No matching spaces" : "New spaces are on the way"}</h2><p className="my-3">{query.trim() ? "Try a broader topic or clear your search to explore every space." : "Join the main feed while we get more conversations ready for you."}</p>{query.trim() ? <button className={blackButton} onClick={() => setQuery("")}>Clear search</button> : <Link href="/feed" className={blackButton}>Explore the community feed</Link>}</div>}
  </>;
}
