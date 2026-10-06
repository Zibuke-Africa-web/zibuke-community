import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { spaces, spaceMembers, subscriptions } from "@/db/schema";

// Do not cache: access is tied to the current user and the paid-through timestamp.
export async function getSpaceAccess(slug: string, userId?: string) {
  const db = await getDb();
  const [space] = await db.select().from(spaces).where(eq(spaces.slug, slug)).limit(1);
  if (!space) return { space: null, allowed: false };
  if (space.privacy === "private") {
    const [member] = userId ? await db.select({ id: spaceMembers.id }).from(spaceMembers).where(and(eq(spaceMembers.spaceId, space.id), eq(spaceMembers.userId, userId))).limit(1) : [];
    if (!member) return { space: null, allowed: false };
  }
  if (!space.isPaywalled) return { space, allowed: true };
  if (!userId) return { space, allowed: false };
  const [subscription] = await db.select({ id: subscriptions.id }).from(subscriptions).where(and(
    eq(subscriptions.userId, userId), eq(subscriptions.spaceSlug, slug),
    inArray(subscriptions.status, ["active", "canceled"]), gt(subscriptions.currentPeriodEnd, new Date()),
  )).limit(1);
  // Canceled means renewal stopped; paid access lasts to the paid-through date.
  return { space, allowed: !!subscription };
}
