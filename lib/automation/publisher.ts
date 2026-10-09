import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { spaces, users } from "@/db/schema";
import { PULSE_EMAIL, PULSE_ID } from "@/lib/bot-post";
import { fetchNews, type FeedDiagnostic } from "./news-fetcher";
import { summarizeArticle } from "./ai-summarizer";

export function publisherDiagnostics() {
  return { success: false, feedsChecked: [] as FeedDiagnostic[], itemsFound: 0, articlesAttempted: 0,
    articlesSaved: 0, articlesIngested: 0, postIds: [] as string[], errors: [] as string[] };
}

export async function publishNews(env: Pick<CloudflareEnv, "DB" | "AI">) {
  const result = publisherDiagnostics();
  const recordError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Publisher error", message);
    result.errors.push(message);
  };
  try {
    const articles = await fetchNews(result.feedsChecked);
    result.itemsFound = articles.length;
    result.errors.push(...result.feedsChecked.filter(feed => feed.error).map(feed => `${feed.url}: ${feed.error}`));
    if (!articles.length) throw new Error("No usable news feeds available");
    try {
      await env.DB.prepare("SELECT source_url, post_id FROM published_articles LIMIT 0").all();
    } catch (error) {
      throw new Error(`Publisher receipt schema check failed; apply migration 0010_published_articles.sql: ${error instanceof Error ? error.message : String(error)}`);
    }
    const db = drizzle(env.DB);
    const [space] = await db.select().from(spaces).where(and(eq(spaces.slug, "general"), eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false))).limit(1);
    let target = space || (await db.select().from(spaces).where(and(eq(spaces.slug, "welcome"), eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false))).limit(1))[0];
    target ||= (await db.select().from(spaces).where(and(eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false))).limit(1))[0];
    if (!target) {
      await db.insert(spaces).values({ id: crypto.randomUUID(), slug: "general", name: "General", privacy: "public", isPaywalled: false }).onConflictDoNothing();
      target = (await db.select().from(spaces).where(and(eq(spaces.slug, "general"), eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false))).limit(1))[0];
    }
    if (!target) throw new Error("No public free space available; existing General space is restricted");
    let authors = await db.select().from(users).where(sql`lower(${users.email}) = ${PULSE_EMAIL}`).limit(2);
    if (!authors.length) {
      await db.insert(users).values({ id: PULSE_ID, email: PULSE_EMAIL, name: "Zibuke Pulse", role: "system", locationCity: "" }).onConflictDoNothing();
      authors = await db.select().from(users).where(sql`lower(${users.email}) = ${PULSE_EMAIL}`).limit(2);
    }
    if (authors.length !== 1 || authors[0].role !== "system") throw new Error("System author requires administrator review");
    const postIds = result.postIds;
    let attempted = 0, failed = 0;
    for (const article of articles) {
      if (attempted >= 2) break;
      try {
        // Include older manually ingested source attributions in duplicate checks.
        const existing = await env.DB.prepare("SELECT 1 FROM published_articles WHERE source_url = ? UNION ALL SELECT 1 FROM posts WHERE instr(content, ?) > 0 LIMIT 1").bind(article.link, article.link).first();
        if (existing) continue;
        attempted++;
        result.articlesAttempted = attempted;
        const summary = await summarizeArticle(env.AI, article, message => recordError(`AI fallback for ${article.link}: ${message}`));
        const title = article.title.replace(/[\\\[\]*_`]/g, "");
        const content = `${summary}\n\n🔗 *Source: [${title}](${article.link.replace(/\(/g, "%28").replace(/\)/g, "%29")})*`;
        const id = crypto.randomUUID();
        // D1 batches are transactional. The INSERT SELECT rechecks deduplication
        // and space visibility atomically; concurrent runs cannot both insert.
        const results = await env.DB.batch([
          env.DB.prepare(`INSERT INTO posts (id, user_id, space_id, content, created_at)
            SELECT ?, ?, id, ?, unixepoch() FROM spaces
            WHERE id = ? AND privacy = 'public' AND is_paywalled = 0
              AND EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'system')
              AND NOT EXISTS (SELECT 1 FROM published_articles WHERE source_url = ?)
              AND NOT EXISTS (SELECT 1 FROM posts WHERE instr(content, ?) > 0)
            RETURNING id`).bind(id, authors[0].id, content, target.id, authors[0].id, article.link, article.link),
          env.DB.prepare("INSERT INTO published_articles (source_url, post_id) SELECT ?, id FROM posts WHERE id = ?").bind(article.link, id),
        ]);
        if (results[0].results.length) postIds.push(id);
      } catch (error) {
        failed++;
        // Do not log source contents, AI output, or bindings.
        recordError(`Article ${article.link}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (failed && !postIds.length) throw new Error("News publishing failed");
    result.success = true;
  } catch (error) { recordError(error); }
  result.articlesSaved = result.articlesIngested = result.postIds.length;
  console.log("Publisher completed", result);
  return result;
}
