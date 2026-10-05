import type { Metadata } from "next";
import { desc, eq, isNull } from "drizzle-orm";
import { Heart, MessageCircle, MessageSquare } from "lucide-react";
import { likePost } from "@/app/actions";
import { getDb } from "@/db";
import { posts, users } from "@/db/schema";
import { FeedComposer } from "./feed-composer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Messages · Zibuke Community",
  description: "Direct conversations with people and groups in Zibuke Community.",
};

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatTimestamp(date: Date) {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);

  if (minutes < 60) {
    return relativeTime.format(-minutes, "minute");
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return relativeTime.format(-hours, "hour");
  }

  return relativeTime.format(-Math.round(hours / 24), "day");
}

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

const interactionButton =
  "inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2";

export default async function MessagesPage() {
  const db = await getDb();
  const feed = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      authorName: users.name,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(isNull(posts.spaceId))
    .orderBy(desc(posts.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          Messages
        </h1>
        <p className="max-w-[68ch] text-sm leading-relaxed text-gray-600">
          Direct conversations with people and groups in Zibuke Community.
        </p>
      </header>

      <FeedComposer />

      {feed.length === 0 ? (
        <section className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">
            <MessageSquare aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-gray-900">
            No conversations yet
          </h2>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-gray-600">
            Messages you send and receive appear here, newest first.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {feed.map((post) => (
            <li key={post.id}>
              <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white"
                  >
                    {getInitials(post.authorName)}
                  </span>
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <h2 className="truncate text-sm font-semibold text-gray-900">
                      {post.authorName}
                    </h2>
                    <time
                      dateTime={post.createdAt.toISOString()}
                      className="text-xs text-gray-500"
                    >
                      {formatTimestamp(post.createdAt)}
                    </time>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-gray-700">
                  {post.content}
                </p>

                <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-3">
                  <form action={likePost.bind(null, post.id)}>
                    <button
                      type="submit"
                      aria-label={`Like post by ${post.authorName}`}
                      className={interactionButton}
                    >
                      <Heart
                        aria-hidden="true"
                        className="size-4 text-gray-500"
                      />
                      Like
                    </button>
                  </form>
                  <button
                    type="button"
                    aria-label={`Reply to post by ${post.authorName}`}
                    className={interactionButton}
                  >
                    <MessageCircle
                      aria-hidden="true"
                      className="size-4 text-gray-500"
                    />
                    Reply
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
