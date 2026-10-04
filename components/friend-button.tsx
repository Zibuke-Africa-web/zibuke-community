"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { requestFriend } from "@/app/profile/actions";

export function FriendButton({ targetId, status }: { targetId: string; status: "none" | "incoming" | "pending" | "accepted" | "blocked" }) {
  const [state, action, pending] = useActionState(requestFriend.bind(null, targetId), { ok: false, message: "" });
  const labels = { none: "Add Friend", incoming: "Accept request", pending: "Request sent", accepted: "Friends", blocked: "Unavailable" };
  return <form action={action}><button disabled={pending || ["pending", "accepted", "blocked"].includes(status)} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-600"><UserPlus size={17} />{pending ? "Saving…" : labels[status]}</button>{state.message && <p role="status" className={`mt-2 max-w-60 text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}</form>;
}
