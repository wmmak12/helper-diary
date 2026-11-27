"use client";
import type { HoldOutcome, HoldRecordInput } from "../types";
import type { HoldCapture } from "./recorder";

// The phone's silent hold records (1.4): fire and forget to the app's own server. A failed send is dropped without a
// word; nothing here ever delays or changes a hold, and nothing is shown.

/** Random id for this load of the app: a reload starts a new one. */
export const PAGE_ID = typeof window === "undefined" ? "" : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function ua(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

export function sendHoldRecord(rec: HoldRecordInput) {
  try {
    const body = JSON.stringify(rec);
    if (body.length > 60_000) return;
    fetch("/api/holds", { method: "POST", body, keepalive: true, credentials: "same-origin", headers: { "content-type": "application/json" } }).catch(() => {});
  } catch {
    /* never in the way of a hold */
  }
}

/** A hold's record, sent once the hold is over (so its last events are in it) or after 4s at most. */
export function reportHold(
  c: HoldCapture,
  h: { outcome: HoldOutcome; problem: string | null; pressAt: number; lang: string; talkId: number | null },
) {
  const releaseAt = Date.now();
  Promise.race([c.whenQuiet(), new Promise((r) => setTimeout(r, 4000))]).then(() =>
    sendHoldRecord({
      kind: "hold", page: PAGE_ID, releaseAt, ...h, events: c.events,
      waitedForPrevious: null, listeningAfter: c.listeningAfter, went: c.went, ua: ua(),
    }),
  );
}
