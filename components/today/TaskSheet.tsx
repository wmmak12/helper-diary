"use client";
import { useState } from "react";
import { langInfo } from "@/lib/languages";
import { useMe, useT } from "@/lib/client/i18n";
import { todayS } from "@/lib/strings/today";
import { common } from "@/lib/strings/common";
import { api } from "@/lib/client/api";
import type { Task } from "@/lib/types";
import { PhotoButton, Photos, Sheet } from "@/components/ui";

function weekdayNames(tag: string) {
  // 0 = Sunday, matching the server
  const base = new Date(Date.UTC(2024, 0, 7)); // a Sunday
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(tag === "my" ? "my-MM" : tag, { weekday: "short", timeZone: "UTC" }).format(new Date(base.getTime() + i * 86400000)),
  );
}

export function TaskSheet({ open, onClose, task, today, onSaved }: { open: boolean; onClose: () => void; task: Task | null; today: string; onSaved: () => void }) {
  const t = useT(todayS);
  return (
    <Sheet open={open} onClose={onClose} title={task ? t.editTask : t.addTask}>
      {open && <TaskForm key={task?.id ?? "new"} onClose={onClose} task={task} today={today} onSaved={onSaved} />}
    </Sheet>
  );
}

function TaskForm({ onClose, task, today, onSaved }: { onClose: () => void; task: Task | null; today: string; onSaved: () => void }) {
  const { lang } = useMe();
  const t = useT(todayS);
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const [title, setTitle] = useState(task ? (task.lang === lang ? task.title : (task.title_tr?.[lang] ?? task.title)) : "");
  const [note, setNote] = useState(task ? (task.lang === lang ? task.note : (task.note_tr?.[lang] ?? task.note)) : "");
  const [time, setTime] = useState(task?.time ?? "");
  const [kind, setKind] = useState<"routine" | "once">(task?.kind ?? "once");
  const [days, setDays] = useState<number[]>(task?.weekdays ?? []);
  const [date, setDate] = useState(task?.date ?? today);
  const [photo, setPhoto] = useState<string | null>(task?.photo ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const names = weekdayNames(tag);
  const label = (s: string) => <span lang={tag} className="mb-1 block text-[16px] font-medium">{s}</span>;

  return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(false);
          const body = { title, note, lang, time: time || null, kind, weekdays: days, date: kind === "once" ? date : null, photo };
          try {
            if (task) await api(`/api/tasks/${task.id}`, { method: "PATCH", body });
            else await api("/api/tasks", { body });
            onSaved();
            onClose();
          } catch {
            setErr(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          {label(t.taskTitle)}
          <input lang={tag} className="field" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>
        <label className="block">
          {label(t.note)}
          <textarea lang={tag} className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <fieldset>
          <legend lang={tag} className="mb-1 text-[16px] font-medium">{t.repeat}</legend>
          <div className="flex flex-wrap gap-2">
            {(["once", "routine"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-[48px] rounded-full border-[1.5px] px-4 ${kind === k ? "border-primary bg-primary text-on-primary" : "border-field bg-paper"}`}>
                <span lang={tag}>{k === "once" ? t.once : t.routine}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {kind === "routine" ? (
          <fieldset>
            <legend lang={tag} className="mb-1 text-[16px] font-medium">{t.days}</legend>
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
        ) : (
          <label className="block">
            {label(t.date)}
            <input type="date" className="field" value={date} min={today} onChange={(e) => setDate(e.target.value)} required />
          </label>
        )}
        <label className="block">
          {label(t.time)}
          <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <div>
          {photo ? <Photos ids={[photo]} onRemove={() => setPhoto(null)} /> : <PhotoButton onAdded={setPhoto} />}
        </div>
        {err && <p role="alert" lang={tag} className="text-danger">{t.saveFailed}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn btn-primary flex-1" disabled={busy || !title.trim()}>
            {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{c.save}</span>}
          </button>
          {task && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                if (!confirm(c.confirmRemove)) return;
                try {
                  await api(`/api/tasks/${task.id}`, { method: "DELETE" });
                  onSaved();
                  onClose();
                } catch {
                  setErr(true);
                }
              }}
            >
              <span lang={tag}>{t.removeTask}</span>
            </button>
          )}
        </div>
      </form>
  );
}
