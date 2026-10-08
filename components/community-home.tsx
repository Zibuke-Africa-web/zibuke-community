"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Search, Send, X } from "lucide-react";
import { createPost } from "@/actions/spaces";
import { uploadMedia } from "@/app/actions";
import type { CommunityFeed, CommunityPost } from "@/lib/space-types";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black";
const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-black px-4 text-sm font-semibold text-black hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60 ${focus}`;

function relativeTime(value: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return formatter.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return formatter.format(-Math.floor(seconds / 3600), "hour");
  return formatter.format(-Math.floor(seconds / 86400), "day");
}

function PostCard({ post, now }: { post: CommunityPost; now: number }) {
  const video = post.mediaUrl && /\.(mp4|webm)$/i.test(new URL(post.mediaUrl, "https://community.local").pathname);
  return <article className="overflow-hidden rounded-2xl border border-slate-300 bg-white p-5 text-black">
    <header className="flex items-center gap-3">
      <Link href={`/profile/${encodeURIComponent(post.author.id)}`} aria-label={`View ${post.author.name}'s profile`} className={`relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-black bg-[#ccff00] font-bold ${focus}`}>
        {post.author.image ? <Image unoptimized src={post.author.image} alt="" fill sizes="44px" className="object-cover" /> : post.author.initials}
      </Link>
      <div className="min-w-0">
        <h3 className="font-bold break-words"><Link href={`/profile/${encodeURIComponent(post.author.id)}`} className={focus}>{post.author.name}</Link></h3>
        <time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} className="text-xs text-slate-700">{relativeTime(post.createdAt, now)}</time>
      </div>
    </header>
    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
      {post.isDailySpark ? <span className="rounded-full border border-black px-3 py-1">#DailySpark · AI-generated</span>
        : post.space ? <Link href={`/spaces/${post.space.slug}`} className={`rounded-full border border-black px-3 py-1 hover:bg-slate-100 ${focus}`}>#{post.space.slug === "welcome" ? "General" : post.space.name}</Link>
        : <span className="rounded-full border border-black px-3 py-1">#Community</span>}
    </div>
    <p className="mt-4 text-sm leading-7 whitespace-pre-wrap break-words">{post.content}</p>
    {post.mediaUrl && <div className="mt-4 overflow-hidden rounded-xl border border-slate-300">
      {video ? <video controls preload="metadata" src={post.mediaUrl} aria-label={`Video shared by ${post.author.name}`} className="max-h-96 w-full bg-black">Your browser cannot play this video. <a href={post.mediaUrl}>Open attachment</a></video>
        : <Image unoptimized src={post.mediaUrl} alt={`Image shared by ${post.author.name}`} width={900} height={600} className="max-h-96 w-full bg-white object-contain" />}
    </div>}
  </article>;
}

