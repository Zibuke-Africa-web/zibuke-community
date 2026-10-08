CREATE TABLE published_articles (
  source_url TEXT PRIMARY KEY NOT NULL,
  post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
