"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { HelpCircle, Send } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import type { Question } from "@/lib/types";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { useApi } from "@/lib/client/useApi";
import { api } from "@/lib/client/api";
import { qpage } from "@/lib/strings/questions";
import { qs } from "@/lib/strings/questions";
import { AskQuestion } from "@/components/AskQuestion";
import { LoadError, PageHeader, Skeleton, Tr } from "@/components/ui";
import { talkDate } from "@/components/talks/format";

export default function QuestionsPage() {
  const t = useT(qpage);
  const a = useT(qs);
  const { me, lang, refreshBadges } = useMe();
  const tag = langInfo(lang).tag;
  const { data, setData, error, loading, reload } = useApi<{ questions: Question[] }>("/api/questions", { poll: 15000 });
  const [asking, setAsking] = useState(false);
  const marked = useRef(new Set<number>());
  const all = data?.questions ?? [];
  const isHelper = me.role === "helper";
  const list = isHelper ? all.filter((q) => q.asker_name === me.name) : all;
  const open = list.filter((q) => !q.answer);
  const answered = list.filter((q) => q.answer);

  // her answers count as seen once shown here
  useEffect(() => {
    if (!isHelper) return;
    const unseen = answered.filter((q) => !q.answer_seen && !marked.current.has(q.id));
    if (!unseen.length) return;
    unseen.forEach((q) => marked.current.add(q.id));
    Promise.all(unseen.map((q) => api(`/api/questions/${q.id}/seen`, { method: "POST" }).catch(() => {}))).then(() => refreshBadges());
  }, [isHelper, answered, refreshBadges]);

  function replace(q: Question) {
    if (data) setData({ questions: data.questions.map((x) => (x.id === q.id ? q : x)) });
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title={t.title}>
        {isHelper && (
          <button className="btn btn-primary" onClick={() => setAsking(true)}>
            <HelpCircle size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{a.ask}</span>
          </button>
        )}
      </PageHeader>
      {loading && !data && <Skeleton rows={5} />}
      {error && !data && <LoadError error={error} onRetry={reload} />}
      {data && list.length === 0 && (
        <p lang={tag} className="page p-5 text-muted">{isHelper ? t.emptyHelper : t.emptyEmployer}</p>
      )}
      {open.length > 0 && (
        <section className="mb-8">
          <h2 lang={tag} className={`mb-3 font-semibold ${lang === "my" ? "text-[22px]" : "text-[24px]"}`}>{t.open}</h2>
          <ul className="space-y-3">
            {open.map((q) => (
              <li key={q.id} id={`q-${q.id}`}>
                <QuestionCard q={q} onAnswered={(nq) => { replace(nq); refreshBadges(); }} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {answered.length > 0 && (
        <section>
          <h2 lang={tag} className={`mb-3 font-semibold ${lang === "my" ? "text-[22px]" : "text-[24px]"}`}>{t.answered}</h2>
          <ul className="space-y-3">
            {answered.map((q) => (
              <li key={q.id} id={`q-${q.id}`}>
                <QuestionCard q={q} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <AskQuestion open={asking} onClose={() => setAsking(false)} onAsked={(q) => data && setData({ questions: [q, ...data.questions] })} />
    </div>
  );
}

function QuestionCard({ q, onAnswered }: { q: Question; onAnswered?: (q: Question) => void }) {
  const t = useT(qpage);
  const { me, lang, toast } = useMe();
  const tag = langInfo(lang).tag;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const refHref = q.ref_type === "entry" ? `/notebook/${q.ref_id}` : q.ref_type === "task" ? `/today#task-${q.ref_id}` : null;
  const canAnswer = me.role === "employer" && !q.answer;
  const fresh = me.role === "helper" && q.answer && !q.answer_seen;

  return (
    <article className={`page relative p-4 ${fresh ? "bg-ribbon-wash" : ""}`}>
      <p lang={tag} className="text-[15px] text-muted">
        <span className="tabular">{talkDate(q.created_at, lang)}</span>
        {me.role === "employer" && <> · {fmt(t.asked, { name: q.asker_name })}</>}
      </p>
      {q.ref_title && refHref && (
        <p className="mt-1 text-[15px]">
          <span lang={tag} className="text-muted">{t.about}: </span>
          <Link href={refHref} className="underline underline-offset-4" lang={langInfo(lang).tag}>
            {pick(q.ref_title, q.ref_lang ?? lang, q.ref_title_tr, lang)}
          </Link>
        </p>
      )}
      <Tr as="p" className="mt-2 text-[20px] font-medium" text={q.text} lang={q.lang} tr={q.tr} />
      {q.answer ? (
        <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="mt-3 border-l-[3px] border-moss pl-3">
          <p lang={tag} className="text-[15px] text-moss">{fmt(t.answeredBy, { name: q.answered_by_name ?? "" })}</p>
          <Tr as="p" className="text-[20px]" text={q.answer} lang={q.answer_lang ?? lang} tr={q.answer_tr} />
        </m.div>
      ) : canAnswer ? (
        <form
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            setBusy(true);
            setErr(false);
            try {
              const r = await api<{ question: Question }>(`/api/questions/${q.id}/answer`, { body: { text, lang } });
              setText("");
              onAnswered?.(r.question);
              toast({ text: t.answerSent });
            } catch {
              setErr(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="sr-only" htmlFor={`ans-${q.id}`} lang={tag}>{t.answerPlaceholder}</label>
          <textarea id={`ans-${q.id}`} lang={tag} className="field" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.answerPlaceholder} />
          {err && <p role="alert" lang={tag} className="mt-1 text-danger">{t.answerFailed}</p>}
          <button className="btn btn-primary btn-small mt-2" disabled={busy || !text.trim()}>
            {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <><Send size={18} strokeWidth={2} aria-hidden /><span lang={tag}>{t.sendAnswer}</span></>}
          </button>
        </form>
      ) : (
        <p lang={tag} className="mt-2 text-[15px] text-muted">{t.noAnswerYet}</p>
      )}
    </article>
  );
}
