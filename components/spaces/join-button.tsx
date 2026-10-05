"use client";

import { useFormStatus } from "react-dom";

export function JoinButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex items-center justify-center rounded-full bg-[#ccff00] px-5 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current disabled:cursor-wait">{pending ? "Joining…" : "Join"}</button>;
}
