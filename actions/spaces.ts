"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { dailySparks, posts, spaceMembers, spaces, users } from "@/db/schema";
import { normalizeSpaceContent, safeSpaceMedia, validSpaceId } from "@/lib/space-post-input";
import type { CommunityFeed, SpaceDetails, SpacePost, SpaceResult } from "@/lib/space-types";
import { recordActivity } from "@/lib/gamification";

async function database() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB);
}

type SpaceDb = Awaited<ReturnType<typeof database>>;

function paidAccess(userId?: string) {
  return sql`(spaces.is_paywalled=0 or exists(select 1 from subscriptions sub where sub.user_id=${userId || ""}
    and sub.space_slug=spaces.slug and sub.status in ('active','canceled') and sub.current_period_end>unixepoch()))`;
}

function memberExists(userId: string | undefined) {
  // Literal qualified identifiers preserve correlation when Drizzle maps SELECT fields.
  return userId
    ? sql<boolean>`exists (select 1 from space_members sm where sm.space_id = spaces.id and sm.user_id = ${userId})`
    : sql<boolean>`0`;
}

async function lookup(db: SpaceDb, spaceId: string, userId?: string) {
  const [space] = await db.select({
    id: spaces.id, slug: spaces.slug, privacy: spaces.privacy,
    isMember: memberExists(userId).mapWith(Boolean),
    paidAccess: paidAccess(userId).mapWith(Boolean),
  }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  return space;
}

function refreshSpace(slug: string) {
  revalidatePath(`/spaces/${slug}`);
  revalidatePath("/spaces");
}

export async function joinSpaceAction(spaceId: string): Promise<SpaceResult<null>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    if (!validSpaceId(spaceId)) return { success: false, error: "INVALID_INPUT" };
    const db = await database();
    const space = await lookup(db, spaceId, session.user.id);
    if (!space || (space.privacy === "private" && !space.isMember)) return { success: false, error: "NOT_FOUND" };
    if (!space.isMember) {
      if (!space.paidAccess) return { success: false, error: "SUBSCRIPTION_REQUIRED" };
      // Recheck privacy at insertion time; the unique index handles concurrent joins.
      const inserted = await db.all<{ id: string }>(sql`insert into space_members (id, space_id, user_id, role)
        select ${crypto.randomUUID()}, ${spaces.id}, ${session.user.id}, 'member' from ${spaces}
        where ${spaces.id} = ${spaceId} and ${spaces.privacy} in ('public', 'members_only') and ${paidAccess(session.user.id)}
        on conflict (space_id, user_id) do nothing returning id`);
      if (!inserted.length && !(await lookup(db, spaceId, session.user.id))?.isMember) return { success: false, error: "FORBIDDEN" };
    }
    refreshSpace(space.slug);
    return { success: true, data: null };
  } catch { return { success: false, error: "UNAVAILABLE" }; }
}

export async function leaveSpaceAction(spaceId: string): Promise<SpaceResult<null>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    if (!validSpaceId(spaceId)) return { success: false, error: "INVALID_INPUT" };
    const db = await database();
    const space = await lookup(db, spaceId, session.user.id);
    if (!space || (space.privacy === "private" && !space.isMember)) return { success: false, error: "NOT_FOUND" };
    const [membership] = await db.select({ role: spaceMembers.role }).from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, session.user.id))).limit(1);
    if (membership && membership.role !== "member") return { success: false, error: "HOST_MEMBERSHIP" };
    const removed = await db.delete(spaceMembers).where(and(
      eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, session.user.id), eq(spaceMembers.role, "member"),
    )).returning({ id: spaceMembers.id });
    if (!removed.length && (await lookup(db, spaceId, session.user.id))?.isMember) return { success: false, error: "HOST_MEMBERSHIP" };
    refreshSpace(space.slug);
    return { success: true, data: null };
  } catch { return { success: false, error: "UNAVAILABLE" }; }
}

