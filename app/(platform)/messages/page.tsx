import Link from "next/link";

export const metadata = { title: "Direct Messaging | Zibuke Community" };

export default function MessagesPage() {
  return <section className="rounded-2xl border border-black bg-white p-6 text-black">
    <h1 className="text-2xl font-bold">Direct Messaging coming soon</h1>
    <p className="mt-3 text-sm leading-7">Private conversations are not available yet. Connect with the community in Spaces.</p>
    <Link href="/spaces" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#ccff00] px-5 font-semibold text-black hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">Explore Spaces</Link>
  </section>;
}
