import { notFound } from "next/navigation";
import { loadSpaces } from "../data";
import { SpaceDetail } from "../views";

export const dynamic = "force-dynamic";
export const metadata = { title: "Space | Zibuke Community" };

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { spaces, preview } = await loadSpaces();
  const space = spaces.find(item => item.slug === slug);
  if (!space) notFound();
  return <SpaceDetail key={`${space.id}-${space.joined}-${space.members}`} space={space} preview={preview} />;
}
