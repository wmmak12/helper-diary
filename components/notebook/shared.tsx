"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Phone } from "lucide-react";
import { langInfo, type Lang } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { api } from "@/lib/client/api";
import { nb } from "@/lib/strings/notebook";
import { common } from "@/lib/strings/common";
import { SECTIONS, type Entry, type Section } from "@/lib/types";
import { PhotoButton, Photos, Sheet } from "@/components/ui";

export function localeTag(lang: Lang) {
  return lang === "my" ? "my-MM" : langInfo(lang).tag;
}

export function when(ms: number, lang: Lang) {
  return new Intl.DateTimeFormat(localeTag(lang), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

/** House | My notes (or Shared notes for employers) switch at the top of the Notebook. */
export function NotebookSwitch() {
  const t = useT(nb);
  const { me, lang } = useMe();
  const path = usePathname();
  const tag = langInfo(lang).tag;
  const items = [
    { href: "/notebook", label: t.house, on: path.startsWith("/notebook") },
    { href: "/notes", label: me.role === "helper" ? t.myNotes : t.sharedNotes, on: path.startsWith("/notes") },
  ];
  return (
    <div className="mb-5 inline-flex rounded-full border-[1.5px] border-field bg-paper p-1" role="tablist">
      {items.map((i) => (
        <Link key={i.href} href={i.href} role="tab" aria-selected={i.on} lang={tag}
          className={`flex min-h-[44px] items-center rounded-full px-5 text-[17px] ${i.on ? "bg-primary text-on-primary" : "text-ink"}`}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function sectionLabel(t: Record<string, string>, s: Section) {
  return t[s];
}

export function PhoneLink({ phone }: { phone: string }) {
  const t = useT(nb);
  const { lang } = useMe();
  return (
    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-[6px] border-[1.5px] border-ink px-3 text-[18px] tabular text-ink">
      <Phone size={20} strokeWidth={1.75} aria-hidden />
      <span>{phone}</span>
      <span className="sr-only" lang={langInfo(lang).tag}>{t.call}</span>
    </a>
  );
}

export function Confirmation({ entry }: { entry: Entry }) {
  const t = useT(nb);
  const { me, lang } = useMe();
  const tag = langInfo(lang).tag;
  if (entry.understood_at) {
    return <p lang={tag} className="text-[15px] text-moss">{fmt(t.understoodBy, { name: me.helper_name ?? "", time: when(entry.understood_at, lang) })}</p>;
  }
  return <p lang={tag} className="text-[15px] text-muted">{t.notConfirmed}</p>;
}

type Draft = { section: Section; title: string; body: string; phone: string; emergency: boolean; photos: string[] };

/** Add or edit a House entry (employers). Written in the employer's own language; translated on save. */
export function EntryEditor({ open, onClose, entry, defaultSection, onSaved }: {
  open: boolean; onClose: () => void; entry?: Entry | null; defaultSection?: Section; onSaved: (e: Entry) => void;
}) {
  const t = useT(nb);
  const c = useT(common);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  const init = (): Draft => entry
    ? {
        section: entry.section,
        // edit in the original language when it is the employer's; otherwise show their translation to edit from
        title: entry.lang === lang ? entry.title : (entry.title_tr?.[lang] ?? entry.title),
        body: entry.lang === lang ? entry.body : (entry.body_tr?.[lang] ?? entry.body),
        phone: entry.phone ?? "", emergency: entry.emergency, photos: entry.photos,
      }
    : { section: defaultSection ?? "rules", title: "", body: "", phone: "", emergency: false, photos: [] };
  const [d, setD] = useState<Draft>(init);
  const [key, setKey] = useState<string>("");
  const k = `${open}-${entry?.id ?? "new"}-${entry?.version ?? 0}-${defaultSection ?? ""}`;
  if (k !== key) { setKey(k); setD(init()); }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  return (
    <Sheet open={open} onClose={onClose} title={entry ? t.editEntry : t.addEntry}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!d.title.trim()) return;
        setBusy(true); setErr(false);
        try {
          const payload = { section: d.section, title: d.title, body: d.body, phone: d.phone.trim() || null, emergency: d.emergency, photos: d.photos, lang };
          const r = entry
            ? await api<{ entry: Entry }>(`/api/entries/${entry.id}`, { method: "PATCH", body: payload })
            : await api<{ entry: Entry }>("/api/entries", { body: payload });
          onSaved(r.entry);
          onClose();
        } catch { setErr(true); } finally { setBusy(false); }
      }}>
        <fieldset>
          <legend lang={tag} className="mb-2 text-[15px] text-muted">{t.section}</legend>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <button type="button" key={s} lang={tag} aria-pressed={d.section === s} onClick={() => set({ section: s })}
                className={`min-h-[44px] rounded-full border-[1.5px] px-4 text-[16px] ${d.section === s ? "border-primary bg-primary text-on-primary" : "border-field bg-paper text-ink"}`}>
                {t[s]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block"><span lang={tag} className="mb-1 block text-[15px] text-muted">{t.title}</span>
          <input lang={tag} className="field" value={d.title} onChange={(e) => set({ title: e.target.value })} required maxLength={200} /></label>
        <label className="block"><span lang={tag} className="mb-1 block text-[15px] text-muted">{t.body}</span>
          <textarea lang={tag} className="field" rows={5} value={d.body} onChange={(e) => set({ body: e.target.value })} /></label>
        <label className="block"><span lang={tag} className="mb-1 block text-[15px] text-muted">{t.phone}</span>
          <input className="field tabular" type="tel" inputMode="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={40} /></label>
        <label className="flex min-h-[44px] items-start gap-3">
          <input type="checkbox" className="mt-1 h-6 w-6 accent-[#24345C]" checked={d.emergency} onChange={(e) => set({ emergency: e.target.checked })} />
          <span lang={tag}><span className="block">{t.emergency}</span><span className="block text-[15px] text-muted">{t.emergencyHint}</span></span>
        </label>
        <div>
          <PhotoButton onAdded={(id) => set({ photos: [...d.photos, id] })} />
          <Photos ids={d.photos} onRemove={(id) => set({ photos: d.photos.filter((p) => p !== id) })} />
        </div>
        {err && <p role="alert" lang={tag} className="text-danger">{t.saveFailed}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn btn-quiet flex-1" onClick={onClose}><span lang={tag}>{c.cancel}</span></button>
          <button className="btn btn-primary flex-1" disabled={busy || !d.title.trim()}>
            {busy ? <span className="ink-dots" aria-label={c.loading}><span /><span /><span /></span> : <span lang={tag}>{c.save}</span>}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
