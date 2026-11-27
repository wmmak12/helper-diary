"use client";
import Link from "next/link";
import { useState } from "react";
import { m } from "motion/react";
import { Lock, Pencil, Plus, Trash2, Users } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { useMe, useT } from "@/lib/client/i18n";
import { api, photoUrl } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { ns } from "@/lib/strings/notes";
import { common } from "@/lib/strings/common";
import type { Collection, Note } from "@/lib/types";
import { Empty, InkIn, LoadError, PageHeader, Sheet, Skeleton, Tr } from "@/components/ui";
import { NotebookSwitch, when } from "@/components/notebook/shared";
import { NoteEditor } from "./NoteEditor";

export function NotesScreen() {
  const t = useT(ns);
  const c = useT(common);
  const { me, lang, toast } = useMe();
  const tag = langInfo(lang).tag;
  const helper = me.role === "helper";
  const { data, setData, error, loading, reload } = useApi<{ notes: Note[]; collections: Collection[] }>("/api/notes");
  const [filter, setFilter] = useState<number | "all">("all");
  const [editor, setEditor] = useState(false);
  const [justSaved, setJustSaved] = useState<number | null>(null);
  const [manage, setManage] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);

  const all = data?.notes ?? [];
  // the helper sees her own notes; employers see what was shared with them
  const visible = helper ? all.filter((n) => n.owner_id === me.id) : all.filter((n) => n.shared && n.owner_id !== me.id);
  const collections = helper ? (data?.collections ?? []) : [];
  const shown = filter === "all" ? visible : visible.filter((n) => n.collection_id === filter);

  const addCollection = async () => {
    if (!newName.trim()) return;
    try {
      const r = await api<{ collection: Collection }>("/api/collections", { body: { name: newName } });
      setNewName("");
      setData({ notes: all, collections: [...collections.filter((x) => x.id !== r.collection.id), r.collection].sort((a, b) => a.name.localeCompare(b.name)) });
      setFilter(r.collection.id);
    } catch { toast({ text: c.offline, tone: "error" }); }
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title={helper ? t.title : t.sharedTitle}>
        {helper && (
          <button className="btn btn-primary btn-small" onClick={() => setEditor(true)}>
            <Plus size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.newNote}</span>
          </button>
        )}
      </PageHeader>
      <NotebookSwitch />
      {loading && <Skeleton rows={5} />}
      {error && <LoadError error={error} onRetry={reload} />}
      {data && helper && (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label={t.collections}>
          {[{ id: "all" as const, name: t.all }, ...collections].map((col) => (
            <button key={col.id} aria-pressed={filter === col.id} onClick={() => setFilter(col.id)}
              lang={col.id === "all" ? tag : undefined}
              className={`min-h-[44px] rounded-full border-[1.5px] px-4 text-[16px] ${filter === col.id ? "border-primary bg-primary text-on-primary" : "border-field bg-paper text-ink"}`}>
              {col.name}
            </button>
          ))}
          <button className="btn btn-small text-muted hover:text-ink" onClick={() => setManage(true)}>
            <Plus size={20} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.collections}</span>
          </button>
        </div>
      )}
      {data && shown.length === 0 && (
        helper
          ? <Empty img="notebook" title={t.emptyTitle} line={t.emptyLine}><button className="btn btn-primary" onClick={() => setEditor(true)}><span lang={tag}>{t.newNote}</span></button></Empty>
          : <Empty img="notebook" title={t.emptyShared} line={t.emptySharedLine} />
      )}
      {shown.length > 0 && (
        <ul className="page divide-y divide-rule">
          {shown.map((n) => {
            const row = (
              <Link href={`/notes/${n.id}`} className="flex gap-3 p-4">
                <div className="min-w-0 flex-1">
                  {n.title && <Tr as="h3" className="text-[20px] font-medium" text={n.title} lang={n.lang} tr={n.title_tr} noToggle />}
                  {n.body && <Tr as="p" className="mt-0.5 line-clamp-2 text-[18px] [&_[lang=my]]:leading-[1.95]" text={n.body} lang={n.lang} tr={n.body_tr} noToggle />}
                  <p lang={tag} className="mt-1 flex flex-wrap items-center gap-x-2 text-[15px] text-muted">
                    {n.shared ? <Users size={16} strokeWidth={1.75} aria-label={t.shared} className="text-moss" /> : <Lock size={16} strokeWidth={1.75} aria-label={t.private} />}
                    {n.collection_name && <span>{n.collection_name}</span>}
                    {!helper && <span>{n.owner_name}</span>}
                    <span className="tabular">{when(n.updated_at, lang)}</span>
                  </p>
                </div>
                {n.photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl(n.photos[0])} alt="" className="h-20 w-20 shrink-0 rounded-[6px] border border-rule object-cover" loading="lazy" />
                )}
              </Link>
            );
            return (
              <m.li key={n.id} layout transition={{ duration: 0.22 }}>
                {justSaved === n.id ? <InkIn k={n.updated_at}>{row}</InkIn> : row}
              </m.li>
            );
          })}
        </ul>
      )}
      {helper && (
        <NoteEditor open={editor} onClose={() => setEditor(false)} collections={collections} defaultCollection={filter === "all" ? null : filter}
          onSaved={(n) => { setData({ notes: [n, ...all], collections }); setJustSaved(n.id); reload(); }} />
      )}
      <Sheet open={manage} onClose={() => { setManage(false); setRenaming(null); }} title={t.collections}>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addCollection(); }}>
          <input lang={tag} className="field" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.collectionName} aria-label={t.newCollection} maxLength={60} />
          <button className="btn btn-primary" disabled={!newName.trim()}><span lang={tag}>{t.createCollection}</span></button>
        </form>
        <ul className="mt-4 divide-y divide-rule">
          {collections.map((col) => (
            <li key={col.id} className="flex items-center gap-2 py-2">
              {renaming?.id === col.id ? (
                <form className="flex flex-1 gap-2" onSubmit={async (e) => {
                  e.preventDefault();
                  try { await api(`/api/collections/${col.id}`, { method: "PATCH", body: { name: renaming.name } }); setRenaming(null); reload(); }
                  catch { toast({ text: c.offline, tone: "error" }); }
                }}>
                  <input className="field" value={renaming.name} onChange={(e) => setRenaming({ id: col.id, name: e.target.value })} aria-label={t.rename} autoFocus />
                  <button className="btn btn-primary btn-small"><span lang={tag}>{c.save}</span></button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-[18px]">{col.name} <span className="tabular text-[15px] text-muted">· {col.count}</span></span>
                  <button className="flex h-11 w-11 items-center justify-center text-muted hover:text-ink" aria-label={t.rename} onClick={() => setRenaming({ id: col.id, name: col.name })}><Pencil size={20} strokeWidth={1.75} /></button>
                  <button className="flex h-11 w-11 items-center justify-center text-danger" aria-label={t.deleteCollection} onClick={async () => {
                    if (!confirm(t.deleteCollectionConfirm)) return;
                    try { await api(`/api/collections/${col.id}`, { method: "DELETE" }); if (filter === col.id) setFilter("all"); reload(); }
                    catch { toast({ text: c.offline, tone: "error" }); }
                  }}><Trash2 size={20} strokeWidth={1.75} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
