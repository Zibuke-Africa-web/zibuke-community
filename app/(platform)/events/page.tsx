import Link from "next/link";
import { CalendarDays } from "lucide-react";

export const metadata = { title: "Events · Zibuke Community" };
export default function EventsPage() {
  return <section className="space-y-5"><h1 className="text-2xl font-bold">Events</h1><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><CalendarDays size={36} className="mx-auto text-brand-600" /><h2 className="mt-4 text-lg font-semibold">A place to come together</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Community events are coming soon. In the meantime, find a group and connect with people who share your interests.</p><Link href="/groups" className="mt-5 inline-block font-semibold text-brand-700">Explore groups →</Link></div></section>;
}
