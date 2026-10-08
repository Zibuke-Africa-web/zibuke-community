export const NEWS_FEEDS = [
  "https://techcentral.co.za/feed/",
  "https://disruptafrica.com/feed/",
  "https://techcabal.com/feed/",
  "https://ventureburn.com/feed/",
  "https://businesstech.co.za/feed/",
] as const;

export interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

export function canonicalArticleUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.hostname = url.hostname.replace(/^www\./, "");
    return url.href;
  } catch { return null; }
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    if (entity[0] !== "#") return named[entity.toLowerCase()] || match;
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : " ";
  });
}

function plainText(value: string) {
  return decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Deliberately a bounded RSS item parser, not a general XML interpreter: no
// external entities, DOM, eval, or dependencies. Incomplete items are ignored.
export function parseFeed(xml: string): NewsArticle[] {
  if (xml.length > 1_048_576) return [];
  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)) {
    const item = match[1];
    if (/<item\b/i.test(item)) continue;
    const tag = (name: string) => item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, "i"))?.[1] || "";
    const title = plainText(tag("title")).slice(0, 240);
    const link = canonicalArticleUrl(plainText(tag("link")));
    const date = Date.parse(plainText(tag("pubDate")));
    const description = plainText(tag("description") || tag("content:encoded")).slice(0, 6000);
    if (!title || !link || !Number.isFinite(date) || !description || seen.has(link)) continue;
    seen.add(link);
    articles.push({ title, link, pubDate: new Date(date).toISOString(), description });
    if (articles.length >= 50) break;
  }
  return articles.sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));
}

async function fetchFeed(feed: string): Promise<NewsArticle[]> {
  const response = await fetch(feed, {
    signal: AbortSignal.timeout(15_000), redirect: "follow",
    headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "ZibukePulse/1.0 (+https://zibukecommunity.co.za)" },
  });
  if (!response.ok || !response.body) throw new Error("Feed unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let xml = "", size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) throw new Error("Feed exceeds size limit");
      xml += decoder.decode(value, { stream: true });
    }
    xml += decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const hostname = new URL(feed).hostname;
  // Only publish article links belonging to the curated source.
  return parseFeed(xml).filter(article => new URL(article.link).hostname === hostname);
}

export async function fetchNews(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(NEWS_FEEDS.map(fetchFeed));
  const articles = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  if (!articles.length) throw new Error("No usable news feeds available");
  const unique = new Map(articles.map(article => [article.link, article]));
  return [...unique.values()].sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));
}
