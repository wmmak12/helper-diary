"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { api, ApiErr, type ApiFailure } from "@/lib/client/api";
import { ss } from "@/lib/strings/search";
import type { SearchHit } from "@/lib/types";
import { LoadError, PageHeader, Skeleton, Tr } from "@/components/ui";

const ORDER: SearchHit["type"][] = ["entry", "note", "talk", "task", "question"];

export function SearchScreen() {
  const t = useT(ss);
  const { lang } = useMe();
  const tag = langInfo(lang).tag;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await api<{ hits: SearchHit[] }>(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        setHits(r.hits); setError(null);
      } catch (e) {
        if (e instanceof ApiErr) setError(e.f);
      } finally { if (!ctrl.signal.aborted) setBusy(false); }
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, tick]);

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title={t.title} />
      <label className="relative block">
        <Search size={22} strokeWidth={1.75} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input type="search" lang={tag} className="field !pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.placeholder} aria-label={t.placeholder} autoFocus />
      </label>
      <div className="mt-5" aria-live="polite">
        {!q.trim() && <p lang={tag} className="text-muted">{t.hint}</p>}
        {busy && !hits && <Skeleton rows={4} />}
        {error && q.trim() && <LoadError error={error} onRetry={() => setTick((x) => x + 1)} />}
        {hits && q.trim() && hits.length === 0 && !busy && <p lang={tag} className="text-muted">{fmt(t.none, { q: q.trim() })}</p>}
        {hits && q.trim() && hits.length > 0 && (
          <div className="space-y-6">
            {ORDER.map((type) => {
              const group = hits.filter((h) => h.type === type);
              if (!group.length) return null;
              return (
                <section key={type}>
                  <h2 lang={tag} className="eyebrow mb-2">{t[type]}</h2>
                  <ul className="page divide-y divide-rule">
                    {group.map((h) => (
                      <li key={`${h.type}-${h.id}`}>
                        <Link href={h.href} className="block p-4">
                          <Tr as="p" className="text-[19px] font-medium" text={h.title || h.snippet} lang={h.lang} tr={h.title ? h.title_tr : h.snippet_tr} noToggle />
                          {h.title && h.snippet && <Tr as="p" className="mt-0.5 line-clamp-2 text-[16px] text-muted [&_[lang=my]]:leading-[1.95]" text={h.snippet} lang={h.lang} tr={h.snippet_tr} noToggle />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
