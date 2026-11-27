"use client";
import { m } from "motion/react";
import { HelpCircle } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import { useMe, useT } from "@/lib/client/i18n";
import { todayS } from "@/lib/strings/today";
import type { Task } from "@/lib/types";
import { Photos, Tr } from "@/components/ui";

/** One task on the ruled page: time in the rose margin, a big checkbox, a pen stroke through it when done. */
export function TaskRow({ task, done, onToggle, onAsk, onEdit }: { task: Task; done: boolean; onToggle: () => void; onAsk?: () => void; onEdit?: () => void }) {
  const { lang } = useMe();
  const t = useT(todayS);
  const tag = langInfo(lang).tag;
  const title = pick(task.title, task.lang, task.title_tr, lang);
  return (
    <m.li layout transition={{ layout: { duration: 0.42, ease: [0.65, 0, 0.35, 1] } }} id={`task-${task.id}`} className="relative flex gap-0 border-b border-rule py-3">
      <span className="tabular w-[48px] shrink-0 pr-2 pt-2 text-right text-[15px] text-muted">{task.time ?? ""}</span>
      <div className="flex min-w-0 flex-1 gap-3 pl-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${done ? t.untick : t.tick}: ${title}`}
          onClick={onToggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-[3px] border-2 transition-colors duration-[140ms] ${done ? "border-primary bg-primary" : "border-ink bg-paper"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: done ? 0 : 1, transition: "stroke-dashoffset 140ms var(--ease-ink)" }} />
            </svg>
          </span>
        </button>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-[18px] font-medium">
            <span className="pen-stroke" data-done={done}>
              <Tr text={task.title} lang={task.lang} tr={task.title_tr} />
            </span>
          </p>
          {task.note && <Tr as="p" className="mt-0.5 text-[16px] text-muted" text={task.note} lang={task.lang} tr={task.note_tr} />}
          {task.photo && <Photos ids={[task.photo]} />}
          {(onAsk || onEdit) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {onAsk && (
                <button type="button" onClick={onAsk} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[6px] px-1 text-[15px] text-muted underline decoration-rule underline-offset-4 hover:text-ink">
                  <HelpCircle size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.askAbout}</span>
                </button>
              )}
              {onEdit && (
                <button type="button" onClick={onEdit} className="inline-flex min-h-[44px] items-center px-1 text-[15px] text-muted underline decoration-rule underline-offset-4 hover:text-ink">
                  <span lang={tag}>{t.editTask}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </m.li>
  );
}
