"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, Check, Expand, ImageOff, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { useApi } from "@/lib/client/useApi";
import { api, ApiErr, photoUrl } from "@/lib/client/api";
import { cookedLine, kitchen } from "@/lib/strings/kitchen";
import { common } from "@/lib/strings/common";
import type { Dish } from "@/lib/types";
import { LoadError, Sheet, Skeleton, Tr } from "@/components/ui";
import { DishSheet } from "./DishSheet";
import { pending } from "./KitchenScreen";

/** 5.0: one dish. Show is its largest control; the recipe, note and favourite are all optional. */
export function DishScreen({ id }: { id: number }) {
  const t = useT(kitchen);
  const c = useT(common);
  const { me, lang, toast } = useMe();
  const tag = langInfo(lang).tag;
  const router = useRouter();
  const [poll, setPoll] = useState(false);
  const { data, setData, error, reload } = useApi<{ dish: Dish }>(Number.isInteger(id) && id > 0 ? `/api/dishes/${id}` : null, { poll: poll ? 5000 : undefined });
  const dish = data?.dish ?? null;
  const waiting = !!dish && pending(dish);
  if (waiting !== poll) setPoll(waiting);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<"dish" | "recipe" | "note" | null>(null);
  const employer = me.role === "employer";

  const patch = async (body: Record<string, unknown>, optimistic?: Partial<Dish>) => {
    if (!dish) return false;
    const before = dish;
    if (optimistic) setData({ dish: { ...dish, ...optimistic } });
    try {
      const r = await api<{ dish: Dish }>(`/api/dishes/${dish.id}`, { method: "PATCH", body: { ...body, lang } });
      setData(r);
      return true;
    } catch (e) {
      if (optimistic) setData({ dish: before });
      toast({ text: e instanceof ApiErr && e.f.kind === "offline" ? c.offline : t.notSaved, tone: "error" });
      return false;
    }
  };

  const cooked = async () => {
    if (!dish || dish.cooked_today) return;
    const before = dish;
    setData({ dish: { ...dish, cooked_today: true, days_since: 0 } });
    try {
      setData(await api<{ dish: Dish }>(`/api/dishes/${dish.id}/cooked`, { method: "POST" }));
    } catch (e) {
      setData({ dish: before });
      toast({ text: e instanceof ApiErr && e.f.kind === "offline" ? c.offline : c.tryAgain, tone: "error" });
    }
  };

  const remove = async () => {
    if (!dish || !confirm(t.confirmDelete)) return;
    try {
      await api(`/api/dishes/${dish.id}`, { method: "DELETE" });
      router.push("/kitchen");
    } catch {
      toast({ text: c.offline, tone: "error" });
    }
  };

  if (error && !dish) return <div className="mx-auto max-w-[720px]"><Back /><LoadError error={error} onRetry={reload} /></div>;
  if (!dish) return <div className="mx-auto max-w-[720px]"><Back /><Skeleton rows={5} /></div>;

  const hasRecipe = !!(dish.ingredients || dish.steps);

  return (
    <div className="mx-auto max-w-[720px] pb-6">
      <Back />
      <div className="overflow-hidden rounded-[6px] border border-rule bg-paper">
        <button type="button" onClick={() => setShow(true)} className="block w-full bg-desk" aria-label={t.show}>
          {dish.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(dish.photo)} alt="" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <span className="flex aspect-[4/3] w-full items-center justify-center text-muted"><ImageOff size={40} strokeWidth={1.75} aria-hidden /></span>
          )}
        </button>
        <div className="p-4">
          <div className="flex items-start gap-2">
            <Tr as="h1" text={dish.name} lang={dish.lang} tr={dish.tr} className={`min-w-0 flex-1 font-semibold [overflow-wrap:anywhere] ${lang === "my" ? "text-[28px]" : "text-[32px] leading-[1.2]"}`} />
            {employer ? (
              <button
                type="button"
                aria-pressed={dish.favourite}
                aria-label={t.favourite}
                onClick={() => patch({ favourite: !dish.favourite }, { favourite: !dish.favourite })}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[1.5px] ${dish.favourite ? "border-ochre-ink text-ochre-ink" : "border-field text-ink"}`}
                data-favourite
              >
                <m.span key={String(dish.favourite)} initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.14 }} className="flex">
                  <Star size={24} strokeWidth={1.75} fill={dish.favourite ? "currentColor" : "none"} aria-hidden />
                </m.span>
              </button>
            ) : (
              dish.favourite && (
                <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-ochre-ink">
                  <Star size={20} strokeWidth={1.75} fill="currentColor" aria-hidden /> <span lang={tag} className="text-[15px] font-medium">{t.favourite}</span>
                </span>
              )
            )}
          </div>
          <p lang={tag} className={`mt-1 text-[15px] ${dish.days_since === 0 ? "text-moss" : "text-muted"}`} data-last-cooked>
            {cookedLine(t, dish.days_since)}
            {dish.added_by_name ? ` · ${fmt(t.addedBy, { name: dish.added_by_name })}` : ""}
          </p>

          <button type="button" onClick={() => setShow(true)} className="btn btn-primary mt-4 w-full !min-h-[68px] !text-[22px]" data-show>
            <Expand size={26} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.show}</span>
          </button>

          {!employer && (
            <button type="button" onClick={cooked} aria-disabled={dish.cooked_today} className={`btn mt-3 w-full ${dish.cooked_today ? "border-[1.5px] border-moss bg-moss-wash text-ink" : "btn-quiet"}`} data-cooked>
              <Check size={22} strokeWidth={2} aria-hidden className={dish.cooked_today ? "text-moss" : ""} />
              <span lang={tag}>{dish.cooked_today ? t.cookedDone : t.cookedButton}</span>
            </button>
          )}
        </div>

        {/* the employer's note ("less salt"), read by everyone in their language */}
        {(dish.note || employer) && (
          <section className="border-t border-rule px-4 py-3">
            {dish.note ? (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p lang={tag} className="eyebrow">{t.note}</p>
                  <Tr as="p" text={dish.note} lang={dish.note_lang} tr={dish.note_tr} className="text-[18px]" />
                </div>
                {employer && (
                  <button type="button" onClick={() => setEditing("note")} aria-label={t.editNote} className="flex h-11 w-11 shrink-0 items-center justify-center text-ink"><Pencil size={20} strokeWidth={1.75} /></button>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => setEditing("note")} className="inline-flex min-h-[44px] items-center gap-1.5 text-ink underline decoration-rule underline-offset-4">
                <Plus size={20} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.addNote}</span>
              </button>
            )}
          </section>
        )}

        {/* the recipe is optional: without one the page is complete, with only a quiet way to add it */}
        <section className="border-t border-rule px-4 py-3">
          {hasRecipe ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 lang={tag} className="text-[22px] font-semibold">{t.recipe}</h2>
                <button type="button" onClick={() => setEditing("recipe")} aria-label={t.editRecipe} className="flex h-11 w-11 items-center justify-center text-ink"><Pencil size={20} strokeWidth={1.75} /></button>
              </div>
              {dish.ingredients && (
                <div className="mt-2">
                  <p lang={tag} className="eyebrow">{t.ingredients}</p>
                  <Tr as="p" text={dish.ingredients} lang={dish.recipe_lang} tr={dish.recipe_tr?.ingredients} />
                </div>
              )}
              {dish.steps && (
                <div className="mt-3">
                  <p lang={tag} className="eyebrow">{t.steps}</p>
                  <Tr as="p" text={dish.steps} lang={dish.recipe_lang} tr={dish.recipe_tr?.steps} />
                </div>
              )}
            </>
          ) : (
            <button type="button" onClick={() => setEditing("recipe")} className="inline-flex min-h-[44px] items-center gap-1.5 text-muted underline decoration-rule underline-offset-4 hover:text-ink" data-add-recipe>
              <Plus size={20} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.addRecipe}</span>
            </button>
          )}
        </section>

        {dish.can_edit && (
          <div className="flex flex-wrap gap-2 border-t border-rule px-4 py-3">
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setEditing("dish")}><Pencil size={20} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.editDish}</span></button>
            <button type="button" className="btn btn-danger btn-small" onClick={remove}><Trash2 size={20} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.deleteDish}</span></button>
          </div>
        )}
      </div>

      <DishSheet open={editing === "dish"} file={null} dish={dish} onClose={() => setEditing(null)} onSaved={(d) => { setData({ dish: d }); setEditing(null); }} />
      <RecipeSheet open={editing === "recipe"} dish={dish} onClose={() => setEditing(null)} onSave={(ingredients, steps) => patch({ ingredients, steps })} />
      <NoteSheet open={editing === "note"} dish={dish} onClose={() => setEditing(null)} onSave={(note) => patch({ note })} />
      <ShowScreen open={show} dish={dish} onClose={() => setShow(false)} />
    </div>
  );
}

function Back() {
  const c = useT(common);
  const k = useT(kitchen);
  const { lang } = useMe();
  return (
    <Link href="/kitchen" className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-[16px] text-muted hover:text-ink">
      <ArrowLeft size={20} strokeWidth={1.75} aria-hidden /> <span lang={langInfo(lang).tag}>{k.title}</span>
      <span className="sr-only">{c.back}</span>
    </Link>
  );
}

function RecipeSheet({ open, dish, onClose, onSave }: { open: boolean; dish: Dish; onClose: () => void; onSave: (ingredients: string, steps: string) => Promise<boolean> }) {
  const t = useT(kitchen);
  const c = useT(common);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  const shownIng = dish.ingredients ? pick(dish.ingredients, dish.recipe_lang, dish.recipe_tr?.ingredients, lang) : "";
  const shownSteps = dish.steps ? pick(dish.steps, dish.recipe_lang, dish.recipe_tr?.steps, lang) : "";
  const [ing, setIng] = useState(shownIng);
  const [steps, setSteps] = useState(shownSteps);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setIng(shownIng);
      setSteps(shownSteps);
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={dish.ingredients || dish.steps ? t.editRecipe : t.addRecipe}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (ing === shownIng && steps === shownSteps) return onClose();
          setBusy(true);
          if (await onSave(ing, steps)) onClose();
          setBusy(false);
        }}
      >
        <label className="block">
          <span lang={tag} className="mb-1 block font-medium">{t.ingredients}</span>
          <textarea value={ing} onChange={(e) => setIng(e.target.value)} rows={4} lang={tag} className="field" data-ingredients />
        </label>
        <label className="block">
          <span lang={tag} className="mb-1 block font-medium">{t.steps}</span>
          <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={6} lang={tag} className="field" data-steps />
        </label>
        <button type="submit" disabled={busy} className="btn btn-primary w-full"><span lang={tag}>{busy ? t.saving : c.save}</span></button>
      </form>
    </Sheet>
  );
}

function NoteSheet({ open, dish, onClose, onSave }: { open: boolean; dish: Dish; onClose: () => void; onSave: (note: string) => Promise<boolean> }) {
  const t = useT(kitchen);
  const c = useT(common);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  const shown = dish.note ? pick(dish.note, dish.note_lang, dish.note_tr, lang) : "";
  const [note, setNote] = useState(shown);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setNote(shown);
      setBusy(false);
    }
  }
  const save = async (v: string) => {
    if (v.trim() === shown.trim()) return onClose();
    setBusy(true);
    if (await onSave(v)) onClose();
    setBusy(false);
  };
  return (
    <Sheet open={open} onClose={onClose} title={dish.note ? t.editNote : t.addNote}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(note); }}>
        <label className="block">
          <span lang={tag} className="mb-1 block font-medium">{t.note}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={600} placeholder={t.notePlaceholder} lang={tag} className="field" data-note />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn btn-primary flex-1"><span lang={tag}>{busy ? t.saving : c.save}</span></button>
          {dish.note && <button type="button" disabled={busy} onClick={() => save("")} className="btn btn-danger"><span lang={tag}>{t.removeNote}</span></button>}
        </div>
      </form>
    </Sheet>
  );
}

/** Show: the photo fills the screen with the dish's name in the helper's language (the viewer's own name smaller under it). Tap or Close to leave. */
function ShowScreen({ open, dish, onClose }: { open: boolean; dish: Dish; onClose: () => void }) {
  const t = useT(kitchen);
  const { lang, me } = useMe();
  const hl = me.helper_lang;
  const hers = pick(dish.name, dish.lang, dish.tr, hl);
  const own = pick(dish.name, dish.lang, dish.tr, lang);
  const hersLang = dish.lang === hl || dish.tr?.[hl] ? hl : dish.lang;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label={t.show}
          data-show-screen
          onClick={onClose}
          className="fixed inset-0 z-[80] flex flex-col bg-ink text-on-primary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button type="button" onClick={onClose} aria-label={t.showClose} className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-10 flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-on-primary bg-ink text-on-primary">
            <X size={26} strokeWidth={2} />
          </button>
          <m.div className="flex min-h-0 flex-1 items-center justify-center p-2" initial={{ scale: 0.98 }} animate={{ scale: 1 }} transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}>
            {dish.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl(dish.photo)} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </m.div>
          <div className="px-5 pb-6 pt-3 text-center">
            <p lang={langInfo(hersLang).tag} className="text-[40px] font-semibold [overflow-wrap:anywhere]">{hers}</p>
            {lang !== hl && own !== hers && <p lang={langInfo(lang).tag} className="mt-1 text-[22px]">{own}</p>}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
