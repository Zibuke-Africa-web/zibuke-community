import Link from "next/link";

export default function SpacesLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white text-black">
    <nav aria-label="Spaces navigation" className="border-b border-black bg-black text-[#ccff00]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link href="/spaces" className="text-lg font-black tracking-tight hover:opacity-90">ZIBUKE / SPACES</Link>
        <Link href="/feed" className="text-sm font-semibold hover:opacity-90">Back to community feed →</Link>
      </div>
    </nav>
    <main className="mx-auto max-w-6xl px-6 py-10 md:py-16">{children}</main>
  </div>;
}
