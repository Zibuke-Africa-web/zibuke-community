"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { connections, users } from "@/db/schema";
import { parseProfileInput } from "@/lib/profile-input";

export type ProfileActionState = { ok: boolean; message: string };

export async function saveProfile(_previous: ProfileActionState, form: FormData): Promise<ProfileActionState> {
  const session = await auth();
  // Never accept the owner ID from form fields or client props.
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "Sign in before editing your profile." };
  let input: ReturnType<typeof parseProfileInput>;
  try { input = parseProfileInput(form); } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Check your profile details." };
  }
  try {
    const db = await getDb();
    const updated = await db.update(users).set({
      ...input,
      // Keep the older profile setup fields in sync.
      website: input.websiteUrl,
      facebookUrl: input.socialLinks.facebook ?? null,
      instagramUrl: input.socialLinks.instagram ?? null,
      tiktokUrl: input.socialLinks.tiktok ?? null,
    }).where(eq(users.id, userId)).returning({ id: users.id });
    if (!updated.length) return { ok: false, message: "Your profile could not be found." };
  } catch {
    return { ok: false, message: "Your profile could not be saved. Please try again." };
  }
  revalidatePath(`/profile/${userId}`);
  revalidatePath("/directory");
  revalidatePath("/profile/setup");
  return { ok: true, message: "Your profile has been updated." };
}

export async function requestFriend(targetId: string): Promise<ProfileActionState> {
  const userId = (await auth())?.user?.id;
  if (!userId) return { ok: false, message: "Sign in to connect with this person." };
  if (userId === targetId) return { ok: false, message: "You cannot send a request to yourself." };
  try {
    const db = await getDb();
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return { ok: false, message: "This profile is unavailable." };
    const [existing] = await db.select().from(connections).where(or(
      and(eq(connections.requesterId, userId), eq(connections.addresseeId, targetId)),
      and(eq(connections.requesterId, targetId), eq(connections.addresseeId, userId)),
    )).limit(1);
    if (existing?.status === "blocked") return { ok: false, message: "This connection is unavailable." };
    if (existing?.status === "pending" && existing.addresseeId === userId) {
      await db.update(connections).set({ status: "accepted" }).where(and(
        eq(connections.requesterId, targetId), eq(connections.addresseeId, userId), eq(connections.status, "pending"),
      ));
    } else if (!existing) {
      await db.insert(connections).values({ requesterId: userId, addresseeId: targetId }).onConflictDoNothing();
    }
  } catch {
    return { ok: false, message: "Your request could not be saved. Please try again." };
  }
  revalidatePath(`/profile/${targetId}`);
  revalidatePath(`/profile/${userId}`);
  return { ok: true, message: "Connection updated." };
}
