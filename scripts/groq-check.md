# Admin-only Groq deployment health check

While signed in as an administrator, visit `/api/groq-check` on the application origin. Anonymous users, ordinary members, missing roles, and authentication failures receive 403. Query-string secrets no longer authorize requests. The database session callback supplies the user's role.

For the CLI, supply a current administrator session Cookie header through the local `GROQ_CHECK_COOKIE` environment variable, then run `node scripts/groq-check.mjs https://your-community-host`. Treat that cookie as a credential: do not commit or share it, and clear it after use. The script refuses redirects and requires HTTPS except for localhost.

The endpoint uses native fetch, a 30-second timeout, and the configured text model. It returns only a text-inference result, model, and upstream HTTP status when relevant. It never returns key fragments, environment binding names, raw provider bodies, or exception messages. Responses are not cached. This probe does not verify vision inference.

- 403: an authenticated administrator session is required.
- 200 with `ok: false`: configuration unavailable or upstream rejection.
- 200 with `ok: true`: text inference succeeded.
- 502: missing or invalid upstream completion.
- 500: inference failed or timed out.

Run `node --test tests/groq-check.test.mjs tests/auth-providers.test.mjs tests/groq-workerd.test.mjs` for regression coverage. Tests inject sessions and intercept outbound traffic; they do not use live credentials.
