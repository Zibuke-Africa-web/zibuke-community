import Link from "next/link";
import { and, eq, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { connections, users } from "@/db/schema";

export const metadata = { title: "Friends · Zibuke Community" };
export default async function FriendsPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) return <section className="rounded-2xl bg-white p-6"><h1 className="text-2xl font-bold">Friends</h1><p className="mt-3 text-slate-500">Sign in to see your connections.</p><Link href="/api/auth/signin?callbackUrl=%2Ffriends" className="mt-4 inline-block font-semibold text-brand-700">Sign in →</Link></section>;
  const db = await getDb();
  const friends = await db.select({ id: users.id, name: users.name }).from(connections)
    .innerJoin(users, eq(users.id, sql`case when ${connections.requesterId} = ${userId} then ${connections.addresseeId} else ${connections.requesterId} end`))
    .where(and(eq(connections.status, "accepted"), or(eq(connections.requesterId, userId), eq(connections.addresseeId, userId)))).orderBy(users.name);
  return <section className="space-y-5"><h1 className="text-2xl font-bold">Friends</h1><p className="text-sm text-slate-500">{friends.length} connections</p>{friends.length ? <ul className="grid gap-3 sm:grid-cols-2">{friends.map(friend => <li key={friend.id}><Link href={`/profile/${encodeURIComponent(friend.id)}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-300"><span className="grid size-11 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{(friend.name || "Z").slice(0, 1)}</span><span className="font-semibold">{friend.name || "Community member"}</span></Link></li>)}</ul> : <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No connections yet. Find someone in the directory and say hello.</p>}<Link href="/directory" className="inline-block font-semibold text-brand-700">Find people →</Link></section>;
}
