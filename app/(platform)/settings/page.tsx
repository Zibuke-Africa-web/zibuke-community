import Link from "next/link";

export const metadata = { title: "Settings · Zibuke Community" };
export default function SettingsPage() {
  return <section className="space-y-5"><h1 className="text-2xl font-bold">Settings</h1><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Your public profile</h2><p className="mt-2 text-sm leading-6 text-slate-500">Manage your bio, website and social links from your profile.</p><Link href="/profile" className="mt-4 inline-block font-semibold text-brand-700">View and edit your profile →</Link></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Photos and profile setup</h2><p className="mt-2 text-sm text-slate-500">Update your profile pictures and other details.</p><Link href="/profile/setup" className="mt-4 inline-block font-semibold text-brand-700">Open profile setup →</Link></div></section>;
}
