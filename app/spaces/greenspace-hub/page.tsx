import Link from "next/link";
import { BotanistWidget } from "@/components/botanist-widget";
import { SpaceMembershipGate } from "@/components/space-membership-gate";

export const metadata = { title: "GreenSpace Hub | Zibuke Community" };
export const dynamic = "force-dynamic";

export default function GreenSpaceHubPage() {
  return <SpaceMembershipGate slug="greenspace-hub">
    <Link href="/spaces" className="mb-6 inline-flex font-bold text-black hover:opacity-90">← All spaces</Link>
    <header className="mb-8 rounded-3xl bg-[#0d140e] p-8 text-[#ccff00] md:p-12">
      <p className="text-sm font-bold uppercase tracking-widest">South African gardens · Zibuke Community</p>
      <h1 className="mt-4 text-4xl font-black md:text-5xl">GreenSpace Hub</h1>
      <p className="mt-4 max-w-2xl text-lg">From Highveld frost to water-wise planting. Understand your garden and connect with hands-on help when you need it.</p>
    </header>
    <BotanistWidget />
  </SpaceMembershipGate>;
}
