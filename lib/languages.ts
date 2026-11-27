// The languages the household app is built around. Adding one means adding a row here and its strings
// in lib/strings/*.ts: screens and stored data key everything by `code`.
export type Lang = "en" | "zh" | "my" | "id" | "tl";

export type LanguageInfo = {
  code: Lang;
  /** BCP 47 tag used for lang="" attributes */
  tag: string;
  /** Name written in the language itself */
  name: string;
  /** English name, given to the model */
  english: string;
  /** Speech recognition / synthesis locale */
  speech: string;
  /** Employers can speak it on Talk */
  spoken: boolean;
};

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", tag: "en", name: "English", english: "English", speech: "en-US", spoken: true },
  { code: "zh", tag: "zh-Hans", name: "中文", english: "Simplified Chinese (Mandarin)", speech: "zh-CN", spoken: true },
  { code: "my", tag: "my", name: "မြန်မာ", english: "Burmese (Myanmar, Unicode)", speech: "my-MM", spoken: false },
  { code: "id", tag: "id", name: "Bahasa Indonesia", english: "Indonesian (Bahasa Indonesia)", speech: "id-ID", spoken: false },
  { code: "tl", tag: "tl", name: "Tagalog", english: "Tagalog (Filipino)", speech: "fil-PH", spoken: false },
];

export const LANG_CODES = LANGUAGES.map((l) => l.code);

export function langInfo(code: string | null | undefined): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function isLang(code: unknown): code is Lang {
  return typeof code === "string" && LANG_CODES.includes(code as Lang);
}

/** Text with its original language and translations into every household language. */
export type Texts = Partial<Record<Lang, string>>;

/** Pick the text in `lang`, falling back to the original. */
export function pick(original: string, originalLang: string, tr: Texts | null | undefined, lang: Lang): string {
  if (originalLang === lang) return original;
  const t = tr?.[lang];
  return t && t.trim() ? t : original;
}
