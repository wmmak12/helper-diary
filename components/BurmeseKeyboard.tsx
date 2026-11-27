"use client";
import { useRef, useState } from "react";
import { Delete, Keyboard, Send } from "lucide-react";
import { strings } from "@/lib/client/i18n";
import { kb } from "@/lib/strings/talk";

// The app's own Burmese keyboard, so the helper can type her reply on the employer's phone without
// switching the phone's keyboard. Letters go in Unicode logical order; ေ and ြ typed before their
// consonant (the order they are written) are moved after it.

const SIGNS_1 = ["ေ", "ျ", "ြ", "ွ", "ှ", "ိ", "ီ", "ု", "ူ"];
const SIGNS_2 = ["ာ", "ါ", "ဲ", "ံ", "့", "း", "်", "္", "။"];
const CONS_1 = ["က", "ခ", "ဂ", "င", "စ", "ဆ", "ဇ", "ည", "တ"];
const CONS_2 = ["ထ", "ဒ", "န", "ပ", "ဖ", "ဗ", "ဘ", "မ", "ယ"];
const CONS_3 = ["ရ", "လ", "ဝ", "သ", "ဟ", "အ", "ဥ", "ဦ", "၊"];
const MORE_1 = ["ဃ", "ဈ", "ဋ", "ဌ", "ဍ", "ဎ", "ဏ", "ဓ", "ဠ"];
const MORE_2 = ["ဣ", "ဤ", "ဧ", "ဩ", "ဪ", "၌", "၍", "၎", "၏"];
const DIGITS = ["၁", "၂", "၃", "၄", "၅", "၆", "၇", "၈", "၉", "၀"];

const CONSONANT = /[က-ဪဿ၎]/;
const MEDIAL_ORDER = ["ျ", "ြ", "ွ", "ှ"]; // ျ ြ ွ ှ
const PREFIX = new Set(["ေ", "ြ"]); // ေ ြ, written before the consonant

function logicalOrder(marks: string): string {
  const chars = [...marks];
  return chars.sort((a, b) => rank(a) - rank(b)).join("");
}
function rank(c: string) {
  const m = MEDIAL_ORDER.indexOf(c);
  if (m >= 0) return m;
  if (c === "ေ") return 10;
  return 20;
}

/** Insert one key into `text` with `pending` = prefix marks typed before their consonant. */
export function typeKey(text: string, pending: string, key: string): { text: string; pending: string } {
  if (CONSONANT.test(key)) {
    if (pending) {
      const base = text.slice(0, text.length - pending.length);
      return { text: base + key + logicalOrder(pending), pending: "" };
    }
    return { text: text + key, pending: "" };
  }
  const last = text.slice(-1);
  if (PREFIX.has(key)) {
    // no consonant to attach to yet (start, space, punctuation, or after a finished syllable mark): hold it
    const attachable = last && (CONSONANT.test(last) || MEDIAL_ORDER.includes(last));
    if (!attachable || pending) {
      return { text: text + key, pending: pending + key };
    }
    if (key === "ေ") return { text: text + key, pending: "" };
  }
  // a medial typed after ေ belongs before it: ကေ + ျ → ကျေ
  if (MEDIAL_ORDER.includes(key) && last === "ေ" && !pending) {
    return { text: text.slice(0, -1) + key + "ေ", pending: "" };
  }
  if (pending) {
    // a non-consonant ends the prefix wait
    return { text: text + key, pending: "" };
  }
  return { text: text + key, pending: "" };
}

export function BurmeseKeyboard({ onSend, busy }: { onSend: (text: string) => Promise<boolean>; busy?: boolean }) {
  const t = strings("my", kb);
  const [text, setText] = useState("");
  const [pending, setPending] = useState("");
  const [layer, setLayer] = useState<"main" | "more">("main");
  const [phone, setPhone] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const press = (k: string) => {
    const r = typeKey(text, pending, k);
    setText(r.text);
    setPending(r.pending);
    navigator.vibrate?.(5);
  };
  const back = () => {
    const chars = [...text];
    chars.pop();
    setText(chars.join(""));
    setPending((p) => p.slice(0, -1));
  };
  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    if (await onSend(v)) {
      setText("");
      setPending("");
    }
  };

  const renderKey = (k: string, wide?: boolean) => (
    <button
      key={k}
      type="button"
      lang="my"
      onClick={() => press(k)}
      aria-label={k}
      className={`flex min-h-[48px] min-w-0 items-center justify-center rounded-[6px] border border-rule bg-paper text-[22px] text-ink active:scale-[0.96] active:bg-desk ${wide ? "col-span-2" : ""}`}
      style={{ lineHeight: 1.8 }}
    >
      {/* dotted circle shows where a sign attaches */}
      {/[ါ-ှ]/.test(k) ? "◌" + k : k}
    </button>
  );
  const renderRow = (keys: string[]) => (
    <div key={keys[0]} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${keys.length}, minmax(0, 1fr))` }}>
      {keys.map((k) => renderKey(k))}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {phone ? (
        <textarea
          ref={areaRef}
          lang="my"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          autoFocus
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          className="field !text-[24px]"
          style={{ lineHeight: 1.95 }}
        />
      ) : (
        <div
          lang="my"
          aria-live="polite"
          aria-label={t.placeholder}
          className="min-h-[96px] rounded-[6px] border-[1.5px] border-field bg-paper px-3 py-2 text-[24px] text-ink"
          style={{ lineHeight: 1.95, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        >
          {text || <span className="text-muted">{t.placeholder}</span>}
          <span aria-hidden className="ml-0.5 inline-block h-[1.2em] w-[2px] translate-y-[0.25em] animate-pulse bg-ink" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setPhone((v) => !v)} className="btn btn-small text-muted underline underline-offset-4" lang="my">
          <Keyboard size={20} strokeWidth={1.75} aria-hidden /> {phone ? t.appKeyboard : t.phoneKeyboard}
        </button>
        <button type="button" onClick={send} disabled={!text.trim() || busy} className="btn btn-primary min-w-[140px] disabled:opacity-50" lang="my">
          {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <><Send size={22} strokeWidth={2} aria-hidden /> {t.send}</>}
        </button>
      </div>
      {!phone && (
        <div className="flex select-none flex-col gap-1 rounded-[6px] bg-desk p-1.5" role="group" aria-label={t.placeholder}>
          {layer === "main" ? (
            <>
              {renderRow(SIGNS_1)}
              {renderRow(SIGNS_2)}
              {renderRow(CONS_1)}
              {renderRow(CONS_2)}
              {renderRow(CONS_3)}
            </>
          ) : (
            <>
              {renderRow(MORE_1)}
              {renderRow(MORE_2)}
              {renderRow(DIGITS)}
            </>
          )}
          <div className="grid grid-cols-[1.4fr_3fr_1.4fr] gap-1">
            <button type="button" lang="my" onClick={() => setLayer((l) => (l === "main" ? "more" : "main"))} className="min-h-[48px] rounded-[6px] border-[1.5px] border-field bg-paper px-1 text-[15px]" style={{ lineHeight: 1.8 }}>
              {layer === "main" ? "ဃ ၁၂၃" : "က ါ"}
            </button>
            <button type="button" lang="my" onClick={() => press(" ")} className="min-h-[48px] rounded-[6px] border border-rule bg-paper text-[15px]" style={{ lineHeight: 1.8 }}>
              {t.space}
            </button>
            <button type="button" onClick={back} aria-label={t.backspace} className="flex min-h-[48px] items-center justify-center rounded-[6px] border-[1.5px] border-field bg-paper">
              <Delete size={24} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
