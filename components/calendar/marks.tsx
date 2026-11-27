"use client";
import { Coffee, ListChecks, PartyPopper } from "lucide-react";

// Each kind has its own colour from design/style.md and its own icon, so colour is never the only cue:
// tasks navy (primary on paper 11.42:1), family events ochre-ink on ochre-wash (5.73:1), day off moss on moss-wash (5.17:1).

export const KIND = {
  task: { icon: ListChecks, text: "text-primary", chip: "bg-paper text-primary border-l-[3px] border-primary" },
  event: { icon: PartyPopper, text: "text-ochre-ink", chip: "bg-ochre-wash text-ochre-ink border-l-[3px] border-ochre-ink" },
  dayoff: { icon: Coffee, text: "text-moss", chip: "bg-moss-wash text-moss border-l-[3px] border-moss" },
} as const;

export function KindIcon({ kind, size = 16, label }: { kind: keyof typeof KIND; size?: number; label?: string }) {
  const I = KIND[kind].icon;
  return <I size={size} strokeWidth={2} className={`shrink-0 ${KIND[kind].text}`} aria-label={label} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} />;
}
