"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { langInfo, type Lang } from "@/lib/languages";
import { fmt, strings } from "@/lib/client/i18n";
import { authS } from "@/lib/strings/auth";
import type { PasswordResetFor } from "@/lib/types";
import { LangSwitch } from "./LangSwitch";

/**
 * 5.5: set a new password with the one-time code the owner made. The form opens in the member's own language once
 * the code says whose it is; they can still switch. A good code and a password of 8 or more characters sign them in.
 */
export function ResetForm({ open, initialCode, initialWho }: { open: boolean; initialCode: string; initialWho: PasswordResetFor | null }) {
  const [formLang, setFormLang] = useState<Lang>(initialWho?.lang ?? "en");
  const [touchedLang, setTouchedLang] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [who, setWho] = useState<PasswordResetFor | null>(initialWho);
  // a code that came in the link and is already spent says so at once
  const [err, setErr] = useState<"bad" | "tooMany" | "badInput" | "closed" | "failed" | null>(open && initialCode && !initialWho ? "bad" : null);
  const [busy, setBusy] = useState(false);
  const t = strings(formLang, authS);
  const tag = langInfo(formLang).tag;

  // Look up whose code a typed one is once it is complete.
  useEffect(() => {
    const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!open || c.length !== 10 || code === initialCode) return;
    let live = true;
    fetch(`/api/reset?code=${encodeURIComponent(c)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PasswordResetFor | null) => {
        if (!live) return;
        setWho(d);
        setErr(d ? null : "bad");
        if (d?.lang && !touchedLang) setFormLang(d.lang);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code, open, initialCode, touchedLang]);

  const label = (text: string) => <span lang={tag} className="mb-1 block text-[16px] font-medium">{text}</span>;
  const message = err && { bad: t.resetBad, tooMany: t.tooMany, badInput: t.badInput, closed: t.closed, failed: t.failed }[err];

  return (
    <div>
      <LangSwitch value={formLang} onChange={(l) => { setFormLang(l); setTouchedLang(true); }} label={t.formLanguage} />
      <h1 lang={tag} className={`font-semibold ${formLang === "my" ? "text-[30px]" : "text-[34px] leading-[1.15]"}`}>{t.resetTitle}</h1>
      <p lang={tag} className="mb-5 text-ink">{t.resetLine}</p>
      {!open ? (
        <div role="status" className="rounded-[6px] border border-rule bg-paper p-5">
          <h2 lang={tag} className="text-[22px] font-semibold">{t.closedTitle}</h2>
          <p lang={tag} className="mt-1">{t.closed}</p>
        </div>
      ) : (
        <form
          className="space-y-4 rounded-[6px] border border-rule bg-paper p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setErr(null);
            try {
              const res = await fetch("/api/reset", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ code: f.get("code"), password: f.get("password") }),
              });
              if (res.ok) {
                location.href = "/";
                return;
              }
              const error = (await res.json().catch(() => ({}))).error;
              setErr(res.status === 429 ? "tooMany" : error === "invalid_code" ? "bad" : error === "bad_input" ? "badInput" : error === "closed" ? "closed" : "failed");
              if (error === "invalid_code") setWho(null);
            } catch {
              setErr("failed");
            }
            setBusy(false);
          }}
        >
          <label className="block">
            {label(t.resetCode)}
            <input name="code" value={code} onChange={(e) => { setCode(e.target.value); setWho(null); setErr(null); }} required autoCapitalize="characters" autoComplete="off" className="field tabular tracking-[.08em]" />
          </label>
          {who && (
            <div className="rounded-[6px] border-[1.5px] border-primary bg-desk px-3 py-2">
              <p lang={tag} className="text-[18px] font-semibold">{fmt(t.resetFor, { name: who.name, login: who.login })}</p>
            </div>
          )}
          {/* the sign-in name beside the new password, so a password manager saves the pair */}
          <input type="text" name="username" autoComplete="username" value={who?.login ?? ""} readOnly hidden />
          <label className="block">
            {label(t.passwordNew)}
            <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} className="field" />
          </label>
          {message && <p role="alert" lang={tag} className="text-danger">{message}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            <span lang={tag}>{busy ? t.resetSaving : t.resetSave}</span>
          </button>
        </form>
      )}
      <p className="mt-5">
        <Link href="/signin" lang={tag} className="inline-flex min-h-[44px] items-center font-semibold text-primary underline underline-offset-4">{t.haveAccount}</Link>
      </p>
    </div>
  );
}
