"use client";
import { useState } from "react";
import { langInfo, pick } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { calS } from "@/lib/strings/calendar";
import { common } from "@/lib/strings/common";
import { api, ApiErr } from "@/lib/client/api";
import type { Repeat, Task } from "@/lib/types";
import { Sheet } from "@/components/ui";
import { addDays, fmtDate, weekdayOf } from "./dates";
import { KIND, KindIcon } from "./marks";

type Kind = "task" | "event" | "dayoff";

function Pills<T extends string>({ value, options, onChange, legend }: { value: T; options: { v: T; label: string; icon?: React.ReactNode }[]; onChange: (v: T) => void; legend: string }) {
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  return (
    <fieldset>
      <legend lang={tag} className="mb-1 text-[16px] font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)} className={`inline-flex min-h-[48px] items-center gap-1.5 rounded-full border-[1.5px] px-4 py-1.5 ${value === o.v ? "border-primary bg-primary text-on-primary [&_svg]:!text-on-primary" : "border-field bg-paper text-ink"}`}>
            {o.icon}
            <span lang={tag}>{o.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Employer: add a task (with repeat), a family event or her day off to this date. The entry stays if saving fails. */
export function AddSheet({ open, date, hasDayOff, onClose, onSaved }: { open: boolean; date: string; hasDayOff: boolean; onClose: () => void; onSaved: () => void }) {
  const { lang, me } = useMe();
  const t = useT(calS);
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const [kind, setKind] = useState<Kind>("task");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [days, setDays] = useState<number[]>([weekdayOf(date)]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const names = Array.from({ length: 7 }, (_, i) => fmtDate(addDays("2024-01-07", i), tag, { weekday: "short" }));
  const label = (s: string) => <span lang={tag} className="mb-1 block text-[16px] font-medium">{s}</span>;
  const kinds: { v: Kind; label: string; icon: React.ReactNode }[] = [
    { v: "task", label: t.addTask, icon: <KindIcon kind="task" /> },
    { v: "event", label: t.addEvent, icon: <KindIcon kind="event" /> },
    ...(hasDayOff ? [] : [{ v: "dayoff" as const, label: me.helper_name ? fmt(t.dayOffFor, { name: me.helper_name }) : t.addDayOff, icon: <KindIcon kind="dayoff" /> }]),
  ];

  const reset = () => {
    setTitle("");
    setTime("");
    setNote("");
    setRepeat("none");
    setDays([weekdayOf(date)]);
    setErr(null);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`${t.add} · ${fmtDate(date, tag, { weekday: "short", day: "numeric", month: "short" })}`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (kind === "task" && repeat === "weekly" && days.length === 0) return setErr(t.pickDays);
          setBusy(true);
          setErr(null);
          try {
            if (kind === "task") {
              await api("/api/tasks", {
                body: { title, note, lang, time: time || null, date, repeat, kind: repeat === "none" ? "once" : "routine", weekdays: repeat === "weekly" ? days : [] },
              });
            } else {
              await api("/api/calendar/items", { body: { kind, date, title: kind === "event" ? title : "", time: kind === "event" ? time || null : null, lang } });
            }
            reset();
            onSaved();
            onClose();
          } catch (x) {
            setErr(x instanceof ApiErr && x.f.kind === "offline" ? c.offline : t.saveFailed);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Pills legend={t.add} value={kind} options={kinds} onChange={(v) => { setKind(v); setErr(null); }} />
        {kind !== "dayoff" && (
          <label className="block">
            {label(kind === "task" ? t.taskTitle : t.eventTitle)}
            <input lang={tag} className="field" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </label>
        )}
        {kind !== "dayoff" && (
          <label className="block">
            {label(t.time)}
            <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}
        {kind === "task" && (
          <>
            <label className="block">
              {label(t.note)}
              <textarea lang={tag} className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <Pills
              legend={t.repeat}
              value={repeat}
              onChange={setRepeat}
              options={[
                { v: "none", label: t.rNone },
                { v: "daily", label: t.rDaily },
                { v: "weekly", label: t.rWeekly },
                { v: "monthly", label: t.rMonthly },
              ]}
            />
            {repeat === "weekly" && (
              <fieldset>
                <legend lang={tag} className="mb-1 text-[16px] font-medium">{t.onDays}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((n, i) => (
                    <button
                      key={i}
                      type="button"
                      lang={tag}
                      aria-pressed={days.includes(i)}
                      onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()))}
                      className={`min-h-[44px] min-w-[52px] rounded-[6px] border-[1.5px] px-2 py-1 text-[16px] ${days.includes(i) ? "border-primary bg-primary text-on-primary" : "border-field bg-paper"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {repeat === "monthly" && <p lang={tag} className="text-[16px] text-muted">{fmt(t.monthlyLine, { d: Number(date.slice(8)) })}</p>}
          </>
        )}
        {kind === "dayoff" && (
          <p className={`flex items-center gap-2 rounded-[6px] px-3 py-2 ${KIND.dayoff.chip}`}>
            <KindIcon kind="dayoff" /> <span lang={tag}>{fmtDate(date, tag, { weekday: "long", day: "numeric", month: "long" })}</span>
          </p>
        )}
        {err && <p role="alert" lang={tag} className="text-danger">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{c.save}</span>}
        </button>
      </form>
    </Sheet>
  );
}

/** Employer: move this task (for a repeating task, only this date's occurrence) to today or a later date. */
export function MoveSheet({ task, from, today, onClose, onMoved }: { task: Task | null; from: string; today: string; onClose: () => void; onMoved: (to: string) => void }) {
  const { lang } = useMe();
  const t = useT(calS);
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const close = () => {
    setTo("");
    setErr(null);
    onClose();
  };
  return (
    <Sheet open={!!task} onClose={close} title={t.moveTo}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!task || !to) return;
          setBusy(true);
          setErr(null);
          try {
            await api(`/api/tasks/${task.id}/move`, { body: { from, to } });
            close();
            onMoved(to);
          } catch (x) {
            setErr(x instanceof ApiErr && x.f.code === "already_on_date" ? t.alreadyThere : x instanceof ApiErr && x.f.kind === "offline" ? c.offline : t.saveFailed);
          } finally {
            setBusy(false);
          }
        }}
      >
        {task && (
          <p className="rounded-[6px] border-l-[3px] border-primary bg-desk px-3 py-2">
            <span className="tabular mr-2 text-[15px] text-muted">{task.time ?? ""}</span>
            <span lang={langInfo(lang).tag} className="font-medium">{pick(task.title, task.lang, task.title_tr, lang)}</span>
          </p>
        )}
        <input type="date" aria-label={t.moveTo} className="field" value={to} min={today} onChange={(e) => setTo(e.target.value)} required />
        {err && <p role="alert" lang={tag} className="text-danger">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy || !to || to === from}>
          {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{t.move}</span>}
        </button>
      </form>
    </Sheet>
  );
}
