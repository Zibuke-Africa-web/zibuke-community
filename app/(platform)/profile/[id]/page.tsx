import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { BriefcaseBusiness, Globe2, Link2, MapPin, MessageCircle, UsersRound } from "lucide-react";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { connections, groups, posts, users } from "@/db/schema";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { FriendButton } from "@/components/friend-button";
import { safeWebUrl } from "@/lib/profile-input";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member profile · Zibuke Community" };

function imageUrl(value: string | null) {
  return value?.startsWith("/media/") ? value : safeWebUrl(value);
}

function Avatar({ name, photo, large = false }: { name: string; photo: string | null; large?: boolean }) {
  const initials = name.split(/\s+/).slice(0, 2).map(word => word[0]).join("");
  return <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 font-bold text-brand-700 ${large ? "size-32 border-[5px] border-white text-4xl shadow-sm sm:size-40" : "size-11 text-sm"}`}>
    {imageUrl(photo) ? <Image unoptimized src={imageUrl(photo)!} alt={`${name}'s profile picture`} fill sizes={large ? "160px" : "44px"} className="object-cover" /> : <span aria-label={name}>{initials || "Z"}</span>}
  </span>;
}

export default async function ProfilePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page ?? "1", 10) || 1));
  const db = await getDb();
  const [profile] = await db.select({
    id: users.id, name: users.name, bio: users.bio, employmentStatus: users.employmentStatus,
    websiteUrl: users.websiteUrl, website: users.website, socialLinks: users.socialLinks,
    facebookUrl: users.facebookUrl, instagramUrl: users.instagramUrl, tiktokUrl: users.tiktokUrl,
    profilePhotoUrl: users.profilePhotoUrl, image: users.image, avatarUrl: users.avatarUrl,
    coverPhotoUrl: users.coverPhotoUrl, location: users.location,
  }).from(users).where(eq(users.id, id)).limit(1);
  if (!profile) notFound();
  const session = await auth();
  const viewerId = session?.user?.id;
  const isOwner = viewerId === profile.id;
  const name = profile.name || "Community member";
  const photo = profile.profilePhotoUrl || profile.image || profile.avatarUrl;
  const accepted = and(eq(connections.status, "accepted"), or(eq(connections.requesterId, id), eq(connections.addresseeId, id)));
  const [friends, [friendCount], userPosts, relationship] = await Promise.all([
    db.select({ id: users.id, name: users.name, photo: sql<string | null>`coalesce(${users.profilePhotoUrl}, ${users.image}, ${users.avatarUrl})` })
      .from(connections).innerJoin(users, eq(users.id, sql`case when ${connections.requesterId} = ${id} then ${connections.addresseeId} else ${connections.requesterId} end`))
      .where(accepted).orderBy(users.name).limit(9),
    db.select({ total: count() }).from(connections).where(accepted),
    db.select({ id: posts.id, content: posts.content, mediaUrl: posts.mediaUrl, createdAt: posts.createdAt })
      .from(posts).leftJoin(groups, eq(groups.id, posts.groupId))
      .where(and(isNull(posts.spaceId), eq(posts.userId, id), or(isNull(posts.groupId), and(eq(groups.privacy, "public"), eq(groups.visibility, "visible")))))
      .orderBy(desc(posts.createdAt), desc(posts.id)).limit(11).offset((page - 1) * 10),
    viewerId && !isOwner ? db.select().from(connections).where(or(
      and(eq(connections.requesterId, viewerId), eq(connections.addresseeId, id)),
      and(eq(connections.requesterId, id), eq(connections.addresseeId, viewerId)),
    )).limit(1) : Promise.resolve([]),
  ]);
  const existing = relationship[0];
  const friendStatus = existing?.status === "pending" && existing.addresseeId === viewerId ? "incoming" : existing?.status ?? "none";
  const socialLinks: Record<string, string> = { ...profile.socialLinks };
  for (const [platform, value] of [["facebook", profile.facebookUrl], ["instagram", profile.instagramUrl], ["tiktok", profile.tiktokUrl]]) {
    if (platform && value && !socialLinks[platform]) socialLinks[platform] = value;
  }
  const website = profile.websiteUrl ?? profile.website;
  const card = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm";

  return <div className="@container/profile min-w-0 text-slate-800">
      <section aria-label={`${name}'s profile`} className="overflow-hidden bg-white shadow-sm sm:rounded-b-2xl">
        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-brand-200 via-blue-100 to-emerald-100 sm:h-72 lg:h-80">
          {imageUrl(profile.coverPhotoUrl) ? <Image unoptimized src={imageUrl(profile.coverPhotoUrl)!} alt={`${name}'s cover photo`} fill sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" /> : <div aria-hidden="true" className="absolute -top-24 right-6 size-96 rounded-full border-[60px] border-white/30" />}
          {!profile.coverPhotoUrl && <span className="absolute right-6 bottom-6 text-xs font-semibold tracking-[.18em] text-brand-800/50 uppercase">Rooted in community</span>}
        </div>
        <div className="relative px-5 pb-6 sm:px-8"><div className="flex flex-col gap-4 @xl/profile:flex-row @xl/profile:items-end @xl/profile:justify-between">
          <div className="flex flex-col gap-3 @xl/profile:flex-row @xl/profile:items-end sm:gap-5"><div className="-mt-16"><Avatar name={name} photo={photo} large /></div><div className="pb-2"><h1 className="text-3xl font-extrabold tracking-tight">{name}</h1><a href="#friends" className="mt-2 inline-block text-sm font-medium text-slate-500">{friendCount.total} {friendCount.total === 1 ? "friend" : "friends"}</a></div></div>
          <div className="pb-2">{isOwner ? <EditProfileModal bio={profile.bio} websiteUrl={website} socialLinks={socialLinks} /> : viewerId ? <FriendButton targetId={id} status={friendStatus} /> : <Link href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/profile/${id}`)}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white"><UsersRound size={17} />Add Friend</Link>}</div>
        </div><nav aria-label="Profile sections" className="mt-5 flex gap-6 border-t border-slate-100 pt-4 text-sm font-semibold"><a href="#posts" className="text-brand-600">Posts</a><a href="#intro" className="text-slate-500">About</a><a href="#friends" className="text-slate-500">Friends</a></nav></div>
      </section>
      <div className="mt-6 grid items-start gap-5 @3xl/profile:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section id="intro" className={card}><h2 className="text-xl font-bold">Intro</h2><p className="mt-4 text-sm leading-7 whitespace-pre-wrap break-words text-slate-600">{profile.bio || "A little more about this person is coming soon."}</p><ul className="mt-5 space-y-4 text-sm text-slate-600">
            <li className="flex gap-3"><BriefcaseBusiness size={18} className="mt-0.5 shrink-0 text-slate-400" /><span>{profile.employmentStatus || "Employment status not shared"}</span></li>
            {profile.location && <li className="flex gap-3"><MapPin size={18} className="shrink-0 text-slate-400" />{profile.location}</li>}
            {safeWebUrl(website) && <li className="flex gap-3"><Globe2 size={18} className="mt-0.5 shrink-0 text-slate-400" /><a href={safeWebUrl(website)!} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand-700 hover:underline">{website}</a></li>}
            {Object.entries(socialLinks).filter(([, url]) => typeof url === "string" && safeWebUrl(url)).map(([platform, url]) => <li key={platform} className="flex gap-3"><Link2 size={18} className="mt-0.5 shrink-0 text-slate-400" /><a href={safeWebUrl(url)!} target="_blank" rel="noopener noreferrer nofollow" className="break-words text-brand-700 capitalize hover:underline">{platform}</a></li>)}
          </ul></section>
          <section id="friends" className={card}><h2 className="text-xl font-bold">Friends</h2><p className="mt-1 text-sm text-slate-500">{friendCount.total} connections</p>{friends.length ? <ul className="mt-5 grid grid-cols-3 gap-x-3 gap-y-5">{friends.map(friend => <li key={friend.id}><Link href={`/profile/${encodeURIComponent(friend.id)}`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600"><div className="relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-brand-50 text-xl font-bold text-brand-700">{imageUrl(friend.photo) ? <Image unoptimized src={imageUrl(friend.photo)!} alt={friend.name || "Community member"} fill sizes="100px" className="object-cover" /> : (friend.name || "Z").split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</div><p className="mt-2 text-xs font-semibold break-words">{friend.name || "Community member"}</p></Link></li>)}</ul> : <p className="mt-4 text-sm leading-6 text-slate-500">New connections start with a hello. No friends to show yet.</p>}{friendCount.total > 9 && <p className="mt-4 text-xs text-slate-400">Showing 9 of {friendCount.total} friends</p>}</section>
        </aside>
        <section id="posts" aria-labelledby="posts-heading" className="min-w-0 space-y-5"><div className={card}><h2 id="posts-heading" className="text-xl font-bold">Posts</h2><p className="mt-1 text-sm text-slate-500">Updates shared by {name}</p></div>
          {userPosts.slice(0, 10).map(post => <article key={post.id} className={card}><header className="flex items-center gap-3"><Avatar name={name} photo={photo} /><div><h3 className="text-sm font-bold">{name}</h3><time dateTime={post.createdAt.toISOString()} className="mt-1 block text-xs text-slate-500">{post.createdAt.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" })}</time></div></header><p className="mt-4 text-sm leading-7 whitespace-pre-wrap break-words text-slate-700">{post.content}</p>{imageUrl(post.mediaUrl) && <Image unoptimized src={imageUrl(post.mediaUrl)!} width={900} height={600} alt={`Photo shared by ${name}`} className="mt-4 max-h-[600px] w-full rounded-xl bg-slate-50 object-contain" />}</article>)}
          {!userPosts.length && <div className={`${card} py-12 text-center`}><MessageCircle className="mx-auto text-brand-400" size={32} /><h3 className="mt-4 font-bold">{page > 1 ? "No more posts" : "No posts yet"}</h3><p className="mt-2 text-sm text-slate-500">{page > 1 ? "Go back to see earlier updates." : "Public updates from this person will appear here."}</p></div>}
          {(page > 1 || userPosts.length > 10) && <nav aria-label="Post pagination" className="flex justify-between text-sm font-semibold text-brand-700">{page > 1 ? <Link href={`/profile/${encodeURIComponent(id)}?page=${page - 1}#posts`}>← Newer posts</Link> : <span />}{userPosts.length > 10 && <Link href={`/profile/${encodeURIComponent(id)}?page=${page + 1}#posts`}>Older posts →</Link>}</nav>}
        </section>
      </div>
  </div>;
}
