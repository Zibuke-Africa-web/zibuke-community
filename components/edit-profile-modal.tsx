"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { saveProfile } from "@/app/profile/actions";

type Props = { bio: string | null; websiteUrl: string | null; socialLinks: Record<string, string> };
const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-brand-600";

export function EditProfileModal(props: Props) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  return <div>
    <button type="button" onClick={() => { setSaved(false); setOpen(true); }} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><Pencil size={16} />Edit Profile</button>
    {saved && <p role="status" className="mt-2 text-xs text-emerald-700">Profile saved.</p>}
    {open && <ProfileDialog {...props} onClose={() => setOpen(false)} onSaved={() => { setSaved(true); setOpen(false); }} />}
  </div>;
}

function ProfileDialog({ bio, websiteUrl, socialLinks, onClose, onSaved }: Props & { onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(bio ?? "");
  const [website, setWebsite] = useState(websiteUrl ?? "");
  const [links, setLinks] = useState(() => Object.entries(socialLinks).map(([platform, url], id) => ({ id, platform, url })));
  const nextId = useRef(links.length);
  const [state, action, pending] = useActionState(saveProfile, { ok: false, message: "" });
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);

  return <dialog ref={dialog} aria-labelledby="edit-profile-title" onCancel={event => { if (pending) event.preventDefault(); }} onClose={onClose} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50">
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4"><h2 id="edit-profile-title" className="text-xl font-bold">Edit your profile</h2><button type="button" aria-label="Close edit profile" disabled={pending} onClick={onClose} className="grid size-10 place-items-center rounded-full bg-slate-100 disabled:opacity-50"><X size={20} /></button></div>
    <form action={action} className="space-y-5 p-6">
      <p className="text-sm text-slate-500">Tell the community a little about yourself. These details are public.</p>
      <label className="block text-sm font-semibold">Bio<textarea autoFocus name="bio" rows={4} maxLength={1000} value={text} onChange={event => setText(event.target.value)} className={inputClass} placeholder="What makes you, you?" /></label>
      <label className="block text-sm font-semibold">Website<input name="websiteUrl" type="url" maxLength={2048} value={website} onChange={event => setWebsite(event.target.value)} className={inputClass} placeholder="https://your-website.co.za" /></label>
      <fieldset disabled={pending}><legend className="text-sm font-semibold">Social links</legend><div className="mt-2 space-y-3">{links.map(link => <div key={link.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><label className="flex-1 text-xs text-slate-600">Platform<input maxLength={40} value={link.platform} onChange={event => setLinks(links.map(row => row.id === link.id ? { ...row, platform: event.target.value } : row))} className={inputClass} placeholder="Instagram" /></label><button type="button" aria-label={`Remove ${link.platform || "social"} link`} onClick={() => setLinks(links.filter(row => row.id !== link.id))} className="mt-5 grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={17} /></button></div><label className="mt-3 block text-xs text-slate-600">URL<input type="url" maxLength={2048} value={link.url} onChange={event => setLinks(links.map(row => row.id === link.id ? { ...row, url: event.target.value } : row))} className={inputClass} placeholder="https://…" /></label></div>)}</div><button type="button" disabled={links.length >= 10} onClick={() => setLinks([...links, { id: nextId.current++, platform: "", url: "" }])} className="mt-3 flex min-h-10 items-center gap-2 text-sm font-semibold text-brand-700 disabled:opacity-40"><Plus size={16} />Add a social link</button></fieldset>
      <input type="hidden" name="socialLinks" value={JSON.stringify(links.map(({ platform, url }) => ({ platform, url })))} />
      {state.message && !state.ok && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.message}</p>}
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={pending} onClick={onClose} className="rounded-lg px-4 py-3 text-sm font-semibold text-slate-600">Cancel</button><button disabled={pending} className="min-w-32 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save changes"}</button></div>
    </form>
  </dialog>;
}
