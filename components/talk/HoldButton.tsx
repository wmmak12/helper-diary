"use client";
import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

// The one large Hold to talk button. It answers in the same frame as the touch; the microphone is
// owned by the caller (onStart/onEnd/onCancel), and the level ring is driven through a CSS variable
// on `ringRef`, never React state.

export type HoldLabels = { hold: string; listening: string; cancel: string };

export function HoldButton({
  labels, labelLang, onStart, onEnd, onCancel, ringRef, disabled, ready = true,
}: {
  labels: HoldLabels;
  labelLang: string;
  onStart: () => void;
  onEnd: (heldMs: number) => void;
  onCancel: () => void;
  ringRef: React.RefObject<HTMLSpanElement | null>;
  disabled?: boolean;
  /** false until the phone's mic opens: the held button keeps its plain label until then */
  ready?: boolean;
}) {
  const [held, setHeld] = useState(false);
  const [away, setAway] = useState(false);
  const [secs, setSecs] = useState(0);
  const startAt = useRef(0);
  const btn = useRef<HTMLButtonElement>(null);
  const activePointer = useRef<number | null>(null);
  const awayRef = useRef(false);
  const listening = held && ready;

  useEffect(() => {
    if (!listening) return;
    const from = performance.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the timer counts from when the phone really listens
    setSecs(0);
    const t = setInterval(() => setSecs(Math.floor((performance.now() - from) / 1000)), 250);
    return () => clearInterval(t);
  }, [listening]);

  const begin = () => {
    if (held || disabled) return;
    startAt.current = performance.now();
    setSecs(0);
    setHeld(true);
    setAway(false);
    awayRef.current = false;
    navigator.vibrate?.(10);
    onStart();
  };
  const finish = (cancelled: boolean) => {
    if (!held && activePointer.current === null) return;
    activePointer.current = null;
    setHeld(false);
    setAway(false);
    const ms = performance.now() - startAt.current;
    if (cancelled || awayRef.current) onCancel();
    else onEnd(ms);
    awayRef.current = false;
  };

  const distanceAway = (e: React.PointerEvent) => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return 0;
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
    const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
    return Math.hypot(dx, dy);
  };

  const label = !held ? labels.hold : away ? labels.cancel : ready ? labels.listening : labels.hold;

  return (
    <button
      ref={btn}
      type="button"
      disabled={disabled}
      aria-pressed={held}
      className={`relative flex min-h-[92px] w-full touch-none select-none items-center justify-center gap-3 rounded-[6px] px-4 py-3 text-on-primary transition-[transform,background-color] duration-[80ms] [-webkit-touch-callout:none] disabled:opacity-60 ${
        held ? (away || !listening ? "translate-y-[2px] scale-[0.985] bg-primary-press" : "translate-y-[2px] scale-[0.985] bg-ribbon-ink") : "bg-primary"
      }`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0 || activePointer.current !== null) return;
        e.preventDefault();
        activePointer.current = e.pointerId;
        btn.current?.setPointerCapture(e.pointerId);
        begin();
      }}
      onPointerMove={(e) => {
        if (activePointer.current !== e.pointerId) return;
        const far = distanceAway(e) > 64;
        if (far !== awayRef.current) {
          awayRef.current = far;
          setAway(far);
        }
      }}
      onPointerUp={(e) => {
        if (activePointer.current !== e.pointerId) return;
        finish(false);
      }}
      onPointerCancel={(e) => {
        if (activePointer.current !== e.pointerId) return;
        finish(true);
      }}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          if (!held) {
            activePointer.current = -1;
            begin();
          }
        }
      }}
      onKeyUp={(e) => {
        if ((e.key === " " || e.key === "Enter") && activePointer.current === -1) {
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => activePointer.current === -1 && finish(true)}
    >
      {/* level ring: scales with the microphone level; breathes when no level data; a still outline under reduced motion */}
      <span
        ref={ringRef}
        aria-hidden
        className={`pointer-events-none absolute -inset-[6px] rounded-[9px] border-[3px] border-ribbon transition-opacity duration-150 ${
          listening && !away
            ? "opacity-35 [transform:scale(calc(1+var(--level,0)*0.08))] [&:not([data-level])]:animate-[ring-breathe_1.2s_ease-in-out_infinite] motion-reduce:!animate-none motion-reduce:!opacity-100 motion-reduce:border-2 motion-reduce:[transform:none]"
            : "opacity-0"
        }`}
      />
      {listening ? (
        <span aria-hidden className="h-4 w-4 shrink-0 rounded-full bg-on-primary" />
      ) : held ? (
        <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border-2 border-on-primary" />
      ) : (
        <Mic size={32} strokeWidth={2} aria-hidden className="shrink-0" />
      )}
      <span lang={labelLang} className={`text-left font-semibold ${held ? "text-[20px]" : labelLang === "my" ? "text-[22px]" : "text-[24px]"}`} style={{ lineHeight: labelLang === "my" ? 1.8 : 1.2 }}>
        {label}
      </span>
      {listening && <span className="tabular ml-auto shrink-0 text-[18px]" aria-hidden>{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}</span>}
      <span className="sr-only" aria-live="assertive">{held ? label : ""}</span>
    </button>
  );
}
