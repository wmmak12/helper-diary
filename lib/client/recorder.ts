"use client";
import { api, ApiErr } from "./api";
import type { Lang } from "../languages";
import type { HoldEvent } from "../types";

// Hold-to-talk (1.9): the microphone opens on press and records; on release every track is stopped (nothing is
// heard outside a hold) and the recording goes once to /api/listen, which turns it into text with the talk's last
// lines as context. The phone's own speech recognition is not used: on iPhone it went deaf after the first hold.

export type ListenProblem = "micBlocked" | "listenFailed" | "offline";

// Safari records audio/mp4, Chrome and Firefox audio/webm; either is turned into WAV before upload (toWav)
const MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
// speech to text takes 16-bit PCM WAV of at most 120 s
const WAV_RATE = 16000;
const MAX_SECONDS = 118;

/** The recording as 16 kHz mono 16-bit WAV (decoding resamples to the context's rate), cut at MAX_SECONDS. */
export async function toWav(blob: Blob): Promise<Blob> {
  const decoded = await new OfflineAudioContext(1, 1, WAV_RATE).decodeAudioData(await blob.arrayBuffer());
  const pcm = decoded.getChannelData(0).subarray(0, MAX_SECONDS * WAV_RATE);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const ascii = (at: number, t: string) => [...t].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  out.setUint32(4, 36 + pcm.length * 2, true);
  ascii(8, "WAVEfmt ");
  out.setUint32(16, 16, true); // fmt chunk size
  out.setUint16(20, 1, true); // PCM
  out.setUint16(22, 1, true); // mono
  out.setUint32(24, WAV_RATE, true);
  out.setUint32(28, WAV_RATE * 2, true); // bytes per second
  out.setUint16(32, 2, true); // bytes per frame
  out.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  out.setUint32(40, pcm.length * 2, true);
  pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Blob([out.buffer], { type: "audio/wav" });
}

/** True when this browser can record a hold. Only meaningful after hydration. */
export function canRecord(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

/** iPhone or iPad Safari (not another browser's iOS shell). */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

/** Microphone permission as the browser reports it, or null where it cannot say. */
export async function micPermission(): Promise<PermissionState | null> {
  try {
    const p = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    return p?.state ?? null;
  } catch {
    return null;
  }
}

export class HoldCapture {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private opening: Promise<void> | null = null;
  private ended = false;
  private problem: ListenProblem | null = null;
  private startAt = 0;
  private finished: () => void = () => {};
  private readonly done = new Promise<void>((r) => (this.finished = r));
  private text = "";
  /** ms from start() until the microphone opened (long when a permission prompt was in the way) */
  waitedMs: number | null = null;
  /** ms from the press until recording began, or null */
  listeningAfter: number | null = null;
  /** what happened, in order, with ms since the press */
  readonly events: HoldEvent[] = [];

  constructor(
    private lang: Lang,
    private talkId: () => number | null,
    private onProblem: (p: ListenProblem) => void,
    private onOpen?: (waitedMs: number) => void,
    /** called once, when recording begins, so the button says Listening */
    private onListening?: () => void,
  ) {}

  private log(type: string, extra?: Omit<HoldEvent, "t" | "rec" | "type">) {
    if (this.events.length < 50) this.events.push({ t: Math.round(performance.now() - this.startAt), rec: 1, type, ...extra });
  }

  /** "heard" (words came back), "deaf" (recorded, no words) or "none" (nothing was recorded) */
  get went(): "heard" | "deaf" | "none" {
    return this.text ? "heard" : this.listeningAfter != null ? "deaf" : "none";
  }

  /** Resolves once the hold is over (text back, failed or cancelled), for the hold record. */
  whenQuiet(): Promise<void> {
    return this.done;
  }

  /** Call inside the press handler. Throws when the browser cannot record. */
  start() {
    if (!canRecord()) throw new Error("no recorder");
    this.startAt = performance.now();
    this.log("call:getUserMedia");
    this.opening = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(
      (stream) => {
        this.stream = stream;
        this.waitedMs = performance.now() - this.startAt;
        this.log("micOpen");
        if (this.ended) return this.release(); // let go before the mic opened
        this.onOpen?.(this.waitedMs);
        const mime = MIMES.find((m) => MediaRecorder.isTypeSupported?.(m));
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
        rec.start();
        this.rec = rec;
        this.listeningAfter = Math.round(performance.now() - this.startAt);
        this.log("listening", { message: rec.mimeType });
        this.onListening?.();
      },
      (e: Error) => {
        this.log("error", { error: e.name, message: String(e.message).slice(0, 300) });
        this.problem = e.name === "NotAllowedError" || e.name === "SecurityError" ? "micBlocked" : "listenFailed";
        if (!this.ended) this.onProblem(this.problem);
      },
    );
  }

  /** Stop recording and free the microphone; resolves with the recording (empty when nothing was recorded). */
  private async finishRecording(): Promise<Blob> {
    await this.opening;
    const rec = this.rec;
    this.rec = null;
    if (rec && rec.state !== "inactive") {
      const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
      rec.stop();
      await Promise.race([stopped, new Promise((r) => setTimeout(r, 1000))]);
    }
    this.release();
    return new Blob(this.chunks, { type: rec?.mimeType || "audio/webm" });
  }

  private release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  /** Release: stop recording, send it to be heard, and return the line ("" when nothing was said). */
  async stop(): Promise<{ text: string; problem: ListenProblem | null }> {
    this.ended = true;
    const blob = await this.finishRecording();
    this.log("recorded", { n: blob.size });
    if (this.problem || blob.size === 0) {
      this.finished();
      return { text: "", problem: this.problem };
    }
    try {
      const wav = await toWav(blob);
      this.log("wav", { n: wav.size });
      const form = new FormData();
      form.append("audio", new File([wav], "hold.wav", { type: "audio/wav" }));
      form.append("lang", this.lang);
      const talkId = this.talkId();
      if (talkId) form.append("talkId", String(talkId));
      this.text = (await api<{ text: string }>("/api/listen", { form })).text.trim();
      this.log("heard", { text: this.text.slice(0, 500) });
    } catch (e) {
      this.problem = e instanceof ApiErr && e.f.kind === "offline" ? "offline" : "listenFailed";
      this.log("error", { error: e instanceof ApiErr ? e.f.code : String(e).slice(0, 80) });
    }
    this.finished();
    return { text: this.text, problem: this.problem };
  }

  /** Slide-off, too short, or leaving the screen: stop and throw the recording away. */
  cancel() {
    this.ended = true;
    this.finishRecording().finally(() => this.finished());
  }
}
