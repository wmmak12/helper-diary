"use client";
import { useState } from "react";
import Link from "next/link";
import { Home, Send } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { chatS } from "@/lib/strings/tplchat";
import type { HouseholdProfile } from "@/lib/types";

/** Must match MAX_MESSAGE in lib/server/tplchat.ts. */
export const MAX_MESSAGE = 1000;

/**
 * 4.0: the text box that talks to the AI. While the AI writes: ink dots and Send disabled. If it cannot be reached:
 * one line saying so, and the typed message stays in the box to send again.
 */
export function AskBox({ placeholder, label, onSend, rows = 3, id, className = "" }: { placeholder: string; label: string; onSend: (text: string) => Promise<void>; rows?: number; id?: string; className?: string }) {
  const { lang } = useMe();
  const t = useT(chatS);
  const tag = langInfo(lang).tag;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const submit = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSend(v);
      setText("");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      aria-busy={busy}
    >
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea
        id={id}
        data-ask-box
        className={`field !leading-[1.6] ${className}`}
        rows={rows}
        value={text}
        maxLength={MAX_MESSAGE}
        placeholder={placeholder}
        onChange={(e) => { setText(e.target.value); setFailed(false); }}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="min-h-[24px] text-[16px]" aria-live="polite">
          {busy && <span className="inline-flex items-center gap-2 text-primary"><span className="ink-dots" aria-hidden><span /><span /><span /></span><span lang={tag} className="sr-only">{t.writing}</span></span>}
        </span>
        <button className="btn btn-primary" disabled={busy || !text.trim()}>
          <Send size={18} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.send}</span>
        </button>
      </div>
      {failed && <p role="alert" lang={tag} className="mt-2 text-danger">{t.aiFailed}</p>}
    </form>
  );
}

/** "2 adults, Grandma 82, child 3, cat, 3 bedrooms", or "" when the profile is empty. */
export function householdLine(p: HouseholdProfile, t: Record<keyof (typeof chatS)["en"], string>, sep: string): string {
  const parts: string[] = [];
  const unnamedAdults = p.members.filter((m) => !m.name && (m.age === null || m.age >= 18)).length;
  if (unnamedAdults) parts.push(unnamedAdults === 1 ? t.oneAdult : fmt(t.adults, { n: unnamedAdults }));
  for (const m of p.members) {
    if (m.name) parts.push(m.age !== null ? `${m.name} ${m.age}` : m.name);
    else if (m.age !== null && m.age < 18) parts.push(m.age < 2 ? t.baby : fmt(m.age < 13 ? t.child : t.teen, { age: m.age }));
  }
  parts.push(...p.pets);
  if (p.bedrooms !== null) parts.push(fmt(t.bedroomsN, { n: p.bedrooms }));
  return parts.join(sep);
}

/** One line: what the AI uses from the household, or a link to fill it in. */
export function HouseholdLine({ profile }: { profile: HouseholdProfile | null }) {
  const { lang } = useMe();
  const t = useT(chatS);
  const tag = langInfo(lang).tag;
  if (!profile) return null;
  const line = householdLine(profile, t, lang === "zh" ? "、" : ", ");
  return (
    <Link href="/templates/household" className="inline-flex min-h-[44px] items-center gap-2 text-[16px] text-primary underline decoration-rule underline-offset-4">
      <Home size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
      <span lang={tag}>{line || profile.matters ? fmt(t.usingHousehold, { line: line || profile.matters.slice(0, 60) }) : t.noHousehold}</span>
    </Link>
  );
}
