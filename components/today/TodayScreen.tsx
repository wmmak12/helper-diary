"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { m } from "motion/react";
import { ChevronRight, HelpCircle, LayoutTemplate, Plus } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { todayS } from "@/lib/strings/today";
import { api } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import type { Task, TodayView } from "@/lib/types";
import { AskQuestion } from "@/components/AskQuestion";
import { HistoryButton } from "@/components/talks/HistoryButton";
import { Empty, LoadError, PageHeader, Ribbon, Skeleton, Tr } from "@/components/ui";
import { TaskRow } from "./TaskRow";
import { TaskSheet } from "./TaskSheet";
import { TomorrowView } from "./TomorrowView";
import { calS } from "@/lib/strings/calendar";
import { tplS } from "@/lib/strings/templates";

function dateLabel(date: string, tag: string) {
  const d = new Date(date + "T12:00:00Z");
  return new Intl.DateTimeFormat(tag === "my" ? "my-MM" : tag, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
}

export function TodayScreen() {
  const { me, lang, refreshBadges, toast } = useMe();
  const t = useT(todayS);
  const tpl = useT(tplS);
  const tag = langInfo(lang).tag;
  const employer = me.role === "employer";
  const { data, error, loading, reload } = useApi<{ today: TodayView }>("/api/today", { poll: 30000 });
  const all = useApi<{ tasks: Task[] }>(employer ? "/api/tasks" : null);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [doneGroup, setDoneGroup] = useState<Record<number, boolean>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [ask, setAsk] = useState<Task | null>(null);
  const [edit, setEdit] = useState<Task | null | "new">(null);
  const seenSent = useRef(new Set<number>());
  const c = useT(calS);
  const [tomorrow, setTomorrow] = useState(false);

  const today = data?.today;

  // server state is the truth once loaded; local state only bridges the moment after a tap
  const [synced, setSynced] = useState<TodayView | undefined>(undefined);
  if (today && today !== synced) {
    setSynced(today);
    setDone(Object.fromEntries(today.tasks.map((x) => [x.id, !!x.done_at])));
    setDoneGroup(Object.fromEntries(today.tasks.map((x) => [x.id, !!x.done_at])));
  }

  // answers she has now seen
  useEffect(() => {
    if (!today || employer) return;
    const fresh = today.answers.filter((a) => !a.answer_seen && !seenSent.current.has(a.id));
    fresh.forEach((a) => {
      seenSent.current.add(a.id);
      api(`/api/questions/${a.id}/seen`, { method: "POST" }).then(refreshBadges).catch(() => {});
    });
  }, [today, employer, refreshBadges]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const toggle = async (task: Task) => {
    const next = !done[task.id];
    setDone((d) => ({ ...d, [task.id]: next }));
    clearTimeout(timers.current[task.id]);
    if (next) timers.current[task.id] = setTimeout(() => setDoneGroup((g) => ({ ...g, [task.id]: true })), 1000);
    try {
      await api(`/api/tasks/${task.id}/done`, { body: { done: next } });
    } catch {
      clearTimeout(timers.current[task.id]);
      setDone((d) => ({ ...d, [task.id]: !next }));
      setDoneGroup((g) => ({ ...g, [task.id]: !next }));
      toast({ text: t.tickFailed, tone: "error" });
    }
  };

  const { open, closed } = useMemo(() => {
    const tasks = today?.tasks ?? [];
    return { open: tasks.filter((x) => !doneGroup[x.id]), closed: tasks.filter((x) => doneGroup[x.id]) };
  }, [today, doneGroup]);

  const doneCount = today ? today.tasks.filter((x) => done[x.id]).length : 0;
  const total = today?.total ?? 0;

  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      done={!!done[task.id]}
      onToggle={() => toggle(task)}
      onAsk={employer ? undefined : () => setAsk(task)}
      onEdit={employer ? () => setEdit(task) : undefined}
    />
  );

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title={t.title} eyebrow={today ? dateLabel(today.date, tag) : undefined}>
        {!employer && <HistoryButton />}
        {employer && (
          <button className="btn btn-primary btn-small" onClick={() => setEdit("new")}>
            <Plus size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.addTask}</span>
          </button>
        )}
      </PageHeader>

      {/* 2.0: the helper looks at tomorrow (read-only) and comes back with one tap */}
      {!employer && today && (
        <div role="group" className="mb-4 flex w-fit rounded-full border-[1.5px] border-field bg-paper p-0.5">
          {([false, true] as const).map((v) => (
            <button key={String(v)} type="button" aria-pressed={tomorrow === v} onClick={() => setTomorrow(v)} className={`relative min-h-[44px] min-w-[96px] rounded-full px-4 py-1 ${tomorrow === v ? "text-on-primary" : "text-ink"}`}>
              {tomorrow === v && <m.span layoutId="today-tomorrow" className="absolute inset-0 rounded-full bg-primary" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
              <span lang={tag} className="relative">{v ? c.tomorrow : t.title}</span>
            </button>
          ))}
        </div>
      )}

      {error && !data && <LoadError error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={6} />}

      {today && tomorrow && !employer && <TomorrowView today={today.date} onBack={() => setTomorrow(false)} />}

      {today && !(tomorrow && !employer) && (
        <div className="space-y-6">
          {employer && today.open_questions.length > 0 && (
            <Link href="/questions" className="flex items-center gap-3 rounded-[6px] border border-rule bg-ribbon-wash p-4">
              <HelpCircle size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-ribbon-ink" />
              <span className="min-w-0 flex-1">
                <span lang={tag} className="block font-semibold">{fmt(t.openQuestions, { name: me.helper_name ?? "" }).trim()}</span>
                <span className="block truncate text-[16px]">
                  <Tr text={today.open_questions[0].text} lang={today.open_questions[0].lang} tr={today.open_questions[0].tr} noToggle />
                </span>
                <span lang={tag} className="block text-[15px] text-muted">{fmt(t.openQuestionsLine, { n: today.open_questions.length })}</span>
              </span>
              <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
            </Link>
          )}

          {!employer && today.changed.length > 0 && (
            <section aria-labelledby="new-h">
              <h2 id="new-h" lang={tag} className="mb-2 text-[22px] font-semibold">{t.whatsNew}</h2>
              <ul className="space-y-2">
                {today.changed.map((e, i) => (
                  <li key={e.id} className="relative">
                    <Link href={`/notebook/${e.id}`} className="relative flex items-center gap-3 overflow-visible rounded-[6px] border border-rule bg-ribbon-wash py-3 pl-4 pr-10">
                      {i === 0 && <Ribbon className="right-3" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[20px] font-medium">
                          <Tr text={e.title} lang={e.lang} tr={e.title_tr} noToggle />
                        </span>
                        <span lang={tag} className="block text-[15px] text-ribbon-ink">{e.version > 1 ? `${t.updated} · ` : ""}{t.readConfirm}</span>
                      </span>
                      <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!employer && today.answers.length > 0 && (
            <section aria-labelledby="ans-h">
              <h2 id="ans-h" lang={tag} className="mb-2 text-[22px] font-semibold">{t.answers}</h2>
              <ul className="space-y-2">
                {today.answers.map((a) => (
                  <li key={a.id} className="page p-4">
                    <Tr as="p" className="text-[16px] text-muted" text={a.text} lang={a.lang} tr={a.tr} />
                    <p lang={tag} className="mt-2 text-[15px] text-moss">{fmt(t.answeredBy, { name: a.answered_by_name ?? "" })}</p>
                    {a.answer && a.answer_lang && <Tr as="p" className="text-[20px] font-medium" text={a.answer} lang={a.answer_lang} tr={a.answer_tr} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="tasks-h">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="tasks-h" lang={tag} className="text-[22px] font-semibold">{t.tasks}</h2>
              {total > 0 && <p lang={tag} className="tabular text-[16px] text-muted">{fmt(t.progress, { done: doneCount, total })}</p>}
            </div>
            {total > 0 && (
              <div className="mb-3 h-[2px] w-full bg-rule" aria-hidden>
                <m.div className="h-full origin-left bg-ink" initial={false} animate={{ scaleX: total ? doneCount / total : 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />
              </div>
            )}
            {total === 0 ? (
              <div className="page">
                <Empty img="today" title={employer ? t.emptyTitle : t.emptyHelperTitle} line={employer ? t.emptyLine : t.emptyHelperLine}>
                  {employer && (
                    <>
                      <button className="btn btn-primary" onClick={() => setEdit("new")}>
                        <Plus size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.addTask}</span>
                      </button>
                      <Link href="/templates" className="inline-flex min-h-[44px] basis-full justify-center items-center gap-1.5 text-[17px] text-primary underline decoration-rule underline-offset-4">
                        <LayoutTemplate size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{tpl.startFrom}</span>
                      </Link>
                    </>
                  )}
                </Empty>
              </div>
            ) : (
              <div className="ruled page overflow-hidden px-0 py-1">
                <ul>{open.map(row)}</ul>
                {closed.length > 0 && (
                  <>
                    <p lang={tag} className="eyebrow px-4 pb-1 pt-4 pl-[60px]">{t.done}</p>
                    <ul>{closed.map(row)}</ul>
                  </>
                )}
              </div>
            )}
          </section>

          {employer && all.data && (
            <section aria-labelledby="all-h">
              <h2 id="all-h" lang={tag} className="mb-2 text-[22px] font-semibold">{t.allTasks}</h2>
              {all.data.tasks.length === 0 ? (
                <p lang={tag} className="text-muted">{t.noTasksYet}</p>
              ) : (
                <ul className="page divide-y divide-rule">
                  {all.data.tasks.map((x) => (
                    <li key={x.id}>
                      <button onClick={() => setEdit(x)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-desk/50">
                        <span className="tabular w-[52px] shrink-0 text-[15px] text-muted">{x.time ?? ""}</span>
                        <span lang={langInfo(lang).tag} className="min-w-0 flex-1">{pick(x.title, x.lang, x.title_tr, lang)}</span>
                        <RepeatLabel task={x} tag={tag} />
                        <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <AskQuestion
        open={!!ask}
        onClose={() => setAsk(null)}
        refType="task"
        refId={ask?.id ?? null}
        refTitle={ask ? pick(ask.title, ask.lang, ask.title_tr, lang) : undefined}
      />
      {employer && (
        <TaskSheet
          open={edit !== null}
          onClose={() => setEdit(null)}
          task={edit === "new" ? null : edit}
          today={today?.date ?? new Date().toISOString().slice(0, 10)}
          onSaved={() => {
            reload();
            all.reload();
          }}
        />
      )}
    </div>
  );
}

function RepeatLabel({ task, tag }: { task: Task; tag: string }) {
  const t = useT(todayS);
  const loc = tag === "my" ? "my-MM" : tag;
  let s: string;
  if (task.kind === "once") s = task.date ? new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(task.date + "T12:00:00Z")) : t.once;
  else if (task.weekdays.length === 0 || task.weekdays.length === 7) s = t.everyDay;
  else {
    const base = Date.UTC(2024, 0, 7);
    s = task.weekdays.map((d) => new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" }).format(new Date(base + d * 86400000))).join(" ");
  }
  return <span lang={tag} className="shrink-0 text-[15px] text-muted">{s}</span>;
}
