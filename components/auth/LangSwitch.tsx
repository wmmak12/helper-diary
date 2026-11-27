"use client";
import { Check } from "lucide-react";
import { LANGUAGES, type Lang } from "@/lib/languages";

/** The form language: small pills that wrap (five fit in two rows at 390 wide). */
export function LangSwitch({ value, onChange, label }: { value: Lang; onChange: (l: Lang) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="mb-4 flex flex-wrap gap-1.5">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={value === l.code}
          lang={l.tag}
          onClick={() => onChange(l.code)}
          className={`min-h-[44px] rounded-full border-[1.5px] px-4 py-1 text-[16px] transition-colors duration-[140ms] ${value === l.code ? "border-primary bg-primary text-on-primary" : "border-field bg-paper text-ink"}`}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}

/**
 * A person's own language (sign-up, Settings): every language in its own name, two to a row on a phone and
 * three from 640 wide. Buttons grow with their text (min-height, never a fixed height) so Burmese keeps its
 * line-height; the chosen one is filled and ticked.
 */
export function LanguageButtons({ value, onChange, label, disabled, size = "md" }: { value: Lang | null; onChange: (l: Lang) => void; label: string; disabled?: boolean; size?: "md" | "lg" }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {LANGUAGES.map((l) => {
        const on = value === l.code;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={on}
            lang={l.tag}
            disabled={disabled}
            onClick={() => onChange(l.code)}
            className={`flex items-center justify-between gap-2 rounded-[6px] border-[1.5px] px-3.5 py-2 text-left transition-[background-color,color,transform] duration-[140ms] active:scale-[0.98] motion-reduce:active:scale-100 disabled:opacity-60 ${size === "lg" ? "min-h-[64px] text-[22px]" : "min-h-[52px] text-[18px]"} ${on ? "border-primary bg-primary text-on-primary" : "border-field bg-paper text-ink"}`}
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">{l.name}</span>
            {on && <Check size={20} strokeWidth={2} aria-hidden className="shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

/** The language a phone is set to, when the app has it (used to open a helper's sign-up in her language). */
export function phoneLang(): Lang | null {
  if (typeof navigator === "undefined") return null;
  for (const raw of navigator.languages ?? [navigator.language]) {
    const p = raw.toLowerCase().split("-")[0];
    const code = p === "fil" ? "tl" : p === "in" ? "id" : p;
    if (code !== "en" && LANGUAGES.some((l) => l.code === code)) return code as Lang;
  }
  return null;
}
