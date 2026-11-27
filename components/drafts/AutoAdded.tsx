"use client";
import Link from "next/link";
import { m } from "motion/react";
import { Check, ChevronRight } from "lucide-react";
import { langInfo, pick } from "@/lib/languages";
import type { Draft, Entry } from "@/lib/types";
import { useMe, useT } from "@/lib/client/i18n";
import { common } from "@/lib/strings/common";
import { talkDate } from "@/components/talks/format";

// Critical points the app saved straight into the Notebook from a talk. Marked with a small ribbon tab in
// the Ink & Ribbon palette (code, not art), in the reader's language.

function Tab() {
  // a ribbon end: a short rose band with a notched tail
  return <span aria-hidden className="mt-[0.3em] inline-block h-[14px] w-[8px] shrink-0 bg-ribbon [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]" />;
}

/** "Auto-added from a talk · <talk title or date>" on a Notebook entry, for employer and helper alike. */
export function AutoMark({ from, compact }: { from: NonNullable<Entry["auto_from"]>; compact?: boolean }) {
  const { lang } = useMe();
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const title = from.title ? pick(from.title, from.lang, from.title_tr, lang) : null;
  const titleLang = from.title && (from.lang === lang || from.title_tr?.[lang]) ? lang : from.lang;
  return (
    <span className={`inline-flex items-start gap-1.5 text-ribbon-ink ${compact ? "text-[14px]" : "text-[15px]"}`} style={{ lineHeight: lang === "my" ? 1.9 : 1.4 }}>
      <Tab />
      <span className="min-w-0">
        <span lang={tag} className="font-medium">{c.autoAddedFrom}</span>
        {" · "}
        {title ? (
          <span lang={langInfo(titleLang).tag} className="italic">{title}</span>
        ) : (
          <span lang={tag} className="tabular italic" suppressHydrationWarning>{talkDate(from.at, lang, false)}</span>
        )}
      </span>
    </span>
  );
}

/** The talk's auto-added entries, each already saved and opening its entry. Shown above the waiting drafts. */
export function AutoAddedList({ drafts, className = "" }: { drafts: Draft[]; className?: string }) {
  const { lang } = useMe();
  const c = useT(common);
  const tag = langInfo(lang).tag;
  const saved = drafts.filter((d) => d.auto && d.entry_id);
  if (!saved.length) return null;
  return (
    <ul className={`space-y-2 ${className}`}>
      {saved.map((d, i) => (
        <m.li key={d.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}>
          <Link
            href={`/notebook/${d.entry_id}`}
            className="flex min-h-[56px] items-center gap-3 rounded-[6px] border border-rule bg-paper px-3 py-2.5 text-ink transition-transform duration-[80ms] active:scale-[0.99] motion-reduce:active:scale-100"
          >
            <Tab />
            <span className="min-w-0 flex-1">
              <span lang={langInfo(d.lang).tag} className="block text-[18px] font-medium leading-snug">{d.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[14px]" style={{ lineHeight: lang === "my" ? 1.9 : 1.4 }}>
                <span lang={tag} className="font-medium text-ribbon-ink">{c.autoAdded}</span>
                <span className="inline-flex items-center gap-1 text-moss">
                  <Check size={14} strokeWidth={2.25} aria-hidden />
                  <span lang={tag}>{c.alreadySaved}</span>
                </span>
              </span>
            </span>
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
          </Link>
        </m.li>
      ))}
    </ul>
  );
}
