"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ImageOff, Plus, Search, Star } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { useApi } from "@/lib/client/useApi";
import { photoUrl } from "@/lib/client/api";
import { cookedLine, kitchen } from "@/lib/strings/kitchen";
import type { Dish } from "@/lib/types";
import { Empty, InkIn, LoadError, PageHeader, Ribbon, Skeleton, Tr } from "@/components/ui";
import { DishSheet, PhotoPick } from "./DishSheet";

type Sort = "newest" | "longest";

/** Still waiting for a translation of its name, note or recipe. */
export function pending(d: Dish) {
  return !d.tr || (!!d.note && !d.note_tr) || ((!!d.ingredients || !!d.steps) && !d.recipe_tr);
}

function matches(d: Dish, q: string) {
  const all = [d.name, ...Object.values(d.tr ?? {})].join("\n").toLowerCase();
  return all.includes(q);
}

function sorted(list: Dish[], sort: Sort): Dish[] {
  if (sort === "newest") return list;
  // longest since cooked: never-cooked first (oldest added first), then the longest ago
  return [...list].sort((a, b) => {
    if (a.last_cooked === b.last_cooked) return a.created_at - b.created_at;
    if (!a.last_cooked) return -1;
    if (!b.last_cooked) return 1;
    return a.last_cooked < b.last_cooked ? -1 : 1;
  });
}

/** 5.0 Kitchen: the household's dish book. */
export function KitchenScreen() {
  const t = useT(kitchen);
  const { me, lang, toast } = useMe();
  const tag = langInfo(lang).tag;
  const [poll, setPoll] = useState(false);
  const { data, setData, error, loading, reload } = useApi<{ dishes: Dish[] }>("/api/dishes", { poll: poll ? 5000 : undefined });
  const dishes = useMemo(() => data?.dishes ?? [], [data]);
  const waiting = dishes.some(pending);
  if (waiting !== poll) setPoll(waiting);

  const [q, setQ] = useState("");
  const [favs, setFavs] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [add, setAdd] = useState<{ file: File; name: string } | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);

  const query = q.trim().toLowerCase();
  const shown = useMemo(() => sorted(dishes.filter((d) => (!favs || d.favourite) && (!query || matches(d, query))), sort), [dishes, favs, query, sort]);

  const startAdd = (file: File, name = "") => setAdd({ file, name });
  const addButton = (name = "", label = t.addDish, primary = true) => (
    <PhotoPick onFile={(f) => startAdd(f, name)} className={`btn ${primary ? "btn-primary" : "btn-quiet btn-small"}`}>
      <Plus size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{label}</span>
    </PhotoPick>
  );

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title={t.title}>{dishes.length > 0 && addButton()}</PageHeader>

      {loading && !data && <Skeleton rows={4} />}
      {error && !data && <LoadError error={error} onRetry={reload} />}

      {data && dishes.length === 0 && (
        <Empty img="kitchen" line={t.emptyLine}>{addButton()}</Empty>
      )}

      {dishes.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1">
              <Search size={20} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} lang={tag} className="field !min-h-[48px] !py-2 !pl-10" />
            </label>
            <div role="group" aria-label={t.filterLabel} className="flex rounded-full border-[1.5px] border-field bg-paper p-0.5">
              {([false, true] as const).map((v) => (
                <button key={String(v)} type="button" aria-pressed={favs === v} onClick={() => setFavs(v)} className={`relative inline-flex min-h-[42px] items-center gap-1 rounded-full px-3.5 ${favs === v ? "text-on-primary" : "text-ink"}`}>
                  {favs === v && <m.span layoutId="kitchen-filter" className="absolute inset-0 rounded-full bg-primary" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
                  {v && <Star size={18} strokeWidth={1.75} aria-hidden className="relative" />}
                  <span lang={tag} className="relative">{v ? t.favourites : t.all}</span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <span lang={tag} className="sr-only">{t.sortLabel}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} lang={tag} aria-label={t.sortLabel} className="field !min-h-[46px] !w-auto !py-1.5 !pr-8 !text-[16px]" data-kitchen-sort>
                <option value="newest">{t.sortNewest}</option>
                <option value="longest">{t.sortLongest}</option>
              </select>
            </label>
          </div>

          {shown.length === 0 && query && (
            <div className="flex flex-col items-start gap-3 rounded-[6px] border border-rule bg-paper p-4">
              <p lang={tag}>{fmt(t.searchNone, { q: q.trim() })}</p>
              {addButton(q.trim(), t.addIt, false)}
            </div>
          )}
          {shown.length === 0 && !query && favs && (
            <p lang={tag} className="rounded-[6px] border border-rule bg-paper p-4 text-muted">{me.role === "helper" ? t.favEmptyHelper : t.favEmptyEmployer}</p>
          )}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" data-dish-grid>
            <AnimatePresence initial={false}>
              {shown.map((d) => (
                <m.li key={d.id} layout="position" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
                  <DishCard dish={d} fresh={d.id === fresh} />
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}

      <DishSheet
        open={!!add}
        file={add?.file ?? null}
        startName={add?.name}
        onClose={() => setAdd(null)}
        onSaved={(d) => {
          setAdd(null);
          setQ("");
          setFavs(false);
          setSort("newest");
          setData((v) => ({ dishes: [d, ...(v?.dishes ?? []).filter((x) => x.id !== d.id)] }));
          setFresh(d.id);
          toast({ text: t.addedToast });
        }}
      />
    </div>
  );
}

function DishCard({ dish, fresh }: { dish: Dish; fresh: boolean }) {
  const t = useT(kitchen);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  const name = <Tr text={dish.name} lang={dish.lang} tr={dish.tr} noToggle as="p" className="text-[18px] font-semibold leading-snug [overflow-wrap:anywhere]" />;
  return (
    <Link href={`/kitchen/${dish.id}`} data-dish-card className="relative block h-full rounded-[6px] border border-rule bg-paper p-1.5 pb-2.5 hover:border-field focus-visible:outline-2">
      <span className="relative block overflow-hidden rounded-[3px] bg-desk">
        {dish.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl(dish.photo)} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <span className="flex aspect-[4/3] w-full items-center justify-center text-muted"><ImageOff size={28} strokeWidth={1.75} aria-label={t.noPhoto} /></span>
        )}
        {dish.favourite && (
          <span className="absolute left-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-paper text-ochre-ink" title={t.favourite}>
            <Star size={18} strokeWidth={1.75} fill="currentColor" aria-label={t.favourite} />
          </span>
        )}
      </span>
      <span className="block px-1.5 pt-2">
        {fresh ? <InkIn>{name}</InkIn> : name}
        <span lang={tag} className={`mt-0.5 block text-[15px] ${dish.days_since === 0 ? "text-moss" : "text-muted"}`}>{cookedLine(t, dish.days_since)}</span>
      </span>
      {fresh && <Ribbon className="right-3" />}
    </Link>
  );
}

