"use client";
import { useEffect, useState } from "react";
import { m } from "motion/react";
import { Copy, LogOut, Share2, UserPlus } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { settingsS } from "@/lib/strings/settings";
import { api, ApiErr } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import type { Invite, Me, Member, PasswordChange, PasswordResetMade } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { LanguageButtons } from "./LangSwitch";
import { AiSettingsSection } from "./AiSettings";

function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="btn btn-quiet btn-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* clipboard blocked: the text is on screen to copy by hand */
        }
      }}
    >
      {copied ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <m.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.14 }} />
        </svg>
      ) : (
        <Copy size={22} strokeWidth={1.75} aria-hidden />
      )}
      <span>{copied ? done : label}</span>
    </button>
  );
}

export function SettingsScreen() {
  const { me, setMe, lang } = useMe();
  const t = useT(settingsS);
  const tag = langInfo(lang).tag;
  const [name, setName] = useState(me.name);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState<"employer" | "helper">("helper");
  const [made, setMade] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNote, setPwNote] = useState<{ ok: boolean; text: string } | null>(null);
  // 5.5: the one-time reset code the owner just made, shown under that member until the screen is left
  const [reset, setReset] = useState<{ id: number; code: string } | null>(null);
  const invites = useApi<{ invites: Invite[] }>(me.is_admin ? "/api/invites" : null);
  const members = useApi<{ members: Member[] }>("/api/members");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const fail = () => setErr(t.failed);
  // a link to /settings#ai (the owner's line on Talk) opens Settings at the AI section
  useEffect(() => {
    if (me.is_admin && window.location.hash === "#ai") document.getElementById("ai")?.scrollIntoView({ block: "start" });
  }, [me.is_admin]);
  const h2 = (s: string) => <h2 lang={tag} className="mb-2 text-[24px] font-semibold">{s}</h2>;

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <PageHeader title={t.title} />
      {err && <p role="alert" lang={tag} className="rounded-[6px] border border-danger bg-danger-wash p-3">{err}</p>}

      {!me.ai && !me.is_admin && (
        <section className="page space-y-1 p-4">
          <p lang={tag}>{t.aiOff}</p>
        </section>
      )}

      <section className="page p-4 sm:p-5">
        {h2(t.language)}
        <p lang={tag} className="mb-3 text-muted">{t.languageLine}</p>
        <LanguageButtons
          value={lang}
          label={t.language}
          onChange={async (code) => {
            if (code === lang) return;
            setErr(null);
            try {
              const r = await api<{ me: Me }>("/api/me", { method: "PATCH", body: { lang: code } });
              setMe(r.me);
            } catch {
              fail();
            }
          }}
        />
      </section>

      {me.is_admin && <AiSettingsSection />}

      <section className="page p-4 sm:p-5">
        {h2(t.account)}
        <p lang={tag} className="mb-3 text-muted">{fmt(t.signedInAs, { login: me.login })}</p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              const r = await api<{ me: Me }>("/api/me", { method: "PATCH", body: { name } });
              setMe(r.me);
              setMsg(t.nameSaved);
            } catch {
              fail();
            }
          }}
        >
          <label className="min-w-[200px] flex-1">
            <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.yourName}</span>
            <input className="field" value={name} onChange={(e) => { setName(e.target.value); setMsg(null); }} maxLength={60} required />
          </label>
          <button className="btn btn-quiet"><span lang={tag}>{t.saveName}</span></button>
        </form>
        {msg && <p lang={tag} className="mt-2 text-moss">{msg}</p>}
        {/* 5.4: change your own password; the server signs out your other devices. A password manager may fill both
            boxes in one tick, so each box updates from the latest state. */}
        <form
          className="mt-6 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pwBusy) return;
            setPwNote(null);
            if (pw.next.length < 8) return setPwNote({ ok: false, text: t.passwordShort });
            setPwBusy(true);
            try {
              const change: PasswordChange = { current: pw.current, password: pw.next };
              await api("/api/me/password", { method: "PUT", body: change });
              setPw({ current: "", next: "" });
              setPwNote({ ok: true, text: t.passwordChanged });
            } catch (e) {
              const code = e instanceof ApiErr ? e.f.code : "";
              setPwNote({ ok: false, text: code === "wrong_password" ? t.wrongPassword : code === "bad_input" ? t.passwordShort : code === "too_many_attempts" ? t.tooMany : t.failed });
            } finally {
              setPwBusy(false);
            }
          }}
        >
          <h3 lang={tag} className="w-full text-[20px] font-semibold">{t.password}</h3>
          <label className="min-w-[200px] flex-1">
            <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.currentPassword}</span>
            <input className="field" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => { const v = e.target.value; setPw((p) => ({ ...p, current: v })); setPwNote(null); }} maxLength={200} required />
          </label>
          <label className="min-w-[200px] flex-1">
            <span lang={tag} className="mb-1 block text-[16px] font-medium">{t.newPassword}</span>
            <input className="field" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => { const v = e.target.value; setPw((p) => ({ ...p, next: v })); setPwNote(null); }} minLength={8} maxLength={200} required />
          </label>
          <button className="btn btn-quiet" disabled={pwBusy}><span lang={tag}>{t.savePassword}</span></button>
        </form>
        {pwNote && <p role={pwNote.ok ? "status" : "alert"} lang={tag} className={`mt-2 ${pwNote.ok ? "text-moss" : "text-danger"}`}>{pwNote.text}</p>}
        <button
          className="btn btn-quiet mt-5"
          onClick={async () => {
            try {
              await api("/api/session", { method: "DELETE" });
            } finally {
              location.href = "/signin";
            }
          }}
        >
          <LogOut size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.signOut}</span>
        </button>
      </section>

      {me.is_admin && (
        <section className="page p-4 sm:p-5">
          {h2(t.invite)}
          <p lang={tag} className="mb-3 text-muted">{t.inviteLine}</p>
          <div className="mb-3 flex flex-wrap gap-2" role="radiogroup">
            {(["helper", "employer"] as const).map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                className={`min-h-[48px] rounded-full border-[1.5px] px-4 ${role === r ? "border-primary bg-primary text-on-primary" : "border-field bg-paper text-ink"}`}
              >
                <span lang={tag}>{r === "helper" ? t.forHelper : t.forEmployer}</span>
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={async () => {
              setErr(null);
              try {
                const r = await api<{ code: string; invites: Invite[] }>("/api/invites", { body: { role } });
                setMade(r.code);
                invites.setData({ invites: r.invites });
              } catch {
                fail();
              }
            }}
          >
            <UserPlus size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.makeInvite}</span>
          </button>
          {made && (
            <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="mt-4 rounded-[6px] border border-rule bg-desk p-4">
              <p lang={tag} className="eyebrow">{t.code}</p>
              <p className="tabular text-[34px] font-semibold tracking-[.08em]">{made}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton text={made} label={t.copy} done={t.copied} />
              </div>
              <p lang={tag} className="eyebrow mt-4">{t.link}</p>
              <p className="break-all text-[16px]">{`${origin}/signup?code=${made}`}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton text={`${origin}/signup?code=${made}`} label={t.copy} done={t.copied} />
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    className="btn btn-quiet btn-small"
                    onClick={() => navigator.share({ title: "Helper Diary", url: `${origin}/signup?code=${made}` }).catch(() => {})}
                  >
                    <Share2 size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.share}</span>
                  </button>
                )}
              </div>
            </m.div>
          )}
          <h3 lang={tag} className="mb-1 mt-6 text-[20px] font-semibold">{t.invites}</h3>
          {invites.data && invites.data.invites.length === 0 && <p lang={tag} className="text-muted">{t.noInvites}</p>}
          <ul className="divide-y divide-rule">
            {invites.data?.invites.map((i) => (
              <li key={i.code} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="tabular flex-1 text-[18px] tracking-[.06em]">{i.code}</span>
                {i.role && <span lang={tag} className="text-[15px] text-muted">{i.role === "helper" ? t.forHelper : t.forEmployer}</span>}
                <span lang={tag} className={`text-[15px] ${i.status === "unused" ? "text-ochre-ink" : i.status === "used" ? "text-moss" : "text-muted"}`}>
                  {i.status === "unused" ? t.unused : i.status === "used" ? (i.used_by_name ? fmt(t.usedBy, { name: i.used_by_name }) : t.used) : t.revoked}
                </span>
                {i.status === "unused" && (
                  <button
                    className="btn btn-danger btn-small"
                    onClick={async () => {
                      try {
                        await api(`/api/invites/${encodeURIComponent(i.code)}`, { method: "DELETE" });
                        if (made === i.code) setMade(null);
                        invites.reload();
                      } catch {
                        fail();
                      }
                    }}
                  >
                    <span lang={tag}>{t.revoke}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="page p-4 sm:p-5">
        {h2(t.members)}
        <ul className="divide-y divide-rule">
          {members.data?.members.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="flex-1">
                <span className="block text-[18px]">{u.name}</span>
                <span className="block text-[15px] text-muted">{u.login}</span>
              </span>
              <span lang={tag} className="text-[15px] text-muted">
                {u.role === "helper" ? t.helper : t.employer}
                {u.is_admin ? ` · ${t.admin}` : ""}
                {u.lang ? ` · ${langInfo(u.lang).name}` : ""}
              </span>
              {me.is_admin && !u.is_admin && u.id !== me.id && (
                <button
                  className="btn btn-quiet btn-small"
                  onClick={async () => {
                    setErr(null);
                    try {
                      const r = await api<PasswordResetMade>(`/api/members/${u.id}/reset`, { method: "POST" });
                      setReset({ id: u.id, code: r.code });
                    } catch {
                      fail();
                    }
                  }}
                >
                  <span lang={tag}>{t.resetPassword}</span>
                </button>
              )}
              {me.is_admin && !u.is_admin && u.id !== me.id && (
                <button
                  className="btn btn-danger btn-small"
                  onClick={async () => {
                    if (!confirm(fmt(t.confirmRemoveMember, { name: u.name }))) return;
                    try {
                      await api(`/api/members/${u.id}`, { method: "DELETE" });
                      if (reset?.id === u.id) setReset(null);
                      members.reload();
                    } catch {
                      fail();
                    }
                  }}
                >
                  <span lang={tag}>{t.removeMember}</span>
                </button>
              )}
              {reset?.id === u.id && (
                <div role="status" className="w-full rounded-[6px] border border-rule bg-paper p-3">
                  <p lang={tag} className="mb-2">{fmt(t.resetMade, { name: u.name })}</p>
                  <p lang={tag} className="eyebrow">{t.code}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tabular text-[24px] font-semibold tracking-[.08em]">{reset.code}</span>
                    <CopyButton text={reset.code} label={t.copy} done={t.copied} />
                  </div>
                  <p lang={tag} className="eyebrow mt-3">{t.link}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="break-all text-[15px]">{`${origin}/reset?code=${reset.code}`}</span>
                    <CopyButton text={`${origin}/reset?code=${reset.code}`} label={t.copy} done={t.copied} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
