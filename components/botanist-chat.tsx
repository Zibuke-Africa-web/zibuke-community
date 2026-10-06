"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Camera, Leaf, Upload, X } from "lucide-react";
import { MAX_PHOTO_BYTES, MAX_PROMPT_LENGTH, ONCALL_TRIGGER, ONCALL_URL, type BotanistReply } from "@/lib/botanist";

const button = "inline-flex items-center justify-center gap-2 rounded-full bg-[#ccff00] px-5 py-3 font-bold text-black transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60";

export function BotanistChat() {
  const id = useId();
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const reader = useRef<FileReader | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [prompt, setPrompt] = useState("");
  const [photo, setPhoto] = useState<{ data: string; name: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BotanistReply | null>(null);

  useEffect(() => () => { reader.current?.abort(); controller.current?.abort(); }, []);

  function selectPhoto(file?: File) {
    if (!file) return;
    reader.current?.abort();
    setError(""); setResult(null); setReading(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_PHOTO_BYTES || !file.size) {
      setError("Choose a JPEG, PNG or WebP photo under 3 MB."); return;
    }
    setReading(true);
    const next = new FileReader();
    reader.current = next;
    next.onload = () => { setPhoto({ data: String(next.result), name: file.name }); setReading(false); };
    next.onerror = () => { setError("The photo could not be read. Please try again."); setReading(false); };
    next.readAsDataURL(file);
  }

  async function diagnose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reading || !prompt.trim()) return;
    setBusy(true); setError(""); setResult(null);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 65000);
    try {
      const response = await fetch("/api/botanist/diagnose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, imageBase64: photo?.data }), signal: abort.signal,
      });
      const value: unknown = await response.json();
      if (!value || typeof value !== "object") throw new Error("An incomplete diagnosis was received. Please try again.");
      const data = value as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Diagnosis unavailable. Please try again.");
      if (typeof data.reply !== "string" || typeof data.isServiceRecommended !== "boolean") throw new Error("An incomplete diagnosis was received. Please try again.");
      setResult({ reply: data.reply, isServiceRecommended: data.isServiceRecommended });
    } catch (cause) {
      setError(abort.signal.aborted ? "The diagnosis timed out. Please try again." : cause instanceof Error ? cause.message : "Could not connect. Please try again.");
    } finally { clearTimeout(timeout); setBusy(false); }
  }

  return <section aria-labelledby={`${id}-title`} className="rounded-3xl border border-black bg-white p-6 text-black md:p-8">
    <div className="flex items-center gap-3"><Leaf aria-hidden="true" /><h2 id={`${id}-title`} className="text-2xl font-black">Botanist AI Agent</h2></div>
    <p className="mt-3 leading-relaxed">Local knowledge for your South African garden. Ask about a plant, lawn or seasonal care, and add a photo for a closer look.</p>
    <form onSubmit={diagnose} className="mt-6 space-y-4" aria-busy={busy}>
      <label htmlFor={`${id}-prompt`} className="block font-bold">What’s happening in your garden?</label>
      <textarea id={`${id}-prompt`} required maxLength={MAX_PROMPT_LENGTH} rows={4} value={prompt} disabled={busy} onChange={event => { setPrompt(event.target.value); setResult(null); }} placeholder="Why are my clivia leaves turning brown? I’m in Johannesburg…" className="w-full resize-y rounded-xl border border-black bg-white p-4 text-black placeholder:text-black focus-visible:outline-2 focus-visible:outline-black" />
      <p id={`${id}-photo-help`} className="text-sm">Optional: JPEG, PNG or WebP, up to 3 MB. Your question and photo are sent to Groq for analysis.</p>
      <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Choose plant photo" onChange={event => { selectPhoto(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" aria-label="Capture plant photo" onChange={event => { selectPhoto(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="flex flex-wrap gap-3">
        <button type="button" className={button} disabled={busy || reading} aria-describedby={`${id}-photo-help`} onClick={() => upload.current?.click()}><Upload size={18} aria-hidden="true" />Upload photo</button>
        <button type="button" className={button} disabled={busy || reading} onClick={() => camera.current?.click()}><Camera size={18} aria-hidden="true" />Take photo</button>
      </div>
      {reading && <p role="status">Reading your photo…</p>}
      {photo && <div className="relative w-40">
        <Image unoptimized src={photo.data} alt="Selected plant photo" width={160} height={160} className="h-40 w-40 rounded-xl border border-black object-cover" />
        <button type="button" disabled={busy || reading} aria-label="Remove plant photo" onClick={() => { setPhoto(null); setResult(null); }} className="absolute right-2 top-2 rounded-full bg-black p-2 text-[#ccff00] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"><X size={16} aria-hidden="true" /></button>
        <p className="mt-2 break-words text-sm">{photo.name}</p>
      </div>}
      <button type="submit" className={button} disabled={busy || reading || !prompt.trim()}>{busy ? "Examining your garden…" : "Get plant advice"}</button>
    </form>
    <div aria-live="polite" aria-atomic="true">{busy && <p role="status" className="mt-4">Preparing your diagnosis. This may take a moment.</p>}</div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-black bg-white p-4 text-black">{error}{error === "Sign in to use the Botanist AI Agent." && <Link href="/login?callbackUrl=%2Fspaces%2Fgreenspace-hub" className="ml-2 font-bold underline hover:opacity-90">Sign in</Link>}</p>}
    {result && <article aria-live="polite" className="mt-6 rounded-2xl bg-[#0d140e] p-6 text-[#ccff00]">
      <h3 className="text-lg font-bold">Your garden diagnosis</h3>
      <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed">{result.reply.replace(ONCALL_TRIGGER, "").trim()}</p>
      <p className="mt-4 text-sm">AI guidance can be mistaken; confirm the cause before treating your plant.</p>
      {result.isServiceRecommended && <div className="mt-6"><p className="mb-3">Need physical maintenance or site cleanup? Book directly through Zibuke OnCall.</p><a href={ONCALL_URL} target="_blank" rel="noopener noreferrer" className={button}>Book Zibuke OnCall Service<span className="sr-only"> (opens in a new tab)</span></a></div>}
    </article>}
  </section>;
}
