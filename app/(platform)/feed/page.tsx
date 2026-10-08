import type { Metadata } from "next";
import Link from "next/link";
import { CommunityHome } from "@/components/community-home";
import { getCommunityFeed } from "@/actions/spaces";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your community | Zibuke",
  description: "Meet your people. Share your ideas. Grow together with Zibuke Community.",
};

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page || "1", 10) || 1));
  const result = await getCommunityFeed(page);
  if (!result.success) return <section role="alert" className="rounded-2xl border border-black bg-white p-6 text-black">
    <h1 className="text-2xl font-bold">The community feed could not load</h1>
    <p className="mt-3">Please try again in a moment.</p>
    <Link href="/feed" className="mt-4 inline-flex min-h-11 items-center font-semibold underline focus-visible:outline-2 focus-visible:outline-black">Reload feed</Link>
  </section>;
  return <CommunityHome feed={result.data} now={Date.now()} />;
}
