"use client";
import { useState } from "react";
import { m } from "motion/react";
import { MicOff, Pencil, RotateCcw, Trash2, WifiOff, Keyboard } from "lucide-react";
import { langInfo, type Lang } from "@/lib/languages";
import { strings } from "@/lib/client/i18n";
import { talk as talkStrings } from "@/lib/strings/talk";
import { photoUrl } from "@/lib/client/api";
import type { Line } from "@/lib/types";
import { InkIn } from "@/components/ui";

export function clock(ts: number) {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export type NoticeKind = "micBlocked" | "offline" | "translateFailed" | "listenFailed";

/** An inline notice in the employer's language and in the helper's, with a way forward. */
export function Notice({
  kind, lang, helperLang, onRetry, onType, typeLabel,
}: { kind: NoticeKind; lang: Lang; helperLang: Lang; onRetry?: () => void; onType?: () => void; typeLabel?: { text: string; lang: Lang } }) {
  const a = strings(lang, talkStrings);
  const b = strings(helperLang, talkStrings);
  const Icon = kind === "micBlocked" ? MicOff : kind === "offline" ? WifiOff : RotateCcw;
  return (
    <m.div
      role="alert"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="mt-2 rounded-[6px] border border-danger bg-danger-wash p-3 text-ink"
    >
      <div className="flex gap-2">
        <Icon size={22} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 space-y-1">
          <p lang={langInfo(lang).tag}>{a[kind]}</p>
          {helperLang !== lang && <p lang={langInfo(helperLang).tag}>{b[kind]}</p>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {onRetry && (
          <button type="button" className="btn btn-quiet btn-small" onClick={onRetry}>
            <RotateCcw size={20} strokeWidth={1.75} aria-hidden /> <span lang={langInfo(lang).tag}>{a.tryAgain}</span>
          </button>
        )}
        {onType && (
          <button type="button" className="btn btn-quiet btn-small" onClick={onType}>
            <Keyboard size={20} strokeWidth={1.75} aria-hidden /> <span lang={langInfo(typeLabel?.lang ?? lang).tag} style={(typeLabel?.lang ?? lang) === "my" ? { lineHeight: 1.8 } : undefined}>{typeLabel?.text ?? a.typeIt}</span>
          </button>
        )}
      </div>
    </m.div>
  );
}

/**
 * The row's bin (5.1): always visible at the top right, level with the speaker line and clear of the words.
 * Its 44px tap area hangs into the row's top padding and ends where the words begin; the speaker line never wraps for it.
 */
export function LineBin({ lang, onDelete }: { lang: Lang; onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={onDelete}
      aria-label={strings(lang, talkStrings).deleteLine}
      data-line-bin
      className="-mr-3 -mt-3 grid h-11 w-11 shrink-0 place-items-center rounded-[6px] text-muted transition-colors duration-[140ms] hover:text-ink active:text-ink"
    >
      <Trash2 size={19} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

/** Shown under a row only when its delete failed on the server and the row came back. */
export function DeleteFailed({ lang }: { lang: Lang }) {
  return (
    <p role="alert" lang={langInfo(lang).tag} className="mt-1 text-[15px] text-danger">
      {strings(lang, talkStrings).deleteFailed}
    </p>
  );
}

/**
 * One line of the transcript. The original writes in; the translation enters from its speaker's side
 * (the employer speaks from the end side, the helper types from the start side).
 */
export function TalkLine({
  line, me, readLang, helperLang, helperName, onEdit, onRetry, retrying, onType, typeLabel, onDelete, deleteFailed,
}: {
  line: Line;
  me: Lang;
  readLang: Lang;
  helperLang: Lang;
  helperName: string;
  onEdit?: (text: string) => Promise<boolean>;
  onRetry?: () => void;
  retrying?: boolean;
  onType?: () => void;
  typeLabel?: { text: string; lang: Lang };
  onDelete?: () => void;
  deleteFailed?: boolean;
}) {
  const s = strings(me, talkStrings);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.text);
  const [busy, setBusy] = useState(false);
  const fromEmployer = line.speaker === "employer";
  const target: Lang = fromEmployer ? helperLang : readLang;
  const translation = line.kind === "text" ? (line.lang === target ? null : (line.tr?.[target] ?? null)) : null;
  const key = `${line.id}-${line.edited_at ?? 0}`;
  const who = fromEmployer ? s.speakerYou : helperName;

  return (
    <div className="relative pb-4">
      <span className="tabular absolute -left-[56px] top-1 w-10 text-right text-[15px] text-muted">{clock(line.created_at)}</span>
      <div className="flex items-start justify-between gap-2">
        <p className={`eyebrow min-w-0 ${fromEmployer ? "" : "!text-ochre-ink"}`} lang={langInfo(me).tag}>
          {who} · <span lang={langInfo(line.lang).tag}>{langInfo(line.lang).name}</span>
        </p>
        {onDelete && !editing && <LineBin lang={me} onDelete={onDelete} />}
      </div>

      {line.kind === "photo" && line.photo ? (
        <a href={photoUrl(line.photo)} target="_blank" rel="noreferrer" className="mt-1 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(line.photo)} alt={s.photo} className="max-h-60 rounded-[6px] border border-rule object-cover" />
        </a>
      ) : editing ? (
        <form
          className="mt-1"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!onEdit || !draft.trim()) return;
            setBusy(true);
            const ok = await onEdit(draft);
            setBusy(false);
            if (ok) setEditing(false);
          }}
        >
          <label className="sr-only" htmlFor={`line-${line.id}`}>{s.editLine}</label>
          <textarea id={`line-${line.id}`} lang={langInfo(line.lang).tag} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="field" autoFocus />
          <div className="mt-2 flex gap-2">
            <button className="btn btn-primary btn-small" disabled={busy || !draft.trim()}>
              {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={langInfo(me).tag}>{s.saveLine}</span>}
            </button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => { setDraft(line.text); setEditing(false); }}>
              <span lang={langInfo(me).tag}>{strings(me, { en: { c: "Cancel" }, zh: { c: "取消" }, my: { c: "မလုပ်တော့ပါ" } }).c}</span>
            </button>
          </div>
        </form>
      ) : (
        <InkIn k={key}>
          {onEdit ? (
            <button
              type="button"
              onClick={() => { setDraft(line.text); setEditing(true); }}
              className="group -mx-1 block w-full rounded-[6px] px-1 text-left hover:bg-desk/60"
              aria-label={`${s.edit}: ${line.text}`}
            >
              <span lang={langInfo(line.lang).tag} className={fromEmployer ? "text-[20px] leading-snug" : "text-[22px] font-medium"}>{line.text}</span>
              <Pencil size={16} strokeWidth={1.75} aria-hidden className="ml-2 inline align-baseline text-muted opacity-60 group-hover:opacity-100" />
            </button>
          ) : (
            <p lang={langInfo(line.lang).tag} className={fromEmployer ? "text-[20px] leading-snug" : "text-[22px] font-medium"}>{line.text}</p>
          )}
        </InkIn>
      )}

      {line.kind === "text" && !editing && (
        translation ? (
          <m.div
            key={`tr-${key}`}
            initial={{ opacity: 0, x: fromEmployer ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-1.5"
          >
            <p lang={langInfo(target).tag} className="font-medium text-ink" style={{ fontSize: "clamp(24px, 6.4vw, 26px)", lineHeight: target === "my" ? 1.95 : 1.35 }}>
              {translation}
            </p>
          </m.div>
        ) : line.lang !== target ? (
          retrying ? (
            <p className="mt-2 text-muted" aria-live="polite">
              <span className="ink-dots" aria-hidden><span /><span /><span /></span>
              <span className="sr-only">{s.translating}</span>
            </p>
          ) : (
            <Notice kind="translateFailed" lang={me} helperLang={helperLang} onRetry={onRetry} onType={onType} typeLabel={typeLabel} />
          )
        ) : null
      )}
      {deleteFailed && <DeleteFailed lang={me} />}
    </div>
  );
}
