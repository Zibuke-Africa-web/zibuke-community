"use server";
import { auth } from "@/auth";
import { recordActivity } from "@/lib/gamification";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { desc, gte } from "drizzle-orm";
import type { Champion } from "@/lib/community";

export async function trackActivityAction() {
  const userId = (await auth())?.user?.id;
  if (!userId) return { ok: false };
  try { await recordActivity(userId); return { ok: true }; } catch { return { ok: false }; }
}

export async function getLeaderboard(): Promise<Champion[]> {
  try {
    // Persisted counters avoid aggregating posts. Only recently active users qualify.
    return await (await getDb()).select({ id: users.id, name: users.name, image: users.image,
      points: users.points, currentStreak: users.currentStreak, badgeTitle: users.badgeTitle,
    }).from(users).where(gte(users.lastActiveAt, new Date(Date.now() - 30 * 86400000)))
      .orderBy(desc(users.points), desc(users.lastActiveAt), desc(users.id)).limit(5);
  } catch { return []; }
}
