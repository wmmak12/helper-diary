"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { Check, ChevronLeft, ChevronRight, LayoutTemplate, Sparkles } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { calS } from "@/lib/strings/calendar";
import { tplS } from "@/lib/strings/templates";
import { chatS } from "@/lib/strings/tplchat";
import { api, ApiErr } from "@/lib/client/api";
import { common } from "@/lib/strings/common";
import { SaveAsSheet } from "@/components/templates/TemplateEditor";
import { tplHref } from "@/components/templates/shared";
import { useApi } from "@/lib/client/useApi";
import type { CalDay } from "@/lib/types";
import { LoadError, PageHeader, Ribbon, Skeleton } from "@/components/ui";
import { addDays, addMonths, fmtDate, isDate, localToday, monthGrid, monthStart, weekStart } from "./dates";
import { KIND, KindIcon } from "./marks";

type View = "month" | "week";
const VIEW_KEY = "helper-diary.calendar.view";

export function CalendarScreen() {
  const { lang, me, toast } = useMe();
  const t = useT(calS);
  const tt = useT(tplS);
  const ch = useT(chatS);
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const employer = me.role === "employer";
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get("d");
  // 3.0: arriving from Put on calendar: open the start date's week with the one celebratory note
  const [added] = useState(() => {
    const n = Number(params.get("added"));
    return Number.isInteger(n) && n > 0 ? { n, from: params.get("from") ?? "" } : null;
  });
  const [view, setView] = useState<View>(added ? "week" : "month");
  const [savingWeek, setSavingWeek] = useState(false);
  const [weekMsg, setWeekMsg] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string>(() => (asked && isDate(asked) ? asked : localToday()));
  const [dir, setDir] = useState(0);

  // the last view chosen on this device
  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (added) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading this device's saved choice after mount
    if (v === "week" || v === "month") setView(v);
  }, [added]);

  const range = view === "month" ? monthGrid(anchor) : { from: weekStart(anchor), to: addDays(weekStart(anchor), 6) };
  const { data, error, loading, reload } = useApi<{ today: string; days: CalDay[] }>(`/api/calendar?from=${range.from}&to=${range.to}`);
  const today = data?.today ?? localToday();
  // keep the last range on screen while the next one loads, so the slide has something to show
  const [shown, setShown] = useState<{ key: string; days: CalDay[] } | null>(null);
  const key = `${view}:${range.from}`;
  if (data && data.days[0]?.date === range.from && data.days.at(-1)?.date === range.to && shown?.key !== key) setShown({ key, days: data.days });

  const switchView = (v: View) => {
    if (v === view) return;
    setDir(v === "week" ? 1 : -1);
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };
  const step = (n: number) => {
    setWeekMsg(null);
    setDir(n);
    setAnchor((a) => (view === "month" ? addMonths(a, n) : addDays(a, 7 * n)));
  };
  const goToday = () => {
    setDir(today < anchor ? -1 : 1);
    setAnchor(today);
  };
  const showingToday = view === "month" ? monthStart(anchor) === monthStart(today) : weekStart(anchor) === weekStart(today);
  const label =
    view === "month"
      ? fmtDate(anchor, tag, { month: "long", year: "numeric" })
      : `${fmtDate(range.from, tag, { day: "numeric", month: "short" })} – ${fmtDate(range.to, tag, { day: "numeric", month: "short", year: "numeric" })}`;

  // remember where the calendar is, so Back from a day page lands on the same month
  useEffect(() => {
    if (asked !== anchor || params.get("added")) router.replace(`/calendar?d=${anchor}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title={t.title}>
        <div role="group" aria-label={`${t.month} | ${t.week}`} className="relative flex rounded-full border-[1.5px] border-field bg-paper p-0.5">
          {(["month", "week"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => switchView(v)} className={`relative min-h-[44px] min-w-[72px] rounded-full px-4 ${view === v ? "text-on-primary" : "text-ink"}`}>
              {view === v && <m.span layoutId="cal-view" className="absolute inset-0 rounded-full bg-primary" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
              <span lang={tag} className="relative">{v === "month" ? t.month : t.week}</span>
            </button>
          ))}
        </div>
      </PageHeader>
      {employer && (
        <Link href="/templates" className="page mb-4 flex items-center gap-3 px-4 py-2.5 hover:bg-desk/60">
          <LayoutTemplate size={22} strokeWidth={1.75} aria-hidden className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span lang={tag} className="block text-[18px] font-semibold">{ch.calEntry}</span>
            <span lang={tag} className="flex items-center gap-1.5 text-[15px] text-ribbon-ink"><Sparkles size={15} strokeWidth={1.75} aria-hidden />{ch.calEntryLine}</span>
          </span>
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
        </Link>
      )}

      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={() => step(-1)} aria-label={view === "month" ? t.prevMonth : t.prevWeek} className="flex h-11 w-11 items-center justify-center rounded-[6px] border-[1.5px] border-field bg-paper text-ink">
          <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
        </button>
        <h2 lang={tag} aria-live="polite" className={`min-w-0 flex-1 text-center font-semibold ${lang === "my" ? "text-[20px]" : "text-[22px]"}`}>{label}</h2>
        <button type="button" onClick={() => step(1)} aria-label={view === "month" ? t.nextMonth : t.nextWeek} className="flex h-11 w-11 items-center justify-center rounded-[6px] border-[1.5px] border-field bg-paper text-ink">
          <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="mb-3 flex min-h-[44px] flex-wrap items-center justify-between gap-2">
        <Legend />
        {!showingToday && (
          <button type="button" className="btn btn-quiet btn-small" onClick={goToday}>
            <span lang={tag}>{t.today}</span>
          </button>
        )}
      </div>
      {employer && view === "week" && shown?.key.startsWith("week") && (
        <div className="mb-3">
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              if (shown.days.every((d) => d.tasks.length === 0)) return setWeekMsg(tt.emptyWeek);
              setWeekMsg(null);
              setSavingWeek(true);
            }}
          >
            <LayoutTemplate size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{tt.saveWeek}</span>
          </button>
          {weekMsg && <p role="status" lang={tag} className="mt-2 text-muted">{weekMsg}</p>}
          <SaveAsSheet
            open={savingWeek}
            title={tt.saveWeek}
            initial={fmt(tt.weekName, { date: fmtDate(range.from, tag, { day: "numeric", month: "short" }) })}
            onClose={() => setSavingWeek(false)}
            onSave={async (name) => {
              try {
                const r = await api<{ template: { ref: string } }>("/api/templates/week", { body: { name, from: range.from, lang } });
                toast({ text: fmt(tt.weekSaved, { name }), action: { label: c.open, href: tplHref(r.template.ref) } });
              } catch (x) {
                throw new Error(x instanceof ApiErr && x.f.code === "empty_week" ? tt.emptyWeek : x instanceof ApiErr && x.f.kind === "offline" ? c.offline : tt.saveFailed);
              }
            }}
          />
        </div>
      )}

      {added && (
        <m.p
          role="status"
          lang={tag}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-3 overflow-hidden rounded-[6px] border border-rule bg-ribbon-wash py-3 pl-4 pr-10 text-[17px] font-medium text-ribbon-ink"
        >
          <Check size={20} strokeWidth={2.5} aria-hidden className="mr-1.5 inline align-[-4px]" />
          {fmt(tt.addedN, { n: added.n, name: added.from })}
          <Ribbon className="right-4" />
        </m.p>
      )}
      {error && !data && <LoadError error={error} onRetry={reload} />}
      {loading && !shown && <Skeleton rows={6} />}
      {shown && (
        <div className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <m.div
              key={shown.key}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 24 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d * -24, transition: { duration: 0.14 } }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              {shown.key.startsWith("month") ? <Month days={shown.days} anchor={anchor} today={today} /> : <Week days={shown.days} today={today} />}
            </m.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Legend() {
  const t = useT(calS);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
      <li className="flex items-center gap-1.5"><KindIcon kind="task" /><span lang={tag} className="text-ink">{t.tasks}</span></li>
      <li className="flex items-center gap-1.5"><KindIcon kind="event" /><span lang={tag} className="text-ink">{t.event}</span></li>
      <li className="flex items-center gap-1.5"><KindIcon kind="dayoff" /><span lang={tag} className="text-ink">{t.dayOff}</span></li>
    </ul>
  );
}

function Month({ days, anchor, today }: { days: CalDay[]; anchor: string; today: string }) {
  const { lang } = useMe();
  const t = useT(calS);
  const tag = langInfo(lang).tag;
  const heads = useMemo(() => days.slice(0, 7).map((d) => fmtDate(d.date, tag, { weekday: "short" })), [days, tag]);
  const month = anchor.slice(0, 7);
  return (
    <div className="page overflow-hidden">
      <div className="grid grid-cols-7 border-b border-rule">
        {heads.map((h, i) => (
          <div key={i} lang={tag} className={`px-1 py-1 text-center text-[14px] text-muted ${lang === "my" ? "leading-[1.8]" : ""}`}>{h}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const out = d.date.slice(0, 7) !== month;
          const isToday = d.date === today;
          const event = d.items.find((i) => i.kind === "event");
          const off = d.items.some((i) => i.kind === "dayoff");
          const label = [fmtDate(d.date, tag, { weekday: "long", day: "numeric", month: "long" }), d.tasks.length ? fmt(t.nTasks, { n: d.tasks.length }) : "", event ? t.event : "", off ? t.dayOff : ""].filter(Boolean).join(", ");
          return (
            <Link
              key={d.date}
              href={`/calendar/${d.date}`}
              aria-label={label}
              aria-current={isToday ? "date" : undefined}
              className={`relative flex min-h-[72px] min-w-0 flex-col gap-0.5 border-b border-r border-rule p-1 hover:bg-desk/60 sm:min-h-[112px] sm:p-1.5 ${out ? "bg-desk/40" : ""}`}
            >
              {isToday && <span aria-hidden className="absolute inset-x-1 top-0 h-[4px] rounded-b-[2px] bg-ribbon" />}
              <span className={`tabular text-[16px] ${isToday ? "font-semibold text-ribbon-ink" : out ? "text-muted" : "text-ink"}`}>{Number(d.date.slice(8))}</span>
              {/* phone: a count and marks */}
              <span className="flex flex-wrap items-center gap-x-1 sm:hidden">
                {d.tasks.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[13px] font-semibold text-primary"><KindIcon kind="task" size={13} />{d.tasks.length}</span>
                )}
                {event && <KindIcon kind="event" size={14} />}
                {off && <KindIcon kind="dayoff" size={14} />}
              </span>
              {/* wider: titles */}
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {d.items.map((i) => (
                  <span key={`i${i.id}`} className={`flex min-w-0 items-center gap-1 rounded-[3px] px-1 text-[13px] ${KIND[i.kind].chip}`}>
                    <KindIcon kind={i.kind} size={12} />
                    <ChipText text={i.kind === "dayoff" ? t.dayOff : pick(i.title, i.lang, i.title_tr, lang)} />
                  </span>
                ))}
                {d.tasks.slice(0, 3).map((x) => (
                  <span key={`t${x.id}`} className={`flex min-w-0 items-center gap-1 rounded-[3px] px-1 text-[13px] ${KIND.task.chip}`}>
                    {x.done_at ? <Check size={12} strokeWidth={2.5} className="shrink-0 text-moss" aria-label={t.done} /> : null}
                    <ChipText text={pick(x.title, x.lang, x.title_tr, lang)} />
                  </span>
                ))}
                {d.tasks.length > 3 && <span lang={tag} className="px-1 text-[13px] text-muted">+{d.tasks.length - 3}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ChipText({ text }: { text: string }) {
  const { lang } = useMe();
  return <span lang={langInfo(lang).tag} className={`min-w-0 truncate ${lang === "my" ? "leading-[1.95]" : "leading-[1.5]"}`}>{text}</span>;
}

function Week({ days, today }: { days: CalDay[]; today: string }) {
  const { lang, me } = useMe();
  const t = useT(calS);
  const tag = langInfo(lang).tag;
  return (
    <ul className="page divide-y divide-rule">
      {days.map((d) => {
        const isToday = d.date === today;
        return (
          <li key={d.date}>
            <Link href={`/calendar/${d.date}`} aria-current={isToday ? "date" : undefined} className="relative block px-4 py-3 hover:bg-desk/60">
              {isToday && <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[4px] rounded-r-[2px] bg-ribbon" />}
              <span lang={tag} className={`flex items-center justify-between gap-2 font-semibold ${isToday ? "text-ribbon-ink" : "text-ink"}`}>
                <span>{fmtDate(d.date, tag, { weekday: "long", day: "numeric", month: "long" })}{isToday ? ` · ${t.today}` : ""}</span>
                <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="text-muted" />
              </span>
              {d.items.map((i) => (
                <span key={`i${i.id}`} className={`mt-1 flex items-center gap-2 rounded-[3px] px-2 py-1 ${KIND[i.kind].chip}`}>
                  <KindIcon kind={i.kind} />
                  <span lang={tag} className="tabular w-[44px] shrink-0 text-[15px]">{i.time ?? ""}</span>
                  <span lang={langInfo(lang).tag} className="min-w-0">
                    {i.kind === "dayoff" ? fmt(t.dayOffFor, { name: me.helper_name ?? "" }).trim() : `${t.event}: ${pick(i.title, i.lang, i.title_tr, lang)}`}
                  </span>
                </span>
              ))}
              {d.tasks.length === 0 && d.items.length === 0 && <span lang={tag} className="mt-0.5 block text-[15px] text-muted">{t.noTasks}</span>}
              {d.tasks.length > 0 && (
                <span className="mt-1 block">
                  {d.tasks.map((x) => (
                    <span key={x.id} className="flex items-baseline gap-2 py-0.5">
                      <span className="tabular w-[44px] shrink-0 text-[15px] text-muted">{x.time ?? ""}</span>
                      <span lang={langInfo(lang).tag} className={`min-w-0 flex-1 ${x.done_at ? "text-muted line-through decoration-moss" : ""}`}>{pick(x.title, x.lang, x.title_tr, lang)}</span>
                      {x.done_at && <span className="flex shrink-0 items-center gap-1 text-[15px] text-moss"><Check size={16} strokeWidth={2.5} aria-hidden /><span lang={tag}>{t.done}</span></span>}
                    </span>
                  ))}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
