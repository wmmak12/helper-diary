"use client";
import { m } from "motion/react";
import { langInfo, pick } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { calS } from "@/lib/strings/calendar";
import { useApi } from "@/lib/client/useApi";
import type { CalDay } from "@/lib/types";
import { LoadError, Skeleton, Tr } from "@/components/ui";
import { addDays, fmtDate } from "@/components/calendar/dates";
import { KIND, KindIcon } from "@/components/calendar/marks";

/** The helper's look at tomorrow from Today: tasks, a day-off or event line. Nothing to tick. */
export function TomorrowView({ today, onBack }: { today: string; onBack: () => void }) {
  const { lang, me } = useMe();
  const t = useT(calS);
  const tag = langInfo(lang).tag;
  const date = addDays(today, 1);
  const { data, error, reload } = useApi<{ days: CalDay[] }>(`/api/calendar?from=${date}&to=${date}`);
  const day = data?.days[0];
  return (
    <m.section aria-labelledby="tom-h" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="space-y-4">
      <p lang={tag} className="eyebrow">{fmtDate(date, tag, { weekday: "long", day: "numeric", month: "long" })}</p>
      {error && !data && <LoadError error={error} onRetry={reload} />}
      {!data && !error && <Skeleton rows={4} />}
      {day && (
        <>
          {day.items.map((i) => (
            <p key={i.id} className={`flex items-center gap-3 rounded-[6px] px-4 py-3 ${KIND[i.kind].chip}`}>
              <KindIcon kind={i.kind} size={22} />
              <span className="min-w-0 flex-1 text-ink">
                {i.kind === "dayoff" ? (
                  <span lang={tag}>{fmt(t.dayOffFor, { name: me.name }).trim()}</span>
                ) : (
                  <>
                    <span lang={tag}>{t.event}{i.time ? ` · ${i.time}` : ""}: </span>
                    <Tr text={i.title} lang={i.lang} tr={i.title_tr} noToggle />
                  </>
                )}
              </span>
            </p>
          ))}
          <h2 id="tom-h" lang={tag} className="text-[22px] font-semibold">{t.tomorrowTasks}</h2>
          {day.tasks.length === 0 ? (
            <p lang={tag} className="text-muted">{t.noTomorrow}</p>
          ) : (
            <ul className="ruled page px-0 py-1">
              {day.tasks.map((x) => (
                <li key={x.id} className="flex gap-3 border-b border-rule py-3 pr-4">
                  <span className="tabular w-[48px] shrink-0 pt-0.5 text-right text-[15px] text-muted">{x.time ?? ""}</span>
                  <span className="min-w-0 flex-1 pl-3">
                    <span lang={langInfo(lang).tag} className="block text-[18px] font-medium">{pick(x.title, x.lang, x.title_tr, lang)}</span>
                    {x.note && <Tr as="span" className="block text-[16px] text-muted" text={x.note} lang={x.lang} tr={x.note_tr} noToggle />}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <button type="button" className="btn btn-quiet w-full" onClick={onBack}>
        <span lang={tag}>{t.backToToday}</span>
      </button>
    </m.section>
  );
}
