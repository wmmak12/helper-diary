"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AutoMark } from "@/components/drafts/AutoAdded";
import { useEffect, useState } from "react";
import { m } from "motion/react";
import { Check, HelpCircle, MessagesSquare, Pencil, Trash2 } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import { useMe, useT } from "@/lib/client/i18n";
import { api, photoUrl } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { nb } from "@/lib/strings/notebook";
import { common } from "@/lib/strings/common";
import type { Entry, Question } from "@/lib/types";
import { LoadError, PageHeader, Photos, Skeleton, Tr } from "@/components/ui";
import { AskQuestion } from "@/components/AskQuestion";
import { Confirmation, EntryEditor, PhoneLink, when } from "./shared";

export function EntryScreen({ id }: { id: number }) {
  const t = useT(nb);
  const c = useT(common);
  const { me, lang, toast, refreshBadges } = useMe();
  const tag = langInfo(lang).tag;
  const router = useRouter();
  const employer = me.role === "employer";
  const { data, setData, error, loading, reload } = useApi<{ entry: Entry; questions: Question[] }>(`/api/entries/${id}`);
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) refreshBadges(); }, [data, refreshBadges]);

  const e = data?.entry;

  return (
    <m.div className="mx-auto max-w-[720px]" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
      <PageHeader title={e ? t[e.section] : c.notebook} back="/notebook" />
      {loading && <Skeleton rows={5} />}
      {error && <LoadError error={error} onRetry={reload} />}
      {e && (
        <article className={`ruled page relative px-4 py-4 pl-[64px] ${e.is_new ? "" : ""}`}>
          {e.is_new && !employer && <span aria-hidden className="ribbon right-5" />}
          {e.auto_from && <div className="mb-1"><AutoMark from={e.auto_from} /></div>}
          <Tr as="h2" className="text-[22px] font-semibold" text={e.title} lang={e.lang} tr={e.title_tr} />
          {e.body && <Tr as="p" className="mt-3 text-[18px]" text={e.body} lang={e.lang} tr={e.body_tr} />}
          {e.steps.length > 0 && (
            <ol className="mt-4 space-y-4">
              {e.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="tabular w-6 shrink-0 text-right text-[18px] font-semibold text-ochre-ink">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Tr as="p" text={s.text} lang={e.lang} tr={s.tr} />
                    {s.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl(s.photo)} alt="" className="mt-2 max-h-64 rounded-[6px] border border-rule object-cover" loading="lazy" />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <Photos ids={e.photos} />
          {e.phone && <div className="mt-4"><PhoneLink phone={e.phone} /></div>}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {e.source_talk_id && (
              <Link href={`/talks/${e.source_talk_id}`} className="btn btn-small text-muted hover:text-ink">
                <MessagesSquare size={20} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.fromTalk}</span>
              </Link>
            )}
          </div>
        </article>
      )}
      {e && !employer && (
        <div className="mt-4 flex flex-wrap gap-3">
          {e.understood_at ? (
            <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[52px] items-center gap-2 rounded-[6px] bg-moss-wash px-4 text-moss" lang={tag}>
              <Check size={22} strokeWidth={2} aria-hidden /> {t.understood} · {when(e.understood_at, lang)}
            </m.p>
          ) : (
            <button className="btn btn-primary flex-1" disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ entry: Entry }>(`/api/entries/${e.id}/understood`, { method: "POST" });
                setData({ ...data!, entry: r.entry });
                refreshBadges();
              } catch { toast({ text: c.offline, tone: "error" }); } finally { setBusy(false); }
            }}>
              <Check size={24} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.understand}</span>
            </button>
          )}
          <button className="btn btn-quiet flex-1" onClick={() => setAsking(true)}>
            <HelpCircle size={24} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.askAbout}</span>
          </button>
        </div>
      )}
      {e && employer && (
        <div className="mt-4 space-y-3">
          <Confirmation entry={e} />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-quiet flex-1" onClick={() => setEditing(true)}><Pencil size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{c.edit}</span></button>
            <button className="btn btn-danger flex-1" onClick={async () => {
              if (!confirm(c.confirmRemove)) return;
              try { await api(`/api/entries/${e.id}`, { method: "DELETE" }); toast({ text: t.removed }); router.push("/notebook"); }
              catch { toast({ text: c.offline, tone: "error" }); }
            }}><Trash2 size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{c.remove}</span></button>
          </div>
        </div>
      )}
      {data && data.questions.length > 0 && (
        <section className="mt-8">
          <h2 lang={tag} className="mb-2 text-[22px] font-semibold">{t.questionsHere}</h2>
          <ul className="page divide-y divide-rule">
            {data.questions.map((q) => (
              <li key={q.id} className="p-4">
                <Tr as="p" text={q.text} lang={q.lang} tr={q.tr} />
                {q.answer ? (
                  <Tr as="p" className="mt-2 border-l-2 border-moss pl-3" text={q.answer} lang={q.answer_lang ?? "en"} tr={q.answer_tr} />
                ) : (
                  <p lang={tag} className="mt-1 text-[15px] text-muted">{t.waitingAnswer}{employer && <> · <Link className="underline underline-offset-4" href={`/questions#q-${q.id}`}>{c.questions}</Link></>}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {e && (
        <>
          <EntryEditor open={editing} entry={e} onClose={() => setEditing(false)} onSaved={(saved) => { setData({ ...data!, entry: saved }); toast({ text: c.saved }); }} />
          <AskQuestion open={asking} onClose={() => setAsking(false)} refType="entry" refId={e.id} refTitle={pick(e.title, e.lang, e.title_tr, lang)} onAsked={(q) => setData({ ...data!, questions: [q, ...data!.questions] })} />
        </>
      )}
    </m.div>
  );
}
