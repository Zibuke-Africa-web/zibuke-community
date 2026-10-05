import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { asc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { spaces, spaceMembers } from "@/db/schema";
import { defaultSpaces, type Space } from "./space-data";

export async function loadSpaces(): Promise<{ spaces: Space[]; preview: boolean }> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = drizzle(env.DB);
    const rows = await db.select({
      id: spaces.id, slug: spaces.slug, name: spaces.name, tagline: spaces.tagline,
      description: spaces.description, icon: spaces.icon, privacy: spaces.privacy,
      isFeatured: spaces.isFeatured,
      members: sql<number>`(select count(*) from ${spaceMembers} where ${spaceMembers.spaceId} = ${spaces.id})`.mapWith(Number),
    }).from(spaces).orderBy(asc(spaces.name));
    if (!rows.length) return { spaces: defaultSpaces, preview: true };
    // Auth failures are treated as anonymous, never as permission to read private data.
    const session = await auth().catch(() => null);
    const memberships = session?.user?.id
      ? await db.select({ spaceId: spaceMembers.spaceId }).from(spaceMembers).where(eq(spaceMembers.userId, session.user.id)) : [];
    const joinedIds = new Set(memberships.map(row => row.spaceId));
    return { preview: false, spaces: rows.filter(row => row.privacy !== "private" || joinedIds.has(row.id)).map(row => ({
      id: row.id, slug: row.slug, name: row.name,
      tag: defaultSpaces.find(seed => seed.slug === row.slug)?.tag ?? row.tagline ?? "Community Space",
      description: row.description ?? "A space to connect and share with your community.",
      icon: row.icon ?? "Users", privacy: row.privacy, members: row.members,
      featured: row.slug === "home-and-garden" || Boolean(row.isFeatured), joined: joinedIds.has(row.id),
    })) };
  } catch {
    // Only public, authored preview data is returned when D1 is unavailable.
    return { spaces: defaultSpaces, preview: true };
  }
}
