import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { PlatformNav } from "./platform-nav";

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2";

function AiInsightsCard({ headingId }: { headingId: string }) {
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2
        id={headingId}
        className="flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <Sparkles aria-hidden="true" className="size-4 text-brand-600" />
        Zibuke AI Insights
      </h2>
      <p className="mt-2.5 text-sm leading-relaxed text-gray-600">
        Patterns from your groups and messages, summarised for you in one place.
      </p>
      <p className="mt-4 border-t border-gray-200 pt-4 text-xs leading-relaxed text-gray-500">
        Nothing to analyse yet. Insights appear once there is activity in your
        groups.
      </p>
    </section>
  );
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 lg:px-6">
          <Link
            href="/"
            className={`flex shrink-0 items-baseline gap-1.5 rounded-sm text-gray-900 ${focusRing} focus-visible:ring-offset-white`}
          >
            <span className="text-lg font-semibold tracking-tight">Zibuke</span>
            <span className="text-xs font-medium tracking-[0.14em] text-gray-500 uppercase">
              Community
            </span>
          </Link>

          <form role="search" className="max-w-md flex-1">
            <label htmlFor="platform-search" className="sr-only">
              Search Zibuke Community
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-500"
              />
              <input
                id="platform-search"
                type="search"
                name="q"
                placeholder="Search people, groups, posts"
                className="h-11 w-full rounded-full bg-gray-100 pr-4 pl-10 text-base text-gray-900 transition-colors placeholder:text-gray-500 hover:bg-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              />
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white"
            >
              ZK
            </span>
            <span className="hidden text-sm font-medium text-gray-700 sm:block">
              Your profile
            </span>
          </div>
        </div>
      </header>

      <nav
        aria-label="Platform"
        className="border-b border-gray-200 bg-white lg:hidden"
      >
        <PlatformNav variant="tabs" />
      </nav>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-6 xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
        <aside className="hidden lg:sticky lg:top-[5.5rem] lg:block lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
          <nav aria-label="Platform">
            <PlatformNav variant="sidebar" />
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>

        <aside className="hidden xl:sticky xl:top-[5.5rem] xl:block xl:self-start">
          <AiInsightsCard headingId="ai-insights-heading" />
        </aside>

        <div className="lg:col-span-2 xl:hidden">
          <AiInsightsCard headingId="ai-insights-heading-inline" />
        </div>
      </div>
    </div>
  );
}
