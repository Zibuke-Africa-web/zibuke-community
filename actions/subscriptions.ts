"use server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function cancelSubscriptionAction(id: string) {
  const userId = (await auth())?.user?.id;
  if (!userId || typeof id !== "string" || id.length > 100) return { ok: false, message: "Sign in to manage your membership." };
  try {
    const rows = await (await getDb()).update(subscriptions).set({ status: "canceled" }).where(and(
      eq(subscriptions.id, id), eq(subscriptions.userId, userId), eq(subscriptions.gateway, "peach_payments"), eq(subscriptions.status, "active"),
    )).returning({ slug: subscriptions.spaceSlug });
    for (const row of rows) revalidatePath(`/spaces/${row.slug}`);
    return { ok: true, message: "Future renewals are canceled. Paid access remains until the end of your current period. A payment already processing may still complete." };
  } catch { return { ok: false, message: "Could not cancel. Please try again or contact support." }; }
}
