import { all, now, run } from "./db";
import type { User } from "./auth";
import type { HoldEvent, HoldOutcome, HoldRecordInput } from "../types";

// Silent hold records (1.4): what happened on each hold (1.9: the recorder's steps; before, the phone recogniser's events), so the team can see what happened
// on a phone it does not have. Written to the server log and kept in hold_records; nothing in the app reads them back.
// They hold times, recognised text, error names and the user agent, never audio.

const KEEP_DAYS = 30;
const KEEP_ROWS = 5000;
const OUTCOMES: HoldOutcome[] = ["sent", "heardNothing", "tooShort", "cancelled", "problem", "noRecogniser"];

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

function cleanEvents(v: unknown): HoldEvent[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 200).map((e) => {
    const x = (e ?? {}) as Record<string, unknown>;
    const out: HoldEvent = { t: n(x.t) ?? 0, rec: n(x.rec) ?? 0, type: s(x.type, 40) };
    if (typeof x.text === "string") out.text = s(x.text, 500);
    if (typeof x.final === "boolean") out.final = x.final;
    if (typeof x.n === "number") out.n = n(x.n) ?? undefined;
    if (typeof x.error === "string") out.error = s(x.error, 80);
    if (typeof x.message === "string") out.message = s(x.message, 300);
    return out;
  });
}

/** Keep only the known fields, bounded in size. Returns null for something that is not a record. */
export function cleanRecord(b: Record<string, unknown>): HoldRecordInput | null {
  const page = s(b.page, 40);
  const ua = s(b.ua, 400);
  if (!page) return null;
  if (b.kind === "hold") {
    const outcome = OUTCOMES.includes(b.outcome as HoldOutcome) ? (b.outcome as HoldOutcome) : null;
    if (!outcome) return null;
    return {
      kind: "hold", page, ua, outcome,
      pressAt: n(b.pressAt) ?? 0,
      releaseAt: n(b.releaseAt),
      lang: s(b.lang, 10),
      talkId: n(b.talkId),
      events: cleanEvents(b.events),
      problem: typeof b.problem === "string" ? s(b.problem, 40) : null,
      waitedForPrevious: n(b.waitedForPrevious),
      listeningAfter: n(b.listeningAfter),
      went: b.went === "heard" || b.went === "deaf" || b.went === "none" ? b.went : undefined,
      starts: Array.isArray(b.starts)
        ? b.starts.slice(0, 10).map((x) => {
            const o = (x ?? {}) as Record<string, unknown>;
            return { rec: n(o.rec) ?? 0, after: n(o.after), warm: typeof o.warm === "boolean" ? o.warm : null, heard: o.heard === true };
          })
        : undefined,
    };
  }
  if (b.kind === "pageLoad") {
    return { kind: b.kind, page, ua, at: n(b.at) ?? 0, talkId: n(b.talkId), lang: typeof b.lang === "string" ? s(b.lang, 10) : undefined };
  }
  return null;
}

export function saveHoldRecord(user: User, rec: HoldRecordInput) {
  const at = now();
  run("INSERT INTO hold_records (user_id, kind, page, data, created_at) VALUES (?,?,?,?,?)", user.id, rec.kind, rec.page, JSON.stringify(rec), at);
  // one line in the server log as well, so the record can be read where the server's output is kept
  console.log(`[hold-record] ${JSON.stringify({ at, user: user.id, ...rec })}`);
  // never pile up: older than KEEP_DAYS, or beyond the newest KEEP_ROWS
  run("DELETE FROM hold_records WHERE created_at < ?", at - KEEP_DAYS * 86400_000);
  run("DELETE FROM hold_records WHERE id <= (SELECT id FROM hold_records ORDER BY id DESC LIMIT 1 OFFSET ?)", KEEP_ROWS);
}

/** For tests and scripts: the records, oldest first. */
export function holdRecords(): { id: number; user_id: number; kind: string; created_at: number; data: HoldRecordInput }[] {
  return all<{ id: number; user_id: number; kind: string; created_at: number; data: string }>("SELECT * FROM hold_records ORDER BY id").map((r) => ({ ...r, data: JSON.parse(r.data) }));
}

