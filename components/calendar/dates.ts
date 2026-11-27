// Date strings (yyyy-mm-dd) as the calendar uses them: plain dates, computed at UTC noon so no time zone shifts them.

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(date: string, n: number): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1, 12)).toISOString().slice(0, 10);
}

/** 0 = Sunday */
export function weekdayOf(date: string): number {
  return new Date(date + "T12:00:00Z").getUTCDay();
}

/** The Monday on or before `date`. */
export function weekStart(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export function monthStart(date: string): string {
  return date.slice(0, 8) + "01";
}

/** The six-week (or five) grid of a month, Monday first. */
export function monthGrid(date: string): { from: string; to: string } {
  const first = monthStart(date);
  const from = weekStart(first);
  const last = addDays(addMonths(first, 1), -1);
  const to = addDays(weekStart(last), 6);
  return { from, to };
}

export function isDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
}

/** Local today as a fallback until the server says which day it is in the household. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loc(tag: string) {
  return tag === "my" ? "my-MM" : tag;
}

export function fmtDate(date: string, tag: string, o: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(loc(tag), { ...o, timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
}

export const longDate = (date: string, tag: string) => fmtDate(date, tag, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const shortDate = (date: string, tag: string) => fmtDate(date, tag, { weekday: "short", day: "numeric", month: "short" });
