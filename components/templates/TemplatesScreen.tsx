"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Home, Sparkles, WandSparkles } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { useApi } from "@/lib/client/useApi";
import { tplS } from "@/lib/strings/templates";
import { chatS } from "@/lib/strings/tplchat";
import { api } from "@/lib/client/api";
import type { HouseholdProfile, Template, TemplatesView, TplChatView } from "@/lib/types";
import { LoadError, PageHeader, Skeleton } from "@/components/ui";
import { KindIcon } from "@/components/calendar/marks";
import { shortDate } from "@/components/calendar/dates";
import { tplHref } from "./shared";
import { AskBox, HouseholdLine } from "./AskBox";

/**
 * 3.0: Samples and My templates. Each row opens the template's page, where it is edited, previewed and applied.
 * 4.0: the AI chat comes first: a box to describe the home. 5.2: no Past chats; each own template has Change with AI,
 * which opens it with its "Ask the AI to change this template" box focused.
 */
export function TemplatesScreen() {
  const { lang } = useMe();
  const t = useT(tplS);
  const ch = useT(chatS);
  const tag = langInfo(lang).tag;
  const router = useRouter();
  const { data, error, loading, reload } = useApi<TemplatesView>(`/api/templates?lang=${lang}`);
  const household = useApi<{ profile: HouseholdProfile }>("/api/household");
  const start = async (text: string) => {
    const r = await api<TplChatView>("/api/template-chats", { body: { text } });
    router.push(`/templates/chats/${r.chat.id}`);
  };
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title={t.title} back="/calendar">
        <Link href="/templates/household" className="btn btn-quiet btn-small"><Home size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{ch.household}</span></Link>
      </PageHeader>
      <section aria-labelledby="tpl-ai" className="page mb-6 px-4 py-4">
        <h2 id="tpl-ai" lang={tag} className="mb-1 flex items-center gap-2 text-[22px] font-semibold"><Sparkles size={20} strokeWidth={1.75} aria-hidden className="text-ribbon-ink" />{ch.aiTitle}</h2>
        <div className="mb-2"><HouseholdLine profile={household.data?.profile ?? null} /></div>
        <AskBox id="tpl-ai-box" rows={4} className="max-sm:min-h-[236px]" label={ch.aiTitle} placeholder={ch.aiHint} onSend={start} />
      </section>
      {error && !data && <LoadError error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={6} />}
      {data && (
        <div className="space-y-6">
          <section aria-labelledby="tpl-samples">
            <h2 id="tpl-samples" lang={tag} className="mb-2 text-[22px] font-semibold">{t.samples}</h2>
            <ul className="page divide-y divide-rule">
              {data.samples.map((s) => <Row key={s.ref} tpl={s} />)}
            </ul>
          </section>
          <section aria-labelledby="tpl-mine">
            <h2 id="tpl-mine" lang={tag} className="mb-2 text-[22px] font-semibold">{t.mine}</h2>
            {data.mine.length === 0 ? (
              <p lang={tag} className="page px-4 py-4 text-muted">{t.mineEmpty}</p>
            ) : (
              <ul className="page divide-y divide-rule">
                {data.mine.map((s) => <Row key={s.ref} tpl={s} changeWithAi />)}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Row({ tpl, changeWithAi = false }: { tpl: Template; changeWithAi?: boolean }) {
  const { lang } = useMe();
  const t = useT(tplS);
  const ch = useT(chatS);
  const router = useRouter();
  const tag = langInfo(lang).tag;
  const on = tpl.on_calendar[0];
  return (
    <li>
      <Link href={tplHref(tpl.ref)} className="flex items-start gap-3 px-4 py-3 hover:bg-desk/60">
        <span className="min-w-0 flex-1">
          <span lang={langInfo(tpl.lang).tag} className="block text-[19px] font-semibold">{tpl.name}</span>
          {tpl.description && <span lang={langInfo(tpl.lang).tag} className="block text-[16px] text-muted">{tpl.description}</span>}
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
            <span className="flex items-center gap-1 font-medium text-primary"><KindIcon kind="task" size={15} /><span lang={tag}>{fmt(t.nTasks, { n: tpl.tasks.length })}</span></span>
            {tpl.saved_by && <span lang={tag} className="text-muted">{fmt(t.savedBy, { name: tpl.saved_by })}</span>}
            {on && <span lang={tag} className="rounded-[3px] bg-ribbon-wash px-1.5 text-ribbon-ink">{fmt(t.onCalendarFrom, { date: shortDate(on.start_date, tag) })}</span>}
          </span>
        </span>
        <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0 text-muted" />
      </Link>
      {changeWithAi && (
        <div className="px-4 pb-3">
          <button type="button" className="btn btn-quiet btn-small" onClick={() => { keepKeyboard(); router.push(`${tplHref(tpl.ref)}?ask=1`); }}>
            <WandSparkles size={18} strokeWidth={1.75} aria-hidden className="text-ribbon-ink" /> <span lang={tag}>{ch.changeWithAi}</span>
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Phones only raise the keyboard for a focus made inside a tap. Focus a throwaway field now, inside the tap, so the
 * keyboard is already up when the template page moves focus to its ask box; it removes itself once focus moves on.
 */
function keepKeyboard() {
  const el = document.createElement("textarea");
  el.setAttribute("aria-hidden", "true");
  el.tabIndex = -1;
  el.style.cssText = "position:fixed;top:40%;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;";
  document.body.appendChild(el);
  el.focus({ preventScroll: true });
  const drop = () => el.remove();
  el.addEventListener("blur", drop, { once: true });
  window.setTimeout(drop, 5000);
}
