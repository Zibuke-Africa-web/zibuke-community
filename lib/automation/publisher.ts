import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { spaces, users } from "@/db/schema";
import { PULSE_EMAIL, PULSE_ID } from "@/lib/bot-post";
import { fetchNews } from "./news-fetcher";
import { summarizeArticle } from "./ai-summarizer";

export async function publishNews(env: Pick<CloudflareEnv, "DB" | "AI">) {
  const articles = await fetchNews();
  const db = drizzle(env.DB);
  const [space] = await db.select().from(spaces).where(and(eq(spaces.slug, "general"), eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false))).limit(1);
  const target = space || (await db.select().from(spaces).where(and(eq(spaces.slug, "welcome"), eq(spaces.privacy, "public"), eq(spaces.isPaywalled, false))).limit(1))[0];
  if (!target) throw new Error("Public General space is unavailable");
  let authors = await db.select().from(users).where(sql`lower(${users.email}) = ${PULSE_EMAIL}`).limit(2);
  if (!authors.length) {
    await db.insert(users).values({ id: PULSE_ID, email: PULSE_EMAIL, name: "Zibuke Pulse", role: "system", locationCity: "" }).onConflictDoNothing();
    authors = await db.select().from(users).where(sql`lower(${users.email}) = ${PULSE_EMAIL}`).limit(2);
  }
  if (authors.length !== 1 || authors[0].role !== "system") throw new Error("System author requires administrator review");
  const postIds: string[] = [];
  let attempted = 0, failed = 0;
  for (const article of articles) {
    // Include older manually ingested source attributions in duplicate checks.
    const existing = await env.DB.prepare("SELECT 1 FROM published_articles WHERE source_url = ? UNION ALL SELECT 1 FROM posts WHERE instr(content, ?) > 0 LIMIT 1").bind(article.link, article.link).first();
    if (existing) continue;
    if (attempted >= 2) break;
    attempted++;
    try {
      const summary = await summarizeArticle(env.AI, article);
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
    } catch {
      failed++;
      // Do not log source contents, AI output, or bindings.
      console.error("Publisher article processing failed");
    }
  }
  if (failed && !postIds.length) throw new Error("News publishing failed");
  return { success: true, articlesIngested: postIds.length, postIds };
}
