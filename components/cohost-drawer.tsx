"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction, type FormEvent } from "react";
import { Copy, Send, Sparkles, Trash2, X } from "lucide-react";
import { readCoHostResponse, type CoHostMessage } from "@/lib/cohost";
import styles from "./cohost-drawer.module.css";

const CoHostContext = createContext<((prompt?: string) => void) | null>(null);
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current";
const suggestions = ["Draft an introduction post", "Explain GreenSpace Hub", "Show membership tiers", "Ask about Zibuke OnCall"];
type ChatEntry = CoHostMessage & { id: string };

export function useCoHost() {
  const open = useContext(CoHostContext);
  if (!open) throw new Error("Co-Host must be used inside CoHostProvider");
  return open;
}

export function CoHostProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  return <CoHostContext.Provider value={prompt => { if (prompt) setDraft(prompt); setOpen(true); }}>
    {children}
    <CoHostDrawer open={open} onClose={() => setOpen(false)} draft={draft} setDraft={setDraft} />
  </CoHostContext.Provider>;
}

export function CoHostDrawer({ open, onClose, draft, setDraft }: {
  open: boolean; onClose: () => void; draft: string; setDraft: Dispatch<SetStateAction<string>>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const history = useRef<CoHostMessage[]>([]);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    if (open && !dialog.current?.open) { dialog.current?.showModal(); input.current?.focus(); }
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "end", behavior: "instant" }); }, [messages, open]);
  useEffect(() => () => { request.current?.abort(); }, []);

  function close() { request.current?.abort(); onClose(); }
  function clear() {
    request.current?.abort(); request.current = null;
    history.current = []; setMessages([]); setPending(false); setNotice(""); setUnauthorized(false); setDraft(""); input.current?.focus();
  }

  async function copy(content: string) {
    try { await navigator.clipboard.writeText(content); setNotice("Copied to clipboard."); }
    catch { setNotice("Copy isn’t available. Select the response text to copy it."); }
  }

  async function send(event?: FormEvent<HTMLFormElement>, suggestion?: string) {
    event?.preventDefault();
    const content = (suggestion ?? draft).trim();
    if (!content || content.length > 4000 || request.current) return;
    // Only completed exchanges become model context. Keep whole user/assistant pairs.
    let context = history.current.slice(-18);
    while (context.length && context.reduce((sum, message) => sum + message.content.length, content.length) > 16000) context = context.slice(2);
    const controller = new AbortController(); request.current = controller;
    const userId = crypto.randomUUID(), replyId = crypto.randomUUID();
    setMessages(previous => [...previous, { id: userId, role: "user", content }, { id: replyId, role: "assistant", content: "" }]);
    setDraft(""); setPending(true); setNotice(""); setUnauthorized(false);
    let reply = "";
    try {
      const response = await fetch("/api/cohost/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...context, { role: "user", content }] }), signal: controller.signal,
      });
      if (request.current !== controller) { await response.body?.cancel(); return; }
      if (!response.ok) {
        if (response.status === 401) { setUnauthorized(true); throw new Error("Sign in again to chat with your Co-Host."); }
        if (response.status === 429) throw new Error("Co-Host is busy. Please wait a moment and try again.");
        if (response.status === 400) throw new Error("Please shorten your message or clear the chat and try again.");
        throw new Error("Co-Host is unavailable right now. Please try again shortly.");
      }
      reply = await readCoHostResponse(response);
      if (request.current !== controller) return;
      setMessages(previous => previous.map(message => message.id === replyId ? { ...message, content: reply } : message));
      history.current = [...context, { role: "user", content }, { role: "assistant", content: reply.slice(0, 4000) }];
      setNotice("Response complete.");
    } catch (error) {
      if (request.current !== controller) return;
      setMessages(previous => previous.filter(message => message.id !== replyId));
      setDraft(content);
      setNotice(controller.signal.aborted ? "Response stopped. Your message is ready to retry." : error instanceof Error && !(error instanceof SyntaxError) ? error.message : "Could not read the reply. Your message is ready to retry.");
    } finally {
      if (request.current === controller) { request.current = null; setPending(false); }
    }
  }

  return <dialog ref={dialog} id="cohost-drawer" aria-labelledby="cohost-title" onCancel={event => { event.preventDefault(); close(); }} onClose={close}
    className={`${styles.drawer} fixed inset-y-0 right-0 left-auto z-50 m-0 h-dvh max-h-dvh w-full max-w-xl border-l border-black bg-white p-0 text-black shadow-2xl`}>
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-black bg-black p-5 text-[#ccff00]">
        <h2 id="cohost-title" className="flex items-center gap-2 text-xl font-bold"><Sparkles aria-hidden="true" size={22} /> Zibuke Co-Host</h2>
        <div className="flex items-center gap-2"><button type="button" onClick={clear} aria-label="Clear chat" className={`rounded-lg p-2 hover:opacity-90 ${focus}`}><Trash2 size={19} /></button><button type="button" onClick={close} aria-label="Close Co-Host" className={`rounded-lg p-2 hover:opacity-90 ${focus}`}><X size={23} /></button></div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        <section className="rounded-2xl border border-black bg-[#ccff00] p-5 text-black"><h3 className="text-xs font-bold uppercase tracking-widest">Network at a Glance</h3><h4 className="mt-4 font-bold">Who You&apos;re Bringing Together</h4><p className="mt-1 text-sm leading-6">Neighbours, creators, local entrepreneurs and people who care for their homes and communities.</p><h4 className="mt-4 font-bold">What&apos;s Possible</h4><p className="mt-1 text-sm leading-6">New connections, shared skills, stronger local businesses, and ideas you can build together.</p></section>
        <p className="my-5 text-sm leading-6">Let&apos;s turn a small idea into a conversation. I can help you find your people, draft a post, or explore the community.</p>
        <div className="flex flex-wrap gap-2">{suggestions.map(suggestion => <button key={suggestion} disabled={pending} onClick={() => void send(undefined, suggestion)} className={`rounded-full border border-black bg-white px-3 py-2 text-left text-xs font-semibold text-black hover:opacity-90 disabled:cursor-wait ${focus}`}>{suggestion}</button>)}</div>
        <div role="log" aria-label="Co-Host conversation" aria-live="off" className="mt-6 space-y-4">
          {messages.map(message => <article key={message.id} className={`rounded-2xl border border-black p-4 ${message.role === "user" ? "ml-6 bg-black text-[#ccff00]" : "mr-2 bg-white text-black"}`}>
            <p className="mb-2 text-xs font-bold">{message.role === "user" ? "You" : "Zibuke Co-Host"}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content || "Thinking…"}</p>
            {message.role === "assistant" && message.content && <button onClick={() => void copy(message.content)} className={`mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs font-bold text-black hover:opacity-90 ${focus}`}><Copy size={14} aria-hidden="true" />Copy text</button>}
          </article>)}
        </div>
        <div ref={end} />
      </div>
      <footer className="border-t border-black bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-black">
        <p role="status" aria-live="polite" className="mb-3 text-xs">{pending ? "Co-Host is responding…" : notice}{unauthorized && <Link href="/login?callbackUrl=%2Ffeed" className="ml-2 font-bold underline hover:opacity-90">Sign in</Link>}</p>
        <form onSubmit={event => void send(event)}><label htmlFor="cohost-input" className="sr-only">Message your Co-Host</label><textarea ref={input} id="cohost-input" value={draft} onChange={event => setDraft(event.target.value)} disabled={pending} maxLength={4000} rows={3} placeholder="What would you like to build together?" className="w-full resize-none rounded-xl border border-black bg-white p-3 text-sm text-black placeholder:text-black focus-visible:outline-2 focus-visible:outline-black" />
          <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs">{draft.length}/4,000</span>{pending ? <button type="button" onClick={() => request.current?.abort()} className={`rounded-full bg-black px-5 py-2 font-bold text-[#ccff00] hover:opacity-90 ${focus}`}>Stop</button> : <button type="submit" disabled={!draft.trim()} className={`inline-flex items-center gap-2 rounded-full bg-[#ccff00] px-5 py-2 font-bold text-black hover:scale-[1.01] disabled:cursor-not-allowed ${focus}`}>Send <Send size={16} aria-hidden="true" /></button>}</div>
        </form>
        <p className="mt-3 text-[10px] leading-4">AI can make mistakes. Messages are sent to Groq to generate replies. Chat stays in this page session; Clear Chat removes it here.</p>
      </footer>
    </div>
  </dialog>;
}
