"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { langInfo, type Lang } from "@/lib/languages";
import { strings } from "@/lib/client/i18n";
import { authS } from "@/lib/strings/auth";
import { LangSwitch, LanguageButtons, phoneLang } from "./LangSwitch";

type Role = "employer" | "helper";

export function SignUpForm({ open, initialCode, initialRole }: { open: boolean; initialCode: string; initialRole: Role | null }) {
  // A helper's invite opens the form in the language her phone is set to (when the app has it), and that
  // language is picked for her; she can tap another. The role itself is fixed by the invite.
  const [formLang, setFormLang] = useState<Lang>("en");
  const [touchedLang, setTouchedLang] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [role, setRole] = useState<Role | null>(initialRole);
  const [lang, setLang] = useState<Lang | null>(null);
  const forHelper = (r: Role | null) => {
    const pl = r === "helper" ? phoneLang() : null;
    if (!pl) return;
    setFormLang(pl);
    setLang((l) => l ?? pl);
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the phone's language is only known after hydration
    if (initialRole === "helper") forHelper("helper");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = strings(formLang, authS);
  const tag = langInfo(formLang).tag;

  // Look up who a typed code is for once it is complete.
  useEffect(() => {
    const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!open || c.length !== 10) return;
    let live = true;
    fetch(`/api/signup?code=${encodeURIComponent(c)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { role?: Role } | null) => {
        if (!live) return;
        const r = d?.role ?? null;
        setRole(r);
        if (r === "helper" && !touchedLang) forHelper(r);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code, open, touchedLang]);

  const label = (text: string) => <span lang={tag} className="mb-1 block text-[16px] font-medium">{text}</span>;

  return (
    <div>
      <LangSwitch value={formLang} onChange={(l) => { setFormLang(l); setTouchedLang(true); }} label={t.formLanguage} />
      <h1 lang={tag} className={`font-semibold ${formLang === "my" ? "text-[30px]" : "text-[34px] leading-[1.15]"}`}>{t.joinTitle}</h1>
      <p lang={tag} className="mb-5 text-ink">{t.joinLine}</p>
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
              const res = await fetch("/api/signup", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  code: f.get("code"), name: f.get("name"), login: f.get("login"), password: f.get("password"), lang: lang ?? formLang,
                }),
              });
              if (res.ok) {
                location.href = "/";
                return;
              }
              const error = (await res.json().catch(() => ({}))).error;
              setErr(
                res.status === 429 ? t.tooMany : error === "invalid_code" ? t.badCode : error === "login_taken" ? t.taken : error === "bad_input" ? t.badInput : error === "closed" ? t.closed : t.failed,
              );
            } catch {
              setErr(t.failed);
            }
            setBusy(false);
          }}
        >
          <label className="block">
            {label(t.code)}
            <input name="code" value={code} onChange={(e) => { setCode(e.target.value); setRole(null); }} required autoCapitalize="characters" autoComplete="off" className="field tabular tracking-[.08em]" />
          </label>
          {role && (
            <div className="rounded-[6px] border-[1.5px] border-primary bg-desk px-3 py-2">
              <p lang={tag} className="text-[16px] font-medium">{t.iAm}</p>
              <p lang={tag} className="text-[18px] font-semibold">{role === "employer" ? t.employer : t.helper}</p>
              <p lang={tag} className="text-[15px]">{role === "employer" ? t.employerLine : t.helperLine}</p>
            </div>
          )}
          <label className="block">
            {label(t.name)}
            <input name="name" autoComplete="name" required className="field" />
          </label>
          <label className="block">
            {label(t.loginNew)}
            <input name="login" autoComplete="username" required minLength={3} className="field" />
          </label>
          <label className="block">
            {label(t.passwordNew)}
            <input name="password" type="password" autoComplete="new-password" required minLength={8} className="field" />
          </label>
          <fieldset>
            <legend lang={tag} className="mb-1 text-[16px] font-medium">{t.language}</legend>
            <LanguageButtons value={lang ?? formLang} onChange={(l) => { setLang(l); if (!touchedLang) setFormLang(l); }} label={t.language} />
          </fieldset>
          {err && <p role="alert" lang={tag} className="text-danger">{err}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            <span lang={tag}>{busy ? t.creating : t.create}</span>
          </button>
        </form>
      )}
      <p className="mt-5">
        <Link href="/signin" lang={tag} className="inline-flex min-h-[44px] items-center font-semibold text-primary underline underline-offset-4">{t.haveAccount}</Link>
      </p>
    </div>
  );
}
