"use client";
import Link from "next/link";
import { useState } from "react";
import { LANGUAGES, langInfo, type Lang } from "@/lib/languages";
import { strings } from "@/lib/client/i18n";
import { authS } from "@/lib/strings/auth";
import { LangSwitch } from "./LangSwitch";

export function SignInForm({ open }: { open: boolean }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = strings(lang, authS);
  const tag = langInfo(lang).tag;
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <LangSwitch value={lang} onChange={setLang} label={t.formLanguage} />
      <div className="mb-6 space-y-0.5">
        {LANGUAGES.map((l) => (
          <p key={l.code} lang={l.tag} className={l.code === lang ? "text-[30px] font-semibold text-ink" : "hidden"}>{strings(l.code, authS).welcome}</p>
        ))}
        <p lang={tag} className="text-ink">{t.tagline}</p>
      </div>
      {!open ? (
        <div role="status" className="rounded-[6px] border border-rule bg-paper p-5">
          <h2 lang={tag} className="text-[22px] font-semibold">{t.closedTitle}</h2>
          <p lang={tag} className="mt-1">{t.closed}</p>
        </div>
      ) : (
        <form
          className="rounded-[6px] border border-rule bg-paper p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setErr(null);
            try {
              const res = await fetch("/api/session", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ login: f.get("login"), password: f.get("password") }),
              });
              if (res.ok) {
                location.href = "/";
                return;
              }
              const code = (await res.json().catch(() => ({}))).error;
              setErr(res.status === 429 ? t.tooMany : code === "closed" ? t.closed : res.status === 401 ? t.wrong : t.failed);
            } catch {
              setErr(t.failed);
            }
            setBusy(false);
          }}
        >
          <label className="block">
            <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.login}</span>
            <input name="login" autoComplete="username" required className="field" aria-invalid={!!err} />
          </label>
          <label className="mt-4 block">
            <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.password}</span>
            <input name="password" type="password" autoComplete="current-password" required className="field" aria-invalid={!!err} />
          </label>
          {err && <p role="alert" lang={tag} className="mt-3 text-danger">{err}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary mt-5 w-full">
            <span lang={tag}>{busy ? t.signingIn : t.signIn}</span>
          </button>
        </form>
      )}
      <p className="mt-5">
        <span lang={tag} className="text-ink">{t.forgot} </span>
        <Link href="/reset" lang={tag} className="inline-flex min-h-[44px] items-center font-semibold text-primary underline underline-offset-4">{t.resetLink}</Link>
      </p>
      <p>
        <span lang={tag} className="text-ink">{t.haveCode} </span>
        <Link href="/signup" lang={tag} className="inline-flex min-h-[44px] items-center font-semibold text-primary underline underline-offset-4">{t.join}</Link>
      </p>
    </div>
  );
}
