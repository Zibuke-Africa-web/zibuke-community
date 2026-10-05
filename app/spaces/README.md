# Spaces views

The server pages load D1 through asynchronous Cloudflare context and Drizzle.
Interactive search, membership controls, and discussion previews live in `views.tsx`.
Dynamic route params are awaited for Next.js 16.

`data.ts` returns the four authored starter spaces when D1 throws or has no spaces.
Fallback names/counts are preview content, not persisted seed rows. Existing database
rows keep their names and slugs (including Phase 1's `creators` slug).
Unknown slugs return 404. Private database rows are only returned to their members.
An empty result caused by privacy filtering does not enable fallback.

Real memberships and posts use `actions/spaces.ts`. Anonymous mutation calls return
`UNAUTHORIZED`, and the UI provides a sign-in link. Public feeds are readable without
membership; members-only/private feeds require membership. Publishing always requires
membership, checked atomically at insertion time. Private spaces cannot be self-joined.
Host/admin memberships cannot be removed with the member toggle.

Fallback cards remain available, but joining and publishing are disabled until their
spaces exist in D1. Optimistic changes roll back on failure; drafts survive a failed
submission. Posts are plain text (max 5,000 characters) and React-escaped when rendered.
Media links accept HTTPS or community uploads, with no server-side fetching. Feeds
return the latest 50 posts with author details and UTC timestamps.

Apply `drizzle/0004_space_posts.sql` (and any earlier pending migrations) before deploying.
It adds nullable `posts.space_id` with a foreign key and index; existing posts keep NULL.
Profile and Messages queries exclude space posts to prevent leaking restricted content.
No production migration is run by application code.

The previous route-group pages were relocated here to avoid duplicate `/spaces`
routes. No feed, auth, middleware, or existing post code was changed in Phase 2.

Manual checks:

- With D1 empty/unavailable, confirm all four starter cards and their supplied counts.
- Search `garden` and `Local Hub`; use an unmatched query and clear the search.
- Open each card and check topic-specific prompts, back links, and privacy badges.
- In fallback mode, confirm membership and publishing controls are disabled.
- With migrated D1, join, publish, refresh, and leave to confirm persistence.
- Try joining or posting anonymously and check the sign-in notice.
- Simulate a failed action and confirm optimistic state rolls back and drafts remain.
- Verify private spaces are unavailable to nonmembers, including direct URLs.
- Check narrow and wide layouts and keyboard focus. Hover must not swap any colors.
