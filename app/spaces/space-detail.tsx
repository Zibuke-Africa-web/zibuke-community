"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Pin } from "lucide-react";
import { createSpacePostAction, joinSpaceAction, leaveSpaceAction } from "@/actions/spaces";
import type { SpaceDetails, SpaceError, SpacePost } from "@/lib/space-types";
import { topicFor } from "./space-data";
import { SpaceIcon } from "./views";

const button = "inline-flex items-center justify-center rounded-full bg-[#ccff00] px-5 py-3 font-bold text-black transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current disabled:cursor-not-allowed";
const field = "mt-3 w-full rounded-xl border border-slate-200 bg-white p-4 text-black placeholder:text-black focus-visible:outline-2 focus-visible:outline-black";
const messages: Record<SpaceError, string> = {
  UNAUTHORIZED: "Sign in to join a space or publish a post.",
  NOT_FOUND: "This space is unavailable or you no longer have access.",
  FORBIDDEN: "This space is invitation only.",
  MEMBERSHIP_REQUIRED: "Join this space before posting or reading its members-only feed.",
  INVALID_INPUT: "This space could not be identified. Please refresh the page.",
  INVALID_CONTENT: "Write a post between 1 and 5,000 characters.",
  INVALID_MEDIA: "Use a valid HTTPS media link or an uploaded community image.",
  HOST_MEMBERSHIP: "Transfer your host or administrator role before leaving this space.",
  UNAVAILABLE: "We couldn’t save your change. Please try again. Your draft is still here.",
};

type DisplayPost = SpacePost & { pending?: boolean };

