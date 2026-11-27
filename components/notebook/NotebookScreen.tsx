"use client";
import Link from "next/link";
import { useState } from "react";
import { AutoMark } from "@/components/drafts/AutoAdded";
import { m } from "motion/react";
import { ArrowDown, ArrowUp, Pencil, Pin, Plus } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { useMe, useT } from "@/lib/client/i18n";
import { api } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { nb } from "@/lib/strings/notebook";
import { common } from "@/lib/strings/common";
import { SECTIONS, type Entry, type Section } from "@/lib/types";
import { Empty, LoadError, PageHeader, Skeleton, Tr } from "@/components/ui";
import { Confirmation, EntryEditor, NotebookSwitch, PhoneLink } from "./shared";

export function NotebookScreen() {
  const t = useT(nb);
  const c = useT(common);
  const { me, lang, toast } = useMe();
  const tag = langInfo(lang).tag;
  const employer = me.role === "employer";
  const { data, setData, error, loading, reload } = useApi<{ entries: Entry[] }>("/api/entries");
  const [editor, setEditor] = useState<{ entry: Entry | null; section?: Section } | null>(null);
  const entries = data?.entries ?? [];
  const emergency = entries.filter((e) => e.emergency);

  const move = async (section: Section, id: number, dir: -1 | 1) => {
    const list = entries.filter((e) => e.section === section);
    const i = list.findIndex((e) => e.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const ids = list.map((e) => e.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const order = new Map(ids.map((x, n) => [x, n]));
    setData({ entries: [...entries].sort((a, b) => (a.section === b.section && a.section === section ? order.get(a.id)! - order.get(b.id)! : 0)) });
    try { await api("/api/entries/reorder", { body: { section, ids } }); } catch { toast({ text: c.offline, tone: "error" }); reload(); }
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title={c.notebook}>
        {employer && (
          <button className="btn btn-primary btn-small" onClick={() => setEditor({ entry: null, section: entries.some((e) => e.section === "purpose") ? "rules" : "purpose" })}>
            <Plus size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.addEntry}</span>
          </button>
        )}
      </PageHeader>
      <NotebookSwitch />
      {loading && <Skeleton rows={6} />}
      {error && <LoadError error={error} onRetry={reload} />}
      {data && entries.length === 0 && (
        <Empty img="notebook" title={t.emptyTitle} line={employer ? t.emptyLine : t.emptyLineHelper}>
          {employer && <button className="btn btn-primary" onClick={() => setEditor({ entry: null, section: "purpose" })}><span lang={tag}>{t.addFirst}</span></button>}
        </Empty>
      )}
      {data && entries.length > 0 && (
        <div className="space-y-8">
          {SECTIONS.map((s) => {
            const list = entries.filter((e) => e.section === s);
            return (
              <section key={s} aria-labelledby={`sec-${s}`} className="relative">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 id={`sec-${s}`} lang={tag} className={`font-semibold ${s === "purpose" ? "text-ribbon-ink" : ""} ${lang === "my" ? "text-[22px]" : "text-[24px]"}`}>{t[s]}</h2>
                  {employer && (
                    <button className="btn btn-small text-muted hover:text-ink" onClick={() => setEditor({ entry: null, section: s })} aria-label={`${t.addEntry}: ${t[s]}`}>
                      <Plus size={20} strokeWidth={1.75} aria-hidden />
                    </button>
                  )}
                </div>
                <div className={`ruled page relative overflow-visible ${s === "purpose" ? "pt-2" : ""}`}>
                  {s === "purpose" && list.length > 0 && <span aria-hidden className="ribbon right-5" />}
                  {list.length === 0 && <p lang={tag} className="py-4 pl-[64px] pr-4 text-muted">{t[`${s}Empty` as keyof typeof t]}</p>}
                  <ul>
                    {list.map((e, i) => (
                      <m.li key={e.id} layout transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className={`relative border-b border-rule last:border-b-0 ${e.is_new ? "bg-ribbon-wash" : ""}`}>
                        <div className="flex gap-2 py-3 pl-[64px] pr-3">
                          <Link href={`/notebook/${e.id}`} className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              {e.emergency && <Pin size={16} strokeWidth={1.75} className="text-ribbon-ink" aria-label={t.pinned} />}
                              <Tr as="h3" className="text-[20px] font-medium" text={e.title} lang={e.lang} tr={e.title_tr} noToggle />
                              {e.is_new && <span lang={tag} className="text-[15px] font-medium text-ribbon-ink">{t.new}</span>}
                            </div>
                            {e.body && <Tr as="p" className="mt-0.5 line-clamp-3 text-[18px] text-ink [&_[lang=my]]:leading-[1.95]" text={e.body} lang={e.lang} tr={e.body_tr} noToggle />}
                            {e.steps.length > 0 && <p lang={tag} className="mt-1 text-[15px] text-muted">{t.steps}: {e.steps.length}</p>}
                            {e.auto_from && <div className="mt-1"><AutoMark from={e.auto_from} compact /></div>}
                          </Link>
                          {employer && (
                            <div className="flex shrink-0 flex-col items-end">
                              <button className="flex h-11 w-11 items-center justify-center text-muted hover:text-ink" aria-label={c.edit} onClick={() => setEditor({ entry: e })}><Pencil size={20} strokeWidth={1.75} /></button>
                              {list.length > 1 && (
                                <div className="flex">
                                  <button disabled={i === 0} className="flex h-11 w-11 items-center justify-center text-muted disabled:opacity-30" aria-label={t.moveUp} onClick={() => move(s, e.id, -1)}><ArrowUp size={20} strokeWidth={1.75} /></button>
                                  <button disabled={i === list.length - 1} className="flex h-11 w-11 items-center justify-center text-muted disabled:opacity-30" aria-label={t.moveDown} onClick={() => move(s, e.id, 1)}><ArrowDown size={20} strokeWidth={1.75} /></button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {(e.phone || employer) && (
                          <div className="flex flex-wrap items-center gap-3 pb-3 pl-[64px] pr-3">
                            {e.phone && <PhoneLink phone={e.phone} />}
                            {employer && <Confirmation entry={e} />}
                          </div>
                        )}
                      </m.li>
                    ))}
                  </ul>
                </div>
                {s === "purpose" && emergency.length > 0 && (
                  <div className="mt-3 rounded-[6px] border border-rule bg-paper px-4 py-3">
                    <p lang={tag} className="eyebrow mb-1 flex items-center gap-1.5"><Pin size={16} strokeWidth={1.75} className="text-ribbon-ink" aria-hidden /> {t.emergencyContacts}</p>
                    <ul className="space-y-2">
                      {emergency.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                          <Tr className="text-[18px]" text={e.title} lang={e.lang} tr={e.title_tr} noToggle />
                          {e.phone && <PhoneLink phone={e.phone} />}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <EntryEditor
        open={!!editor}
        entry={editor?.entry}
        defaultSection={editor?.section}
        onClose={() => setEditor(null)}
        onSaved={(saved) => {
          const exists = entries.some((x) => x.id === saved.id);
          setData({ entries: exists ? entries.map((x) => (x.id === saved.id ? saved : x)) : [...entries, saved] });
          toast({ text: c.saved });
          reload();
        }}
      />
    </div>
  );
}
