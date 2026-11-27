"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { BookOpen, CalendarDays, CookingPot, Eye, HelpCircle, ListChecks, Mic, Search, Settings, X } from "lucide-react";
import { LANGUAGES, langInfo, type Lang } from "@/lib/languages";
import type { Me } from "@/lib/types";
import { MeProvider, fmt, strings, useMe, useT } from "@/lib/client/i18n";
import { common } from "@/lib/strings/common";
import { shell } from "@/lib/strings/shell";
import { api } from "@/lib/client/api";
import { LanguageButtons } from "@/components/auth/LangSwitch";

type Tab = { href: string; key: "talk" | "kitchen" | "notebook" | "today" | "calendar" | "questions"; icon: typeof Mic; badge?: "drafts" | "questions" | "today" };

/** The section a path belongs to: notes live inside the Notebook tab (its House | My notes switch), so /notes is /notebook. */
function sectionOf(pathname: string): string {
  const first = "/" + (pathname.split("/")[1] ?? "");
  return first === "/notes" ? "/notebook" : first;
}

function tabsFor(me: Me): Tab[] {
  if (me.role === "helper") {
    return [
      { href: "/today", key: "today", icon: ListChecks, badge: "today" },
      { href: "/calendar", key: "calendar", icon: CalendarDays },
      // 5.0: Kitchen takes History's slot; her History is a button at the top of Today
      { href: "/kitchen", key: "kitchen", icon: CookingPot },
      { href: "/notebook", key: "notebook", icon: BookOpen },
      { href: "/questions", key: "questions", icon: HelpCircle },
    ];
  }
  return [
    { href: "/talk", key: "talk", icon: Mic },
    // 5.0: Kitchen takes History's slot; History (with the drafts count) is a button at the top of Talk
    { href: "/kitchen", key: "kitchen", icon: CookingPot },
    { href: "/notebook", key: "notebook", icon: BookOpen },
    { href: "/today", key: "today", icon: ListChecks, badge: "questions" },
    { href: "/calendar", key: "calendar", icon: CalendarDays },
  ];
}

export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <MeProvider initial={me}>
          <Frame>{children}</Frame>
        </MeProvider>
      </MotionConfig>
    </LazyMotion>
  );
}

