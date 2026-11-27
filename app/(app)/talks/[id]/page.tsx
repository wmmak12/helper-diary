"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, NotebookPen } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import type { Line, TalkDetail } from "@/lib/types";
import { useMe, useT } from "@/lib/client/i18n";
import { useApi } from "@/lib/client/useApi";
import { api } from "@/lib/client/api";
import { talksS } from "@/lib/strings/talks";
import { common } from "@/lib/strings/common";
import { LoadError, PageHeader, Skeleton } from "@/components/ui";
import { Transcript } from "@/components/talks/Transcript";
import { DraftList } from "@/components/drafts/DraftList";
import { talkDate } from "@/components/talks/format";

export default function TalkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT(talksS);
  const c = useT(common);
  const { me, lang, refreshBadges } = useMe();
  const tag = langInfo(lang).tag;
  const router = useRouter();
  const [poll, setPoll] = useState<number | undefined>(undefined);
  const { data, setData, error, loading, reload } = useApi<{ talk: TalkDetail }>(`/api/talks/${id}`, { poll });
  const talk = data?.talk;
  const lines: Line[] = talk?.lines ?? [];
  const drafting = !!talk?.drafting;
  // poll while drafting runs in the background (adjusting state from the previous render)
  if (talk && (drafting ? 3000 : undefined) !== poll) setPoll(drafting ? 3000 : undefined);
  useEffect(() => {
    if (!drafting) refreshBadges();
  }, [drafting, refreshBadges]);
  const [busy, setBusy] = useState(false);
  const [draftErr, setDraftErr] = useState(false);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  // a talk with no lines left (every row binned) is not shown: its old URL lands on History
  const emptied = !!talk && talk.lines.length === 0;
  const deleting = useRef(0);
  useEffect(() => {
    if (emptied && !deleting.current) router.replace("/talks");
  }, [emptied, router]);

  // the bin (5.1): the row goes at once; if the server keeps it, it comes back in place with one line under it
  async function deleteLine(l: Line) {
    const rest = lines.filter((x) => x.id !== l.id);
    if (data) setData({ talk: { ...data.talk, lines: rest } });
    setFailed((s0) => {
      const n = new Set(s0);
      n.delete(l.id);
      return n;
    });
    deleting.current++;
    try {
      await api(`/api/lines/${l.id}`, { method: "DELETE" });
      if (!rest.length) router.replace("/talks");
    } catch {
      setData((d) => (d ? { talk: { ...d.talk, lines: [...d.talk.lines, l].sort((a, b) => a.id - b.id) } } : d));
      setFailed((s0) => new Set(s0).add(l.id));
    } finally {
      deleting.current--;
    }
  }

  function onLine(l: Line) {
    if (!data) return;
    setData({ talk: { ...data.talk, lines: lines.map((x) => (x.id === l.id ? l : x)) } });
  }

  async function makeNotes() {
    setBusy(true);
    setDraftErr(false);
    try {
      await api(`/api/talks/${id}/draft`, { method: "POST" });
      setPoll(3000);
      await reload();
    } catch {
      setDraftErr(true);
    } finally {
      setBusy(false);
    }
  }

  const title = talk ? (talk.title ? pick(talk.title, talk.lang, talk.title_tr, lang) : t.untitled) : t.title;
  const isEmployer = me.role === "employer";
  // 5.2: on a phone the points sit above the lines while any waits for approval; under them once all are handled
  const waiting = !!talk?.drafts.some((d) => d.status === "waiting");

  return (
    <div>
      <PageHeader title={title} back="/talks" eyebrow={talk ? talkDate(talk.created_at, lang) : undefined}>
        {isEmployer && talk && (
          <button
            className="btn btn-danger btn-small"
            onClick={async () => {
              if (!confirm(t.deleteConfirm)) return;
              try {
                await api(`/api/talks/${id}`, { method: "DELETE" });
                refreshBadges();
                router.push("/talks");
              } catch {
                /* stays */
              }
            }}
          >
            <Trash2 size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.deleteTalk}</span>
          </button>
        )}
      </PageHeader>
      {loading && !data && <Skeleton rows={6} />}
      {error && !data && <LoadError error={error} onRetry={reload} />}
      {talk && (
        <div className={isEmployer ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" : ""}>
          <div className="min-w-0">
            {isEmployer && lines.some((l) => l.kind === "text") && <p lang={tag} className="mb-2 text-[15px] text-muted">{t.tapToEdit}</p>}
            {lines.length ? (
              <Transcript lines={lines} talkLang={talk.lang} helperLang={me.helper_lang} onLine={onLine} onDelete={isEmployer ? deleteLine : undefined} failed={failed} />
            ) : (
              <Skeleton rows={3} />
            )}
          </div>
          {isEmployer && (
            <aside className={`min-w-0 ${waiting ? "max-lg:order-first" : ""}`} data-waiting={waiting || undefined}>
              {talk.drafts.length > 0 && <DraftList drafts={talk.drafts} onChanged={reload} />}
              {drafting ? (
                <p lang={tag} className="mt-3 flex items-center gap-2 text-muted" role="status">
                  <span className="ink-dots" aria-hidden><span /><span /><span /></span> {t.draftingLine}
                </p>
              ) : talk.draft_error ? (
                <div role="alert" className="mt-3 rounded-[6px] border border-danger bg-danger-wash p-4">
                  <p lang={tag}>{t.draftFailed}</p>
                  <button className="btn btn-quiet btn-small mt-2" onClick={makeNotes} disabled={busy}>
                    <RotateCcw size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{c.tryAgain}</span>
                  </button>
                </div>
              ) : talk.drafts.length === 0 && lines.some((l) => l.kind === "text") ? (
                <div className="page p-4">
                  <h2 lang={tag} className={`font-semibold ${lang === "my" ? "text-[22px]" : "text-[24px]"}`}>{t.fromTalk}</h2>
                  <button className="btn btn-primary mt-3 w-full" onClick={makeNotes} disabled={busy}>
                    <NotebookPen size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.makeNotes}</span>
                  </button>
                </div>
              ) : null}
              {draftErr && <p role="alert" lang={tag} className="mt-2 text-danger">{c.offline}</p>}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
