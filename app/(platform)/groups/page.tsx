import type { Metadata } from "next";
import { Users } from "lucide-react";
import { joinGroup } from "@/app/actions";
import { getDb } from "@/db";
import { groups } from "@/db/schema";
import { CreateGroupModal } from "./create-group-modal";

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Groups
          </h1>
          <p className="max-w-[68ch] text-sm leading-relaxed text-gray-600">
            Spaces for the projects, cohorts, and interests you follow.
          </p>
        </div>
        <CreateGroupModal />
      </header>

      {allGroups.length === 0 ? (
        <section className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Users aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-gray-900">
            No groups yet
          </h2>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-gray-600">
            Groups you join appear here with their latest activity and members.
          </p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {allGroups.map((group) => (
            <li key={group.id}>
              <article className="flex h-full flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {group.name}
                  </h2>
                  {group.description ? (
                    <p className="text-sm leading-relaxed text-gray-600">
                      {group.description}
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <Users
                      aria-hidden="true"
                      className="size-4 text-gray-400"
                    />
                    {PLACEHOLDER_MEMBER_COUNT} members
                  </span>
                  <form action={joinGroup.bind(null, group.id)}>
                    <button
                      type="submit"
                      aria-label={`Join ${group.name}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                    >
                      Join Group
                    </button>
                  </form>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
