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
