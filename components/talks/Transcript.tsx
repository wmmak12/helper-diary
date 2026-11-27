"use client";
import { useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Pencil, RotateCcw } from "lucide-react";
import { langInfo, type Lang } from "@/lib/languages";
import type { Line } from "@/lib/types";
import { useMe, useT } from "@/lib/client/i18n";
import { api, photoUrl } from "@/lib/client/api";
import { talksS } from "@/lib/strings/talks";
import { common } from "@/lib/strings/common";
import { InkIn } from "@/components/ui";
import { clock } from "./format";
import { DeleteFailed, LineBin } from "@/components/talk/TalkLine";

/**
 * Two-sided transcript on a ruled page: each line in the reader's language with the other side beside it
 * (two columns from 640px, stacked on a phone). Employers tap a line to correct it; the translation follows.
 * Employers also get a bin on every row (5.1); the row leaves at once and `failed` marks one the server kept.
 */
export function Transcript({
  lines, talkLang, helperLang, onLine, onDelete, failed,
}: { lines: Line[]; talkLang: Lang; helperLang: Lang; onLine: (l: Line) => void; onDelete?: (l: Line) => void; failed?: Set<number> }) {
  const reduce = useReducedMotion();
  const leave = reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 8, transition: { duration: 0.154, ease: "easeIn" as const } };
  return (
    <ol className="ruled page overflow-hidden pt-2">
      <AnimatePresence initial={false}>
        {lines.map((l) => (
          <m.li key={l.id} layout="position" exit={leave} transition={{ duration: 0.22 }} className="relative list-none border-b border-rule pl-[60px] pr-4 py-3">
            <LineRow line={l} talkLang={talkLang} helperLang={helperLang} onLine={onLine} onDelete={onDelete} failed={!!failed?.has(l.id)} />
          </m.li>
        ))}
      </AnimatePresence>
      <li aria-hidden className="ruled-tail list-none" />
    </ol>
  );
}

function LineRow({
  line, talkLang, helperLang, onLine, onDelete, failed,
}: { line: Line; talkLang: Lang; helperLang: Lang; onLine: (l: Line) => void; onDelete?: (l: Line) => void; failed: boolean }) {
  const t = useT(talksS);
  const c = useT(common);
  const { me, lang } = useMe();
  const tag = langInfo(lang).tag;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(line.text);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const canEdit = me.role === "employer" && line.kind === "text";
  const canDelete = me.role === "employer" && !!onDelete;

  // The reader's side and the other side
  const otherLang: Lang = line.lang === lang ? (lang === helperLang ? talkLang : helperLang) : line.lang;
  const mainLang: Lang = line.lang === lang || line.tr?.[lang] ? lang : line.lang;
  const main = mainLang === line.lang ? line.text : (line.tr?.[mainLang] ?? line.text);
  const other = otherLang === line.lang ? line.text : (line.tr?.[otherLang] ?? "");
  const showOther = otherLang !== mainLang;
  const fromStart = line.speaker === "helper";

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    setErr(false);
    try {
      const r = await api<{ line: Line; failed: boolean }>(`/api/lines/${line.id}`, { method: "PATCH", body: { text } });
      onLine(r.line);
      setEditing(false);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <span className="tabular absolute left-0 top-4 w-[44px] text-right text-[15px] text-muted">{clock(line.created_at)}</span>
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow min-w-0" lang={tag}>{line.speaker === "employer" ? t.employer : (me.helper_name ?? t.helper)}</p>
        {canDelete && !editing && <LineBin lang={lang} onDelete={() => onDelete!(line)} />}
      </div>
      {line.kind === "photo" && line.photo ? (
        <a href={photoUrl(line.photo)} target="_blank" rel="noreferrer" className="mt-1 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(line.photo)} alt={t.photo} className="max-h-64 rounded-[6px] border border-rule object-cover" loading="lazy" />
        </a>
      ) : editing ? (
        <div className="mt-1">
          <label className="sr-only" htmlFor={`line-${line.id}`} lang={tag}>{t.editLine}</label>
          <textarea id={`line-${line.id}`} lang={langInfo(line.lang).tag} className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          {err && <p role="alert" lang={tag} className="mt-1 text-danger">{t.lineFailed}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn btn-primary btn-small" onClick={save} disabled={busy || !text.trim()}>
              {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{t.saveLine}</span>}
            </button>
            <button className="btn btn-quiet btn-small" onClick={() => { setEditing(false); setText(line.text); }} disabled={busy}>
              <span lang={tag}>{c.cancel}</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          aria-label={canEdit ? t.editLine : undefined}
          onClick={canEdit ? () => { setText(line.text); setEditing(true); } : undefined}
          onKeyDown={canEdit ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setText(line.text); setEditing(true); } } : undefined}
          className={`group mt-0.5 grid gap-x-6 gap-y-1 sm:grid-cols-2 ${canEdit ? "cursor-text rounded-[6px] hover:bg-desk/40" : ""}`}
        >
          <InkIn k={`${line.id}-${line.edited_at ?? 0}-main`}>
            <p lang={langInfo(mainLang).tag} className="text-[20px] font-medium" style={{ whiteSpace: "pre-wrap" }}>
              {main}
              {canEdit && <Pencil size={16} strokeWidth={1.75} aria-hidden className="ml-2 inline align-baseline text-muted opacity-60 group-hover:opacity-100" />}
            </p>
          </InkIn>
          {showOther && (
            <m.div
              key={`${line.id}-${line.edited_at ?? 0}-${other ? "tr" : "none"}`}
              initial={{ opacity: 0, x: fromStart ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              {other ? (
                <p lang={langInfo(otherLang).tag} className="text-[20px] text-ink" style={{ whiteSpace: "pre-wrap" }}>{other}</p>
              ) : (
                <RetryTranslate line={line} onLine={onLine} />
              )}
            </m.div>
          )}
        </div>
      )}
      {failed && <DeleteFailed lang={lang} />}
    </>
  );
}

function RetryTranslate({ line, onLine }: { line: Line; onLine: (l: Line) => void }) {
  const tc = useT(common);
  const { me, lang } = useMe();
  const [busy, setBusy] = useState(false);
  if (me.role !== "employer") return <p className="text-[15px] text-muted">…</p>;
  return (
    <button
      className="btn btn-quiet btn-small"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          const r = await api<{ line: Line }>(`/api/lines/${line.id}/retry`, { method: "POST" });
          onLine(r.line);
        } catch {
          /* stays retryable */
        } finally {
          setBusy(false);
        }
      }}
    >
      <RotateCcw size={18} strokeWidth={1.75} aria-hidden /> <span lang={langInfo(lang).tag}>{busy ? "…" : tc.tryAgain}</span>
    </button>
  );
}
