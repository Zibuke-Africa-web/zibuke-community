"use client";
import { useState, useTransition } from "react";
import { rsvpEventAction, cancelRsvpAction } from "@/actions/events";

export function EventRsvp({ eventId, attending, count }: { eventId: string; attending: boolean; count: number }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return <div className="mt-auto pt-5"><p className="mb-3 text-sm">{count} attending</p><button aria-pressed={attending} disabled={pending} onClick={() => start(async () => {
    try { const result = await (attending ? cancelRsvpAction(eventId) : rsvpEventAction(eventId)); setMessage(result.message); }
    catch { setMessage("Could not update your RSVP. Please try again."); }
  })} className={`rounded-full px-5 py-3 font-bold hover:opacity-90 disabled:opacity-60 ${attending ? "bg-black text-[#ccff00]" : "bg-[#ccff00] text-black"}`}>{pending ? "Saving…" : attending ? "Attending · Cancel RSVP" : "RSVP Now"}</button><p role="status" className="mt-2 text-sm">{message}</p></div>;
}