export function CommunityHome({ feed, now }: { feed: CommunityFeed; now: number }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const visible = feed.posts.filter(post => `${post.author.name} ${post.content} ${post.space?.name || ""} ${post.isDailySpark ? "DailySpark" : ""}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting || uploading || !draft.trim()) return;
    setPosting(true); setError(""); setNotice("");
    try {
      const result = await createPost(draft, mediaUrl.trim() || undefined);
      if (!result.success) {
        setError(result.error === "INVALID_MEDIA" ? "Use an HTTPS media URL or upload a photo." : result.error === "INVALID_CONTENT" ? "Write a post of 1–5,000 characters." : result.error === "UNAUTHORIZED" ? "Sign in again before posting." : "Your post could not be saved. Please try again.");
        return;
      }
      setDraft(""); setMediaUrl(""); setSearch(""); setNotice("Posted to General.");
      if (feed.page !== 1) router.push("/feed");
      // The action revalidates the server feed; posts are never held in client state.
    } catch { setError("Your post could not be saved. Please try again."); }
    finally { setPosting(false); }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(""); setNotice("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024 - 20480) {
      setError("Choose a JPEG, PNG or WebP image under 5 MB."); return;
    }
    setUploading(true);
    try {
      const form = new FormData(); form.set("file", file);
      const result = await uploadMedia(form);
      if (!result.ok || !result.url) { setError(result.error || "The image could not be uploaded."); return; }
      setMediaUrl(result.url); setNotice("Photo uploaded. Publish your post to share it.");
    } catch { setError("The image could not be uploaded. Please try again."); }
    finally { setUploading(false); }
  }

  return <div className="mx-auto max-w-[680px] space-y-5 text-black">
    <header><h1 className="text-2xl font-bold sm:text-3xl">Your community</h1><p className="mt-2 text-sm leading-6">Public conversations, community updates and Daily Sparks.</p></header>
    <section aria-label="Create a post" className="rounded-2xl border border-slate-300 bg-white p-5">
      <form onSubmit={publish} aria-busy={posting || uploading}>
        <label htmlFor="new-post" className="font-semibold">Share with General</label>
        <p id="post-audience" className="mt-1 text-sm leading-6">Your post will be public in General / Welcome. Posting joins you to this space.</p>
        <textarea id="new-post" aria-describedby="post-audience" required maxLength={5000} disabled={posting || uploading} value={draft} onChange={event => setDraft(event.target.value)} rows={3} placeholder="What's on your mind?" className={`mt-3 w-full resize-y rounded-xl border border-slate-400 bg-white p-3 text-sm text-black placeholder:text-slate-700 ${focus}`} />
        <label htmlFor="post-media" className="mt-3 block text-sm font-semibold">Image or video URL (optional)</label>
        <input id="post-media" maxLength={2048} disabled={posting || uploading} value={mediaUrl} onChange={event => setMediaUrl(event.target.value)} placeholder="https://…" className={`mt-2 w-full rounded-xl border border-slate-400 bg-white p-3 text-sm text-black placeholder:text-slate-700 ${focus}`} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={posting || uploading} onClick={() => fileInput.current?.click()} className={button}><ImagePlus size={18} aria-hidden="true" />{uploading ? "Uploading…" : "Upload photo"}</button>
          {mediaUrl && <button type="button" disabled={posting || uploading} onClick={() => setMediaUrl("")} className={button}><X size={16} aria-hidden="true" />Remove attachment</button>}
          <button type="submit" disabled={posting || uploading || !draft.trim()} className={`${button} bg-[#ccff00] hover:bg-[#ccff00]`}><Send size={17} aria-hidden="true" />{posting ? "Posting…" : "Post"}</button>
        </div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload a photo" disabled={posting || uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
      </form>
      {error && <p role="alert" className="mt-3 text-sm font-semibold">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    </section>
    <label className="flex items-center gap-3 rounded-xl border border-slate-400 bg-white px-4 py-3"><Search size={18} aria-hidden="true" /><span className="sr-only">Search this page of posts</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this page of posts" className={`min-w-0 flex-1 text-sm text-black placeholder:text-slate-700 ${focus}`} /></label>
    <section aria-labelledby="feed-heading" className="space-y-4">
      <h2 id="feed-heading" className="text-lg font-bold">Latest conversations</h2>
      {visible.map(post => <PostCard key={post.id} post={post} now={now} />)}
      {!visible.length && <div role="status" className="space-y-3 rounded-2xl border border-slate-300 bg-white p-6 text-sm"><h3 className="text-lg font-bold">{search ? "No matching posts on this page" : feed.page > 1 ? "You’re all caught up" : "Be the first to say hello"}</h3><p>{search ? "Try another phrase or clear your search." : feed.page > 1 ? "Return to the latest conversations." : "Introduce yourself, share an idea, or ask a question. Your first post could start a great conversation in General."}</p>{search ? <button className={button} onClick={() => setSearch("")}>Clear search</button> : feed.page > 1 ? <Link href="/feed" className={button}>Latest conversations</Link> : <a href="#new-post" className={button}>Start a conversation</a>}</div>}
    </section>
    {(feed.page > 1 || feed.hasMore) && <nav aria-label="Feed pages" className="flex justify-between gap-3">
      {feed.page > 1 ? <Link href={`/feed?page=${feed.page - 1}`} className={button}>Newer posts</Link> : <span />}
      {feed.hasMore && <Link href={`/feed?page=${feed.page + 1}`} className={button}>Older posts</Link>}
    </nav>}
  </div>;
}
