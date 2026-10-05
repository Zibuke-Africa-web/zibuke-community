import { notFound } from "next/navigation";
import { loadSpaces } from "../data";
import { getSpaceDetails, getSpacePosts } from "@/actions/spaces";
import { SpaceDetail } from "../space-detail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Space | Zibuke Community" };

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const details = await getSpaceDetails(slug);
  if (!details.success) {
    // Preserve authored starter previews, but never pretend a write was persisted.
    const fallback = await loadSpaces();
    const seed = fallback.preview ? fallback.spaces.find(item => item.slug === slug) : undefined;
    if (seed) return <SpaceDetail key={seed.id} preview posts={[]} space={{
      id: seed.id, slug: seed.slug, name: seed.name, tagline: seed.tag,
      description: seed.description, icon: seed.icon, privacy: seed.privacy,
      memberCount: seed.members, isMember: false, role: null,
    }} />;
    if (details.error === "NOT_FOUND") notFound();
    return <section role="alert" className="rounded-3xl border border-black bg-white p-8 text-black"><h1 className="text-2xl font-bold">This space couldn’t load</h1><p className="mt-3">Please refresh the page to try again.</p></section>;
  }
  const feed = await getSpacePosts(details.data.id);
  return <SpaceDetail key={details.data.id} space={details.data} posts={feed.success ? feed.data : []} feedError={feed.success ? undefined : feed.error} />;
}
