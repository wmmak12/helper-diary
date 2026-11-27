import { langInfo, type Lang } from "@/lib/languages";

export function talkDate(ts: number, lang: Lang, withTime = true) {
  try {
    return new Intl.DateTimeFormat(langInfo(lang).tag, {
      weekday: "short", day: "numeric", month: "short", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function clock(ts: number) {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
