"use server";

import { and, asc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { events, eventRsvps, spaces } from "@/db/schema";
import { eventCategory, safeHttps } from "@/lib/community";

function entitled(userId: string) {
  return sql`(events.space_id is null or exists (select 1 from spaces s where s.id = events.space_id
    and (s.privacy = 'public' or exists (select 1 from space_members m where m.space_id=s.id and m.user_id=${userId}))
    and (s.is_paywalled=0 or exists (select 1 from subscriptions sub where sub.user_id=${userId} and sub.space_slug=s.slug
      and sub.status in ('active','canceled') and sub.current_period_end > unixepoch()))))`;
}

export async function rsvpEventAction(eventId: string) {
  const userId = (await auth())?.user?.id;
  if (!userId) return { ok: false, message: "Sign in to RSVP." };
  if (typeof eventId !== "string" || !eventId || eventId.length > 100) return { ok: false, message: "Invalid event." };
  try {
    const db = await getDb();
    const [event] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), gte(events.startTime, new Date()), entitled(userId))).limit(1);
    if (!event) return { ok: false, message: "This event has ended or requires space membership." };
    await db.run(sql`insert into event_rsvps (id,event_id,user_id)
      select ${crypto.randomUUID()}, id, ${userId} from events where id=${eventId} and start_time > unixepoch() and ${entitled(userId)}
      on conflict(event_id,user_id) do nothing`);
    revalidatePath("/events");
    return { ok: true, message: "You’re on the guest list." };
  } catch { return { ok: false, message: "RSVP could not be saved. Please try again." }; }
}

export async function cancelRsvpAction(eventId: string) {
  const userId = (await auth())?.user?.id;
  if (!userId) return { ok: false, message: "Sign in to manage your RSVP." };
  if (typeof eventId !== "string" || eventId.length > 100) return { ok: false, message: "Invalid event." };
  try {
    await (await getDb()).delete(eventRsvps).where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)));
    revalidatePath("/events"); return { ok: true, message: "Your RSVP has been canceled." };
  } catch { return { ok: false, message: "Could not cancel your RSVP. Please try again." }; }
}

export async function getUpcomingEvents(filter = "All Events") {
  const userId = (await auth())?.user?.id;
  if (!userId) return { ok: false as const, events: [] };
  try {
    const db = await getDb();
    const category = filter === "GreenSpace Sessions" ? eq(spaces.slug, "greenspace-hub")
      : filter === "Founder Teardowns" ? sql`${spaces.slug} in ('builders-lab','bulletproof-venture')`
      : filter === "General" ? sql`(${spaces.slug} is null or ${spaces.slug} not in ('greenspace-hub','builders-lab','bulletproof-venture'))` : undefined;
    const rows = await db.select({ id: events.id, title: events.title, description: events.description, hostName: events.hostName,
      startTime: events.startTime, isVirtual: events.isVirtual, coverImage: events.coverImage, spaceSlug: spaces.slug,
      canAttend: sql<boolean>`${entitled(userId)}`.mapWith(Boolean),
      meetUrl: sql<string | null>`case when ${entitled(userId)} then ${events.meetUrl} else null end`,
      rsvpCount: sql<number>`(select count(*) from event_rsvps r where r.event_id=events.id)`.mapWith(Number),
      isAttending: sql<boolean>`exists(select 1 from event_rsvps r where r.event_id=events.id and r.user_id=${userId})`.mapWith(Boolean),
    }).from(events).leftJoin(spaces, eq(events.spaceId, spaces.id)).where(and(
      gte(events.startTime, new Date()), category,
      sql`(${spaces.id} is null or ${spaces.privacy} <> 'private' or exists(select 1 from space_members m where m.space_id=${spaces.id} and m.user_id=${userId}))`,
    )).orderBy(asc(events.startTime), asc(events.id)).limit(60);
    return { ok: true as const, events: rows.map(row => ({ ...row, startTime: row.startTime.toISOString(), meetUrl: safeHttps(row.meetUrl), coverImage: safeHttps(row.coverImage), category: eventCategory(row.spaceSlug) })) };
  } catch { return { ok: false as const, events: [] }; }
}
