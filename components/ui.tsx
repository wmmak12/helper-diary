"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, Eye, ImagePlus, X, RotateCcw, WifiOff } from "lucide-react";
import { langInfo, pick, type Lang, type Texts } from "@/lib/languages";
import { strings, useMe, useT } from "@/lib/client/i18n";
import { common } from "@/lib/strings/common";
import { photoUrl, uploadPhoto, type ApiFailure } from "@/lib/client/api";

/** Text in the reader's language, with the original one tap away (or everywhere, when the header toggle is on). */
export function Tr({
  text, lang, tr, className, as: As = "span", noToggle,
}: { text: string; lang: Lang; tr: Texts | null | undefined; className?: string; as?: "span" | "p" | "h1" | "h2" | "h3" | "div"; noToggle?: boolean }) {
  const { lang: me, original: globalOriginal } = useMe();
  const [local, setLocal] = useState(false);
  const translated = pick(text, lang, tr, me);
  const isTranslated = lang !== me && translated !== text;
  const showOriginal = isTranslated && (local || globalOriginal);
  const shown = showOriginal ? text : translated;
  const shownLang = showOriginal || !isTranslated ? lang : me;
  const t = strings(me, common);
  return (
    <As className={className}>
      <span lang={langInfo(shownLang).tag} style={{ whiteSpace: "pre-wrap" }}>{shown}</span>
      {isTranslated && !noToggle && !globalOriginal && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLocal((v) => !v); }}
          className="ml-2 inline-flex min-h-[32px] items-center gap-1 rounded-[6px] px-1.5 align-middle text-[15px] font-normal text-muted underline decoration-rule underline-offset-4 hover:text-ink"
          aria-pressed={local}
        >
          <Eye size={16} strokeWidth={1.75} aria-hidden />
          <span lang={langInfo(me).tag}>{local ? t.showTranslation : t.original}</span>
        </button>
      )}
      {!tr && lang !== me && (
        <span className="ml-2 text-[15px] text-muted" lang={langInfo(me).tag}>({t.notTranslated})</span>
      )}
    </As>
  );
}

export function PageHeader({ title, titleLang, back, children, eyebrow }: { title: string; titleLang?: Lang; back?: string; children?: React.ReactNode; eyebrow?: string }) {
  const { lang } = useMe();
  const t = useT(common);
  const l = langInfo(titleLang ?? lang);
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-flex min-h-[44px] items-center gap-1.5 text-[16px] text-muted hover:text-ink">
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden /> <span lang={langInfo(lang).tag}>{t.back}</span>
          </Link>
        )}
        {eyebrow && <p className="eyebrow" lang={langInfo(lang).tag}>{eyebrow}</p>}
        <h1 lang={l.tag} className={`font-semibold ${l.code === "my" ? "text-[30px]" : "text-[34px] leading-[1.15]"}`}>{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Empty({ img, title, line, children }: { img: "notebook" | "today" | "conversations" | "kitchen"; title?: string; line?: string; children?: React.ReactNode }) {
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/empty-${img}.png`} alt="" width={200} height={200} className="h-auto w-[160px] lg:w-[200px]" />
      {title && <h2 lang={tag} className="mt-2 text-[24px] font-semibold">{title}</h2>}
      {line && <p lang={tag} className={`mt-1 max-w-[30ch] ${title ? "text-muted" : "mt-3 text-[18px] text-ink"}`}>{line}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  const t = useT(common);
  return (
    <div className="space-y-5 py-4" role="status" aria-label={t.loading}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${88 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

export function LoadError({ error, onRetry }: { error: ApiFailure; onRetry: () => void }) {
  const t = useT(common);
  const { lang } = useMe();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[6px] border border-danger bg-danger-wash p-4 text-ink">
      {error.kind === "offline" && <WifiOff size={22} strokeWidth={1.75} aria-hidden className="text-danger" />}
      <p lang={langInfo(lang).tag} className="flex-1">{error.kind === "offline" ? t.offline : t.loadFailed}</p>
      <button className="btn btn-quiet btn-small" onClick={onRetry}><RotateCcw size={20} strokeWidth={1.75} aria-hidden /> <span lang={langInfo(lang).tag}>{t.tryAgain}</span></button>
    </div>
  );
}

/** The rose ribbon bookmark: marks the one thing on a screen that changed or matters most. */
export function Ribbon({ className = "right-4" }: { className?: string }) {
  return (
    <m.span
      aria-hidden
      className={`ribbon ${className}`}
      initial={{ y: "-100%", rotate: 1.5 }}
      animate={{ y: 0, rotate: 0 }}
      transition={{ y: { duration: 0.42, ease: [0.34, 1.32, 0.64, 1] }, rotate: { delay: 0.42, duration: 0.16 } }}
      style={{ transformOrigin: "top center" }}
    />
  );
}

/** Ink write-in: the text settles in from its start side under a paper cover. */
export function InkIn({ children, k, className }: { children: React.ReactNode; k?: string | number; className?: string }) {
  return (
    <m.div key={k} className={`relative ${className ?? ""}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}>
      {children}
      <m.span aria-hidden className="pointer-events-none absolute inset-0 bg-paper" style={{ transformOrigin: "right" }} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }} />
    </m.div>
  );
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const t = useT(common);
  const { lang } = useMe();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
          <m.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={onClose} />
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[6px] border border-rule bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:rounded-[6px] ${wide ? "lg:max-w-[960px]" : "lg:max-w-[560px]"}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { duration: 0.22, ease: [0.65, 0, 0.35, 1] } }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 lang={langInfo(lang).tag} className="text-[24px] font-semibold">{title}</h2>
              <button className="btn btn-small -mr-2 -mt-1 !min-h-[44px] !px-2" onClick={onClose} aria-label={t.close}><X size={24} strokeWidth={1.75} /></button>
            </div>
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Photos({ ids, onRemove }: { ids: string[]; onRemove?: (id: string) => void }) {
  const t = useT(common);
  if (!ids.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ids.map((id) => (
        <div key={id} className="relative">
          <a href={photoUrl(id)} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(id)} alt="" className="h-28 w-28 rounded-[6px] border border-rule object-cover" loading="lazy" />
          </a>
          {onRemove && (
            <button type="button" onClick={() => onRemove(id)} aria-label={t.removePhoto} className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink bg-paper">
              <X size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function PhotoButton({ onAdded, label, className }: { onAdded: (id: string) => void; label?: string; className?: string }) {
  const t = useT(common);
  const { lang, toast } = useMe();
  const [busy, setBusy] = useState(false);
  return (
    <label className={`btn btn-quiet btn-small ${busy ? "opacity-60" : ""} ${className ?? ""}`}>
      <ImagePlus size={22} strokeWidth={1.75} aria-hidden />
      <span lang={langInfo(lang).tag}>{busy ? t.loading : (label ?? t.addPhoto)}</span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try { onAdded(await uploadPhoto(f)); } catch { toast({ text: t.offline, tone: "error" }); } finally { setBusy(false); }
        }}
      />
    </label>
  );
}

export function useLangTag() {
  const { lang } = useMe();
  return langInfo(lang).tag;
}
