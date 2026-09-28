import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";

export const metadata: Metadata = {
  title: "Messages · Zibuke Community",
  description: "Direct conversations with people and groups in Zibuke Community.",
};

export default function MessagesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
        <p className="max-w-[68ch] text-sm leading-relaxed text-stone-600">
          Direct conversations with people and groups in Zibuke Community.
        </p>
      </header>

      <section className="flex flex-col items-center rounded-xl border border-stone-200 bg-white px-6 py-12 text-center shadow-sm">
        <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
          <MessageSquare aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-4 text-sm font-semibold">No conversations yet</h2>
        <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-stone-600">
          Messages you send and receive appear here, newest first.
        </p>
      </section>
    </div>
  );
}
