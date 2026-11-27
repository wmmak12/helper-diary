"use client";
import { useState } from "react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { qs } from "@/lib/strings/questions";
import { api } from "@/lib/client/api";
import type { Question } from "@/lib/types";
import { Sheet } from "./ui";

/** Sheet for asking a question, on its own or about an entry or task. She types in her own language. */
export function AskQuestion({
  open, onClose, refType = null, refId = null, refTitle, onAsked,
}: { open: boolean; onClose: () => void; refType?: "entry" | "task" | null; refId?: number | null; refTitle?: string; onAsked?: (q: Question) => void }) {
  const t = useT(qs);
  const { lang, toast, refreshBadges } = useMe();
  const tag = langInfo(lang).tag;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={t.askTitle}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          setErr(false);
          try {
            const r = await api<{ question: Question }>("/api/questions", { body: { text, lang, ref_type: refType, ref_id: refId } });
            setText("");
            onAsked?.(r.question);
            toast({ text: t.sent });
            refreshBadges();
            onClose();
          } catch {
            setErr(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {refTitle && <p lang={tag} className="mb-2 text-muted">{fmt(t.askAbout, { title: refTitle })}</p>}
        <textarea lang={tag} value={text} onChange={(e) => setText(e.target.value)} rows={4} className="field" placeholder={t.askPlaceholder} aria-label={t.askPlaceholder} required />
        {err && <p role="alert" lang={tag} className="mt-2 text-danger">{t.failed}</p>}
        <button className="btn btn-primary mt-3 w-full" disabled={busy || !text.trim()}>
          {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{t.send}</span>}
        </button>
      </form>
    </Sheet>
  );
}
