"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, m, useMotionValue } from "motion/react";
import { Check, ChevronRight, Trash2 } from "lucide-react";
import { langInfo } from "@/lib/languages";
import type { TalkSummary } from "@/lib/types";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { useApi } from "@/lib/client/useApi";
import { api } from "@/lib/client/api";
import { talksS } from "@/lib/strings/talks";
import { common } from "@/lib/strings/common";
import { Empty, LoadError, PageHeader, Sheet, Skeleton, Tr } from "@/components/ui";
import { talkDate } from "@/components/talks/format";

// how far a swiped row opens to show its Delete button
const OPEN = -96;

export default function TalksPage() {
  const t = useT(talksS);
  const c = useT(common);
  const { me, lang, refreshBadges } = useMe();
  const tag = langInfo(lang).tag;
  const employer = me.role === "employer";
  const { data, error, loading, reload } = useApi<{ talks: TalkSummary[] }>("/api/talks", { poll: 10000 });
  const talks = data?.talks ?? [];
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [swiped, setSwiped] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(0);

  const toggle = (id: number) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };

  async function remove(ids: number[]) {
    setBusy(true);
    const results = await Promise.allSettled(ids.map((id) => api(`/api/talks/${id}`, { method: "DELETE" })));
    setBusy(false);
    setConfirming(null);
    setSwiped(null);
    setFailed(results.filter((r) => r.status === "rejected").length);
    stopSelecting();
    refreshBadges();
    reload();
  }

  return (
    <div className="mx-auto max-w-[720px] pb-24 lg:pb-0">
      <PageHeader title={t.title}>
        {employer && talks.length > 0 && (selecting ? (
          <>
            <button className="btn btn-quiet btn-small" onClick={() => setPicked(picked.size === talks.length ? new Set() : new Set(talks.map((x) => x.id)))}>
              <span lang={tag}>{picked.size === talks.length ? t.selectNone : t.selectAll}</span>
            </button>
            <button className="btn btn-quiet btn-small" onClick={stopSelecting}><span lang={tag}>{c.cancel}</span></button>
          </>
        ) : (
          <button className="btn btn-quiet btn-small" onClick={() => { setSwiped(null); setSelecting(true); }}><span lang={tag}>{t.select}</span></button>
        ))}
      </PageHeader>
      {failed > 0 && <p role="alert" lang={tag} className="mb-3 text-danger">{fmt(t.deleteFailed, { n: failed })}</p>}
      {loading && !data && <Skeleton rows={5} />}
      {error && !data && <LoadError error={error} onRetry={reload} />}
      {data && talks.length === 0 && (
        <div className="page">
          <Empty img="conversations" title={t.emptyTitle} line={employer ? t.emptyLine : t.emptyHelper}>
            {employer && (
              <Link href="/talk" className="btn btn-primary"><span lang={tag}>{t.goTalk}</span></Link>
            )}
          </Empty>
        </div>
      )}
      {talks.length > 0 && (
        <ul className="page divide-y divide-rule overflow-hidden">
          <AnimatePresence initial={false}>
            {talks.map((x) => {
              const summary = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="tabular text-[15px] text-muted" lang={tag}>{talkDate(x.created_at, lang)}</p>
                    <div className="text-[20px] font-medium">
                      {x.title ? (
                        <Tr text={x.title} lang={x.lang} tr={x.title_tr} noToggle />
                      ) : x.first_line ? (
                        <Tr text={x.first_line.text} lang={x.first_line.lang} tr={x.first_line.tr} noToggle className="line-clamp-2" />
                      ) : (
                        <span lang={tag}>{t.untitled}</span>
                      )}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[15px] text-muted" lang={tag}>
                      <span className="tabular">{fmt(t.lines, { n: x.lines })}</span>
                      {employer && x.drafting && <span>{t.drafting}</span>}
                    </p>
                  </div>
                  {employer && x.waiting > 0 && (
                    <span lang={tag} className="tabular shrink-0 rounded-full bg-ochre-ink px-2.5 py-0.5 text-[15px] font-semibold text-on-primary">
                      {fmt(t.waiting, { n: x.waiting })}
                    </span>
                  )}
                </>
              );
              return (
                <m.li key={x.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
                  {selecting ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={picked.has(x.id)}
                      aria-label={t.pick}
                      onClick={() => toggle(x.id)}
                      className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left ${picked.has(x.id) ? "bg-ribbon-wash" : ""}`}
                    >
                      <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border-2 ${picked.has(x.id) ? "border-primary bg-primary" : "border-ink bg-paper"}`}>
                        {picked.has(x.id) && <Check size={22} strokeWidth={2.5} className="text-on-primary" />}
                      </span>
                      {summary}
                    </button>
                  ) : (
                    <SwipeRow
                      swipeable={employer}
                      open={swiped === x.id}
                      onOpen={(o) => setSwiped(o ? x.id : null)}
                      onDelete={() => setConfirming([x.id])}
                      deleteLabel={t.delete}
                      tag={tag}
                    >
                      <Link href={`/talks/${x.id}`} draggable={false} className="flex min-h-[72px] items-center gap-3 px-4 py-3 hover:bg-desk/50">
                        {summary}
                        <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
                      </Link>
                    </SwipeRow>
                  )}
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {selecting && (
        <div className="fixed inset-x-0 z-20 flex justify-center px-4 bottom-[calc(76px+env(safe-area-inset-bottom))] lg:bottom-6 lg:pl-[248px]">
          <div className="flex w-full max-w-[720px] items-center justify-between gap-3 rounded-[6px] border border-rule bg-paper p-3">
            <span lang={tag} className="tabular text-muted">{fmt(t.selected, { n: picked.size })}</span>
            <button className="btn btn-danger btn-small" disabled={picked.size === 0} onClick={() => setConfirming([...picked])}>
              <Trash2 size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{fmt(t.deleteN, { n: picked.size })}</span>
            </button>
          </div>
        </div>
      )}

      <Sheet open={!!confirming} onClose={() => !busy && setConfirming(null)} title={confirming && confirming.length > 1 ? fmt(t.deleteManyConfirm, { n: confirming.length }) : t.deleteConfirm}>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-danger" disabled={busy} onClick={() => confirming && remove(confirming)}>
            {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <><Trash2 size={20} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.delete}</span></>}
          </button>
          <button className="btn btn-quiet" disabled={busy} onClick={() => setConfirming(null)}><span lang={tag}>{c.cancel}</span></button>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * A row that slides left to show Delete (phone). The swipe is followed by hand rather than motion's drag: drag needs
 * domMax, and loading it changes motion for the whole app (sheets stopped opening). A tap on an open row closes it.
 */
function SwipeRow({ swipeable, open, onOpen, onDelete, deleteLabel, tag, children }: {
  swipeable: boolean; open: boolean; onOpen: (open: boolean) => void; onDelete: () => void; deleteLabel: string; tag: string; children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  // the finger's start, the row's offset then, and whether this gesture turned out sideways (x) or a scroll (y)
  const g = useRef({ x: 0, y: 0, base: 0, axis: null as "x" | "y" | null });
  const settle = (to: number) => animate(x, to, { duration: 0.22, ease: [0.22, 1, 0.36, 1] });
  useEffect(() => {
    settle(open ? OPEN : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!swipeable) return <>{children}</>;
  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex w-24 flex-col items-center justify-center gap-1 bg-danger text-[15px] font-medium text-on-primary"
      >
        <Trash2 size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{deleteLabel}</span>
      </button>
      <m.div
        style={{ x, touchAction: "pan-y" }}
        onPointerDown={(e) => (g.current = { x: e.clientX, y: e.clientY, base: x.get(), axis: null })}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pointerType === "mouse") return;
          const dx = e.clientX - g.current.x, dy = e.clientY - g.current.y;
          if (!g.current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
            g.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (g.current.axis === "x") e.currentTarget.setPointerCapture(e.pointerId);
          }
          if (g.current.axis === "x") x.set(Math.min(0, Math.max(OPEN - 24, g.current.base + dx)));
        }}
        onPointerUp={() => {
          if (g.current.axis !== "x") return;
          const go = x.get() < OPEN / 2;
          settle(go ? OPEN : 0);
          onOpen(go);
        }}
        onPointerCancel={() => settle(open ? OPEN : 0)}
        onClickCapture={(e) => {
          const swiped = Math.abs(e.clientX - g.current.x) > 8;
          if (!swiped && !open) return;
          e.preventDefault();
          e.stopPropagation();
          if (open && !swiped) onOpen(false);
        }}
        className="relative bg-paper"
      >
        {children}
      </m.div>
    </div>
  );
}
