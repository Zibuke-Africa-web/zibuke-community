import Image from "next/image";
import Link from "next/link";
import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { initials, safeHttps, whatsappUrl } from "@/lib/community";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local Business & Member Directory | Zibuke" };
const categories = ["All", "Home & Garden", "Digital Services", "Consulting", "Retail"];
export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string; city?: string; category?: string; page?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const city = ["Secunda", "Mpumalanga"].includes(params.city || "") ? params.city! : "";
  const category = categories.includes(params.category || "") ? params.category! : "All";
  const page = Math.max(1, Math.min(100, Number.parseInt(params.page || "1", 10) || 1));
  const href = (changes: Record<string, string>) => `/directory?${new URLSearchParams({ q: query, city, category, ...changes })}`;
  const result = await (async () => {
    try {
      const pattern = `%${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      const members = await (await getDb()).select({ id: users.id, name: users.name, image: users.image, bio: users.bio,
        businessName: users.businessName, businessCategory: users.businessCategory, locationCity: users.locationCity,
        whatsappNumber: users.whatsappNumber, skills: users.skills,
        verified: sql<boolean>`(${users.isVerifiedPartner}=1 and exists(select 1 from subscriptions s where s.user_id=${users.id} and s.status in ('active','canceled') and s.current_period_end>unixepoch()))`.mapWith(Boolean),
      }).from(users).where(and(
        query ? sql`(${users.name} like ${pattern} escape '\' or ${users.businessName} like ${pattern} escape '\' or ${users.skills} like ${pattern} escape '\')` : undefined,
        city === "Secunda" ? eq(users.locationCity, "Secunda") : city === "Mpumalanga" ? or(eq(users.locationCity, "Secunda"), like(users.location, "%Mpumalanga%")) : undefined,
        category === "Home & Garden" ? sql`${users.businessCategory} in ('Home & Garden','Landscaping','Gardening')` : category !== "All" ? eq(users.businessCategory, category) : undefined,
      )).orderBy(asc(users.name), asc(users.id)).limit(25).offset((page - 1) * 24);
      return { members, failed: false };
    } catch { return { members: [], failed: true }; }
  })();
  const { members, failed } = result;
  return <section className="space-y-6 bg-white text-black"><header><h1 className="text-3xl font-black">Local Business &amp; Member Directory</h1><p className="mt-3">Find your people and trusted partners across Secunda and Mpumalanga.</p></header>
    <form action="/directory" role="search" className="flex gap-2"><input name="q" type="search" defaultValue={query} maxLength={100} aria-label="Search members, businesses, or skills" placeholder="Search members, businesses, or skills..." className="min-w-0 flex-1 rounded-xl border border-black bg-white p-3 text-black placeholder:text-black" /><input type="hidden" name="city" value={city} /><input type="hidden" name="category" value={category} /><button className="rounded-xl bg-[#ccff00] px-4 font-bold text-black hover:opacity-90">Search</button></form>
    <nav aria-label="Location" className="flex flex-wrap gap-2">{[["", "All locations"], ["Secunda", "Secunda Local"], ["Mpumalanga", "Mpumalanga"]].map(([value, label]) => <Link key={value} href={href({ city: value })} aria-current={city === value ? "page" : undefined} className={`rounded-full border border-black px-4 py-2 text-sm font-bold hover:opacity-90 ${city === value ? "bg-black text-[#ccff00]" : "bg-white text-black"}`}>{label}</Link>)}</nav>
    <nav aria-label="Business category" className="flex flex-wrap gap-2">{categories.map(value => <Link key={value} href={href({ category: value })} aria-current={category === value ? "page" : undefined} className={`rounded-full border border-black px-4 py-2 text-sm font-bold hover:opacity-90 ${category === value ? "bg-[#ccff00] text-black" : "bg-white text-black"}`}>{value}</Link>)}</nav>
    {failed ? <p role="alert">The directory could not load. Please refresh.</p> : !members.length ? <p className="rounded-xl border border-black p-6">No matching members. Try another search or filter.</p> : <ul className="grid gap-4 md:grid-cols-2">{members.slice(0, 24).map(member => {
      const name = member.name || member.businessName || "Community member";
      const image = safeHttps(member.image); const whatsapp = whatsappUrl(member.whatsappNumber);
      return <li key={member.id} className="flex flex-col rounded-2xl border border-black bg-white p-5 text-black"><div className="flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ccff00] font-bold text-black">{image ? <Image unoptimized src={image} alt="" width={48} height={48} /> : initials(name)}</span><div><h2 className="font-bold">{name}</h2><p className="text-sm">{member.businessName || member.businessCategory || "Community member"}</p></div></div>
      {member.verified && <span className="mt-3 self-start rounded-full bg-black px-3 py-1 text-xs font-bold text-[#ccff00]">Verified Partner</span>}
      <p className="mt-3 text-sm">{member.locationCity} · {member.businessCategory || "Member"}</p>{member.bio && <p className="mt-3 line-clamp-3 text-sm leading-6">{member.bio}</p>}<p className="mt-3 text-xs">{member.skills.slice(0, 6).join(" · ")}</p><div className="mt-auto flex flex-wrap gap-2 pt-5"><Link href={`/profile/${encodeURIComponent(member.id)}`} className="rounded-full bg-[#ccff00] px-4 py-2 text-sm font-bold text-black hover:opacity-90">View Profile</Link>{whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-full bg-black px-4 py-2 text-sm font-bold text-[#ccff00] hover:opacity-90">Chat on WhatsApp</a>}</div></li>;
    })}</ul>}
    <nav aria-label="Directory pages" className="flex justify-between">{page > 1 ? <Link className="font-bold hover:opacity-90" href={href({ page: String(page - 1) })}>Previous</Link> : <span />}{members.length > 24 && <Link className="font-bold hover:opacity-90" href={href({ page: String(page + 1) })}>Next</Link>}</nav>
  </section>;
}
