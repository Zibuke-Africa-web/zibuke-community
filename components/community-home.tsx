"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Globe2, Heart, ImagePlus, MessageCircle, Search, Send, X } from "lucide-react";

type Post = { id: string; name: string; initials: string; role: string; time: string; text: string; art?: "garden" | "ideas"; media?: string; video?: boolean };
const initialPosts: Post[] = [
  { id: "welcome", name: "Zibuke Community", initials: "Z", role: "Community team", time: "2026-10-04T08:00:00Z", text: "Big things start with small connections. 🌱\n\nA shared idea. A helping hand. A conversation that opens a door. What’s one thing you’d love to build with your community?", art: "garden" },
  { id: "ideas", name: "Thandi Mokoena", initials: "TM", role: "Creative entrepreneur", time: "2026-10-04T07:30:00Z", text: "A little reminder for anyone starting something new: you don’t have to have it all figured out. Start where you are, share what you know, and find your people.\n\nWhat are you working on this week? 💡", art: "ideas" },
  { id: "connect", name: "Sipho Dlamini", initials: "SD", role: "Community builder", time: "2026-10-03T14:00:00Z", text: "The best part of a community? Someone always knows someone. Introduce yourself below — your next collaborator could be one conversation away. 🤝" },
];
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600";
function Avatar({ initials, small = false, color = "bg-brand-100 text-brand-700" }: { initials: string; small?: boolean; color?: string }) {
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold ${small ? "size-9 text-xs" : "size-11 text-sm"} ${color}`}>{initials}</span>;
}

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [comments, setComments] = useState<string[]>([]);
  return <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_0_rgb(15_23_42/0.025)]">
    <header className="flex items-center gap-3 px-5 pt-5"><Avatar initials={post.initials} color={post.initials === "Z" ? "bg-brand-600 text-white" : "bg-rose-100 text-rose-700"} /><div className="min-w-0"><h2 className="text-sm font-bold">{post.name}</h2><p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">{post.role}<span>·</span><time dateTime={post.time}>{new Date(post.time).toLocaleDateString("en-ZA", { month: "short", day: "numeric", timeZone: "Africa/Johannesburg" })}</time><Globe2 size={11} aria-label="Public post" /></p></div></header>
    <p className="px-5 py-4 text-sm leading-7 whitespace-pre-wrap text-slate-700">{post.text}</p>
    {post.media ? post.video ? <video controls src={post.media} className="max-h-96 w-full bg-slate-950" /> : <Image unoptimized src={post.media} alt="Attached post preview" width={900} height={600} className="max-h-96 w-full object-contain bg-slate-50" /> : post.art ? <div role="img" aria-label="Community image placeholder" className={`relative mx-4 flex aspect-[1.9] flex-col justify-end overflow-hidden rounded-xl p-6 sm:p-8 ${post.art === "garden" ? "bg-[#e7eee3] text-[#294735]" : "bg-[#eee9fc] text-[#514086]"}`}>
      <div aria-hidden="true" className="absolute -top-10 -right-8 size-56 rounded-full border-[36px] border-current opacity-[.07]" /><div aria-hidden="true" className="absolute top-8 right-16 size-28 rotate-12 rounded-[2rem] bg-white/40" />
      <span className="relative text-[10px] font-bold tracking-[.22em] uppercase">{post.art === "garden" ? "Rooted in community" : "A little inspiration"}</span><p className="relative mt-3 max-w-80 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{post.art === "garden" ? <>Good things<br />grow together.</> : <>Your next chapter<br />starts with an idea.</>}</p><span className="relative mt-5 text-[10px] opacity-60">ZIBUKE COMMUNITY · IMAGE PLACEHOLDER</span>
    </div> : null}
    <div className="mx-5 mt-4 flex min-h-9 items-center justify-between border-b border-slate-100 text-xs text-slate-500"><span>{liked ? "You liked this" : "Be the first to show some love"}</span><span>{comments.length ? `${comments.length} comments` : "Start a conversation"}</span></div>
    <div className="grid grid-cols-2 gap-2 p-2"><button type="button" aria-pressed={liked} onClick={() => setLiked(!liked)} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold hover:bg-slate-50 ${focus} ${liked ? "text-rose-600" : "text-slate-500"}`}><Heart size={18} fill={liked ? "currentColor" : "none"} />Like</button><button type="button" aria-expanded={commenting} onClick={() => setCommenting(!commenting)} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-50 ${focus}`}><MessageCircle size={18} />Comment</button></div>
    {commenting && <div className="border-t border-slate-100 p-4"><form onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const value = String(new FormData(form).get("comment") ?? "").trim(); if (value) { setComments([...comments, value]); form.reset(); } }} className="flex gap-2"><input aria-label="Write a comment" name="comment" required maxLength={1000} placeholder="Keep the conversation going…" className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 text-sm outline-brand-600" /><button aria-label="Post comment" className={`grid size-11 place-items-center rounded-full bg-brand-600 text-white ${focus}`}><Send size={16} /></button></form>{comments.map((comment, i) => <p key={i} className="mt-3 rounded-xl bg-slate-50 p-3 text-sm break-words"><strong className="mr-2">You</strong>{comment}</p>)}</div>}
  </article>;
}

export function CommunityHome() {
  const [search, setSearch] = useState("");
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<{ url: string; name: string; video: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);

  return (
        <div className="mx-auto max-w-[680px] space-y-5">
          <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-slate-500"><Search size={18} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search feed posts" placeholder="Search this feed" className="min-w-0 flex-1 text-sm outline-none" /></label>
          <div className="flex items-end justify-between gap-3"><div><p className="mb-1 text-[10px] font-bold tracking-[.18em] text-brand-600 uppercase">Your people. Your possibilities.</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Good to see you here<span className="text-brand-600">.</span></h1></div><span className="mb-1 shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-500">Community preview</span></div>
          <section aria-label="Create a post" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"><form onSubmit={event => { event.preventDefault(); if (!draft.trim() && !attachment) return; setPosts([{ id: crypto.randomUUID(), name: "You", initials: "Y", role: "Local preview", time: new Date().toISOString(), text: draft.trim(), media: attachment?.url, video: attachment?.video }, ...posts]); setDraft(""); setAttachment(null); setNotice("Added to your preview feed. This post is only saved for this visit."); }}>
            <div className="flex items-start gap-3"><Avatar initials="Y" /><div className="flex-1"><label htmlFor="new-post" className="sr-only">What’s on your mind?</label><textarea id="new-post" maxLength={5000} value={draft} onChange={event => setDraft(event.target.value)} rows={2} placeholder="What's on your mind?" className="w-full resize-y rounded-xl bg-slate-50 p-3 text-sm leading-6 outline-brand-600 placeholder:text-slate-400" /></div></div>
            {attachment && <div className="relative mt-3 rounded-xl bg-slate-50 p-3">{attachment.video ? <video src={attachment.url} controls className="max-h-56 w-full" /> : <Image unoptimized src={attachment.url} alt={attachment.name} width={600} height={400} className="max-h-56 w-full object-contain" />}<button type="button" aria-label="Remove attachment" onClick={() => { URL.revokeObjectURL(attachment.url); setAttachment(null); }} className={`absolute top-2 right-2 rounded-full bg-white p-2 shadow ${focus}`}><X size={16} /></button></div>}
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => fileRef.current?.click()} className={`flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:text-sm ${focus}`}><ImagePlus size={21} className="text-emerald-500" />Photo/Video</button><span className="hidden text-[11px] text-slate-400 sm:block">Big ideas start with a hello.</span><button disabled={!draft.trim() && !attachment} className={`flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 ${focus}`}>Post <Send size={14} /></button></div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="hidden" aria-label="Attach photo or video" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (!["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"].includes(file.type) || file.size > 20 * 1024 * 1024) { setNotice("Choose a JPG, PNG, WebP, MP4 or WebM file under 20 MB."); return; } if (attachment) URL.revokeObjectURL(attachment.url); const url = URL.createObjectURL(file); urls.current.push(url); setAttachment({ url, name: file.name, video: file.type.startsWith("video/") }); setNotice("Media preview ready. Uploads will be available in a future update."); }} />
          </form><p className="mt-2 text-[10px] text-slate-400">Preview mode · Posts, likes and comments stay in this visit.</p>{notice && <p role="status" className="mt-2 text-xs leading-5 text-brand-700">{notice}</p>}</section>
          <div className="flex items-center gap-3"><h2 className="shrink-0 text-xs font-bold text-slate-500">Around your community</h2><div className="h-px flex-1 bg-slate-200" /><span className="text-[11px] text-slate-400">Latest posts</span></div>
          {posts.filter(post => `${post.name} ${post.text}`.toLowerCase().includes(search.trim().toLowerCase())).map(post => <PostCard key={post.id} post={post} />)}
          {search && !posts.some(post => `${post.name} ${post.text}`.toLowerCase().includes(search.trim().toLowerCase())) && <p role="status" className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">No matching posts. Try another name or topic.</p>}
          <p className="py-4 text-center text-xs text-slate-400">You’re all caught up. Make a new connection today.</p>
        </div>

  );
}
