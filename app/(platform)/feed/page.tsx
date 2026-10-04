import type { Metadata } from "next";
import { CommunityHome } from "@/components/community-home";

export const metadata: Metadata = {
  title: "Your community · Zibuke",
  description: "Meet your people. Share your ideas. Grow together with Zibuke Community.",
};

export default function FeedPage() {
  return <CommunityHome />;
}
