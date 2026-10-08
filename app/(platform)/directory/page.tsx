import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { directoryCategories as categories, directorySubtitle, provinceHubs, readDirectory } from "@/lib/directory";
import { initials, safeHttps, whatsappUrl } from "@/lib/community";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local Business & Member Directory | Zibuke" };
export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string; city?: string; category?: string; page?: string }> }) {
  const params = await searchParams;
  const result = await (async () => {
    try {
      const session = await auth();
      return { ...await readDirectory(await getDb(), session?.user?.id, params), failed: false };
    } catch {
      return { members: [], localCity: "", locations: [{ value: "", label: "All locations" }, ...Object.keys(provinceHubs).map(value => ({ value, label: value }))], query: "", city: "", category: "All", page: 1, failed: true };
    }
  })();
  const { members, localCity, locations, query, city, category, page, failed } = result;
  const href = (changes: Record<string, string>) => `/directory?${new URLSearchParams({ q: query, city, category, page: "1", ...changes })}`;
  return <section className="space-y-6 bg-white text-black"><header><h1 className="text-3xl font-black">Local Business &amp; Member Directory</h1><p className="mt-3">{directorySubtitle(localCity)}</p></header>
    <form action="/directory" role="search" className="flex gap-2"><input name="q" type="search" defaultValue={query} maxLength={100} aria-label="Search members, businesses, or skills" placeholder="Search members, businesses, or skills..." className="min-w-0 flex-1 rounded-xl border border-black bg-white p-3 text-black placeholder:text-black" /><input type="hidden" name="city" value={city} /><input type="hidden" name="category" value={category} /><button className="rounded-xl bg-[#ccff00] px-4 font-bold text-black hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">Search</button></form>
    <nav aria-label="Location" className="flex flex-wrap gap-2">{locations.map(({ value, label }) => <Link key={value} href={href({ city: value })} aria-current={city === value ? "page" : undefined} className={`rounded-full border border-black px-4 py-2 text-sm font-bold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black ${city === value ? "bg-black text-[#ccff00]" : "bg-white text-black"}`}>{label}</Link>)}</nav>
    <nav aria-label="Business category" className="flex flex-wrap gap-2">{categories.map(value => <Link key={value} href={href({ category: value })} aria-current={category === value ? "page" : undefined} className={`rounded-full border border-black px-4 py-2 text-sm font-bold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black ${category === value ? "bg-[#ccff00] text-black" : "bg-white text-black"}`}>{value}</Link>)}</nav>
    {failed ? <p role="alert">The directory could not load. Please refresh.</p> : !members.length ? <div role="status" className="rounded-2xl border border-slate-300 bg-white p-6 text-slate-900"><h2 className="text-xl font-bold">No members found in this area yet</h2><p className="my-3">Try a different location or clear your search to meet people across South Africa.</p><Link href="/directory" className="inline-flex rounded-full bg-[#ccff00] px-5 py-3 font-bold text-black hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">All locations · Reset filters</Link></div> : <ul className="grid gap-4 md:grid-cols-2">{members.slice(0, 24).map(member => {
      const name = member.name || member.businessName || "Community member";
      const image = safeHttps(member.image); const whatsapp = whatsappUrl(member.whatsappNumber);
      return <li key={member.id} className="flex flex-col rounded-2xl border border-black bg-white p-5 text-black"><div className="flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ccff00] font-bold text-black">{image ? <Image unoptimized src={image} alt="" width={48} height={48} /> : initials(name)}</span><div><h2 className="font-bold">{name}</h2><p className="text-sm">{member.businessName || member.businessCategory || "Community member"}</p></div></div>
      {member.verified && <span className="mt-3 self-start rounded-full bg-black px-3 py-1 text-xs font-bold text-[#ccff00]">Verified Partner</span>}
      <p className="mt-3 text-sm">{member.locationCity || "Location not shared"} · {member.businessCategory || "Member"}</p>{member.bio && <p className="mt-3 line-clamp-3 text-sm leading-6">{member.bio}</p>}<p className="mt-3 text-xs">{member.skills.slice(0, 6).join(" · ")}</p><div className="mt-auto flex flex-wrap gap-2 pt-5"><Link href={`/profile/${encodeURIComponent(member.id)}`} className="rounded-full bg-[#ccff00] px-4 py-2 text-sm font-bold text-black hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">View Profile</Link>{whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-full bg-black px-4 py-2 text-sm font-bold text-[#ccff00] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">Chat on WhatsApp</a>}</div></li>;
    })}</ul>}
    <nav aria-label="Directory pages" className="flex justify-between">{page > 1 ? <Link className="font-bold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black" href={href({ page: String(page - 1) })}>Previous</Link> : <span />}{members.length > 24 && <Link className="font-bold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black" href={href({ page: String(page + 1) })}>Next</Link>}</nav>
  </section>;
}