export function SpaceDetail({ space, posts, feedError, preview = false }: {
  space: SpaceDetails; posts: SpacePost[]; feedError?: SpaceError; preview?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [notice, setNotice] = useState<{ text: string; error?: SpaceError } | null>(null);
  const [joining, startJoining] = useTransition();
  const [posting, startPosting] = useTransition();
  const [membership, setOptimisticMembership] = useOptimistic(
    { joined: space.isMember, count: space.memberCount },
    (current, joined: boolean) => ({ joined, count: Math.max(0, current.count + Number(joined) - Number(current.joined)) }),
  );
  const [visiblePosts, addOptimisticPost] = useOptimistic<DisplayPost[], DisplayPost>(posts, (current, post) => [post, ...current]);
  const canRead = space.privacy === "public" || space.isMember;
  const topic = topicFor(space.slug);
  const signIn = `/login?callbackUrl=${encodeURIComponent(`/spaces/${space.slug}`)}`;

  function failure(error: SpaceError) { setNotice({ text: messages[error], error }); }

  function toggleMembership() {
    setNotice(null);
    startJoining(async () => {
      const next = !space.isMember;
      setOptimisticMembership(next);
      try {
        const result = await (next ? joinSpaceAction(space.id) : leaveSpaceAction(space.id));
        if (!result.success) { failure(result.error); return; }
        setNotice({ text: next ? "You joined this space." : "You left this space." });
        if (!next && space.privacy === "private") router.replace("/spaces");
        else router.refresh();
      } catch { failure("UNAVAILABLE"); }
    });
  }

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting || joining || !draft.trim() || preview) return;
    setNotice(null);
    const content = draft;
    startPosting(async () => {
      addOptimisticPost({ id: `pending-${crypto.randomUUID()}`, content: content.trim(), mediaUrl: null,
        createdAt: new Date().toISOString(), author: { id: "", name: "You", initials: "You", image: null }, pending: true });
      try {
        const result = await createSpacePostAction(space.id, content, mediaUrl.trim() || undefined);
        if (!result.success) { failure(result.error); return; }
        setDraft(""); setMediaUrl("");
        setNotice({ text: "Your post has been published." });
        router.refresh();
      } catch { failure("UNAVAILABLE"); }
    });
  }

  return <>
    <Link href="/spaces" className="mb-6 inline-flex text-sm font-bold hover:opacity-90">← All spaces</Link>
    <header className="overflow-hidden rounded-3xl border border-[#223824]">
      <div className="bg-[#0d140e] p-8 text-[#ccff00] md:p-12">
        <div className="flex items-center justify-between gap-4"><SpaceIcon icon={space.icon || "Users"} /><span className="rounded-full border border-current px-3 py-1 text-xs font-bold">{space.privacy === "members_only" ? "Members only" : space.privacy === "private" ? "Private" : "Public"}</span></div>
        <h1 className="mt-8 text-3xl font-black md:text-5xl">{space.name}</h1><p className="mt-4 max-w-2xl text-lg leading-relaxed">{space.description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-8 py-5 text-black">
        <p aria-live="polite" className="font-bold">{membership.count} members</p>
        <button onClick={toggleMembership} aria-pressed={membership.joined} aria-busy={joining} disabled={joining || posting || preview} className={button}>{membership.joined ? "Joined" : "Join Space"}{joining ? " · Saving…" : ""}</button>
      </div>
    </header>
    {notice && <div role={notice.error ? "alert" : "status"} className="mt-5 rounded-2xl border border-black bg-white p-4 text-black">{notice.text}{notice.error === "UNAUTHORIZED" && <Link className="ml-3 font-bold underline hover:opacity-90" href={signIn}>Sign in →</Link>}</div>}
    {preview && <p role="status" className="mt-5 rounded-2xl border border-black bg-white p-4 text-black">Starter space preview. Joining and publishing will be available when this space is connected.</p>}
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section aria-label="Space discussions" className="min-w-0 space-y-6">
        {canRead ? <>
          <article className="rounded-3xl border border-black bg-[#ccff00] p-7 text-black"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><Pin size={16} aria-hidden="true" /> Pinned discussion prompt</p><h2 className="mt-4 text-2xl font-bold">{topic.title}</h2><p className="mt-3 leading-relaxed">{topic.prompt}</p></article>
          <form onSubmit={publish} className="rounded-3xl border border-slate-200 bg-white p-6 text-black">
            <label htmlFor="space-post" className="block font-bold">Share something with this space...</label>
            <textarea id="space-post" value={draft} onChange={event => setDraft(event.target.value)} disabled={posting || preview} maxLength={5000} required rows={4} placeholder="What is on your mind?" className={`${field} resize-y`} />
            <label htmlFor="space-media" className="mt-4 block text-sm font-bold">Media link (optional)</label><input id="space-media" value={mediaUrl} onChange={event => setMediaUrl(event.target.value)} disabled={posting || preview} maxLength={2048} placeholder="https://… or /media/uploads/…" className={field} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{draft.length}/5,000 · {space.isMember ? "Share with this space" : "Membership required to publish"}</p><button type="submit" disabled={posting || joining || preview || !draft.trim()} className={button}>{posting ? "Publishing…" : "Publish post"}</button></div>
          </form>
          <section aria-label="Latest space posts" aria-busy={posting} className="space-y-4">
            <h2 className="text-xl font-bold">Latest discussions</h2>
            {feedError && <p role="alert" className="rounded-2xl border border-black bg-white p-4 text-black">The feed couldn’t load. <button onClick={() => router.refresh()} className="font-bold underline hover:opacity-90">Try again</button></p>}
            {!feedError && !visiblePosts.length && <p className="rounded-2xl border border-slate-200 bg-white p-7 text-black">No posts yet. Start the first conversation.</p>}
            {visiblePosts.map(post => <article key={post.id} className="rounded-3xl border border-slate-200 bg-white p-7 text-black">
              <div className="flex items-center gap-3"><span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-xs font-bold text-[#ccff00]">{post.author.image ? <Image unoptimized src={post.author.image} alt="" fill sizes="40px" className="object-cover" /> : post.author.initials}</span><div><p className="font-bold">{post.author.name}</p><p className="text-xs">{post.pending ? "Publishing…" : <time dateTime={post.createdAt}>{new Date(post.createdAt).toISOString().replace("T", " ").slice(0, 16)} UTC</time>}</p></div></div>
              <p className="mt-4 whitespace-pre-wrap break-words">{post.content}</p>
              {post.mediaUrl && <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex font-bold underline hover:opacity-90">Open attached media →</a>}
            </article>)}
            {posts.length === 50 && <p className="text-sm">Showing the latest 50 posts.</p>}
          </section>
        </> : <section className="rounded-3xl border border-slate-200 bg-white p-8 text-black"><h2 className="text-2xl font-bold">A conversation for members</h2><p className="mt-3">Join this space to read and share posts.</p></section>}
      </section>
      <aside className="rounded-3xl border border-slate-200 bg-white p-7 text-black"><h2 className="text-xl font-bold">Make yourself at home</h2><p className="mt-4 leading-relaxed">Share generously, be kind, and keep conversations connected to this space.</p><Link href="/feed" className="mt-6 inline-block font-bold hover:opacity-90">Back to community feed →</Link></aside>
    </div>
  </>;
}
