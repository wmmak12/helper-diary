"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Lang } from "../languages";
import type { Me } from "../types";
import { api } from "./api";

/** A screen's strings: every language a household can pick, English required. */
export type Strings<K extends string> = { en: Record<K, string> } & Partial<Record<Exclude<Lang, "en">, Partial<Record<K, string>>>>;

type Badges = { drafts: number; questions: number; today: number };
type ToastT = { id: number; text: string; lang: Lang; action?: { label: string; href: string }; tone?: "ok" | "error" };

type Ctx = {
  me: Me;
  lang: Lang;
  setMe: (m: Me) => void;
  original: boolean;
  setOriginal: (v: boolean) => void;
  badges: Badges;
  refreshBadges: () => void;
  toast: (t: Omit<ToastT, "id" | "lang"> & { lang?: Lang }) => void;
  toasts: ToastT[];
  dismissToast: (id: number) => void;
};

const MeCtx = createContext<Ctx | null>(null);

export function MeProvider({ initial, children }: { initial: Me; children: React.ReactNode }) {
  const [me, setMe] = useState(initial);
  const [original, setOriginal] = useState(false);
  const [badges, setBadges] = useState<Badges>({ drafts: 0, questions: 0, today: 0 });
  const [toasts, setToasts] = useState<ToastT[]>([]);
  const lang: Lang = me.lang ?? "en";
  const refreshBadges = useCallback(() => {
    api<Badges>("/api/badges").then(setBadges).catch(() => {});
  }, []);
  useEffect(() => {
    refreshBadges();
    const t = setInterval(() => document.visibilityState === "visible" && refreshBadges(), 20000);
    return () => clearInterval(t);
  }, [refreshBadges]);
  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);
  const toast = useCallback<Ctx["toast"]>(
    (t) => {
      const id = Date.now() + Math.random();
      setToasts((ts) => [...ts.slice(-2), { ...t, lang: t.lang ?? lang, id }]);
      if (!t.action && t.tone !== "error") setTimeout(() => dismissToast(id), 4000);
      else setTimeout(() => dismissToast(id), 8000);
    },
    [dismissToast, lang],
  );
  const v = useMemo(
    () => ({ me, lang, setMe, original, setOriginal, badges, refreshBadges, toast, toasts, dismissToast }),
    [me, lang, original, badges, refreshBadges, toast, toasts, dismissToast],
  );
  return <MeCtx.Provider value={v}>{children}</MeCtx.Provider>;
}

export function useMe(): Ctx {
  const c = useContext(MeCtx);
  if (!c) throw new Error("useMe outside MeProvider");
  return c;
}

export function strings<K extends string>(lang: Lang, s: Strings<K>): Record<K, string> {
  return { ...s.en, ...(s[lang as Exclude<Lang, "en">] ?? {}) } as Record<K, string>;
}

/** Strings for the signed-in user's language. */
export function useT<K extends string>(s: Strings<K>): Record<K, string> {
  const { lang } = useMe();
  return strings(lang, s);
}

/** Fill {name} placeholders. */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
