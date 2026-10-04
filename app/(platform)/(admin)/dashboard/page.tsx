import type { Metadata } from "next";
import { count } from "drizzle-orm";
import { FileText, Users, UsersRound } from "lucide-react";
import { getDb } from "@/db";
import { groups, posts, users } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard · Zibuke Admin",
  description: "Platform totals from the D1 database.",
};

export default async function AdminDashboardPage() {
  const db = await getDb();

  const [[userTotal], [groupTotal], [postTotal]] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(groups),
    db.select({ value: count() }).from(posts),
  ]);

  const metrics = [
    {
      label: "Users",
      value: userTotal?.value ?? 0,
      hint: "Registered profiles",
      icon: Users,
    },
    {
      label: "Groups",
      value: groupTotal?.value ?? 0,
      hint: "Communities on the platform",
      icon: UsersRound,
    },
    {
      label: "Posts",
      value: postTotal?.value ?? 0,
      hint: "Feed items written",
      icon: FileText,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400">
          Live totals read from the D1 database.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <article
            key={label}
            className="rounded-lg border border-gray-800 bg-gray-900 p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                {label}
              </h2>
              <Icon aria-hidden="true" className="size-4 text-gray-500" />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-white">
              {value}
            </p>
            <p className="mt-1 text-xs text-gray-500">{hint}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
