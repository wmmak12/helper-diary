"use client";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { CalendarPlus, Check, ListChecks, Pencil, X } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import type { Draft, Entry } from "@/lib/types";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { api } from "@/lib/client/api";
import { talksS } from "@/lib/strings/talks";
import { common } from "@/lib/strings/common";
import { InkIn, Ribbon, Sheet } from "@/components/ui";
import { photoUrl } from "@/lib/client/api";
import { AutoAddedList } from "./AutoAdded";

type Celebrating = { entry: Entry };

/**
 * "From this talk": drafted key points, instructions and guides. The employer approves, edits or drops each,
 * or sends it to Today. Approving plays the one celebration (design/motion.md) and files it in the Notebook.
 */
export function DraftList({ drafts, onChanged }: { drafts: Draft[]; onChanged: () => void }) {
  const t = useT(talksS);
  const c = useT(common);
  const { lang, toast, refreshBadges } = useMe();
  const tag = langInfo(lang).tag;
  const [celebrating, setCelebrating] = useState<Record<number, Celebrating>>({});
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [compare, setCompare] = useState<Draft | null>(null);

  const waiting = drafts.filter((d) => (d.status === "waiting" || celebrating[d.id]) && !gone.has(d.id));
  const decided = drafts.filter((d) => d.status !== "waiting" && !d.auto && !celebrating[d.id]);

  async function approve(d: Draft, input: { as?: "new" | "merge" | "replace"; body?: string } = {}) {
    const r = await api<{ entry: Entry }>(`/api/drafts/${d.id}/approve`, { body: input });
    setCelebrating((c) => ({ ...c, [d.id]: { entry: r.entry } }));
    refreshBadges();
    // the entry holds for a moment, then leaves the list and the toast appears
    setTimeout(() => {
      setGone((g) => new Set(g).add(d.id));
      toast({ text: t.addedNb, action: { label: c.open, href: `/notebook/${r.entry.id}` } });
      setTimeout(() => {
        setCelebrating((c) => {
          const n = { ...c };
          delete n[d.id];
          return n;
        });
        onChanged();
      }, 300);
    }, 1000);
  }

  return (
    <section aria-labelledby="from-talk">
      <h2 id="from-talk" lang={tag} className={`mb-3 font-semibold ${lang === "my" ? "text-[22px]" : "text-[24px]"}`}>{t.fromTalk}</h2>
      <AutoAddedList drafts={drafts} className="mb-3" />
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {waiting.map((d) => (
            <m.li key={d.id} layout exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.22, ease: [0.65, 0, 0.35, 1] } }} className="overflow-hidden">
              <DraftCard
                draft={d}
                celebrating={celebrating[d.id]}
                onApprove={async () => {
                  if (d.match !== "new" && d.target) {
                    setCompare(d);
                    return;
                  }
                  await approve(d);
                }}
                onChanged={onChanged}
              />
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
      {decided.length > 0 && (
        <ul className="mt-4 space-y-1 text-[15px] text-muted">
          {decided.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-2">
              {d.status === "approved" ? <Check size={16} strokeWidth={2} className="text-moss" aria-hidden /> : <X size={16} strokeWidth={2} aria-hidden />}
              <span lang={langInfo(d.lang).tag}>{d.title}</span>
              <span lang={tag}>· {d.status === "approved" ? t.approved : t.dropped}</span>
              {d.status === "approved" && d.entry_id && (
                <Link href={`/notebook/${d.entry_id}`} lang={tag} className="inline-flex min-h-[44px] items-center text-ink underline underline-offset-4">{c.open}</Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <CompareSheet
        draft={compare}
        onClose={() => setCompare(null)}
        onChoose={async (as, body) => {
          const d = compare!;
          await approve(d, { as, body });
          setCompare(null);
        }}
      />
    </section>
  );
}

function sectionLabel(t: Record<string, string>, s: string) {
  return t[s] ?? s;
}

function DraftCard({ draft, celebrating, onApprove, onChanged }: { draft: Draft; celebrating?: Celebrating; onApprove: () => Promise<void>; onChanged: () => void }) {
  const t = useT(talksS);
  const c = useT(common);
  const { me, lang } = useMe();
  const tag = langInfo(lang).tag;
  const dtag = langInfo(draft.lang).tag;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState<null | "approve" | "drop" | "task" | "save">(null);
  const [err, setErr] = useState(false);
  const [taskId, setTaskId] = useState(draft.task_id);
  const done = !!celebrating;

  async function act(kind: "approve" | "drop" | "task" | "save", fn: () => Promise<unknown>) {
    setBusy(kind);
    setErr(false);
    try {
      await fn();
    } catch {
      setErr(true);
    } finally {
      setBusy(null);
    }
  }

  const kindLabel = draft.kind === "keypoint" ? t.keypoint : draft.kind === "instruction" ? t.instruction : t.guide;
  const matchLabel =
    draft.match === "merge" && draft.target
      ? fmt(t.addsTo, { title: pick(draft.target.title, draft.target.lang, draft.target.title_tr, lang) })
      : draft.match === "replace" && draft.target
        ? fmt(t.replaces, { title: pick(draft.target.title, draft.target.lang, draft.target.title_tr, lang) })
        : t.newEntry;
  const entry = celebrating?.entry;
  const helperText = entry ? pick(entry.body || entry.title, entry.lang, entry.body ? entry.body_tr : entry.title_tr, me.helper_lang) : "";

  return (
    <m.article
      className="relative rounded-[6px] border border-rule border-l-[3px] p-4"
      initial={false}
      animate={{ backgroundColor: done ? "#FBF7EF" : "#F6EBD6", borderLeftColor: done ? "#E4D8C4" : "#B7791F" }}
      transition={{ duration: 0.22, delay: done ? 0.08 : 0 }}
    >
      {done && <Ribbon className="right-4" />}
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <m.p key="filed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22, delay: 0.08 }} lang={tag} className="eyebrow">
            {fmt(t.nbSection, { section: sectionLabel(t, entry?.section ?? draft.section) })}
          </m.p>
        ) : (
          <m.p key="draft" exit={{ opacity: 0, transition: { duration: 0.1 } }} lang={tag} className="eyebrow !text-ochre-ink">
            {kindLabel} · {sectionLabel(t, draft.section)} · {matchLabel}
          </m.p>
        )}
      </AnimatePresence>

      {editing ? (
        <div className="mt-2 space-y-2">
          <label className="block">
            <span lang={tag} className="text-[15px] text-muted">{t.draftTitle}</span>
            <input lang={dtag} className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span lang={tag} className="text-[15px] text-muted">{t.draftBody}</span>
            <textarea lang={dtag} className="field" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary btn-small"
              disabled={!!busy || !title.trim()}
              onClick={() =>
                act("save", async () => {
                  await api(`/api/drafts/${draft.id}`, { method: "PATCH", body: { title, body } });
                  setEditing(false);
                  onChanged();
                })
              }
            >
              <span lang={tag}>{c.save}</span>
            </button>
            <button className="btn btn-quiet btn-small" onClick={() => { setEditing(false); setTitle(draft.title); setBody(draft.body); }}>
              <span lang={tag}>{c.cancel}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 lang={dtag} className="mt-1 text-[20px] font-medium">{draft.title}</h3>
          {draft.body && <p lang={dtag} className="mt-1" style={{ whiteSpace: "pre-wrap" }}>{draft.body}</p>}
        </>
      )}

      {draft.steps.length > 0 && (
        <ol className="mt-3 space-y-3">
          {draft.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="tabular w-6 shrink-0 text-right text-muted">{i + 1}.</span>
              <div className="min-w-0">
                <p lang={dtag}>{s.text}</p>
                {s.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl(s.photo)} alt="" loading="lazy" className="mt-2 h-32 w-auto rounded-[6px] border border-rule object-cover" />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {done && helperText && (
        <InkIn className="mt-3">
          <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16, duration: 0.12 }} lang={langInfo(me.helper_lang).tag} className="text-[20px]">
            {helperText}
          </m.p>
        </InkIn>
      )}

      {err && <p role="alert" lang={tag} className="mt-2 text-danger">{t.decisionFailed}</p>}

      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary btn-small min-w-[120px]" disabled={!!busy || done} onClick={() => act("approve", onApprove)}>
            {done ? (
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                <m.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.14 }} />
              </svg>
            ) : busy === "approve" ? (
              <span className="ink-dots" aria-hidden><span /><span /><span /></span>
            ) : (
              <><Check size={20} strokeWidth={2} aria-hidden /><span lang={tag}>{t.approve}</span></>
            )}
            {busy === "approve" && <span className="sr-only" lang={tag}>{c.loading}</span>}
          </button>
          {!done && (
            <>
              <button className="btn btn-quiet btn-small" disabled={!!busy} onClick={() => setEditing(true)}>
                <Pencil size={18} strokeWidth={1.75} aria-hidden /><span lang={tag}>{c.edit}</span>
              </button>
              <button
                className="btn btn-quiet btn-small"
                disabled={!!busy}
                onClick={() => act("drop", async () => { await api(`/api/drafts/${draft.id}/drop`, { method: "POST" }); onChanged(); })}
              >
                <X size={18} strokeWidth={1.75} aria-hidden /><span lang={tag}>{t.drop}</span>
              </button>
              {taskId ? (
                <Link href="/today" className="btn btn-small text-moss"><ListChecks size={18} strokeWidth={1.75} aria-hidden /><span lang={tag}>{t.onToday}</span></Link>
              ) : (
                <button
                  className="btn btn-quiet btn-small"
                  disabled={!!busy}
                  onClick={() => act("task", async () => { const r = await api<{ task: { id: number } }>(`/api/drafts/${draft.id}/task`, { method: "POST" }); setTaskId(r.task.id); })}
                >
                  <CalendarPlus size={18} strokeWidth={1.75} aria-hidden /><span lang={tag}>{busy === "task" ? c.loading : t.toToday}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </m.article>
  );
}

/** Merge-or-replace: the Notebook entry and the drafted one side by side. */
function CompareSheet({ draft, onClose, onChoose }: { draft: Draft | null; onClose: () => void; onChoose: (as: "new" | "merge" | "replace", body?: string) => Promise<void> }) {
  const t = useT(talksS);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  const [merged, setMerged] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const target = draft?.target;
  const mergedText = merged ?? draft?.merged_body ?? (target && draft ? `${pick(target.body, target.lang, target.body_tr, draft.lang)}\n${draft.body}` : "");

  async function choose(as: "new" | "merge" | "replace") {
    setBusy(as);
    setErr(false);
    try {
      await onChoose(as, as === "merge" ? mergedText : undefined);
      setMerged(null);
    } catch {
      setErr(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={!!draft && !!target} onClose={() => { setMerged(null); onClose(); }} title={t.compareTitle} wide>
      {draft && target && (
        <div>
          {draft.reason && (
            <p lang={langInfo(draft.lang).tag} className="mb-3 rounded-[6px] bg-ribbon-wash px-3 py-2 text-ink">
              <span lang={tag} className="font-semibold">{t.why}: </span>{draft.reason}
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[6px] border border-rule p-4">
              <p lang={tag} className="eyebrow">{t.nowInNb}</p>
              <h3 lang={langInfo(lang).tag} className="mt-1 text-[20px] font-medium">{pick(target.title, target.lang, target.title_tr, lang)}</h3>
              <p lang={langInfo(lang).tag} className="mt-1" style={{ whiteSpace: "pre-wrap" }}>{pick(target.body, target.lang, target.body_tr, lang)}</p>
            </div>
            <div className="rounded-[6px] border border-rule border-l-[3px] border-l-ochre bg-ochre-wash p-4">
              <p lang={tag} className="eyebrow !text-ochre-ink">{t.fromThisTalk}</p>
              <h3 lang={langInfo(draft.lang).tag} className="mt-1 text-[20px] font-medium">{draft.title}</h3>
              <p lang={langInfo(draft.lang).tag} className="mt-1" style={{ whiteSpace: "pre-wrap" }}>{draft.body}</p>
            </div>
          </div>
          <label className="mt-4 block">
            <span lang={tag} className="text-[15px] text-muted">{t.mergedText}</span>
            <textarea lang={langInfo(draft.lang).tag} className="field mt-1" rows={4} value={mergedText} onChange={(e) => setMerged(e.target.value)} />
          </label>
          {err && <p role="alert" lang={tag} className="mt-2 text-danger">{t.decisionFailed}</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button className="btn btn-primary" disabled={!!busy} onClick={() => choose("merge")}>
              {busy === "merge" ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{t.merge}</span>}
            </button>
            <button className="btn btn-quiet" disabled={!!busy} onClick={() => choose("replace")}>
              {busy === "replace" ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{t.replace}</span>}
            </button>
            <button className="btn btn-quiet" disabled={!!busy} onClick={() => choose("new")}>
              {busy === "new" ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{t.keepBoth}</span>}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
