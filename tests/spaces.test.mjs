import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

test('Spaces migration and repeatable seed preserve existing data and enforce membership integrity', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("PRAGMA foreign_keys = ON; CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('member'); CREATE TABLE posts (id TEXT PRIMARY KEY, content TEXT); INSERT INTO posts VALUES ('original', 'Keep this post');");
    db.exec(readFileSync(new URL('../drizzle/0003_spaces.sql', import.meta.url), 'utf8'));
    const seed = readFileSync(new URL('../db/seed-spaces.sql', import.meta.url), 'utf8');
    db.exec(seed);
    db.exec(seed);
    assert.equal(db.prepare('SELECT count(*) AS n FROM spaces').get().n, 4);
    assert.equal(db.prepare('SELECT content FROM posts').get().content, 'Keep this post');
    assert.throws(() => db.exec("INSERT INTO spaces (id, slug, name, privacy) VALUES ('bad', 'bad', 'Bad', 'invalid')"));
    assert.throws(() => db.exec("INSERT INTO space_members (id, space_id, user_id) VALUES ('bad', 'space-welcome', 'missing')"));
    db.exec("INSERT INTO space_members (id, space_id, user_id) VALUES ('joined', 'space-welcome', 'member')");
    assert.throws(() => db.exec("INSERT INTO space_members (id, space_id, user_id) VALUES ('duplicate', 'space-welcome', 'member')"));
    db.exec("INSERT INTO spaces (id, slug, name, privacy) VALUES ('secret', 'secret', 'Secret', 'private')");
    const join = db.prepare("INSERT INTO space_members (id, space_id, user_id) SELECT ?, id, ? FROM spaces WHERE id = ? AND privacy IN ('public', 'members_only') ON CONFLICT (space_id, user_id) DO NOTHING");
    assert.equal(join.run('repeat', 'member', 'space-welcome').changes, 0);
    assert.equal(join.run('forbidden', 'member', 'secret').changes, 0);
    assert.equal(join.run('creator', 'member', 'space-creators').changes, 1);
    db.exec("DELETE FROM users WHERE id = 'member'");
    assert.equal(db.prepare('SELECT count(*) AS n FROM space_members').get().n, 0);
  } finally { db.close(); }
});
