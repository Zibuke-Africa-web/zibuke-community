import type { Metadata } from "next";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Users · Zibuke Admin",
  description: "Every profile in the D1 database.",
};

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function displayHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export default async function AdminUsersPage() {
  const db = await getDb();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      bio: users.bio,
      facebookUrl: users.facebookUrl,
      instagramUrl: users.instagramUrl,
      tiktokUrl: users.tiktokUrl,
      website: users.website,
    })
    .from(users)
    .orderBy(users.name);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">Users</h1>
        <p className="text-sm text-slate-600">
          {rows.length} {rows.length === 1 ? "profile" : "profiles"} in D1.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs tracking-wide text-gray-300 uppercase">
              <th scope="col" className="px-4 py-2.5 font-medium">
                ID
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Name
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Role
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Bio
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Social links
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((row) => {
              const links = [
                { label: "Facebook", value: row.facebookUrl },
                { label: "Instagram", value: row.instagramUrl },
                { label: "TikTok", value: row.tiktokUrl },
                { label: "Website", value: row.website },
              ].filter(
                (link): link is { label: string; value: string } =>
                  Boolean(link.value),
              );

              return (
                <tr key={row.id} className="align-top hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">
                    <span title={row.id}>{row.id.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap text-gray-100">
                    {row.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                    {row.role}
                  </td>
                  <td className="max-w-[32ch] px-4 py-3 text-gray-400">
                    {row.bio ? (
                      <span className="line-clamp-2">{row.bio}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {links.length === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {links.map(({ label, value }) => {
                          const href = safeHttpUrl(value);

                          return (
                            <li key={label} className="text-xs">
                              <span className="text-gray-300">{label}:</span>{" "}
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  title={value}
                                  className="text-brand-400 underline-offset-2 hover:underline"
                                >
                                  {displayHost(href)}
                                </a>
                              ) : (
                                <span className="text-gray-400">{value}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-8 text-center text-sm text-gray-300">
          No profiles yet.
        </p>
      ) : null}
    </div>
  );
}
