"use client";
import Link from "next/link";
import { useState } from "react";
import { m } from "motion/react";
import { ArrowRightLeft, Check, ChevronRight, NotebookText, Plus, StickyNote, Trash2 } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { calS } from "@/lib/strings/calendar";
import { common } from "@/lib/strings/common";
import { api } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import type { CalItem, DayView, Task } from "@/lib/types";
import { LoadError, PageHeader, Skeleton, Tr } from "@/components/ui";
import { clock } from "@/components/talks/format";
import { isDate, longDate, shortDate } from "./dates";
import { KIND, KindIcon } from "./marks";
import { AddSheet, MoveSheet } from "./DaySheets";

export function DayScreen({ date }: { date: string }) {
  const { me, lang, toast } = useMe();
  const t = useT(calS);
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const valid = isDate(date);
  const { data, error, loading, reload } = useApi<{ day: DayView }>(valid ? `/api/calendar/${date}` : null);
  const day = data?.day;
  const employer = me.role === "employer";
  const canPlan = employer && !!day && date >= day.today;
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<Task | null>(null);
  const [delErr, setDelErr] = useState(false);

  const removeItem = async (i: CalItem) => {
    if (!confirm(c.confirmRemove)) return;
    setDelErr(false);
    try {
      await api(`/api/calendar/items/${i.id}`, { method: "DELETE" });
      reload();
    } catch {
      setDelErr(true);
    }
  };

  const empty = day && !day.tasks.length && !day.items.length && !day.talks.length && !day.entries.length && !day.notes.length;

  return (
    // the day page opens from its date: it settles in from the end side (a fade under reduced motion)
    <m.div className="mx-auto max-w-[760px]" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
      <PageHeader title={valid ? longDate(date, tag) : t.title} back={`/calendar?d=${valid ? date : ""}`} eyebrow={day && date === day.today ? t.today : undefined}>
        {canPlan && (
          <button className="btn btn-primary btn-small" onClick={() => setAdding(true)}>
            <Plus size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.add}</span>
          </button>
        )}
      </PageHeader>

      {error && !data && <LoadError error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={6} />}

      {day && (
        <div className="space-y-6">
          {day.items.map((i) => (
            <div key={i.id} className={`flex items-center gap-3 rounded-[6px] px-4 py-3 ${KIND[i.kind].chip}`}>
              <KindIcon kind={i.kind} size={24} />
              <span className="min-w-0 flex-1">
                <span lang={tag} className="block text-[15px] font-medium">{i.kind === "event" ? t.event : t.dayOff}{i.time ? ` · ${i.time}` : ""}</span>
                {i.kind === "event" ? (
                  <Tr as="span" className="block text-[20px] font-semibold text-ink" text={i.title} lang={i.lang} tr={i.title_tr} />
                ) : (
                  <span lang={tag} className="block text-[20px] font-semibold text-ink">{fmt(t.dayOffFor, { name: me.helper_name ?? "" }).trim()}</span>
                )}
              </span>
              {employer && (
                <button type="button" onClick={() => removeItem(i)} className="btn btn-danger btn-small">
                  <Trash2 size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.delete}</span>
                </button>
              )}
            </div>
          ))}
          {delErr && <p role="alert" lang={tag} className="text-danger">{t.saveFailed}</p>}

          {empty ? (
            <div className="page flex flex-col items-center px-4 py-8 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/empty-today.png" alt="" width={200} height={200} className="h-auto w-[160px] lg:w-[200px]" />
              <p lang={tag} className="mt-2 max-w-[32ch] text-[18px]">{t.nothing}</p>
              {canPlan && (
                <button className="btn btn-primary mt-4" onClick={() => setAdding(true)}>
                  <Plus size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.add}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <section aria-labelledby="d-tasks">
                <h2 id="d-tasks" lang={tag} className="mb-2 flex items-center gap-2 text-[22px] font-semibold"><KindIcon kind="task" size={22} /> {t.tasks}</h2>
                {day.tasks.length === 0 ? (
                  <p lang={tag} className="text-muted">{t.noTasks}</p>
                ) : (
                  <ul className="page divide-y divide-rule">
                    {day.tasks.map((x) => (
                      <li key={x.id} className="flex items-start gap-3 px-4 py-3">
                        <span className="tabular w-[48px] shrink-0 pt-0.5 text-[15px] text-muted">{x.time ?? ""}</span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[18px] font-medium ${x.done_at ? "text-muted line-through decoration-moss" : ""}`}>
                            <Tr text={x.title} lang={x.lang} tr={x.title_tr} />
                          </span>
                          {x.note && <Tr as="span" className="block text-[16px] text-muted" text={x.note} lang={x.lang} tr={x.note_tr} />}
                          {x.moved_from && <span lang={tag} className="block text-[15px] text-muted">{fmt(t.movedFrom, { date: shortDate(x.moved_from, tag) })}</span>}
                        </span>
                        {x.done_at && (
                          <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[15px] text-moss"><Check size={18} strokeWidth={2.5} aria-hidden /><span lang={tag}>{t.done}</span></span>
                        )}
                        {/* a daily task is on every day already, so it has nowhere to move to */}
                        {canPlan && x.repeat !== "daily" && (
                          <button type="button" onClick={() => setMoving(x)} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[6px] border-[1.5px] border-field bg-paper px-3 text-[15px] text-ink">
                            <ArrowRightLeft size={16} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.move}</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="d-talks">
                <h2 id="d-talks" lang={tag} className="mb-2 text-[22px] font-semibold">{t.talks}</h2>
                {day.talks.length === 0 ? (
                  <p lang={tag} className="text-muted">{t.noTalks}</p>
                ) : (
                  <ul className="page divide-y divide-rule">
                    {day.talks.map((x) => (
                      <li key={x.id}>
                        <Link href={`/talks/${x.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2 hover:bg-desk/50">
                          <span className="tabular w-[48px] shrink-0 text-[15px] text-muted">{clock(x.created_at)}</span>
                          <span className="min-w-0 flex-1">
                            {x.title ? (
                              <Tr as="span" className="block font-medium" text={x.title} lang={x.lang} tr={x.title_tr} noToggle />
                            ) : x.first_line ? (
                              <Tr as="span" className="block font-medium" text={x.first_line.text} lang={x.first_line.lang} tr={x.first_line.tr} noToggle />
                            ) : null}
                            <span lang={tag} className="block text-[15px] text-muted">{fmt(t.lines, { n: x.lines })}</span>
                          </span>
                          <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="text-muted" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="d-notes">
                <h2 id="d-notes" lang={tag} className="mb-2 text-[22px] font-semibold">{t.notes}</h2>
                {day.entries.length === 0 && day.notes.length === 0 ? (
                  <p lang={tag} className="text-muted">{t.noNotes}</p>
                ) : (
                  <ul className="page divide-y divide-rule">
                    {day.entries.map((e) => (
                      <li key={`e${e.id}`}>
                        <Link href={`/notebook/${e.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2 hover:bg-desk/50">
                          <NotebookText size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
                          <span className="min-w-0 flex-1">
                            <Tr as="span" className="block font-medium" text={e.title} lang={e.lang} tr={e.title_tr} noToggle />
                            <span lang={tag} className="block text-[15px] text-muted">{t.notebook}</span>
                          </span>
                          <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="text-muted" />
                        </Link>
                      </li>
                    ))}
                    {day.notes.map((n) => (
                      <li key={`n${n.id}`}>
                        <Link href={`/notes/${n.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2 hover:bg-desk/50">
                          <StickyNote size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
                          <span className="min-w-0 flex-1">
                            <Tr as="span" className="block font-medium" text={n.title || n.body.slice(0, 80)} lang={n.lang} tr={n.title ? n.title_tr : n.body_tr} noToggle />
                            <span lang={tag} className="block text-[15px] text-muted">{n.owner_name} · {n.shared ? t.shared : t.private}</span>
                          </span>
                          <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="text-muted" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {canPlan && day && (
        <>
          <AddSheet open={adding} date={date} hasDayOff={day.items.some((i) => i.kind === "dayoff")} onClose={() => setAdding(false)} onSaved={reload} />
          <MoveSheet
            task={moving}
            from={date}
            today={day.today}
            onClose={() => setMoving(null)}
            onMoved={(to) => {
              reload();
              toast({ text: fmt(t.movedTo, { date: longDate(to, tag) }) });
            }}
          />
        </>
      )}
    </m.div>
  );
}
