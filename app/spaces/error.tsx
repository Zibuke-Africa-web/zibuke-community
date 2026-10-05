"use client";

export default function SpacesError({ reset }: { reset: () => void }) {
  return <section role="alert" className="rounded-3xl border border-black bg-white p-8 text-black"><h1 className="text-2xl font-bold">Spaces couldn’t load</h1><p className="my-4">Please try again in a moment.</p><button onClick={reset} className="rounded-full bg-[#ccff00] px-5 py-3 font-bold text-black hover:opacity-90">Try again</button></section>;
}
