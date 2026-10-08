import { and, asc, eq, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import type { Db } from "@/db";

export const directoryCategories = ["All", "Home & Garden", "Digital Services", "Consulting", "Retail"];
// Hub aliases supplement explicitly stored province names; this is not geocoding.
export const provinceHubs: Record<string, string[]> = {
  Gauteng: ["Johannesburg", "Pretoria", "Tshwane", "Sandton", "Soweto", "Centurion", "Midrand"],
  "Western Cape": ["Cape Town", "Stellenbosch", "Paarl", "George"],
  Mpumalanga: ["Secunda", "Mbombela", "Nelspruit", "Emalahleni", "Witbank", "Middelburg"],
  "KwaZulu-Natal": ["Durban", "Pietermaritzburg", "Umhlanga", "Richards Bay"],
};

export function savedCity(profile?: { location: string | null; locationCity: string | null } | null) {
  const location = profile?.location?.trim();
  // Older rows were assigned Secunda without asking the member. Do not infer residency.
  const city = location || (profile?.locationCity?.trim().toLowerCase() !== "secunda" ? profile?.locationCity?.trim() : "");
  return city?.split(",")[0].trim().slice(0, 100) || "";
}
export function directorySubtitle(city: string) {
  return city ? `Find your people and trusted partners in ${city} and across South Africa.` : "Find your people and trusted partners across South Africa.";
}

export async function readDirectory(db: Db, viewerId: string | undefined, params: { q?: string; city?: string; category?: string; page?: string }) {
  const [viewer] = viewerId ? await db.select({ location: users.location, locationCity: users.locationCity }).from(users).where(eq(users.id, viewerId)).limit(1) : [];
  const localCity = savedCity(viewer);
  const locations = [{ value: "", label: "All locations" }, ...(localCity ? [{ value: localCity, label: `${localCity} (Local)` }] : []),
    ...Object.keys(provinceHubs).filter(province => province !== localCity).map(province => ({ value: province, label: province }))];
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const city = typeof params.city === "string" ? params.city.trim().slice(0, 100) : "";
  const category = directoryCategories.includes(params.category || "") ? params.category! : "All";
  const page = Math.max(1, Math.min(100, Number.parseInt(params.page || "1", 10) || 1));
  const location = sql<string>`coalesce(nullif(trim(${users.location}),''), case when lower(trim(${users.locationCity}))<>'secunda' then trim(${users.locationCity}) else '' end)`;
  const cityPart = sql<string>`lower(trim(case when instr(${location},',')>0 then substr(${location},1,instr(${location},',')-1) else ${location} end))`;
  const pattern = `%${query.replaceAll("!", "!!").replaceAll("%", "!%").replaceAll("_", "!_")}%`;
  const province = Object.keys(provinceHubs).find(value => value.toLowerCase() === city.toLowerCase());
  const hubs = province ? [province, ...provinceHubs[province]].map(value => value.toLowerCase()) : [];
  const region = province ? sql`(${cityPart} in (${sql.join(hubs.map(hub => sql`${hub}`), sql`, `)}) or instr(',' || replace(lower(${location}), ', ', ',') || ',', ${`,` + province.toLowerCase() + `,`})>0)` : sql`${cityPart}=${city.toLowerCase()}`;
  const members = await db.select({ id: users.id, name: users.name,
    image: sql<string | null>`coalesce(${users.profilePhotoUrl},${users.image},${users.avatarUrl})`, bio: users.bio,
    businessName: users.businessName, businessCategory: users.businessCategory, locationCity: location,
    whatsappNumber: users.whatsappNumber, skills: users.skills,
    verified: sql<boolean>`(${users.isVerifiedPartner}=1 and exists(select 1 from subscriptions s where s.user_id=users.id and s.status in ('active','canceled') and s.current_period_end>unixepoch()))`.mapWith(Boolean),
  }).from(users).where(and(
    sql`${users.role}<>'system' and ${users.id}<>'system-zibuke-community'`,
    query ? sql`(${users.name} like ${pattern} escape '!' or ${users.businessName} like ${pattern} escape '!' or ${users.skills} like ${pattern} escape '!')` : undefined,
    city ? region : undefined,
    category === "Home & Garden" ? sql`${users.businessCategory} in ('Home & Garden','Landscaping','Gardening')` : category !== "All" ? eq(users.businessCategory, category) : undefined,
  )).orderBy(asc(users.name), asc(users.id)).limit(25).offset((page - 1) * 24);
  return { members, localCity, locations, query, city, category, page };
}
