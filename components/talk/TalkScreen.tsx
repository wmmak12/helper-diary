"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { HelpCircle, Keyboard, Mic, SendHorizontal, X } from "lucide-react";
import { langInfo, LANGUAGES, type Lang } from "@/lib/languages";
import { fmt, strings, useMe } from "@/lib/client/i18n";
import { talk as talkStrings } from "@/lib/strings/talk";
import { api, ApiErr } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { canRecord, HoldCapture, isIosSafari, micPermission } from "@/lib/client/recorder";
import { PAGE_ID, reportHold, sendHoldRecord, ua } from "@/lib/client/holdLog";
import { common } from "@/lib/strings/common";
import type { HoldOutcome, Line, Me, Question, TalkDetail } from "@/lib/types";
import { Empty, PhotoButton, Sheet, Tr } from "@/components/ui";
import { BurmeseKeyboard } from "@/components/BurmeseKeyboard";
import { AutoAddedList } from "@/components/drafts/AutoAdded";
import { PastTalksRow } from "@/components/talks/HistoryButton";
import { HoldButton } from "./HoldButton";
import { aiS } from "@/lib/strings/ai";
import { LineBin, Notice, TalkLine, type NoticeKind } from "./TalkLine";

// Talk: the employer's first screen. A text box (spoken into with the phone keyboard's own mic key, or typed) is the
// main way to talk, Hold to talk the second (1.6); she types back on the app's Burmese
// keyboard on the same phone. Every line is saved on the server before it is translated, and a line
// that could not reach the server waits in this phone's storage until it can.
// 5.1: one talk per day on this phone's clock. The page shows only today's talk; at midnight it turns blank
// (on the next use or refocus), and the day's first line starts the day's talk on the server.

/** This phone's day: its key, local midnight and the next midnight (DST-safe). */
function phoneDay() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return { key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, start, end };
}

const QUEUE_KEY = "dt.talk.queue";
const SPEAK_KEY = "dt.talk.lang";
const MIC_GRANTED_KEY = "dt.mic.granted"; // this phone has opened the microphone for Talk before
const MIC_TIP_CLOSED_KEY = "dt.mic.tipClosed";

