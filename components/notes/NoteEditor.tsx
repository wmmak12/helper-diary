"use client";
import { useState } from "react";
import { Lock, Users } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { useMe, useT } from "@/lib/client/i18n";
import { api } from "@/lib/client/api";
import { ns } from "@/lib/strings/notes";
import { common } from "@/lib/strings/common";
import type { Collection, Note } from "@/lib/types";
import { PhotoButton, Photos, Sheet } from "@/components/ui";

type D = { title: string; body: string; collection_id: number | null; photos: string[]; shared: boolean };

/** Write or edit one of her notes, in her own language, private until she shares it. */
export function NoteEditor({ open, onClose, note, collections, defaultCollection, onSaved }: {
  open: boolean; onClose: () => void; note?: Note | null; collections: Collection[]; defaultCollection?: number | null; onSaved: (n: Note) => void;
}) {
  const t = useT(ns);
  const c = useT(common);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  const init = (): D => note
    ? { title: note.title, body: note.body, collection_id: note.collection_id, photos: note.photos, shared: note.shared }
    : { title: "", body: "", collection_id: defaultCollection ?? null, photos: [], shared: false };
  const [d, setD] = useState<D>(init);
  const [key, setKey] = useState("");
  const k = `${open}-${note?.id ?? "new"}-${note?.updated_at ?? 0}-${defaultCollection ?? ""}`;
  if (k !== key) { setKey(k); setD(init()); }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const set = (p: Partial<D>) => setD((x) => ({ ...x, ...p }));
  const empty = !d.title.trim() && !d.body.trim() && d.photos.length === 0;
  const noteLang = note?.lang ?? lang;
  return (
    <Sheet open={open} onClose={onClose} title={note ? t.editNote : t.newNote}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (empty) return;
        setBusy(true); setErr(false);
        try {
          const payload = { ...d, lang: noteLang };
          const r = note
            ? await api<{ note: Note }>(`/api/notes/${note.id}`, { method: "PATCH", body: payload })
            : await api<{ note: Note }>("/api/notes", { body: payload });
          onSaved(r.note);
          onClose();
        } catch { setErr(true); } finally { setBusy(false); }
      }}>
        <label className="block"><span lang={tag} className="mb-1 block text-[15px] text-muted">{t.noteTitle}</span>
          <input lang={langInfo(noteLang).tag} className="field" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} /></label>
        <label className="block"><span lang={tag} className="mb-1 block text-[15px] text-muted">{t.noteBody}</span>
          <textarea lang={langInfo(noteLang).tag} className="field" rows={7} value={d.body} onChange={(e) => set({ body: e.target.value })} /></label>
        {collections.length > 0 && (
          <label className="block"><span lang={tag} className="mb-1 block text-[15px] text-muted">{t.collection}</span>
            <select lang={tag} className="field" value={d.collection_id ?? ""} onChange={(e) => set({ collection_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t.noCollection}</option>
              {collections.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
            </select>
          </label>
        )}
        <div>
          <PhotoButton onAdded={(id) => set({ photos: [...d.photos, id] })} />
          <Photos ids={d.photos} onRemove={(id) => set({ photos: d.photos.filter((p) => p !== id) })} />
        </div>
        <ShareToggle shared={d.shared} onChange={(v) => set({ shared: v })} />
        {err && <p role="alert" lang={tag} className="text-danger">{t.saveFailed}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn btn-quiet flex-1" onClick={onClose}><span lang={tag}>{c.cancel}</span></button>
          <button className="btn btn-primary flex-1" disabled={busy || empty}>
            {busy ? <span className="ink-dots" aria-label={c.loading}><span /><span /><span /></span> : <span lang={tag}>{c.save}</span>}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function ShareToggle({ shared, onChange, disabled }: { shared: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useT(ns);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  return (
    <div className={`rounded-[6px] border p-3 ${shared ? "border-moss bg-moss-wash" : "border-rule bg-paper"}`}>
      <p lang={tag} className={`flex items-center gap-2 font-medium ${shared ? "text-moss" : "text-ink"}`}>
        {shared ? <Users size={20} strokeWidth={1.75} aria-hidden /> : <Lock size={20} strokeWidth={1.75} aria-hidden />}
        {shared ? t.shared : t.private}
      </p>
      <p lang={tag} className="mt-1 text-[15px] text-muted">{shared ? t.shareLine : t.privateLine}</p>
      <button type="button" disabled={disabled} className="btn btn-quiet btn-small mt-2" aria-pressed={shared} onClick={() => onChange(!shared)}>
        <span lang={tag}>{shared ? t.unshare : t.share}</span>
      </button>
    </div>
  );
}
