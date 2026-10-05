# Spaces rollout

Schema additions: `db/schema.ts`. Reviewable raw D1 SQL: `drizzle/0003_spaces.sql`
and `drizzle/0004_space_posts.sql`.
The generated Drizzle snapshot and journal are included for future migrations.
Phase 4 adds a nullable `space_id` foreign key and index to `posts`; old rows remain
unchanged with NULL space IDs. Timestamps use Unix seconds. Membership has a unique
space/user index and cascading foreign keys.

Review pending migrations before applying: Wrangler applies all pending migrations,
not just Spaces. Back up the remote database using your usual process first.

```powershell
npx.cmd wrangler d1 migrations list zibuke-db --remote
npx.cmd wrangler d1 migrations apply zibuke-db --local
npx.cmd wrangler d1 execute zibuke-db --local --file=db/seed-spaces.sql
```

After reviewing and testing locally, apply explicitly to production:

```powershell
npx.cmd wrangler d1 migrations apply zibuke-db --remote
npx.cmd wrangler d1 execute zibuke-db --remote --file=db/seed-spaces.sql
```

The seed is optional and repeatable; existing slugs and edited content are preserved.
Neither page rendering nor deployment automatically seeds or migrates the database.
Apply the migration before releasing the routes.

## Access and scope

- `/spaces` is a standalone directory with a link back to `/feed`.
- Public spaces and their feed layout can be explored without signing in.
- `members_only` space descriptions are discoverable; their feed requires joining.
  Any authenticated community user can join public or members-only spaces.
- Private spaces are omitted from discovery and return 404 to nonmembers.
  They require a membership provisioned by a trusted administrator; there is no
  public self-join or invitation management UI.
- Joining validates the session server-side and atomically checks privacy.
  Duplicate joins do not increase membership counts.
- Space members can publish plain-text posts with optional safe media links. Reads
  enforce space privacy. The latest 50 posts are displayed, newest first. Existing
  posts are not reassigned to spaces; profile and Messages lists exclude space posts.
- Preview fallback spaces cannot persist joins or posts until created in D1.
- All new surfaces use black/lime or white/black, with scale or opacity hover effects.

Smoke check after local migration: browse all four seeded spaces, sign in and join,
repeat a join, confirm the count stays stable, and confirm a private space returns
404 unless the signed-in user has membership. Check `/feed` still behaves as before.
