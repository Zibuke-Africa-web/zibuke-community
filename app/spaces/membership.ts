"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { spaceMembers, spaces } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function setMembership(slug: string, joined: boolean): Promise<{ error?: string }> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100 || typeof joined !== "boolean") return { error: "Invalid space." };
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/spaces/${slug}`)}`);
  try {
    const db = await getDb();
    const [space] = await db.select().from(spaces).where(eq(spaces.slug, slug)).limit(1);
    if (!space || space.privacy === "private") return { error: "Membership in this space is managed by invitation." };
    if (joined) {
      await db.run(sql`insert into space_members (id, space_id, user_id)
        select ${crypto.randomUUID()}, ${spaces.id}, ${session.user.id} from ${spaces}
        where ${spaces.id} = ${space.id} and ${spaces.privacy} in ('public', 'members_only')
        on conflict (space_id, user_id) do nothing`);
    } else {
      // Host/admin memberships must be managed by an administrator.
      const removed = await db.delete(spaceMembers).where(and(eq(spaceMembers.spaceId, space.id), eq(spaceMembers.userId, session.user.id), eq(spaceMembers.role, "member"))).returning({ id: spaceMembers.id });
      if (!removed.length) return { error: "Your membership could not be changed. Refresh the page or contact the space host." };
    }
  } catch { return { error: "Membership couldn’t be saved. Please try again." }; }
  revalidatePath("/spaces");
  revalidatePath(`/spaces/${slug}`);
  return {};
}
