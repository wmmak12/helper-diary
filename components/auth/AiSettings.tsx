"use client";
import { useEffect, useId, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { aiS } from "@/lib/strings/ai";
import { api } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import type { AiCheck, AiPart, AiPartInput, AiSettings, AiSettingsInput, AiSettingsSaved, Me } from "@/lib/types";
import { LoadError, Skeleton } from "@/components/ui";

type PartKey = "text" | "speech";
/** One part as edited: key "keep" leaves the saved key, "clear" removes it, a string replaces it. */
type Draft = { base_url: string; model: string; key: string; keyMode: "keep" | "replace" | "clear" };

const draftOf = (p: AiPart): Draft => ({ base_url: p.base_url, model: p.model, key: "", keyMode: p.key_hint ? "keep" : "replace" });

/**
 * Settings › AI settings (5.3, owner only; the caller renders it only when me.is_admin). Text AI and speech to
 * text, each an address, key and model. Save sends the parts that changed (both when nothing changed, to check
 * again), then shows under the section whether each part works. A saved key is only ever its hint.
 */
export function AiSettingsSection() {
  const { lang, setMe } = useMe();
  const t = useT(aiS);
  const tag = langInfo(lang).tag;
  const res = useApi<{ settings: AiSettings }>("/api/ai-settings");
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState<Record<PartKey, Draft> | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ check: AiSettingsSaved["check"]; sent: PartKey[] } | null>(null);
  const [failed, setFailed] = useState(false);

  // take what the server has, unless the owner is mid-edit (useApi also reloads on window focus)
  useEffect(() => {
    if (!res.data) return;
    const got = res.data.settings;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the form starts from the loaded settings
    setSaved(got);
    setDraft((d) => d ?? { text: draftOf(got.text), speech: draftOf(got.speech) });
  }, [res.data]);

  const dirty = (k: PartKey) => {
    if (!draft || !saved) return false;
    const d = draft[k];
    const p = saved[k];
    return d.base_url.trim() !== p.base_url || d.model.trim() !== p.model || d.keyMode === "clear" || (d.keyMode === "replace" && d.key.trim() !== "");
  };
  const inputOf = (k: PartKey): AiPartInput => {
    const d = draft![k];
    const out: AiPartInput = { base_url: d.base_url.trim(), model: d.model.trim() };
    if (d.keyMode === "clear") out.key = "";
    else if (d.keyMode === "replace" && d.key.trim()) out.key = d.key.trim();
    return out;
  };
  const set = (k: PartKey, patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, [k]: { ...d[k], ...patch } } : d));
    setResult(null);
    setFailed(false);
  };

  const save = async () => {
    if (!draft || busy) return;
    const changed = (["text", "speech"] as const).filter(dirty);
    const sent = changed.length ? changed : (["text", "speech"] as const).filter((k) => draft[k].base_url.trim() || draft[k].model.trim() || saved?.[k].key_hint);
    const body: AiSettingsInput = {};
    for (const k of sent) body[k] = inputOf(k);
    setBusy(true);
    setResult(null);
    setFailed(false);
    try {
      const r = await api<AiSettingsSaved>("/api/ai-settings", { method: "PUT", body });
      setSaved(r.settings);
      setDraft({ text: draftOf(r.settings.text), speech: draftOf(r.settings.speech) });
      res.setData({ settings: r.settings });
      setResult({ check: r.check, sent: [...sent] });
      // Talk's Hold to talk and the setup line follow Me.ai / Me.speech: read them now, no sign-out needed
      api<{ me: Me }>("/api/me").then((x) => setMe(x.me)).catch(() => {});
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  const checkText = (c: AiCheck | undefined) =>
    !c ? t.saved : c.ok ? t.works : c.error === "unreachable" ? t.errUnreachable : c.error === "key" ? t.errKey : c.error === "model" ? t.errModel : t.errOther;

  return (
    <section id="ai" className="page scroll-mt-4 p-4 sm:p-5" aria-labelledby="ai-title">
      <h2 id="ai-title" lang={tag} className="mb-1 text-[24px] font-semibold">{t.title}</h2>
      <p lang={tag} className="mb-3 text-muted">{t.line}</p>
      {res.error && !res.data ? (
        <LoadError error={res.error} onRetry={res.reload} />
      ) : !draft || !saved ? (
        <Skeleton rows={3} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {saved.text_source !== "owner" && (
            <p lang={tag} className="mb-4 flex items-start gap-2 rounded-[6px] bg-ochre-wash px-3 py-2 text-[16px] text-ink">
              <span aria-hidden className="mt-[5px] h-3.5 w-1.5 shrink-0 bg-ochre" />
              <span>{saved.text_source === "server" ? t.sourceServer : t.sourceNone}</span>
            </p>
          )}
          <Part k="text" title={t.textPart} draft={draft.text} saved={saved.text} onChange={(p) => set("text", p)} addressHelp={t.addressHelp} modelHelp={t.modelHelp} />
          <div className="my-5 border-t border-rule" />
          <Part k="speech" title={t.speechPart} draft={draft.speech} saved={saved.speech} onChange={(p) => set("speech", p)} addressHelp={t.speechAddressHelp} modelHelp={t.speechModelHelp} />
          <button type="submit" disabled={busy} className="btn btn-primary mt-5 w-full sm:w-auto">
            {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : null}
            <span lang={tag}>{busy ? t.checking : t.save}</span>
          </button>
          <div aria-live="polite" className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {failed && (
                <m.p key="failed" role="alert" lang={tag} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="flex items-start gap-2 rounded-[6px] border border-danger bg-danger-wash p-3">
                  <AlertCircle size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-danger" /> {t.saveFailed}
                </m.p>
              )}
              {result?.sent.map((k) => {
                const c = result.check[k];
                const ok = !c || c.ok;
                return (
                  <m.p key={`r-${k}`} lang={tag} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className={`flex items-start gap-2 rounded-[6px] border p-3 ${ok ? "border-moss bg-moss-wash" : "border-danger bg-danger-wash"}`} data-ai-result={k}>
                    {ok ? <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-moss" /> : <AlertCircle size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-danger" />}
                    <span><span className="font-semibold">{k === "text" ? t.textPart : t.speechPart}:</span> {checkText(c)}</span>
                  </m.p>
                );
              })}
            </AnimatePresence>
          </div>
        </form>
      )}
    </section>
  );
}

function Part({ k, title, draft, saved, onChange, addressHelp, modelHelp }: {
  k: PartKey; title: string; draft: Draft; saved: AiPart; onChange: (p: Partial<Draft>) => void; addressHelp: string; modelHelp: string;
}) {
  const { lang } = useMe();
  const t = useT(aiS);
  const tag = langInfo(lang).tag;
  const id = useId();
  const field = (name: "base_url" | "model", label: string, help: string, opts: { type: string; placeholder: string; autoComplete: string }) => (
    <label className="block" htmlFor={`${id}-${name}`}>
      <span lang={tag} className="block text-[16px] font-medium">{label}</span>
      <span lang={tag} id={`${id}-${name}-help`} className="mb-1 block text-[15px] text-muted [overflow-wrap:anywhere]">{help}</span>
      <input
        id={`${id}-${name}`}
        name={`${k}-${name}`}
        type={opts.type}
        inputMode={opts.type === "url" ? "url" : undefined}
        value={draft[name]}
        onChange={(e) => onChange({ [name]: e.target.value } as Partial<Draft>)}
        placeholder={opts.placeholder}
        autoComplete={opts.autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        aria-describedby={`${id}-${name}-help`}
        className="field"
      />
    </label>
  );
  return (
    <fieldset className="space-y-4" data-ai-part={k}>
      <legend lang={tag} className="mb-3 text-[20px] font-semibold">{title}</legend>
      {field("base_url", t.address, addressHelp, { type: "url", placeholder: "https://api.example.com/v1", autoComplete: "off" })}
      <div>
        <label htmlFor={`${id}-key`} lang={tag} className="block text-[16px] font-medium">{t.key}</label>
        <span lang={tag} id={`${id}-key-help`} className="mb-1 block text-[15px] text-muted">{t.keyHelp}</span>
        {saved.key_hint && draft.keyMode === "keep" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span lang={tag} className="min-w-0 flex-1 rounded-[6px] border border-rule bg-desk px-3 py-2.5 text-[17px]" data-key-saved>
              {fmt(t.keySaved, { hint: saved.key_hint })}
            </span>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => onChange({ keyMode: "replace", key: "" })}><span lang={tag}>{t.replaceKey}</span></button>
            <button type="button" className="btn btn-danger btn-small" onClick={() => onChange({ keyMode: "clear", key: "" })}><span lang={tag}>{t.clearKey}</span></button>
          </div>
        ) : saved.key_hint && draft.keyMode === "clear" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-danger bg-danger-wash px-3 py-1.5">
            <span lang={tag} className="min-w-0 flex-1">{t.keyWillClear}</span>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => onChange({ keyMode: "keep" })}><span lang={tag}>{t.undo}</span></button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`${id}-key`}
              name={`${k}-key`}
              type="password"
              value={draft.key}
              onChange={(e) => onChange({ key: e.target.value })}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby={`${id}-key-help`}
              className="field min-w-0 flex-1"
            />
            {saved.key_hint && (
              <button type="button" className="btn btn-quiet btn-small" onClick={() => onChange({ keyMode: "keep", key: "" })}><span lang={tag}>{t.undo}</span></button>
            )}
          </div>
        )}
      </div>
      {field("model", t.model, modelHelp, { type: "text", placeholder: k === "text" ? "gpt-4o-mini" : "whisper-1", autoComplete: "off" })}
    </fieldset>
  );
}
