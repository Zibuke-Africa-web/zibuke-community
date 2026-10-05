"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { spaceMembers, spaces } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

export async function joinSpace(formData: FormData) {
  const slug = formData.get("slug");
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    notFound();
  }
  const path = `/spaces/${slug}`;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(path)}`);
  const db = await getDb();
  const [space] = await db.select({ id: spaces.id, privacy: spaces.privacy }).from(spaces).where(eq(spaces.slug, slug)).limit(1);
  if (!space || space.privacy === "private") notFound();

  // Atomic privacy check and conflict handling: concurrent joins cannot inflate counts.
  await db.run(sql`insert into space_members (id, space_id, user_id)
    select ${crypto.randomUUID()}, ${spaces.id}, ${session.user.id} from ${spaces}
    where ${spaces.id} = ${space.id} and ${spaces.privacy} in ('public', 'members_only')
    on conflict (space_id, user_id) do nothing`);
  revalidatePath("/spaces");
  revalidatePath(path);
  redirect(path);
}
