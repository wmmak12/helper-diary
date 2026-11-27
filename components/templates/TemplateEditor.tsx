"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { CalendarCheck, Pencil, Plus, Trash2, X } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { api, ApiErr } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { tplS } from "@/lib/strings/templates";
import { chatS } from "@/lib/strings/tplchat";
import { common } from "@/lib/strings/common";
import type { Template, TemplatePreview, TemplateRepeat, TemplateTask } from "@/lib/types";
import { LoadError, PageHeader, Sheet, Skeleton } from "@/components/ui";
import { fmtDate, shortDate } from "@/components/calendar/dates";
import { daysLabel, nextMonday, tplHref, weekdayNames } from "./shared";
import { AskBox } from "./AskBox";

const ERR: Record<string, "nameRequired" | "noTasks" | "titleRequired" | "pickDays" | "startPast"> = {
  name_required: "nameRequired",
  no_tasks: "noTasks",
  title_required: "titleRequired",
  weekdays_required: "pickDays",
  past_date: "startPast",
};

/** 3.0: one template. Its tasks are a working copy: edits stay on this page until saved or put on the calendar. */
export function TemplateEditor({ tref }: { tref: string }) {
  const { lang } = useMe();
  const { data, error, reload } = useApi<{ template: Template; today: string }>(`/api/templates?ref=${encodeURIComponent(tref)}&lang=${lang}`);
  if (error && !data) return <LoadError error={error} onRetry={reload} />;
  if (!data) return <Skeleton rows={8} />;
  return <Editor key={data.template.ref + (data.template.updated_at ?? "")} tpl={data.template} today={data.today} reload={reload} />;
}

