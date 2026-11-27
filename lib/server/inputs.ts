import { str } from "./api";
import { photoExists } from "./photos";
import { isLang } from "../languages";
import { SECTIONS, type Section } from "../types";

export function entryInput(b: Record<string, unknown>) {
  const steps = Array.isArray(b.steps)
    ? (b.steps as Record<string, unknown>[]).map((s) => ({ text: str(s?.text, 2000), photo: photoExists(s?.photo) ? (s.photo as string) : null })).filter((s) => s.text)
    : undefined;
  return {
    section: SECTIONS.includes(b.section as Section) ? (b.section as Section) : undefined,
    title: typeof b.title === "string" ? str(b.title, 200) : undefined,
    body: typeof b.body === "string" ? str(b.body, 8000) : undefined,
    lang: isLang(b.lang) ? b.lang : undefined,
    photos: Array.isArray(b.photos) ? (b.photos as unknown[]).filter(photoExists).slice(0, 12) : undefined,
    steps,
    phone: b.phone === null ? null : typeof b.phone === "string" ? str(b.phone, 40) : undefined,
    emergency: typeof b.emergency === "boolean" ? b.emergency : undefined,
  };
}


export function noteInput(b: Record<string, unknown>) {
  return {
    title: typeof b.title === "string" ? str(b.title, 200) : undefined,
    body: typeof b.body === "string" ? str(b.body, 20000) : undefined,
    lang: isLang(b.lang) ? b.lang : undefined,
    collection_id: b.collection_id === null ? null : b.collection_id !== undefined ? Number(b.collection_id) : undefined,
    photos: Array.isArray(b.photos) ? (b.photos as unknown[]).filter(photoExists).slice(0, 12) : undefined,
    shared: typeof b.shared === "boolean" ? b.shared : undefined,
  };
}


export function taskInput(b: Record<string, unknown>) {
  return {
    title: typeof b.title === "string" ? str(b.title, 200) : undefined,
    note: typeof b.note === "string" ? str(b.note, 4000) : undefined,
    lang: isLang(b.lang) ? b.lang : undefined,
    kind: b.kind === "routine" || b.kind === "once" ? (b.kind as "routine" | "once") : undefined,
    repeat: b.repeat === "none" || b.repeat === "daily" || b.repeat === "weekly" || b.repeat === "monthly" ? (b.repeat as "none" | "daily" | "weekly" | "monthly") : undefined,
    weekdays: Array.isArray(b.weekdays) ? (b.weekdays as unknown[]).map(Number) : undefined,
    date: b.date === null ? null : typeof b.date === "string" ? b.date : undefined,
    time: b.time === null || b.time === "" ? null : typeof b.time === "string" ? b.time : undefined,
    photo: b.photo === null ? null : photoExists(b.photo) ? (b.photo as string) : undefined,
  };
}

