"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { BriefcaseBusiness, House, Lightbulb, Users, Pin, Search, type LucideIcon } from "lucide-react";
import { type Space, topicFor } from "./space-data";
import { setMembership } from "./membership";

const limeButton = "inline-flex items-center justify-center rounded-full bg-[#ccff00] px-5 py-3 font-bold text-black transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current disabled:cursor-not-allowed";
const blackButton = "inline-flex items-center justify-center rounded-full bg-black px-5 py-3 font-bold text-[#ccff00] transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black";
const icons: Record<string, LucideIcon> = { Users, BriefcaseBusiness, House, Lightbulb };

function SpaceIcon({ icon }: { icon: string }) {
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
    {!filtered.length && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-black"><h2 className="text-xl font-bold">No matching spaces</h2><p className="my-3">Try another name or tag.</p><button className={blackButton} onClick={() => setQuery("")}>Clear search</button></div>}
  </>;
}

export function SpaceDetail({ space, preview }: { space: Space; preview: boolean }) {
  const [joined, setJoined] = useState(space.joined);
  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState<{ id: string; content: string }[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const topic = topicFor(space.slug);
  const canRead = space.privacy === "public" || joined;
  const count = Math.max(0, space.members + Number(joined) - Number(space.joined));

  function toggleJoin() {
    setError("");
    if (preview) { setJoined(!joined); return; }
    startTransition(async () => {
      try {
        const result = await setMembership(space.slug, !joined);
        if (result.error) setError(result.error);
        else setJoined(!joined);
      } catch { setError("Membership couldn’t be changed. Please refresh and try again."); }
    });
  }

  function addPreviewPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || !joined) return;
    setPosts(previous => [{ id: crypto.randomUUID(), content: draft.trim() }, ...previous]);
    setDraft("");
  }

  return <>
    <Link href="/spaces" className="mb-6 inline-flex text-sm font-bold hover:opacity-90">← All spaces</Link>
    <header className="overflow-hidden rounded-3xl border border-[#223824]">
      <div className="bg-[#0d140e] p-8 text-[#ccff00] md:p-12"><div className="flex items-center justify-between gap-4"><SpaceIcon icon={space.icon} /><Privacy space={space} /></div><p className="mt-8 text-sm font-bold uppercase tracking-widest">{space.tag}</p><h1 className="mt-3 text-3xl font-black md:text-5xl">{space.name}</h1><p className="mt-4 max-w-2xl text-lg leading-relaxed">{space.description}</p></div>
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-8 py-5 text-black"><p aria-live="polite" className="font-bold">{count} members · {joined ? "You belong here" : "Find your people here"}</p><button onClick={toggleJoin} aria-pressed={joined} disabled={pending || space.privacy === "private"} className={limeButton}>{pending ? "Saving…" : joined ? "Joined" : "Join Space"}</button></div>
    </header>
    {error && <p role="alert" className="mt-4 bg-white text-black">{error}</p>}
    {preview && <p className="mt-4 text-sm">Starter space preview. Joining here lasts until you leave or refresh this page.</p>}
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section aria-label="Space discussions" className="min-w-0 space-y-6">
        {canRead ? <>
          <article className="rounded-3xl border border-black bg-[#ccff00] p-7 text-black"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><Pin size={16} aria-hidden="true" /> Pinned discussion prompt</p><h2 className="mt-4 text-2xl font-bold">{topic.title}</h2><p className="mt-3 leading-relaxed">{topic.prompt}</p></article>
          <form onSubmit={addPreviewPost} className="rounded-3xl border border-slate-200 bg-white p-6 text-black"><label htmlFor="space-post" className="block font-bold">Share something with this space...</label><textarea id="space-post" value={draft} onChange={event => setDraft(event.target.value)} disabled={!joined} maxLength={2000} rows={4} placeholder={joined ? "What is on your mind?" : "Join this space to try a discussion draft."} aria-describedby="post-preview-note" className="mt-4 w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-black placeholder:text-black focus-visible:outline-2 focus-visible:outline-black" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p id="post-preview-note" className="max-w-xs text-sm">Discussion preview only. Posts stay on this page and are not saved or shared.</p><button type="submit" disabled={!joined || !draft.trim()} className={limeButton}>Preview post</button></div></form>
          <div aria-live="polite" className="space-y-4">{posts.map(post => <article key={post.id} className="rounded-3xl border border-slate-200 bg-white p-7 text-black"><p className="text-sm font-bold">You · Local preview</p><p className="mt-3 whitespace-pre-wrap break-words">{post.content}</p></article>)}</div>
          <section aria-label="Discussion starters"><h2 className="mb-4 text-xl font-bold">Around this space</h2><p className="mb-4 text-sm">Discussion starters to get things going.</p><div className="space-y-4">{topic.discussions.map(title => <article key={title} className="rounded-3xl border border-slate-200 bg-white p-7 text-black"><p className="text-xs font-bold uppercase tracking-widest">Discussion idea</p><h3 className="mt-3 text-lg font-bold">{title}</h3><p className="mt-3 text-sm">A starting point for your next conversation.</p></article>)}</div></section>
        </> : <section className="rounded-3xl border border-slate-200 bg-white p-8 text-black"><h2 className="text-2xl font-bold">A conversation for members</h2><p className="mt-3">Join this space to explore its discussion prompts and try the post creator.</p></section>}
      </section>
      <aside className="rounded-3xl border border-slate-200 bg-white p-7 text-black"><h2 className="text-xl font-bold">Make yourself at home</h2><p className="mt-4 leading-relaxed">Share generously, be kind, and keep conversations connected to this space. Every good connection starts with a hello.</p><Link href="/feed" className="mt-6 inline-block font-bold hover:opacity-90">Back to community feed →</Link></aside>
    </div>
  </>;
}
