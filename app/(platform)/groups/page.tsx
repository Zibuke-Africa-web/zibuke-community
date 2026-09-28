import type { Metadata } from "next";
import { Users } from "lucide-react";
import { getDb } from "@/db";
import { groups } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Groups · Zibuke Community",
  description: "Spaces for the projects, cohorts, and interests you follow.",
};

const PLACEHOLDER_MEMBER_COUNT = 0;

export default async function GroupsPage() {
  const db = await getDb();
  const allGroups = await db.select().from(groups).orderBy(groups.name);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Groups</h1>
        <p className="max-w-[68ch] text-sm leading-relaxed text-stone-600">
          Spaces for the projects, cohorts, and interests you follow.
        </p>
      </header>

      {allGroups.length === 0 ? (
        <section className="flex flex-col items-center rounded-xl border border-stone-200 bg-white px-6 py-12 text-center shadow-sm">
          <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
            <Users aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-sm font-semibold">No groups yet</h2>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-stone-600">
            Groups you join appear here with their latest activity and members.
          </p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {allGroups.map((group) => (
            <li key={group.id}>
              <article className="flex h-full flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-sm font-semibold text-stone-900">
                    {group.name}
                  </h2>
                  {group.description ? (
                    <p className="text-sm leading-relaxed text-stone-600">
                      {group.description}
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                    <Users
                      aria-hidden="true"
                      className="size-4 text-stone-400"
                    />
                    {PLACEHOLDER_MEMBER_COUNT} members
                  </span>
                  <button
                    type="button"
                    aria-label={`Join ${group.name}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                  >
                    Join Group
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