export async function createSpacePostAction(spaceId: string, content: string, mediaUrl?: string): Promise<SpaceResult<{ id: string }>> {
  return publishSpacePost(spaceId, content, mediaUrl);
}

async function publishSpacePost(spaceId: string, content: string, mediaUrl?: string, publicOnly = false): Promise<SpaceResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    if (!validSpaceId(spaceId)) return { success: false, error: "INVALID_INPUT" };
    const normalized = normalizeSpaceContent(content);
    if (!normalized) return { success: false, error: "INVALID_CONTENT" };
    const media = mediaUrl === undefined || mediaUrl === "" ? null : safeSpaceMedia(mediaUrl);
    if (mediaUrl !== undefined && mediaUrl !== "" && !media) return { success: false, error: "INVALID_MEDIA" };
    const db = await database();
    const space = await lookup(db, spaceId, session.user.id);
    if (!space || (space.privacy === "private" && !space.isMember)) return { success: false, error: "NOT_FOUND" };
    if (!space.isMember) return { success: false, error: "MEMBERSHIP_REQUIRED" };
    if (!space.paidAccess) return { success: false, error: "SUBSCRIPTION_REQUIRED" };
    const id = crypto.randomUUID();
    // INSERT SELECT makes membership validation atomic with publishing on D1.
    const inserted = await db.all<{ id: string }>(sql`insert into posts (id, user_id, space_id, content, media_url)
      select ${id}, ${session.user.id}, ${spaces.id}, ${normalized}, ${media} from ${spaces}
      where ${spaces.id} = ${spaceId} and ${memberExists(session.user.id)} and ${paidAccess(session.user.id)}
        and (${publicOnly ? 0 : 1} or (${spaces.privacy}='public' and ${spaces.isPaywalled}=0)) returning id`);
    if (!inserted.length) return { success: false, error: "MEMBERSHIP_REQUIRED" };
    await recordActivity(session.user.id).catch(() => {});
    refreshSpace(space.slug);
    revalidatePath("/");
    revalidatePath("/feed");
    return { success: true, data: { id } };
  } catch { return { success: false, error: "UNAVAILABLE" }; }
}

// Main-feed authors choose content, never a user ID or destination space.
export async function createPost(content: string, mediaUrl?: string): Promise<SpaceResult<{ id: string }>> {
  try {
    if (!(await auth())?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    if (!normalizeSpaceContent(content)) return { success: false, error: "INVALID_CONTENT" };
    if (mediaUrl !== undefined && mediaUrl !== "" && !safeSpaceMedia(mediaUrl)) return { success: false, error: "INVALID_MEDIA" };
    const db = await database();
    const [general] = await db.select({ id: spaces.id }).from(spaces).where(and(
      eq(spaces.slug, "welcome"), eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false),
    )).limit(1);
    if (!general) return { success: false, error: "UNAVAILABLE" };
    const joined = await joinSpaceAction(general.id);
    if (!joined.success) return joined;
    return publishSpacePost(general.id, content, mediaUrl, true);
  } catch { return { success: false, error: "UNAVAILABLE" }; }
}