function Editor({ tpl, today, reload }: { tpl: Template; today: string; reload: () => void }) {
  const { lang, toast } = useMe();
  const t = useT(tplS);
  const ch = useT(chatS);
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const tl = langInfo(tpl.lang).tag;
  const router = useRouter();
  const [tasks, setTasks] = useState<TemplateTask[]>(tpl.tasks);
  const [name, setName] = useState(tpl.name);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [start, setStart] = useState(() => nextMonday(today));
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  // 5.2 Change with AI (/templates/mine-12?ask=1): its ask box in view and focused, keyboard up
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("ask") !== "1") return;
    window.history.replaceState(window.history.state, "", window.location.pathname);
    const box = document.getElementById("tpl-ask-box") as HTMLTextAreaElement | null;
    if (!box) return;
    box.focus({ preventScroll: true });
    box.closest("section")?.scrollIntoView({ block: "center" });
  }, []);

  const failText = (x: unknown, fallback: string) =>
    x instanceof ApiErr && ERR[x.f.code] ? t[ERR[x.f.code]] : x instanceof ApiErr && x.f.kind === "offline" ? c.offline : fallback;

  const change = (next: TemplateTask[]) => {
    setTasks(next);
    setErr(null);
    if (preview) setStale(true);
  };

  const doPreview = async () => {
    if (tasks.length === 0) return setErr(t.noTasks);
    if (!start || start < today) return setErr(t.startPast);
    setBusy("preview");
    setErr(null);
    try {
      const r = await api<{ preview: TemplatePreview }>("/api/templates/preview", { body: { tasks, start } });
      setPreview(r.preview);
      setStale(false);
    } catch (x) {
      setErr(failText(x, c.loadFailed));
    } finally {
      setBusy(null);
    }
  };

  const put = async () => {
    setBusy("put");
    setErr(null);
    try {
      const r = await api<{ added: number; start: string; name: string }>("/api/templates/apply", { body: { source: tpl.ref, name: name.trim() || tpl.name, lang: tpl.lang, tasks, start } });
      router.push(`/calendar?d=${r.start}&added=${r.added}&from=${encodeURIComponent(r.name)}`);
    } catch (x) {
      setErr(failText(x, t.putFailed));
      setBusy(null);
    }
  };

  const saveMine = async () => {
    if (!name.trim()) return setErr(t.nameRequired);
    if (tasks.length === 0) return setErr(t.noTasks);
    setBusy("save");
    setErr(null);
    try {
      await api(`/api/templates/${target!.split(":")[1]}`, { method: "PATCH", body: { name, tasks } });
      toast({ text: c.saved });
      if (draft) router.push(tplHref(target!));
      else reload();
    } catch (x) {
      setErr(failText(x, t.saveFailed));
    } finally {
      setBusy(null);
    }
  };

  const del = async () => {
    if (!confirm(t.confirmDelete)) return;
    try {
      await api(`/api/templates/${tpl.ref.split(":")[1]}`, { method: "DELETE" });
      toast({ text: t.deleted });
      router.push("/templates");
    } catch (x) {
      setErr(failText(x, t.saveFailed));
    }
  };

  const removeApp = async (id: number, count: number) => {
    if (!confirm(fmt(t.confirmRemoveN, { n: count }))) return;
    setBusy(`remove${id}`);
    try {
      const r = await api<{ removed: number }>(`/api/templates/applications/${id}`, { method: "DELETE" });
      toast({ text: fmt(t.removedN, { n: r.removed }) });
      setPreview(null);
      reload();
    } catch (x) {
      setErr(failText(x, t.saveFailed));
    } finally {
      setBusy(null);
    }
  };

  const mine = tpl.kind === "mine";
  // 4.0: a chat's proposal opened by Keep editing; Save changes goes to the own template the chat was changing
  const draft = tpl.kind === "draft";
  const target = mine ? tpl.ref : (tpl.draft_of ?? null);
  const askChange = async (text: string) => {
    const r = await api<{ chat: { id: number } }>("/api/template-chats", { body: { text, base_ref: tpl.ref, base_name: name.trim() || tpl.name, base_tasks: tasks } });
    router.push(`/templates/chats/${r.chat.id}`);
  };
  return (
    <div className="mx-auto max-w-[760px] pb-8">
      <PageHeader title={tpl.name} titleLang={tpl.lang} back={draft ? `/templates/chats/${tpl.ref.split(":")[1]}` : "/templates"} eyebrow={draft ? ch.draftEyebrow : mine ? t.mine : t.samples} />
      {tpl.description && <p lang={tl} className="-mt-2 mb-3 text-[17px] text-muted">{tpl.description}</p>}
      {tpl.saved_by && <p lang={tag} className="-mt-2 mb-3 text-[16px] text-muted">{fmt(t.savedBy, { name: tpl.saved_by })}</p>}

      {tpl.on_calendar.map((a) => (
        <div key={a.id} className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border-l-[3px] border-ribbon-ink bg-ribbon-wash px-3 py-2">
          <span lang={tag} className="text-ribbon-ink">
            <CalendarCheck size={18} strokeWidth={1.75} aria-hidden className="mr-1.5 inline align-[-3px]" />
            {fmt(t.onCalendarFrom, { date: shortDate(a.start_date, tag) })} · {fmt(t.nTasks, { n: a.count })}
          </span>
          <button type="button" className="btn btn-danger btn-small" disabled={busy === `remove${a.id}`} onClick={() => removeApp(a.id, a.count)}>
            <span lang={tag}>{t.removeTasks}</span>
          </button>
        </div>
      ))}

      {!draft && (
        <section aria-labelledby="tpl-ask" className="page mb-5 px-4 py-3">
          <h2 id="tpl-ask" lang={tag} className="mb-2 text-[19px] font-semibold">{ch.askChange}</h2>
          <AskBox id="tpl-ask-box" rows={2} label={ch.askChange} placeholder={ch.askChangeHint} onSend={askChange} />
        </section>
      )}

      {(mine || draft) && (
        <label className="mb-4 block">
          <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.name}</span>
          <input lang={tl} className="field" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setErr(null); }} />
        </label>
      )}
      {tpl.kind === "sample" && <p lang={tag} className="mb-3 text-[16px] text-muted">{t.sampleCopy}</p>}

      <section aria-labelledby="tpl-tasks">
        <h2 id="tpl-tasks" lang={tag} className="mb-2 text-[22px] font-semibold">{t.tasks} <span className="text-[17px] font-normal text-muted">· {tasks.length}</span></h2>
        {tasks.length === 0 ? (
          <p lang={tag} className="page px-4 py-4 text-muted">{t.noTasksYet}</p>
        ) : (
          <ul className="page divide-y divide-rule overflow-hidden">
            <AnimatePresence initial={false}>
              {tasks.map((x, i) => (
                <m.li
                  key={`${i}:${x.title}`}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-2 py-2 pl-4 pr-2"
                >
                  <button type="button" onClick={() => setEditing(i)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <span className="tabular w-[48px] shrink-0 pt-0.5 text-[15px] text-muted">{x.time ?? ""}</span>
                    <span className="min-w-0 flex-1">
                      <span lang={tl} className="block text-[18px] font-medium">{x.title}</span>
                      <span lang={tag} className="block text-[15px] text-primary">{daysLabel(x, t, tag)}</span>
                      {x.note && <span lang={tl} className="block text-[15px] text-muted">{x.note}</span>}
                    </span>
                  </button>
                  <button type="button" onClick={() => setEditing(i)} aria-label={`${t.editTask}: ${x.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] text-ink hover:bg-desk">
                    <Pencil size={18} strokeWidth={1.75} aria-hidden />
                  </button>
                  <button type="button" onClick={() => change(tasks.filter((_, j) => j !== i))} aria-label={`${t.removeTask}: ${x.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] text-danger hover:bg-danger-wash">
                    <X size={20} strokeWidth={1.75} aria-hidden />
                  </button>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        <button type="button" className="btn btn-quiet mt-3" onClick={() => setEditing("new")}>
          <Plus size={20} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.addTask}</span>
        </button>
      </section>

      <section aria-labelledby="tpl-start" className="mt-6">
        <h2 id="tpl-start" className="sr-only">{t.start}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[180px] flex-1">
            <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.start}</span>
            <input
              type="date"
              className="field"
              value={start}
              min={today}
              onChange={(e) => { setStart(e.target.value); setErr(null); if (preview) setStale(true); }}
            />
          </label>
          <button type="button" className="btn btn-quiet" onClick={doPreview} disabled={busy === "preview"}>
            {busy === "preview" ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{t.preview}</span>}
          </button>
        </div>
        {start && <p lang={tag} className="mt-1 text-[15px] text-muted">{fmtDate(start, tag, { weekday: "long", day: "numeric", month: "long" })}</p>}
      </section>

      {err && <p role="alert" lang={tag} className="mt-3 text-danger">{err}</p>}

      <AnimatePresence>
        {preview && (
          <m.section
            aria-labelledby="tpl-preview"
            className="mt-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 id="tpl-preview" lang={tag} className="mb-2 text-[22px] font-semibold">{fmt(t.previewHead, { date: shortDate(preview.start, tag) })}</h2>
            {stale ? (
              <p lang={tag} className="page px-4 py-3 text-muted">{t.previewStale}</p>
            ) : (
              <>
                <ul className="page divide-y divide-rule">
                  {preview.days.map((d) => (
                    <li key={d.date} className="px-4 py-3">
                      <span lang={tag} className="block font-semibold">{fmtDate(d.date, tag, { weekday: "long", day: "numeric", month: "short" })}</span>
                      {d.tasks.length === 0 && <span lang={tag} className="block text-[15px] text-muted">{t.nothingThatDay}</span>}
                      {d.tasks.map((x) => (
                        <span key={x.index} className="flex items-baseline gap-2 py-0.5">
                          <span className="tabular w-[44px] shrink-0 text-[15px] text-muted">{x.time ?? ""}</span>
                          <span className={`min-w-0 flex-1 ${x.already ? "text-muted" : ""}`}>
                            <span lang={tl}>{x.title}</span>
                            {x.already && <span lang={tag} className="ml-2 whitespace-nowrap rounded-[3px] bg-desk px-1.5 text-[14px] text-muted">{t.already}</span>}
                          </span>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                <p lang={tag} className="mt-3 text-[16px]">{preview.adding > 0 ? fmt(t.willAdd, { n: preview.adding }) : t.nothingToAdd}</p>
                {preview.adding > 0 && (
                  <button type="button" className="btn btn-primary mt-3 w-full" onClick={put} disabled={busy === "put"}>
                    {busy === "put" ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <><CalendarCheck size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.put}</span></>}
                  </button>
                )}
              </>
            )}
          </m.section>
        )}
      </AnimatePresence>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-rule pt-4">
        {target ? (
          <>
            <button type="button" className="btn btn-quiet" onClick={saveMine} disabled={busy === "save"}><span lang={tag}>{t.saveChanges}</span></button>
            <button type="button" className="btn btn-quiet" onClick={() => setSaveOpen(true)}><span lang={tag}>{t.saveAs}</span></button>
            {mine && <button type="button" className="btn btn-danger" onClick={del}><Trash2 size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.deleteTpl}</span></button>}
          </>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => setSaveOpen(true)}><span lang={tag}>{t.saveAs}</span></button>
        )}
      </div>

      <TaskSheet
        open={editing !== null}
        task={typeof editing === "number" ? tasks[editing] : null}
        taskLang={tl}
        onClose={() => setEditing(null)}
        onSave={(x) => {
          change(editing === "new" || editing === null ? [...tasks, x].sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99")) : tasks.map((y, j) => (j === editing ? x : y)));
          setEditing(null);
        }}
        onRemove={typeof editing === "number" ? () => { change(tasks.filter((_, j) => j !== editing)); setEditing(null); } : undefined}
      />
      <SaveAsSheet
        open={saveOpen}
        initial={mine ? "" : name.trim() || tpl.name}
        onClose={() => setSaveOpen(false)}
        onSave={async (n) => {
          if (tasks.length === 0) throw new Error(t.noTasks);
          try {
            const r = await api<{ template: Template }>("/api/templates", { body: { name: n, lang: tpl.lang, tasks } });
            toast({ text: t.savedMine });
            router.push(tplHref(r.template.ref));
          } catch (x) {
            throw new Error(failText(x, t.saveFailed));
          }
        }}
      />
    </div>
  );
}

/** Edit one task of the working copy: title, time, note and its days. */
export function TaskSheet({ open, task, taskLang, onClose, onSave, onRemove }: { open: boolean; task: TemplateTask | null; taskLang: string; onClose: () => void; onSave: (t: TemplateTask) => void; onRemove?: () => void }) {
  const { lang } = useMe();
  const t = useT(tplS);
  const tag = langInfo(lang).tag;
  const [x, setX] = useState<TemplateTask>(blank());
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the sheet starts from the task it was opened on
    if (open) { setX(task ?? blank()); setErr(null); }
  }, [open, task]);
  const names = weekdayNames(tag);
  const set = (p: Partial<TemplateTask>) => { setX((v) => ({ ...v, ...p })); setErr(null); };
  const pill = (on: boolean) => `inline-flex min-h-[44px] items-center rounded-full border-[1.5px] px-4 py-1 ${on ? "border-primary bg-primary text-on-primary" : "border-field bg-paper text-ink"}`;
  return (
    <Sheet open={open} onClose={onClose} title={task ? t.editTask : t.addTask}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!x.title.trim()) return setErr(t.titleRequired);
          if (x.repeat === "weekly" && x.weekdays.length === 0) return setErr(t.pickDays);
          onSave({ ...x, title: x.title.trim(), note: x.note.trim(), weekdays: x.repeat === "weekly" ? x.weekdays : [], day: x.repeat === "once" ? (x.day ?? 1) : null });
        }}
      >
        <label className="block">
          <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.taskTitle}</span>
          <input lang={taskLang} className="field" value={x.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} aria-invalid={!!err && !x.title.trim()} />
        </label>
        <label className="block">
          <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.time}</span>
          <input type="time" className="field" value={x.time ?? ""} onChange={(e) => set({ time: e.target.value || null })} />
        </label>
        <label className="block">
          <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.note}</span>
          <textarea lang={taskLang} className="field" rows={2} value={x.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} />
        </label>
        <fieldset>
          <legend lang={tag} className="mb-1 text-[16px] font-medium">{t.days}</legend>
          <div className="flex flex-wrap gap-1.5">
            {(["daily", "weekly", "monthly", "once"] as TemplateRepeat[]).map((r) => (
              <button key={r} type="button" aria-pressed={x.repeat === r} className={pill(x.repeat === r)} onClick={() => set({ repeat: r, day: r === "once" ? (x.day ?? 1) : x.day, weekdays: r === "weekly" && x.weekdays.length === 0 ? [1] : x.weekdays })}>
                <span lang={tag}>{r === "daily" ? t.rDaily : r === "weekly" ? t.rWeekly : r === "monthly" ? t.rMonthly : t.rOnce}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {x.repeat === "weekly" && (
          <fieldset>
            <legend lang={tag} className="mb-1 text-[16px] font-medium">{t.onDays}</legend>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((i) => (
                <button key={i} type="button" lang={tag} aria-pressed={x.weekdays.includes(i)} onClick={() => set({ weekdays: x.weekdays.includes(i) ? x.weekdays.filter((d) => d !== i) : [...x.weekdays, i].sort() })} className={`min-h-[44px] min-w-[52px] rounded-[6px] border-[1.5px] px-2 py-1 text-[16px] ${x.weekdays.includes(i) ? "border-primary bg-primary text-on-primary" : "border-field bg-paper"}`}>
                  {names[i]}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {x.repeat === "once" && (
          <fieldset>
            <legend lang={tag} className="mb-1 text-[16px] font-medium">{t.whichDay}</legend>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" lang={tag} aria-pressed={x.day === n} onClick={() => set({ day: n })} className={`min-h-[44px] rounded-[6px] border-[1.5px] px-3 py-1 text-[16px] ${x.day === n ? "border-primary bg-primary text-on-primary" : "border-field bg-paper"}`}>
                  {fmt(t.dayN, { n })}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {x.repeat === "monthly" && <p lang={tag} className="text-[16px] text-muted">{t.monthly}</p>}
        {err && <p role="alert" lang={tag} className="text-danger">{err}</p>}
        <div className="flex gap-2">
          {onRemove && (
            <button type="button" className="btn btn-danger" onClick={onRemove}><Trash2 size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.removeTask}</span></button>
          )}
          <button className="btn btn-primary flex-1"><span lang={tag}>{t.done}</span></button>
        </div>
      </form>
    </Sheet>
  );
}

function blank(): TemplateTask {
  return { title: "", note: "", time: null, repeat: "daily", weekdays: [], day: null };
}

/** Save as my template: a name, then it appears under My templates for both employers. */
export function SaveAsSheet({ open, initial, title, onClose, onSave }: { open: boolean; initial: string; title?: string; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const { lang } = useMe();
  const t = useT(tplS);
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const [name, setName] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- each opening starts from the suggested name
    if (open) { setName(initial); setErr(null); }
  }, [open, initial]);
  return (
    <Sheet open={open} onClose={onClose} title={title ?? t.saveAs}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return setErr(t.nameRequired);
          setBusy(true);
          setErr(null);
          try {
            await onSave(name.trim());
            onClose();
          } catch (x) {
            setErr((x as Error).message || t.saveFailed);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.name}</span>
          <input lang={tag} className="field" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setErr(null); }} aria-invalid={!!err} />
        </label>
        {err && <p role="alert" lang={tag} className="text-danger">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{c.save}</span>}
        </button>
      </form>
    </Sheet>
  );
}