type Pending = {
  key: string;
  speaker: "employer" | "helper";
  lang: Lang;
  text: string;
  state: "hearing" | "sending" | "offline" | "sendFailed";
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadQueue(): Pending[] {
  try {
    return (JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Pending[]).filter((p) => p.text).map((p) => ({ ...p, state: "offline" as const }));
  } catch {
    return [];
  }
}
function saveQueue(rows: Pending[]) {
  const keep = rows.filter((r) => r.text && (r.state === "offline" || r.state === "sendFailed" || r.state === "sending"));
  try {
    if (keep.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(keep));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* storage full or blocked: rows stay on screen */
  }
}

/** Delete a line on the server; true when it is gone (already gone counts). */
async function removeOnServer(lineId: number) {
  try {
    await api(`/api/lines/${lineId}`, { method: "DELETE" });
    return true;
  } catch (e) {
    return e instanceof ApiErr && e.f.status === 404;
  }
}

export function TalkScreen() {
  const { me, lang, refreshBadges, setMe } = useMe();
  // the owner may just have saved AI or speech settings (here or on another phone): Talk reads them fresh
  useEffect(() => {
    if (!me.is_admin) return;
    api<{ me: Me }>("/api/me").then((r) => setMe(r.me)).catch(() => {});
  }, [me.is_admin, setMe]);
  const s = strings(lang, talkStrings);
  const as = strings(lang, aiS);
  const tag = langInfo(lang).tag;
  const helperLang = me.helper_lang;
  const helperName = me.helper_name ?? strings(lang, talkStrings).speakerHelper;
  const helperTag = langInfo(helperLang).tag;
  const spoken = LANGUAGES.filter((l) => l.spoken);

  const [speakLang, setSpeakLang] = useState<Lang>(lang === "zh" ? "zh" : "en");
  useEffect(() => {
    const saved = localStorage.getItem(SPEAK_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the remembered choice after hydration
    if (saved === "en" || saved === "zh") setSpeakLang(saved);
  }, []);
  const chooseLang = (l: Lang) => {
    setSpeakLang(l);
    localStorage.setItem(SPEAK_KEY, l);
  };
  const sl = strings(speakLang, talkStrings);
  const slTag = langInfo(speakLang).tag;
  // the employer's "Type instead" and the helper's line under her own-language label follow the English / 中文 switch
  const mineLabel = { text: sl.typeIt, lang: speakLang };
  // her button reads in her own language (5.3: whichever language the helper chose, not always Burmese)
  const hs = strings(helperLang, talkStrings);
  const helperLabel = { text: `${hs.helperKeyboard} ${hs.helperKeyboard2}`, lang: helperLang };
  const helperLine = me.helper_name ? fmt(sl.helperReplies, { name: me.helper_name }) : sl.helperGeneric;

  // ---- the talk on screen
  const [talkId, setTalkId] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState<Set<number>>(new Set());
  const deletedKeys = useRef<Set<string>>(new Set()); // rows binned while still being heard or translated
  const dayKey = useRef<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [retrying, setRetrying] = useState<Set<number>>(new Set());
  const [hint, setHint] = useState<string | null>(null);
  const [micNotice, setMicNotice] = useState<NoticeKind | null>(null);
  const [typing, setTyping] = useState(false); // her reply sheet (Burmese keyboard, or the phone's own)
  // ---- the employer's box: the phone keyboard's mic key (its own dictation) or typing; Send adds the line
  const [boxText, setBoxText] = useState("");
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const dirty = useRef(false);
  const talkIdRef = useRef<number | null>(null);
  useEffect(() => {
    talkIdRef.current = talkId;
  }, [talkId]);

  const load = useCallback(async () => {
    const day = phoneDay();
    dayKey.current = day.key;
    try {
      const r = await api<{ talk: TalkDetail | null }>(`/api/talks/today?start=${day.start}&end=${day.end}`);
      if (dayKey.current !== day.key) return;
      const t = r.talk;
      talkIdRef.current = t?.id ?? null;
      setTalkId(t?.id ?? null);
      setLines(t?.lines ?? []);
    } catch {
      /* the screen still works: the day's first line finds or starts the day's talk */
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the latest talk, and restore lines waiting on this phone, after hydration
    load();
    setPending(loadQueue());
  }, [load]);
  useEffect(() => saveQueue(pending), [pending]);

  // ---- questions from her waiting for an answer
  const qs = useApi<{ questions: Question[] }>("/api/questions");
  const open = (qs.data?.questions ?? []).filter((q) => !q.answer);

  // ---- what the app made of today's talk: auto-added entries first, then drafts waiting for approval.
  // Only today's: on a day with no lines yet nothing from an earlier day shows (History keeps the count).
  const panelId = talkId;
  const detail = useApi<{ talk: TalkDetail }>(panelId ? `/api/talks/${panelId}` : null, { poll: 15000 });

  const askDrafts = useCallback((id: number | null, keepalive = false) => {
    if (!id || !dirty.current) return;
    dirty.current = false;
    fetch(`/api/talks/${id}/draft`, { method: "POST", keepalive, credentials: "same-origin" })
      .then(() => setTimeout(() => refreshBadges(), 15000))
      .catch(() => {
        dirty.current = true;
      });
  }, [refreshBadges]);
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && askDrafts(talkIdRef.current, true);
    const onPageHide = () => askDrafts(talkIdRef.current, true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      askDrafts(talkIdRef.current, true); // leaving Talk for another tab
    };
  }, [askDrafts]);

  // Past midnight on this phone: yesterday's talk is asked for its drafts and the page turns blank, so a new
  // line never appears under yesterday's rows. Runs on every add, on refocus and at midnight itself.
  const turnOver = useCallback(() => {
    if (dayKey.current === null || dayKey.current === phoneDay().key) return false;
    askDrafts(talkIdRef.current);
    talkIdRef.current = null;
    setTalkId(null);
    setLines([]);
    setDeleteFailed(new Set());
    load();
    return true;
  }, [askDrafts, load]);
  useEffect(() => {
    const onBack = () => document.visibilityState === "visible" && turnOver();
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    window.addEventListener("pageshow", onBack);
    const { end } = phoneDay();
    const timer = setTimeout(onBack, Math.max(1000, end - Date.now() + 500));
    return () => {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
      window.removeEventListener("pageshow", onBack);
      clearTimeout(timer);
    };
  }, [turnOver, talkId]);

  const ensureTalk = useCallback(async (): Promise<number> => {
    turnOver();
    if (talkIdRef.current) return talkIdRef.current;
    const day = phoneDay();
    const r = await api<{ talk: TalkDetail }>("/api/talks/today", { body: { lang: speakLang, start: day.start, end: day.end } });
    dayKey.current = day.key;
    talkIdRef.current = r.talk.id;
    setTalkId(r.talk.id);
    // the day's talk may already hold lines from the other phone
    setLines((ls) => (ls.length ? ls : r.talk.lines));
    return r.talk.id;
  }, [speakLang, turnOver]);

  // ---- send a line (saved before translation; offline lines wait on this phone)
  const sendPending = useCallback(
    async (p: Pending) => {
      setPending((rows) => rows.map((r) => (r.key === p.key ? { ...r, state: "sending" } : r)));
      try {
        const id = await ensureTalk();
        const r = await api<{ line: Line; failed: boolean }>(`/api/talks/${id}/lines`, { body: { speaker: p.speaker, text: p.text, lang: p.lang } });
        if (deletedKeys.current.has(p.key)) {
          // binned while it was translating: it stays deleted
          deletedKeys.current.delete(p.key);
          if (!(await removeOnServer(r.line.id))) {
            setLines((ls) => [...ls, r.line]);
            setDeleteFailed((s0) => new Set(s0).add(r.line.id));
          }
          return true;
        }
        dirty.current = true;
        setPending((rows) => rows.filter((x) => x.key !== p.key));
        setLines((ls) => (ls.some((l) => l.id === r.line.id) ? ls : [...ls, r.line]));
        return true;
      } catch (e) {
        if (deletedKeys.current.delete(p.key)) return false; // binned: nothing to bring back
        const offline = e instanceof ApiErr && e.f.kind === "offline";
        setPending((rows) => rows.map((x) => (x.key === p.key ? { ...x, state: offline ? "offline" : "sendFailed" } : x)));
        return false;
      }
    },
    [ensureTalk],
  );

  // retry waiting lines when the connection comes back
  useEffect(() => {
    const onOnline = () => pending.filter((p) => p.state === "offline" && p.text).forEach((p) => sendPending(p));
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [pending, sendPending]);

  const addText = (speaker: "employer" | "helper", text: string, l: Lang) => {
    const p: Pending = { key: newKey(), speaker, lang: l, text: text.trim(), state: "sending" };
    setPending((rows) => [...rows, p]);
    sendPending(p);
  };

  // the box grows with a long dictated sentence (a few lines, then it scrolls)
  const fitBox = () => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 3, 240)}px`;
  };
  // Send: read the box as it stands (dictation may have just written into it), empty it at once so a second
  // quick tap finds nothing, and close the keyboard so the newest line and its translation are in view.
  const sendBox = () => {
    const el = boxRef.current;
    const text = (el?.value ?? boxText).trim();
    if (!text) return;
    if (el) {
      el.value = "";
      el.style.height = "";
      el.blur();
    }
    setBoxText("");
    addText("employer", text, speakLang);
  };
  // every employer "Type instead": the box with the keyboard up (focus must happen inside the tap)
  const toBox = (text?: string) => {
    const el = boxRef.current;
    if (!el) return;
    if (text && !el.value.trim()) {
      el.value = text;
      setBoxText(text);
      fitBox();
    }
    el.focus({ preventScroll: true });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  };

  const replaceLine = (line: Line) => {
    setLines((ls) => ls.map((l) => (l.id === line.id ? line : l)));
  };

  // ---- the bin (5.1): the row goes at once, no question and no Undo; if the server refuses it comes back in place
  const deleteLine = async (line: Line) => {
    setLines((ls) => ls.filter((l) => l.id !== line.id));
    setDeleteFailed((s0) => {
      const n = new Set(s0);
      n.delete(line.id);
      return n;
    });
    if (await removeOnServer(line.id)) return;
    setLines((ls) => [...ls, line].sort((a, b) => a.id - b.id));
    setDeleteFailed((s0) => new Set(s0).add(line.id));
  };
  // a row still being heard, translated or waiting to send: forget it here, and delete it if it reaches the server
  const deletePending = (p: Pending) => {
    if (p.state === "hearing" || p.state === "sending") deletedKeys.current.add(p.key);
    setPending((rows) => rows.filter((x) => x.key !== p.key));
  };

  const retryLine = async (lineId: number) => {
    setRetrying((s0) => new Set(s0).add(lineId));
    try {
      const r = await api<{ line: Line; failed: boolean }>(`/api/lines/${lineId}/retry`, { method: "POST" });
      replaceLine(r.line);
    } catch {
      /* the notice stays with its Try again */
    } finally {
      setRetrying((s0) => {
        const n = new Set(s0);
        n.delete(lineId);
        return n;
      });
    }
  };

  const editLine = async (lineId: number, text: string) => {
    try {
      setRetrying((s0) => new Set(s0).add(lineId));
      const r = await api<{ line: Line; failed: boolean }>(`/api/lines/${lineId}`, { method: "PATCH", body: { text } });
      replaceLine(r.line);
      dirty.current = true;
      return true;
    } catch {
      return false;
    } finally {
      setRetrying((s0) => {
        const n = new Set(s0);
        n.delete(lineId);
        return n;
      });
    }
  };

  // ---- listening: the button records while held; on release the recording is heard on the server (1.9)
  const [canRecordHere, setCanRecordHere] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capabilities are only known after hydration
  useEffect(() => setCanRecordHere(canRecord()), []);
  // 5.3: Hold to talk exists only once the owner's speech-to-text settings are filled in
  const canListen = me.speech && canRecordHere;
  const capture = useRef<HoldCapture | null>(null);
  const pressAt = useRef(0);
  // the button says Listening as soon as recording begins; before that it keeps its plain label
  const [ready, setReady] = useState(false);
  // one silent record per load of Talk, so holds before and after a reload can be told apart
  useEffect(() => {
    sendHoldRecord({ kind: "pageLoad", page: PAGE_ID, at: Date.now(), talkId: null, ua: ua(), lang: localStorage.getItem(SPEAK_KEY) ?? undefined });
  }, []);
  const report = (c: HoldCapture, outcome: HoldOutcome, problem?: string | null) =>
    reportHold(c, { outcome, problem: problem ?? null, pressAt: pressAt.current, lang: speakLang, talkId: talkIdRef.current });
  const ringRef = useRef<HTMLSpanElement | null>(null);
  const [holding, setHolding] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showHint = (h: string) => {
    setHint(h);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 3000);
  };

  // Safari's own microphone question: if it comes back after a reload on a phone that already allowed it,
  // one line says how to make Safari remember. Only on iPhone/iPad Safari, only on the first hold of the page.
  const grantedBefore = useRef<boolean | null>(null);
  const firstHold = useRef(true);
  const [micTip, setMicTip] = useState(false);
  useEffect(() => {
    try {
      grantedBefore.current = localStorage.getItem(MIC_GRANTED_KEY) === "1";
    } catch {
      grantedBefore.current = false;
    }
  }, []);
  const closeMicTip = () => {
    setMicTip(false);
    try {
      localStorage.setItem(MIC_TIP_CLOSED_KEY, "1");
    } catch {
      /* it stays closed for this page */
    }
  };

  const onStart = () => {
    const first = firstHold.current;
    firstHold.current = false;
    const permBefore = first ? micPermission() : null;
    const onOpen = async (waitedMs: number) => {
      try {
        localStorage.setItem(MIC_GRANTED_KEY, "1");
        if (!first || !grantedBefore.current || !isIosSafari() || localStorage.getItem(MIC_TIP_CLOSED_KEY)) return;
      } catch {
        return;
      }
      const state = await permBefore;
      if (state === "prompt" || (state === null && waitedMs > 1200)) setMicTip(true);
    };
    setMicNotice(null);
    setHint(null);
    setHolding(true);
    setReady(false);
    pressAt.current = Date.now();
    const c: HoldCapture = new HoldCapture(
      speakLang,
      () => talkIdRef.current,
      (problem) => setMicNotice(problem),
      onOpen,
      () => capture.current === c && setReady(true),
    );
    capture.current = c;
    try {
      c.start();
    } catch {
      capture.current = null;
      setHolding(false);
      setMicNotice("listenFailed");
      report(c, "noRecogniser");
    }
  };

  const onEnd = async (ms: number) => {
    const c = capture.current;
    capture.current = null;
    setHolding(false);
    if (!c) return;
    if (ms < 400) {
      c.cancel();
      showHint(sl.tooShort);
      report(c, "tooShort");
      return;
    }
    // the row appears at once (dots) while the recording is heard on the server
    const key = newKey();
    const row: Pending = { key, speaker: "employer", lang: speakLang, text: "", state: "hearing" };
    setPending((rows) => [...rows, row]);
    const r = await c.stop();
    const text = r.text;
    if (deletedKeys.current.delete(key)) {
      report(c, "cancelled");
      return;
    }
    if (!text) {
      setPending((rows) => rows.filter((x) => x.key !== key));
      if (r.problem) setMicNotice(r.problem);
      else showHint(sl.heardNothing);
      report(c, r.problem ? "problem" : "heardNothing", r.problem);
      return;
    }
    report(c, "sent");
    const ready = { ...row, text, state: "sending" as const };
    setPending((rows) => rows.map((x) => (x.key === key ? ready : x)));
    sendPending(ready);
  };

  const onCancel = () => {
    const c = capture.current;
    if (c) report(c, "cancelled");
    capture.current?.cancel();
    capture.current = null;
    setHolding(false);
  };

  // stop the microphone if the screen goes away mid-hold
  useEffect(() => () => capture.current?.cancel(), []);

  const addPhoto = async (photo: string) => {
    try {
      const id = await ensureTalk();
      const r = await api<{ line: Line }>(`/api/talks/${id}/photos`, { body: { photo, speaker: "employer" } });
      dirty.current = true;
      setLines((ls) => [...ls, r.line]);
    } catch {
      setMicNotice("offline");
    }
  };

  // newest first, right under the button: what was just said is what she reads
  const shownLines = useMemo(() => [...lines].reverse(), [lines]);
  const shownPending = useMemo(() => [...pending].reverse(), [pending]);

  // Keep the newest exchange readable: when a line is sent, translated or needs attention, scroll just enough that
  // it sits above the tab bar (its top stays below the header), so the person listening can read the translation.
  const olRef = useRef<HTMLOListElement | null>(null);
  const newestKey = shownPending[0] ? `${shownPending[0].key}:${shownPending[0].state}` : shownLines[0] ? `l${shownLines[0].id}` : null;
  const seenKey = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!loaded) return;
    const first = seenKey.current === undefined;
    if (newestKey === seenKey.current) return;
    seenKey.current = newestKey;
    if (first || !newestKey || capture.current) return;
    // measure after the row transitions (0.22s) so a leaving "translating" row is gone and the new line has its height
    const timer = setTimeout(() => {
      const li = olRef.current?.firstElementChild;
      if (!li) return;
      const nav = document.querySelector<HTMLElement>("[data-tabbar]");
      const navTop = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : window.innerHeight;
      const header = document.querySelector<HTMLElement>("[data-topbar]");
      const headerBottom = header && getComputedStyle(header).display !== "none" ? header.getBoundingClientRect().bottom : 0;
      const r = li.getBoundingClientRect();
      const overflow = r.bottom - (navTop - 12);
      if (overflow <= 0) return;
      const by = Math.min(overflow, r.top - headerBottom - 8);
      if (by <= 0) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollBy({ top: by, behavior: reduce ? "auto" : "smooth" });
    }, 300);
    return () => clearTimeout(timer);
  }, [newestKey, loaded]);
  const panel = panelId && detail.data?.talk.id === panelId ? detail.data.talk : undefined;
  const autoCount = (t?: TalkDetail) => t?.drafts.filter((d) => d.auto && d.entry_id).length ?? 0;
  const waiting = panel?.waiting ?? 0;
  const drafting = panel?.drafting ?? false;
  const fromTalk = panel && (autoCount(panel) > 0 || waiting > 0) && (
    <>
      <AutoAddedList drafts={panel.drafts} />
      {waiting > 0 && (
        <div className={autoCount(panel) > 0 ? "mt-3 border-t border-rule pt-3" : ""}>
          <p lang={tag} className="text-[18px] font-medium text-ochre-ink">{fmt(s.draftsWaiting, { n: waiting })}</p>
          <Link href={`/talks/${panel.id}`} className="btn btn-primary btn-small mt-3 w-full">
            <span lang={tag}>{s.review}</span>
          </Link>
        </div>
      )}
    </>
  );
  const hasRows = pending.length > 0 || lines.length > 0;
  // 5.3: the owner alone sees what is missing (text AI, speech to text or both) with a link to Settings
  const setupKey = !me.is_admin ? null : !me.ai && !me.speech ? "setupBoth" : !me.ai ? "setupText" : !me.speech ? "setupSpeech" : null;
  const setupLine = setupKey && (
    <p className="mt-2 flex items-start gap-2 text-[15px] leading-snug text-ink" role="note" data-ai-setup>
      <span aria-hidden className="mt-[3px] h-3.5 w-1.5 shrink-0 bg-ochre" />
      <span className="min-w-0 flex-1">
        <span lang={tag}>{as[setupKey]}</span>{" "}
        <Link href="/settings#ai" lang={tag} className="inline-flex min-h-[44px] items-center font-semibold text-primary underline underline-offset-4 -my-3">{as.setupLink}</Link>
      </span>
    </p>
  );
  // a binned row leaves as design/motion.md says (exit: 0.7 × 220ms, ease-in, 8px); instantly under reduced motion
  const reduce = useReducedMotion();
  const leave = reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 8, transition: { duration: 0.154, ease: "easeIn" as const } };
  const today = new Intl.DateTimeFormat(langInfo(lang).speech, { weekday: "short", day: "numeric", month: "short" }).format(new Date());

  return (
    <div className="lg:flex lg:gap-8">
      <section className="ruled relative min-w-0 flex-1 rounded-[6px] border border-rule pb-6 lg:max-w-[720px]">
        {/* open questions from her */}
        {open.length > 0 && (
          <Link href="/questions" className="flex min-h-[52px] items-start gap-2 rounded-t-[6px] border-b border-rule bg-ochre-wash px-4 py-2 text-ink">
            <HelpCircle size={22} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0 text-ochre-ink" />
            <span className="min-w-0">
              <span lang={tag} className="block font-medium">{fmt(s.questionsOpen, { n: open.length, name: open[0].asker_name })}</span>
              <Tr text={open[0].text} lang={open[0].lang} tr={open[0].tr} className="block text-[16px] text-muted" noToggle />
            </span>
          </Link>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3 pl-[60px] pr-4 pt-5">
          <div>
            <h1 lang={tag} className={`font-semibold ${lang === "my" ? "text-[30px]" : "text-[34px] leading-none"}`}>{s.title}</h1>
            <p className="mt-1.5 text-[15px] italic text-muted" lang={tag} suppressHydrationWarning>
              {today}
              {me.helper_name ? ` · ${fmt(s.with, { name: me.helper_name })}` : ""}
            </p>
          </div>
          <div role="radiogroup" aria-label={s.iSpeak} className="flex rounded-full border-[1.5px] border-ink bg-paper p-0.5 text-[16px]">
            {spoken.map((l) => (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={speakLang === l.code}
                onClick={() => chooseLang(l.code)}
                lang={l.tag}
                className={`relative min-h-[44px] whitespace-nowrap rounded-full px-4 ${speakLang === l.code ? "font-semibold text-on-primary" : "text-ink"}`}
              >
                {speakLang === l.code && <m.span layoutId="speak-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
                <span className="relative">{l.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* the controls: the box (keyboard mic or typing) with Send, then Hold to talk (when speech is set up), then her reply button */}
        <div className="mt-4 border-y border-rule bg-paper px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendBox();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={boxRef}
              data-talk-box
              lang={slTag}
              rows={1}
              value={boxText}
              onChange={(e) => {
                setBoxText(e.target.value);
                fitBox();
              }}
              onKeyDown={(e) => {
                // the keyboard's return key sends; Shift+Return keeps a new line; never mid-composition (中文 input)
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendBox();
                }
              }}
              enterKeyHint="send"
              autoCapitalize="sentences"
              placeholder={sl.boxLabel}
              aria-label={sl.boxLabel}
              className="field min-w-0 flex-1 resize-none !text-[20px] leading-snug"
            />
            <button
              type="submit"
              aria-disabled={!boxText.trim()}
              className={`btn btn-primary min-h-[56px] shrink-0 !px-4 !text-[18px] ${boxText.trim() ? "" : "opacity-60"}`}
            >
              <SendHorizontal size={22} strokeWidth={2} aria-hidden /> <span lang={slTag}>{sl.send}</span>
            </button>
          </form>
          <p className="mt-1.5 flex items-center gap-2 text-[15px] italic text-muted">
            <Mic size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span lang={slTag}>{sl.micKeyHint}</span>
          </p>

          {canListen && (
            <div className="mt-3">
              <HoldButton
                labels={{ hold: sl.hold, listening: sl.listening, cancel: sl.cancelHint }}
                ready={ready}
                labelLang={slTag}
                onStart={onStart}
                onEnd={onEnd}
                onCancel={onCancel}
                ringRef={ringRef}
              />
            </div>
          )}

          {me.speech && <div className="mt-2 flex min-h-[44px] items-center">
            <AnimatePresence mode="wait" initial={false}>
              {hint ? (
                <m.p key="hint" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} lang={slTag} className="font-medium text-ribbon-ink">
                  {hint}
                </m.p>
              ) : holding ? (
                <m.p key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} lang={slTag} className="min-w-0 flex-1 text-[20px] leading-snug text-ink">
                  <span className="ink-dots text-muted" aria-hidden><span /><span /><span /></span>
                </m.p>
              ) : !canListen ? (
                <m.p key="nolisten" className="text-[15px] text-muted">
                  <span lang={slTag}>{sl.noListen}</span>
                  {helperLang !== speakLang && <span lang={helperTag} className="block" style={{ lineHeight: 1.8 }}>{strings(helperLang, talkStrings).noListen}</span>}
                </m.p>
              ) : (
                <m.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} lang={slTag} className="text-[15px] italic text-muted">
                  {sl.holdHint}
                </m.p>
              )}
            </AnimatePresence>
          </div>}

          {setupLine}

          {micTip && canListen && (
            <p className="-mt-1 mb-1 flex items-start gap-2 text-[15px] leading-snug text-ink" role="note">
              <span aria-hidden className="mt-[3px] h-3.5 w-1.5 shrink-0 bg-ribbon" />
              <span lang={tag} className="min-w-0 flex-1">{s.micTip}</span>
              <button type="button" onClick={closeMicTip} aria-label={strings(lang, common).close} className="-my-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center text-muted hover:text-ink">
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </p>
          )}

          <button
            type="button"
            onClick={() => setTyping(true)}
            aria-label={`${helperLabel.text} · ${helperLine}`}
            className="mt-2 flex min-h-[76px] w-full flex-col items-center justify-center gap-1 rounded-[6px] border-[1.5px] border-ink bg-paper px-2 py-2.5 text-center text-ink transition-transform duration-[80ms] active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <Keyboard size={24} strokeWidth={1.75} aria-hidden />
            <span lang={helperTag} className="text-[18px] font-medium" style={{ lineHeight: 1.95 }}>{helperLabel.text}</span>
            <span lang={slTag} className="text-[15px] italic leading-snug text-ochre-ink">{helperLine}</span>
          </button>
          {micNotice && <Notice kind={micNotice} lang={lang} helperLang={helperLang} typeLabel={mineLabel} onType={() => { setMicNotice(null); toBox(); }} onRetry={micNotice === "offline" ? () => setMicNotice(null) : undefined} />}
        </div>

        {/* 5.2: History, one tap away with the drafts waiting (was a small button beside the title) */}
        <div className="px-4 pt-3">
          <PastTalksRow />
        </div>

        {/* today's talk, newest first; on a day with nothing said yet, only the empty page below */}
        {hasRows && (
          <div className="flex flex-wrap items-center justify-between gap-2 pl-[60px] pr-4 pt-4">
            <h2 lang={tag} className="eyebrow">{s.thisTalk}</h2>
            <PhotoButton onAdded={addPhoto} />
          </div>
        )}

        <ol ref={olRef} className={hasRows ? "mt-3 border-t border-rule" : ""} aria-live="polite">
          <AnimatePresence initial={false}>
            {shownPending.map((p) => (
              <m.li key={p.key} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={leave} transition={{ duration: 0.22 }} className="relative list-none border-b border-rule pb-4 pl-[60px] pr-4 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <p className={`eyebrow min-w-0 ${p.speaker === "helper" ? "!text-ochre-ink" : ""}`} lang={tag}>
                    {p.speaker === "employer" ? s.speakerYou : helperName} · <span lang={langInfo(p.lang).tag}>{langInfo(p.lang).name}</span>
                  </p>
                  <LineBin lang={lang} onDelete={() => deletePending(p)} />
                </div>
                {p.text ? (
                  <p lang={langInfo(p.lang).tag} className={p.speaker === "employer" ? "text-[20px] leading-snug" : "text-[22px] font-medium"}>{p.text}</p>
                ) : null}
                {(p.state === "hearing" || p.state === "sending") && (
                  <p className="mt-1 text-muted">
                    <span className="ink-dots" aria-hidden><span /><span /><span /></span>
                    <span className="sr-only" lang={tag}>{p.state === "hearing" ? s.hearing : s.translating}</span>
                  </p>
                )}
                {p.state === "offline" && <Notice kind="offline" lang={lang} helperLang={helperLang} onRetry={() => sendPending(p)} />}
                {p.state === "sendFailed" && <Notice kind="translateFailed" lang={lang} helperLang={helperLang} onRetry={() => sendPending(p)} onType={() => {
                  if (p.speaker === "helper") return setTyping(true);
                  // the line never reached the server: its words go into the box to edit (when the box is empty)
                  if (!boxRef.current?.value.trim()) setPending((rows) => rows.filter((x) => x.key !== p.key));
                  toBox(p.text);
                }} typeLabel={p.speaker === "employer" ? mineLabel : helperLabel} />}
              </m.li>
            ))}
            {shownLines.map((l) => (
              <m.li key={l.id} layout="position" exit={leave} transition={{ duration: 0.22 }} className="list-none border-b border-rule pl-[60px] pr-4 pt-3">
                <TalkLine
                  line={l}
                  me={lang}
                  readLang={l.speaker === "helper" ? speakLang : helperLang}
                  helperLang={helperLang}
                  helperName={helperName}
                  onEdit={(text) => editLine(l.id, text)}
                  onRetry={() => retryLine(l.id)}
                  retrying={retrying.has(l.id)}
                  onType={() => (l.speaker === "helper" ? setTyping(true) : toBox())}
                  typeLabel={l.speaker === "employer" ? mineLabel : helperLabel}
                  onDelete={() => deleteLine(l)}
                  deleteFailed={deleteFailed.has(l.id)}
                />
              </m.li>
            ))}
          </AnimatePresence>
        </ol>
        {hasRows ? <div aria-hidden className="ruled-tail" /> : null}

        {loaded && !hasRows && <Empty img="conversations" title={s.emptyToday} />}

        {/* phone: the same list, under the conversation, only when the talk saved or drafted something */}
        {fromTalk && (
          <div className="mx-4 mt-2 border-t border-rule pt-4 lg:hidden">
            <h2 lang={tag} className="eyebrow mb-3">{s.fromTalk}</h2>
            {fromTalk}
          </div>
        )}
      </section>

      {/* desktop: drafts from this talk */}
      <aside className="mt-6 hidden w-[340px] shrink-0 lg:block">
        <h2 lang={tag} className="text-[22px] font-medium">{s.fromTalk}</h2>
        <p lang={tag} className="text-[15px] italic text-muted">{s.fromTalkLine}</p>
        <div className="page mt-4 p-4">
          {fromTalk || <p lang={tag} className="text-muted">{drafting ? s.drafting : s.noDrafts}</p>}
          {fromTalk && drafting && <p lang={tag} className="mt-3 text-muted">{s.drafting}</p>}
        </div>
      </aside>

      <Sheet open={typing} onClose={() => setTyping(false)} title={strings(helperLang, talkStrings).typeTitle}>
        {helperLang === "my" ? (
          <BurmeseKeyboard
            onSend={async (text) => {
              addText("helper", text, helperLang);
              setTyping(false);
              return true;
            }}
          />
        ) : (
          <PlainReply
            lang={helperLang}
            onSend={(text) => {
              addText("helper", text, helperLang);
              setTyping(false);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

/** Her reply on the phone's own keyboard, for every helper language but Burmese (which has the app's keyboard). */
function PlainReply({ lang, onSend }: { lang: Lang; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const tag = langInfo(lang).tag;
  const t = strings(lang, talkStrings);
  const a = strings(lang, aiS);
  const send = () => {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText("");
  };
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea
        lang={tag}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
        autoCapitalize="sentences"
        enterKeyHint="send"
        placeholder={a.replyBox}
        aria-label={a.replyBox}
        className="field !text-[22px] leading-snug"
      />
      <div className="flex justify-end">
        <button type="submit" disabled={!text.trim()} className="btn btn-primary min-w-[140px] disabled:opacity-50">
          <SendHorizontal size={22} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.send}</span>
        </button>
      </div>
    </form>
  );
}
