import type { Metadata } from "next";
import { CommunityHome } from "@/components/community-home";
import Link from "next/link";
import { getActiveSpark } from "@/lib/daily-spark-server";

export const metadata: Metadata = {
  title: "Your community · Zibuke",
  description: "Meet your people. Share your ideas. Grow together with Zibuke Community.",
};

export default async function FeedPage() {
  const spark = await getActiveSpark();
  return <>
    {spark.createdAt && <article className="mb-6 rounded-2xl border border-black bg-white p-6 text-black">
      <header className="flex items-center gap-3"><span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-black font-bold text-[#ccff00]">Z</span><div><h2 className="font-bold">Zibuke Community</h2><p className="text-xs">AI-generated daily spark · <time dateTime={spark.createdAt}>{new Date(spark.createdAt).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })}</time></p></div></header>
      <h3 className="mt-5 text-lg font-bold">{spark.topic}</h3><p className="mt-3 leading-7">{spark.prompt}</p>
      <Link href={`/spaces/${spark.targetSpaceSlug}`} className="mt-5 inline-flex rounded-full bg-[#ccff00] px-5 py-3 font-bold text-black hover:opacity-90">Join today&apos;s conversation →</Link>
    </article>}
    <CommunityHome />
  </>;
}
