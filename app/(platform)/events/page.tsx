import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Video } from "lucide-react";
import { getUpcomingEvents } from "@/actions/events";
import { EventRsvp } from "@/components/event-rsvp";
import { eventFilters } from "@/lib/community";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community Workshops & Live Sessions | Zibuke" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const raw = (await searchParams).category;
  const selected = eventFilters.find(item => item === raw) || "All Events";
  const result = await getUpcomingEvents(selected);
  return <section className="space-y-6 bg-white text-black">
    <header className="rounded-3xl bg-[#0d140e] p-7 text-[#ccff00]"><CalendarDays size={28} aria-hidden="true" /><h1 className="mt-4 text-3xl font-black">Community Workshops &amp; Live Sessions</h1><p className="mt-3">Learn together, share what you know, and meet your community. All times shown in South African Standard Time.</p></header>
    <nav aria-label="Event categories" className="flex flex-wrap gap-2">{eventFilters.map(filter => <Link key={filter} href={`/events?category=${encodeURIComponent(filter)}`} aria-current={filter === selected ? "page" : undefined} className={`rounded-full border border-black px-4 py-2 text-sm font-bold hover:opacity-90 ${filter === selected ? "bg-[#ccff00] text-black" : "bg-white text-black"}`}>{filter}</Link>)}</nav>
    {!result.ok ? <p role="alert" className="rounded-xl border border-black p-6">Events could not load. Please refresh to try again.</p> : !result.events.length ? <p className="rounded-xl border border-black p-6">No upcoming sessions in this category yet. Check back for the next workshop.</p> : <div className="grid gap-5 md:grid-cols-2">{result.events.map(event => {
      const date = new Date(event.startTime);
      return <article key={event.id} className="flex flex-col overflow-hidden rounded-2xl border border-black bg-white text-black">
        {event.coverImage && <Image unoptimized src={event.coverImage} alt="" width={640} height={280} className="h-40 w-full object-cover" />}
        <div className="flex flex-1 flex-col p-6"><div className="flex items-start justify-between gap-3"><time dateTime={event.startTime} className="rounded-xl bg-[#ccff00] px-4 py-2 text-center font-bold text-black"><span className="block text-xs uppercase">{date.toLocaleDateString("en-ZA", { month: "short", timeZone: "Africa/Johannesburg" })}</span><span className="text-2xl">{date.toLocaleDateString("en-ZA", { day: "2-digit", timeZone: "Africa/Johannesburg" })}</span></time><span className="text-xs font-bold">{event.category}</span></div>
        <h2 className="mt-4 text-xl font-bold">{event.title}</h2><p className="mt-2 text-sm">Hosted by {event.hostName}</p><p className="mt-1 text-sm">{date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })} SAST · {event.isVirtual ? "Virtual session" : "In-person workshop"}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6">{event.description}</p>
        {event.meetUrl && <a href={event.meetUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-2 break-all text-sm font-bold underline hover:opacity-90"><Video size={18} aria-hidden="true" />Live room · {new URL(event.meetUrl).hostname}</a>}
        {event.canAttend || event.isAttending ? <EventRsvp eventId={event.id} attending={event.isAttending} count={event.rsvpCount} /> : <Link href={`/spaces/${event.spaceSlug}`} className="mt-5 rounded-full bg-black px-4 py-3 text-center font-bold text-[#ccff00] hover:opacity-90">Join this space to attend</Link>}
        </div>
      </article>;
    })}</div>}
  </section>;
}
