# Taste
- When giving an explicit shell/git command, expects the agent to just run it rather than being asked clarifying multiple-choice questions first; if a conflict is surfaced, repeats the original command verbatim instead of picking an option. Confidence: 0.6
- Prefers the Next.js (App Router) + TypeScript + Tailwind CSS + lucide-react stack for building web apps. Confidence: 0.6
- Wants new projects initialized directly in the target directory — explicitly no extra nested project folder. Confidence: 0.7
- Prefers keeping dependencies on the actively-supported, current-generation packages: when a dependency is deprecated or peer-incompatible, swap it for the maintained replacement rather than keeping it with `--legacy-peer-deps`. Confidence: 0.6
- Prefers to visually inspect UI work themselves in a running dev server (`npm run dev` left running) instead of accepting automated/structural verification alone. Confidence: 0.55
- Prefers Cloudflare as the deployment/runtime target, with Drizzle ORM over Cloudflare D1 for the data layer (wrangler config + `@opennextjs/cloudflare` adapter). Confidence: 0.45
- Explicitly declares CLI/build tooling (e.g., `drizzle-kit`, `wrangler`) as devDependencies via `npm i -D` rather than relying on transitive/peer installation. Confidence: 0.5
- Works in explicit numbered phases: prompts open with "Let's move to Phase N" followed by an itemized list of concrete tasks to execute. Confidence: 0.65
- Wants seed/mock data to be realistic and representative (e.g., actual names, plausible roles, JSON skill arrays) rather than placeholder/lorem content. Confidence: 0.6
n` script) rather than checking them in. Confidence: 0.7
- When tooling is slow due to environment/disk I/O (e.g. synced folders), prefers applying the concrete config-level speedup (like adding `--cache` to the lint script) instead of only leaving it as a diagnosed problem. Confidence: 0.5
- Wants seed/mock data to be realistic and representative (e.g., actual names, plausible roles, JSON skill arrays) rather than placeholder/lorem content. Confidence: 0.5
- Likes checkpointing working state with a git commit (`git add .` + `git commit`) at milestones before adding new features, using conventional-commit-style messages (e.g. `feat: ...`). Confidence: 0.5
- Wants seeded mock data to be referentially consistent — new rows should reference the existing seeded records' UUIDs/foreign keys so joins resolve, rather than inventing standalone IDs. Confidence: 0.55
- Writes design/styling requests as precise, implementation-level specs — names the exact files to touch, specific Tailwind utility classes (`rounded-full`, `shadow-sm`, `hover:bg-gray-100`), and concrete hex colors — while leaving small choices open (e.g. "blue-600 or #0866FF", "slate-100 or gray-100") for the agent to decide. Confidence: 0.55
- Reaches for Auth.js (NextAuth v5, `next-auth@beta`) with the `@auth/drizzle-adapter` for authentication, wiring up the standard adapter tables (accounts/sessions/verificationTokens) plus social providers and an email provider. Confidence: 0.5
- Prefers wiring interactivity and mutations through Next.js Server Actions (collected in `app/actions.ts`, using `revalidatePath`), rather than API routes or client-side fetch. Confidence: 0.5
- Recurringly wants a "Facebook-style" social UI — feed composer, Like/Reply ghost buttons, profile/cover photos, a create-group modal with Privacy/Visibility radios, pill-shaped search. Confidence: 0.55
- Prefers comprehensive, feature-complete implementations that "capture maximum" data — e.g. multi-step onboarding forms and richly expanded schemas — over minimal stubs. Confidence: 0.45
