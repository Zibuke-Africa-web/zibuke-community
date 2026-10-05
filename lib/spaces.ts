import "server-only";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { spaces } from "@/db/schema";
import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";

// Request-scoped reads: never cache membership across users.
export async function getVisibleSpaces(slug?: string) {
  const session = await auth();
  const userId = session?.user?.id;
  const db = await getDb();
  const membership = userId
    ? sql<boolean>`exists (select 1 from space_members sm where sm.space_id = spaces.id and sm.user_id = ${userId})`
    : sql<boolean>`0`;
  return db.select({
    id: spaces.id,
    slug: spaces.slug,
    name: spaces.name,
    tagline: spaces.tagline,
    description: spaces.description,
    icon: spaces.icon,
    privacy: spaces.privacy,
    isFeatured: spaces.isFeatured,
    isMember: membership.mapWith(Boolean),
    memberCount: sql<number>`(select count(*) from space_members sm where sm.space_id = spaces.id)`.mapWith(Number),
  }).from(spaces).where(and(
    or(ne(spaces.privacy, "private"), membership),
    slug === undefined ? undefined : eq(spaces.slug, slug),
  )).orderBy(desc(spaces.isFeatured), asc(spaces.name));
}

export type SpaceSummary = Awaited<ReturnType<typeof getVisibleSpaces>>[number];
