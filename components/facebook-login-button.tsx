"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function FacebookLoginButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setPending(true);
    setError(null);
    try {
      await signIn('facebook', { callbackUrl: '/feed' });
    } catch {
      setError("Facebook sign-in could not start. Please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-[#1877F2] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#166FE5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2] disabled:cursor-wait disabled:opacity-70"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-6 shrink-0" fill="currentColor">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.021 10.125 11.927v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.931-1.956 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.099 24 12.073Z" />
        </svg>
        {pending ? "Connecting…" : "Continue with Facebook"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
