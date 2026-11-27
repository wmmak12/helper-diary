import type { TemplateTask } from "@/lib/types";
import { fmt } from "@/lib/client/i18n";
import { addDays, fmtDate, weekdayOf } from "@/components/calendar/dates";
import type { tplS } from "@/lib/strings/templates";

type T = Record<keyof (typeof tplS)["en"], string>;

/** The path of a template's page: sample:baby → /templates/sample-baby */
export const tplHref = (ref: string) => `/templates/${ref.replace(":", "-")}`;

/** Short weekday names, Sunday first. */
export const weekdayNames = (tag: string) => Array.from({ length: 7 }, (_, i) => fmtDate(addDays("2024-01-07", i), tag, { weekday: "short" }));

/** "Every day", "Mon, Thu", "Monthly, from the start date" or "Day 3". */
export function daysLabel(x: TemplateTask, t: T, tag: string): string {
  if (x.repeat === "daily") return t.everyDay;
  if (x.repeat === "monthly") return t.monthly;
  if (x.repeat === "once") return fmt(t.dayN, { n: x.day ?? 1 });
  const names = weekdayNames(tag);
  // Monday first, as the calendar reads
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => x.weekdays.includes(d)).map((d) => names[d]).join(", ");
}

/** The next Monday after `today` (never today itself). */
export function nextMonday(today: string): string {
  const wd = weekdayOf(today);
  return addDays(today, ((8 - wd) % 7) || 7);
}