function LanguagePick() {
  const { me, setMe } = useMe();
  const [busy, setBusy] = useState<Lang | null>(null);
  // the line under the buttons is in the helper's language for her, English for an employer
  const pickLang: Lang = me.role === "helper" ? me.helper_lang : "en";
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center gap-4 px-4 py-10">
      {LANGUAGES.map((l) => {
        const s = strings(l.code, shell);
        return (
          <p key={l.code} lang={l.tag} className="text-[20px] font-semibold">{s.pickTitle}</p>
        );
      })}
      <div className="mt-2">
        <LanguageButtons
          size="lg"
          value={busy}
          disabled={!!busy}
          label={strings(pickLang, shell).pickTitle}
          onChange={async (l) => {
            setBusy(l);
            try {
              const r = await api<{ me: Me }>("/api/me", { method: "PATCH", body: { lang: l } });
              setMe(r.me);
            } catch {
              setBusy(null);
            }
          }}
        />
      </div>
      <p className="text-muted" lang={langInfo(pickLang).tag}>{strings(pickLang, shell).pickLine}</p>
    </main>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { me, lang, badges, original, setOriginal, toasts, dismissToast } = useMe();
  const pathname = usePathname();
  const t = useT(common);
  const s = useT(shell);
  const tag = langInfo(lang).tag;
  const tabs = tabsFor(me);
  const section = sectionOf(pathname);
  const found = tabs.findIndex((x) => x.href === section);
  // History (/talks) has no tab since 5.0: the screen you came to it from stays current
  const [lastTab, setLastTab] = useState(found >= 0 ? found : 0);
  if (found >= 0 && found !== lastTab) setLastTab(found);
  const active = found >= 0 ? found : section === "/talks" ? lastTab : -1;
  const [prevActive, setPrevActive] = useState(active);
  const [dir, setDir] = useState(0);
  if (prevActive !== active) {
    setDir(active >= 0 && prevActive >= 0 ? Math.sign(active - prevActive) : 0);
    setPrevActive(active);
  }

  if (!me.lang) return <LanguagePick />;

  const badge = (b?: Tab["badge"]) => (b ? badges[b] : 0);
  const originalToggle = me.lang !== "en" || me.role === "helper";

  return (
    <div className="min-h-dvh lg:flex">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-rule bg-desk px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" width={32} height={32} className="h-8 w-8 object-cover" />
          <span className="text-[21px] font-semibold" lang="en">Helper Diary</span>
        </Link>
        <nav aria-label={s.nav} className="flex flex-col gap-1">
          {tabs.map((x, i) => (
            <Link key={x.href} href={x.href} aria-current={i === active ? "page" : undefined} className={`relative flex min-h-[52px] items-center gap-3 rounded-[6px] px-3 text-[18px] ${i === active ? "bg-paper text-ink" : "text-muted hover:text-ink"}`}>
              {i === active && <m.span layoutId="side-ribbon" className="absolute left-0 top-2 h-[calc(100%-16px)] w-[4px] rounded-[2px] bg-ribbon" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
              <x.icon size={24} strokeWidth={1.75} aria-hidden />
              <span lang={tag} className="flex-1">{t[x.key]}</span>
              {badge(x.badge) > 0 && <Badge n={badge(x.badge)} />}
            </Link>
          ))}
          <div className="my-3 h-px bg-rule" />
          {me.role === "employer" && (
            <Link href="/questions" className={`flex min-h-[48px] items-center gap-3 rounded-[6px] px-3 ${pathname.startsWith("/questions") ? "bg-paper text-ink" : "text-muted hover:text-ink"}`}>
              <HelpCircle size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag} className="flex-1">{t.questions}</span>
              {badges.questions > 0 && <Badge n={badges.questions} />}
            </Link>
          )}
          <Link href="/search" className={`flex min-h-[48px] items-center gap-3 rounded-[6px] px-3 ${pathname.startsWith("/search") ? "bg-paper text-ink" : "text-muted hover:text-ink"}`}>
            <Search size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.search}</span>
          </Link>
          <Link href="/settings" className={`flex min-h-[48px] items-center gap-3 rounded-[6px] px-3 ${pathname.startsWith("/settings") ? "bg-paper text-ink" : "text-muted hover:text-ink"}`}>
            <Settings size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.settings}</span>
          </Link>
          {originalToggle && (
            <button onClick={() => setOriginal(!original)} aria-pressed={original} className="mt-2 flex min-h-[48px] items-center gap-3 rounded-[6px] border-[1.5px] border-field px-3 text-left text-ink">
              <Eye size={22} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{original ? s.hideOriginal : `${t.original}`}</span>
            </button>
          )}
        </nav>
        <p className="mt-auto px-2 text-[15px] text-muted">{me.name}</p>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {/* phone header */}
        <header data-topbar className="sticky top-0 z-30 flex items-center gap-1 border-b border-rule bg-desk px-3 py-1.5 lg:hidden" style={{ paddingTop: "max(6px, env(safe-area-inset-top))" }}>
          <Link href="/" className="flex min-h-[44px] flex-1 items-center gap-2" aria-label="Helper Diary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={28} height={28} className="h-7 w-7 object-cover" />
            <span className="text-[19px] font-semibold" lang="en">Helper Diary</span>
          </Link>
          {originalToggle && (
            <button onClick={() => setOriginal(!original)} aria-pressed={original} className={`flex min-h-[44px] items-center gap-1 rounded-[6px] px-2 text-[15px] ${original ? "bg-paper text-ink ring-[1.5px] ring-ink" : "text-ink"}`}>
              <Eye size={20} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.original}</span>
            </button>
          )}
          {me.role === "employer" && (
            <Link href="/questions" aria-label={t.questions} className="relative flex h-11 w-11 items-center justify-center text-ink">
              <HelpCircle size={24} strokeWidth={1.75} />
              {badges.questions > 0 && <span className="absolute right-0.5 top-0.5"><Badge n={badges.questions} /></span>}
            </Link>
          )}
          <Link href="/search" aria-label={t.search} className="flex h-11 w-11 items-center justify-center text-ink"><Search size={24} strokeWidth={1.75} /></Link>
          <Link href="/settings" aria-label={t.settings} className="flex h-11 w-11 items-center justify-center text-ink"><Settings size={24} strokeWidth={1.75} /></Link>
        </header>

        <AnimatePresence mode="popLayout" initial={false}>
          <m.main
            key={section}
            initial={{ opacity: 0, x: dir * 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-32 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8"
          >
            {children}
          </m.main>
        </AnimatePresence>

        {/* phone tab bar */}
        <nav data-tabbar aria-label={s.nav} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-rule bg-desk lg:hidden" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {tabs.map((x, i) => (
            <Link key={x.href} href={x.href} aria-current={i === active ? "page" : undefined} className={`relative flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 pb-1 pt-2 ${i === active ? "text-ink" : "text-muted"}`}>
              {i === active && <m.span layoutId="tab-ribbon" className="absolute top-0 h-[5px] w-10 rounded-b-[3px] bg-ribbon" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
              <span className="relative">
                <x.icon size={24} strokeWidth={1.75} aria-hidden />
                {badge(x.badge) > 0 && <span className="absolute -right-4 -top-2"><Badge n={badge(x.badge)} /></span>}
              </span>
              <span lang={tag} className={`max-w-full text-center text-[15px] [overflow-wrap:anywhere] ${lang === "my" ? "leading-[1.8]" : "leading-tight"}`}>{t[x.key]}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        <AnimatePresence>
          {toasts.map((x) => (
            <m.div key={x.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.22 }}
              className={`pointer-events-auto flex w-full max-w-[480px] items-center gap-3 rounded-[6px] px-4 py-2 ${x.tone === "error" ? "border border-danger bg-danger-wash text-ink" : "bg-primary text-on-primary"}`}>
              <span lang={langInfo(x.lang).tag} className="flex-1 py-1">{x.text}</span>
              {x.action && <Link href={x.action.href} onClick={() => dismissToast(x.id)} className="min-h-[44px] content-center px-2 font-semibold underline underline-offset-4" lang={langInfo(x.lang).tag}>{x.action.label}</Link>}
              <button onClick={() => dismissToast(x.id)} aria-label={t.close} className="flex h-11 w-11 items-center justify-center"><X size={20} strokeWidth={1.75} /></button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Badge({ n }: { n: number }) {
  return (
    <m.span key={n} initial={{ scale: 1 }} animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.14 }} className="tabular inline-flex min-w-[22px] items-center justify-center rounded-full bg-ochre-ink px-1.5 text-[13px] font-semibold leading-[22px] text-on-primary">
      {n}
    </m.span>
  );
}

export { fmt };
