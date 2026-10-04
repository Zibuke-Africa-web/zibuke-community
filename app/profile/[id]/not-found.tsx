import Link from "next/link";

export default function ProfileNotFound() {
  return <main className="grid min-h-screen place-content-center bg-slate-50 p-6 text-center"><h1 className="text-2xl font-bold text-slate-800">Profile not found</h1><p className="mt-3 text-slate-500">This member may no longer be part of the community.</p><Link href="/directory" className="mt-6 font-semibold text-brand-700">Find people in the directory →</Link></main>;
}
