"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function logout() {
    setPending(true);
    setError(false);
    try {
      await signOut({ callbackUrl: "/login" });
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return <div className="relative shrink-0">
    <button type="button" onClick={logout} disabled={pending} className="min-h-11 whitespace-nowrap rounded-full border border-black bg-white px-3 text-sm font-semibold text-black hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black disabled:cursor-wait disabled:opacity-60">
      {pending ? "Signing out…" : "Sign out"}
    </button>
    {error && <p role="alert" className="absolute top-full right-0 z-50 mt-2 w-56 rounded-lg border border-black bg-white p-3 text-sm text-black">Could not sign out. Please try again.</p>}
  </div>;
}