export async function getCommunityFeed(page = 1): Promise<SpaceResult<CommunityFeed>> {
  try {
    if (!(await auth())?.user?.id) return { success: false, error: "UNAUTHORIZED" };
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return { success: false, error: "INVALID_INPUT" };
    const db = await database();
    const rows = await db.select({
      id: posts.id, content: posts.content, mediaUrl: posts.mediaUrl, createdAt: posts.createdAt,
      authorId: users.id, authorName: users.name,
      authorImage: sql<string | null>`coalesce(${users.profilePhotoUrl}, ${users.image}, ${users.avatarUrl})`,
      spaceSlug: spaces.slug, spaceName: spaces.name, sparkId: dailySparks.id,
    }).from(posts).innerJoin(users, eq(posts.userId, users.id))
      .leftJoin(spaces, eq(posts.spaceId, spaces.id))
      .leftJoin(dailySparks, eq(dailySparks.id, posts.id))
      // Never promote orphaned user/group posts or paid content into the public feed.
      .where(and(isNull(posts.groupId), or(
        and(eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false)),
        and(isNull(posts.spaceId), eq(posts.userId, "system-zibuke-community")),
      )))
      .orderBy(desc(posts.createdAt), desc(posts.id)).limit(31).offset((page - 1) * 30);
    return { success: true, data: { page, hasMore: rows.length > 30, posts: rows.slice(0, 30).map(row => {
      const name = row.authorName?.trim() || "Community member";
      return {
        id: row.id, content: row.content, mediaUrl: safeSpaceMedia(row.mediaUrl), createdAt: row.createdAt.toISOString(),
        author: { id: row.authorId, name, initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(), image: safeSpaceMedia(row.authorImage) },
        space: row.spaceSlug && row.spaceName ? { slug: row.spaceSlug, name: row.spaceName } : null,
        isDailySpark: row.sparkId !== null && row.authorId === "system-zibuke-community",
      };
    }) } };
  } catch { return { success: false, error: "UNAVAILABLE" }; }
}

export async function getSpaceDetails(slug: string): Promise<SpaceResult<SpaceDetails>> {
  if (typeof slug !== "string" || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { success: false, error: "NOT_FOUND" };
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const db = await database();
    const membership = memberExists(userId);
    const [space] = await db.select({
      id: spaces.id, slug: spaces.slug, name: spaces.name, tagline: spaces.tagline,
      description: spaces.description, icon: spaces.icon, privacy: spaces.privacy,
      memberCount: sql<number>`(select count(*) from space_members sm where sm.space_id = spaces.id)`.mapWith(Number),
      isMember: membership.mapWith(Boolean),
      role: userId ? sql<string | null>`(select sm.role from space_members sm where sm.space_id = spaces.id and sm.user_id = ${userId} limit 1)` : sql<null>`null`,
    }).from(spaces).where(and(eq(spaces.slug, slug), or(sql`${spaces.privacy} <> 'private'`, membership))).limit(1);
    return space ? { success: true, data: space } : { success: false, error: "NOT_FOUND" };
  } catch { return { success: false, error: "UNAVAILABLE" }; }
}

export async function getSpacePosts(spaceId: string): Promise<SpaceResult<SpacePost[]>> {
  if (!validSpaceId(spaceId)) return { success: false, error: "INVALID_INPUT" };
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const db = await database();
    const space = await lookup(db, spaceId, userId);
    if (!space || (space.privacy === "private" && !space.isMember)) return { success: false, error: "NOT_FOUND" };
    if (space.privacy !== "public" && !space.isMember) return { success: false, error: userId ? "MEMBERSHIP_REQUIRED" : "UNAUTHORIZED" };
    if (!space.paidAccess) return { success: false, error: "SUBSCRIPTION_REQUIRED" };
    const rows = await db.select({
      id: posts.id, content: posts.content, mediaUrl: posts.mediaUrl, createdAt: posts.createdAt,
      authorId: users.id, authorName: users.name,
      authorImage: sql<string | null>`coalesce(${users.profilePhotoUrl}, ${users.image}, ${users.avatarUrl})`,
    }).from(posts).innerJoin(users, eq(posts.userId, users.id)).innerJoin(spaces, eq(posts.spaceId, spaces.id))
      .where(and(eq(posts.spaceId, spaceId), paidAccess(userId), or(eq(spaces.privacy, "public"), memberExists(userId))))
      .orderBy(desc(posts.createdAt), desc(posts.id)).limit(50);
    return { success: true, data: rows.map(row => {
      const name = row.authorName?.trim() || "Community member";
      return { id: row.id, content: row.content, mediaUrl: safeSpaceMedia(row.mediaUrl), createdAt: row.createdAt.toISOString(),
        author: { id: row.authorId, name, initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(), image: safeSpaceMedia(row.authorImage) } };
    }) };
  } catch { return { success: false, error: "UNAVAILABLE" }; }
}
