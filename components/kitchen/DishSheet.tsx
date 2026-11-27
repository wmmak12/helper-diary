"use client";
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import { useMe, useT } from "@/lib/client/i18n";
import { api, ApiErr, photoUrl, uploadPhoto } from "@/lib/client/api";
import { kitchen } from "@/lib/strings/kitchen";
import { common } from "@/lib/strings/common";
import type { Dish } from "@/lib/types";
import { Sheet } from "@/components/ui";

/** A hidden file input wrapped in a label: on a phone it offers the camera or the gallery. */
export function PhotoPick({ onFile, children, className }: { onFile: (f: File) => void; children: React.ReactNode; className?: string }) {
  return (
    <label className={`cursor-pointer ${className ?? ""}`}>
      {children}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

/**
 * Add a dish (photo, then name, then Save: nothing else is asked) or change one's photo and name.
 * The photo is shrunk on the phone and starts uploading as soon as it is picked. A failed save says so in one
 * line and keeps the photo and the name.
 */
export function DishSheet({
  open, onClose, file, startName = "", dish, onSaved,
}: { open: boolean; onClose: () => void; file: File | null; startName?: string; dish?: Dish; onSaved: (d: Dish) => void }) {
  const t = useT(kitchen);
  const c = useT(common);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  const shownName = dish ? pick(dish.name, dish.lang, dish.tr, lang) : startName;
  const [name, setName] = useState(shownName);
  const [picked, setPicked] = useState<File | null>(file);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = useRef<Promise<string> | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // a new sheet (or a new photo from the Kitchen's Add a dish) starts over
  const [seen, setSeen] = useState<{ open: boolean; file: File | null }>({ open, file });
  if (seen.open !== open || seen.file !== file) {
    setSeen({ open, file });
    if (open) {
      setName(shownName);
      setPicked(file);
      setError(null);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!picked) {
      upload.current = null;
      return;
    }
    const url = URL.createObjectURL(picked);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the preview URL belongs to this file and is revoked with it
    setPreview(url);
    const p = uploadPhoto(picked);
    p.catch(() => {});
    upload.current = p;
    return () => URL.revokeObjectURL(url);
  }, [picked]);

  useEffect(() => {
    if (open && picked) setTimeout(() => nameRef.current?.focus(), 450);
  }, [open, picked]);

  const save = async () => {
    if (busy) return;
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    let photo: string | undefined;
    try {
      if (picked) {
        try {
          photo = await (upload.current ?? uploadPhoto(picked));
        } catch {
          // the early upload failed (offline a moment ago?): try once more on Save before saying so
          upload.current = uploadPhoto(picked);
          photo = await upload.current;
        }
      }
      let d: Dish;
      if (dish) {
        const patch: Record<string, unknown> = { lang };
        if (name.trim() !== shownName.trim()) patch.name = name;
        if (photo) patch.photo = photo;
        d = (await api<{ dish: Dish }>(`/api/dishes/${dish.id}`, { method: "PATCH", body: patch })).dish;
      } else {
        d = (await api<{ dish: Dish }>("/api/dishes", { body: { name, photo, lang } })).dish;
      }
      onSaved(d);
    } catch (e) {
      const f = e instanceof ApiErr ? e.f : null;
      setError(f?.kind === "offline" ? c.offline : f && (f.code === "unsupported_image" || f.code === "too_large") ? t.photoFailed : t.saveFailed);
      setBusy(false);
    }
  };

  const img = preview && picked ? preview : dish?.photo ? photoUrl(dish.photo) : null;
  const canSave = !!name.trim() && (!!picked || !!dish);

  return (
    <Sheet open={open} onClose={onClose} title={dish ? t.editDish : t.addTitle}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <PhotoPick onFile={(f) => { setPicked(f); setError(null); }} className="block">
          {img ? (
            <span className="relative block overflow-hidden rounded-[6px] border border-rule bg-desk">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="aspect-[4/3] w-full object-cover" />
              <span className="absolute bottom-2 right-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-[6px] border-[1.5px] border-ink bg-paper px-3 text-[16px] text-ink">
                <Camera size={20} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.changePhoto}</span>
              </span>
            </span>
          ) : (
            <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-[6px] border-[1.5px] border-dashed border-field bg-desk text-ink">
              <Camera size={32} strokeWidth={1.75} aria-hidden />
              <span lang={tag} className="text-[18px]">{t.choosePhoto}</span>
            </span>
          )}
        </PhotoPick>
        <label className="block">
          <span lang={tag} className="mb-1 block font-medium">{t.nameLabel}</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            enterKeyHint="done"
            placeholder={t.namePlaceholder}
            lang={tag}
            data-dish-name
            className="field"
          />
        </label>
        {error && <p role="alert" lang={tag} className="rounded-[6px] border border-danger bg-danger-wash px-3 py-2 text-ink">{error}</p>}
        <button type="submit" aria-disabled={!canSave || busy} className={`btn btn-primary w-full ${canSave && !busy ? "" : "opacity-60"}`}>
          <span lang={tag}>{busy ? t.saving : c.save}</span>
        </button>
      </form>
    </Sheet>
  );
}
