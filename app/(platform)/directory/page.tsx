import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Directory · Zibuke Community",
  description: "Everyone in Zibuke Community, and what they are working on.",
};

function getInitials(name: string | null) {
  if (!name) {
    return "";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default async function DirectoryPage() {
  const db = await getDb();
  const members = await db.select().from(users).orderBy(users.name);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          Directory
        </h1>
        <p className="max-w-[68ch] text-sm leading-relaxed text-gray-600">
          Everyone in Zibuke Community, with the groups they belong to and what
          they have posted recently.
        </p>
      </header>

      {members.length === 0 ? (
        <section className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Compass aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-gray-900">
            No members yet
          </h2>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-gray-600">
            Profiles appear here as people join. Each one lists their groups,
            recent posts, and the fastest way to reach them.
          </p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {members.map((member) => (
            <li key={member.id}>
              <article className="flex h-full flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white"
                  >
                    {getInitials(member.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-gray-900">
                      {member.name}
                    </h2>
                    <p className="truncate text-xs text-gray-500">
                      {member.role}
                    </p>
                  </div>
                </div>

                {member.skills.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {member.skills.map((skill) => (
                      <li
                        key={skill}
                        className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <button
                  type="button"
                  aria-label={`Message ${member.name}`}
                  className="mt-auto inline-flex min-h-11 items-center justify-center self-start rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                >
                  Message
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
