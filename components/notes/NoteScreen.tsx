"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { m } from "motion/react";
import { Pencil, Trash2 } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { api } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { ns } from "@/lib/strings/notes";
import { common } from "@/lib/strings/common";
import type { Collection, Note } from "@/lib/types";
import { InkIn, LoadError, PageHeader, Photos, Skeleton, Tr } from "@/components/ui";
import { when } from "@/components/notebook/shared";
import { NoteEditor, ShareToggle } from "./NoteEditor";

export function NoteScreen({ id }: { id: number }) {
  const t = useT(ns);
  const c = useT(common);
  const { me, lang, toast } = useMe();
  const tag = langInfo(lang).tag;
  const router = useRouter();
  const { data, setData, error, loading, reload } = useApi<{ note: Note }>(`/api/notes/${id}`);
  const cols = useApi<{ collections: Collection[] }>(data?.note.owner_id === me.id ? "/api/collections" : null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(0);
  const [busy, setBusy] = useState(false);
  const n = data?.note;
  const mine = n?.owner_id === me.id;

  const body = n && (
    <article className="ruled page relative px-4 py-4 pl-[64px]">
      {n.title && <Tr as="h2" className="text-[22px] font-semibold" text={n.title} lang={n.lang} tr={n.title_tr} />}
      {n.body && <Tr as="p" className="mt-3 text-[18px]" text={n.body} lang={n.lang} tr={n.body_tr} />}
      <Photos ids={n.photos} />
      <p lang={tag} className="mt-4 text-[15px] text-muted">
        {n.collection_name && <>{n.collection_name} · </>}
        {!mine && <>{fmt(t.by, { name: n.owner_name })} · </>}
        <span className="tabular">{when(n.updated_at, lang)}</span>
      </p>
    </article>
  );

  return (
    <m.div className="mx-auto max-w-[720px]" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
      <PageHeader title={me.role === "helper" ? t.title : t.sharedTitle} back="/notes" />
      {loading && <Skeleton rows={5} />}
      {error && <LoadError error={error} onRetry={reload} />}
      {n && (saved ? <InkIn k={saved}>{body}</InkIn> : body)}
      {n && mine && (
        <div className="mt-4 space-y-3">
          <ShareToggle shared={n.shared} disabled={busy} onChange={async (v) => {
            setBusy(true);
            try { const r = await api<{ note: Note }>(`/api/notes/${n.id}`, { method: "PATCH", body: { shared: v } }); setData({ note: r.note }); }
            catch { toast({ text: t.saveFailed, tone: "error" }); } finally { setBusy(false); }
          }} />
          <div className="flex gap-2">
            <button className="btn btn-quiet flex-1" onClick={() => setEditing(true)}><Pencil size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{c.edit}</span></button>
            <button className="btn btn-danger flex-1" onClick={async () => {
              if (!confirm(c.confirmRemove)) return;
              try { await api(`/api/notes/${n.id}`, { method: "DELETE" }); toast({ text: t.deleted }); router.push("/notes"); }
              catch { toast({ text: c.offline, tone: "error" }); }
            }}><Trash2 size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.deleteNote}</span></button>
          </div>
        </div>
      )}
      {n && mine && (
        <NoteEditor open={editing} note={n} collections={cols.data?.collections ?? []} onClose={() => setEditing(false)}
          onSaved={(x) => { setData({ note: x }); setSaved(Date.now()); toast({ text: c.saved }); }} />
      )}
    </m.div>
  );
}
