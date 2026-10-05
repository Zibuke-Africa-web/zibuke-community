import Link from "next/link";

export default function SpaceNotFound() {
  return <section className="rounded-3xl border border-black bg-white p-8 text-black"><h1 className="text-2xl font-bold">Space not found</h1><p className="my-4">This space is unavailable or you don’t have access.</p><Link href="/spaces" className="inline-flex rounded-full bg-[#ccff00] px-5 py-3 font-bold text-black hover:opacity-90">Explore spaces</Link></section>;
}
