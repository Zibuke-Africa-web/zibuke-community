"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { groups, posts, users } from "@/db/schema";

export type ActionResult = {
  ok: boolean;
  error?: string;
  key?: string;
  simulated?: boolean;
};

const SIMULATED_DELAY_MS = 300;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export async function updateProfile(
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      ok: false,
      error: "Sign in before saving your profile.",
    };
  }

  const db = await getDb();

  await db
    .update(users)
    .set({
      bio: text(formData, "bio"),
      phone: text(formData, "phone"),
      location: text(formData, "location"),
      facebookUrl: text(formData, "facebookUrl"),
      instagramUrl: text(formData, "instagramUrl"),
      tiktokUrl: text(formData, "tiktokUrl"),
      website: text(formData, "website"),
      image: text(formData, "profilePictureUrl"),
      coverPhotoUrl: text(formData, "coverPhotoUrl"),
    })
    .where(eq(users.id, userId));

  revalidatePath("/profile/setup");
  revalidatePath("/directory");

  return { ok: true };
}

export async function joinGroup(groupId: string): Promise<void> {
  await wait(SIMULATED_DELAY_MS);

  const db = await getDb();
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, groupId));

  if (!group) {
    return;
  }

  revalidatePath("/groups");
}

export async function likePost(postId: string): Promise<void> {
  await wait(SIMULATED_DELAY_MS);

  const db = await getDb();
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId));

  if (!post) {
    return;
  }

  revalidatePath("/messages");
}

export async function uploadMedia(
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image to upload." };
  }

  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Only image files can be uploaded." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Images must be 5 MB or smaller." };
  }

  const extension = file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
  const key = `uploads/${crypto.randomUUID()}.${extension}`;

  const { env } = await getCloudflareContext({ async: true });
  await env.ZIBUKE_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  revalidatePath("/messages");
  revalidatePath("/profile/setup");

  return { ok: true, key };
}

export async function createGroup(
  formData: FormData,
): Promise<ActionResult> {
  const name = text(formData, "name");

  if (!name || name.length < 3) {
    return { ok: false, error: "Group name needs at least 3 characters." };
  }

  const db = await getDb();

  await db.insert(groups).values({
    name,
    description: text(formData, "description"),
    privacy: formData.get("privacy") === "private" ? "private" : "public",
    visibility: formData.get("visibility") === "hidden" ? "hidden" : "visible",
  });

  revalidatePath("/groups");

  return { ok: true };
}
