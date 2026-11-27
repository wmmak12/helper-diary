"use client";
import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { common } from "@/lib/strings/common";
import { talk as talkStrings } from "@/lib/strings/talk";
import { Badge } from "@/components/AppShell";

/** 5.0: History left the bottom bar for Kitchen. This button opens it from the top of the helper's Today. */
export function HistoryButton({ className = "" }: { className?: string }) {
  const { me, lang, badges } = useMe();
  const t = useT(common);
  const n = me.role === "employer" ? badges.drafts : 0;
  return (
    <Link href="/talks" data-history-button className={`btn btn-quiet btn-small relative !gap-1.5 ${className}`}>
      <MessagesSquare size={22} strokeWidth={1.75} aria-hidden />
      <span lang={langInfo(lang).tag}>{t.talks}</span>
      {n > 0 && <Badge n={n} />}
    </Link>
  );
}

/** 5.2: on Talk (employers), a full-width "Past talks" row under the controls; it opens History and carries the
 *  waiting-drafts count, shown only above zero. */
export function PastTalksRow({ className = "" }: { className?: string }) {
  const { lang, badges } = useMe();
  const s = useT(talkStrings);
  const tag = langInfo(lang).tag;
  const n = badges.drafts;
  return (
    <Link
      href="/talks"
      data-past-talks
      aria-label={n > 0 ? `${s.pastTalks} · ${fmt(s.pastTalksWaiting, { n })}` : s.pastTalks}
      className={`flex min-h-[56px] w-full items-center gap-3 rounded-[6px] border-[1.5px] border-ink bg-paper px-4 py-2 text-ink transition-transform duration-[80ms] hover:bg-desk/60 active:scale-[0.98] motion-reduce:active:scale-100 ${className}`}
    >
      <MessagesSquare size={22} strokeWidth={1.75} aria-hidden className="shrink-0" />
      <span lang={tag} className="min-w-0 flex-1 text-[18px] font-medium">{s.pastTalks}</span>
      {n > 0 && <Badge n={n} />}
      <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
    </Link>
  );
}
