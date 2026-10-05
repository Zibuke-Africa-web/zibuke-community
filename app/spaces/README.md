# Spaces views

The server pages load D1 through asynchronous Cloudflare context and Drizzle.
Interactive search, membership controls, and discussion previews live in `views.tsx`.
Dynamic route params are awaited for Next.js 16.

`data.ts` returns the four authored starter spaces when D1 throws or has no spaces.
Fallback names/counts are preview content, not persisted seed rows. Existing database
rows keep their names and slugs (including Phase 1's `creators` slug).
Unknown slugs return 404. Private database rows are only returned to their members.
An empty result caused by privacy filtering does not enable fallback.

Real memberships use authenticated server actions; fallback memberships use page-local
state. Private membership changes require an administrator. Host/admin memberships
cannot be removed with the member toggle. Discussion drafts are page-local previews
in both modes; there is no persistent space-post schema or publishing endpoint yet.

The previous route-group pages were relocated here to avoid duplicate `/spaces`
routes. No feed, auth, middleware, or existing post code was changed in Phase 2.

Manual checks:

- With D1 empty/unavailable, confirm all four starter cards and their supplied counts.
- Search `garden` and `Local Hub`; use an unmatched query and clear the search.
- Open each card and check topic-specific prompts, back links, and privacy badges.
- In fallback mode, join, preview a post, then refresh to confirm preview state resets.
- With migrated D1 and a signed-in user, join/leave and refresh to confirm persistence.
- Verify private spaces are unavailable to nonmembers, including direct URLs.
- Check narrow and wide layouts and keyboard focus. Hover must not swap any colors.
