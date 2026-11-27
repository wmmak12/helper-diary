"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { useMe, useT } from "@/lib/client/i18n";
import { api } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { chatS } from "@/lib/strings/tplchat";
import { common } from "@/lib/strings/common";
import type { HouseholdProfile } from "@/lib/types";
import { LoadError, PageHeader, Skeleton } from "@/components/ui";

/** 4.0: the household profile (shared by both employers; never the helper). Every AI proposal is written from it. */
export function HouseholdScreen() {
  const { data, error, reload } = useApi<{ profile: HouseholdProfile }>("/api/household");
  const t = useT(chatS);
  if (error && !data) return <LoadError error={error} onRetry={reload} />;
  if (!data) return <Skeleton rows={6} />;
  return (
    <div className="mx-auto max-w-[760px] pb-8">
      <PageHeader title={t.household} back="/templates" />
      <Form key={data.profile.updated_at ?? 0} initial={data.profile} />
    </div>
  );
}

type Draft = { members: { name: string; age: string }[]; pets: string[]; bedrooms: string; bathrooms: string; floors: string; garden: boolean | null; matters: string };

function Form({ initial }: { initial: HouseholdProfile }) {
  const { lang, toast } = useMe();
  const t = useT(chatS);
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const router = useRouter();
  const n = (v: number | null) => (v === null ? "" : String(v));
  const [d, setD] = useState<Draft>({
    members: initial.members.length ? initial.members.map((m) => ({ name: m.name, age: n(m.age) })) : [{ name: "", age: "" }],
    pets: initial.pets,
    bedrooms: n(initial.bedrooms),
    bathrooms: n(initial.bathrooms),
    floors: n(initial.floors),
    garden: initial.garden,
    matters: initial.matters,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const set = (p: Partial<Draft>) => { setD((v) => ({ ...v, ...p })); setErr(false); };
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = async () => {
    setBusy(true);
    setErr(false);
    try {
      await api("/api/household", {
        method: "PUT",
        body: { members: d.members.map((m) => ({ name: m.name, age: num(m.age) })), pets: d.pets, bedrooms: num(d.bedrooms), bathrooms: num(d.bathrooms), floors: num(d.floors), garden: d.garden, matters: d.matters },
      });
      toast({ text: t.hhSaved });
      router.push("/templates");
    } catch {
      setErr(true);
      setBusy(false);
    }
  };

  const small = "field !w-[88px] tabular";
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <p lang={tag} className="-mt-2 text-[16px] text-muted">{t.hhLead}</p>

      <fieldset className="page px-4 py-3">
        <legend lang={tag} className="float-left w-full text-[20px] font-semibold">{t.hhMembers}</legend>
        <p lang={tag} className="clear-both mb-2 text-[16px] text-muted">{t.hhMembersHint}</p>
        <ul className="clear-both space-y-2">
          {d.members.map((m, i) => (
            <li key={i} className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span lang={tag} className="mb-1 block text-[15px] text-muted">{t.hhName}</span>
                <input className="field" value={m.name} maxLength={40} onChange={(e) => set({ members: d.members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              </label>
              <label>
                <span lang={tag} className="mb-1 block text-[15px] text-muted">{t.hhAge}</span>
                <input className={small} inputMode="numeric" type="number" min={0} max={120} value={m.age} onChange={(e) => set({ members: d.members.map((x, j) => (j === i ? { ...x, age: e.target.value } : x)) })} />
              </label>
              <button type="button" aria-label={`${t.hhRemove} ${m.name || i + 1}`} onClick={() => set({ members: d.members.filter((_, j) => j !== i) })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] text-danger hover:bg-danger-wash">
                <X size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-quiet btn-small mt-3" onClick={() => set({ members: [...d.members, { name: "", age: "" }] })}><Plus size={18} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.hhAddMember}</span></button>
      </fieldset>

      <fieldset className="page px-4 py-3">
        <legend lang={tag} className="float-left mb-2 w-full text-[20px] font-semibold">{t.hhPets}</legend>
        <ul className="clear-both space-y-2">
          {d.pets.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <input className="field" aria-label={t.hhPets} placeholder={t.hhPetHint} value={p} maxLength={60} onChange={(e) => set({ pets: d.pets.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" aria-label={`${t.hhRemove} ${p || i + 1}`} onClick={() => set({ pets: d.pets.filter((_, j) => j !== i) })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] text-danger hover:bg-danger-wash">
                <X size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-quiet btn-small mt-3" onClick={() => set({ pets: [...d.pets, ""] })}><Plus size={18} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.hhAddPet}</span></button>
      </fieldset>

      <fieldset className="page px-4 py-3">
        <legend lang={tag} className="float-left mb-2 w-full text-[20px] font-semibold">{t.hhHome}</legend>
        <div className="clear-both flex flex-wrap gap-4">
          {(["bedrooms", "bathrooms", "floors"] as const).map((k) => (
            <label key={k}>
              <span lang={tag} className="mb-1 block text-[15px] text-muted">{k === "bedrooms" ? t.hhBedrooms : k === "bathrooms" ? t.hhBathrooms : t.hhFloors}</span>
              <input className={small} inputMode="numeric" type="number" min={0} max={20} value={d[k]} onChange={(e) => set({ [k]: e.target.value })} />
            </label>
          ))}
          <div role="group" aria-label={t.hhGarden}>
            <span lang={tag} className="mb-1 block text-[15px] text-muted">{t.hhGarden}</span>
            <div className="flex gap-1.5">
              {([true, false] as const).map((v) => (
                <button key={String(v)} type="button" aria-pressed={d.garden === v} onClick={() => set({ garden: d.garden === v ? null : v })} className={`min-h-[44px] rounded-full border-[1.5px] px-4 ${d.garden === v ? "border-primary bg-primary text-on-primary" : "border-field bg-paper text-ink"}`}>
                  <span lang={tag}>{v ? t.hhYes : t.hhNo}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <label className="block">
        <span lang={tag} className="mb-1 block text-[20px] font-semibold">{t.hhMatters}</span>
        <textarea className="field" rows={3} maxLength={1000} placeholder={t.hhMattersHint} value={d.matters} onChange={(e) => set({ matters: e.target.value })} />
      </label>

      {err && <p role="alert" lang={tag} className="text-danger">{t.hhFailed}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <span lang={tag}>{c.save}</span>}
      </button>
    </form>
  );
}
