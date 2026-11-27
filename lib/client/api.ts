"use client";
// Thin JSON client for the household API. Errors carry a kind so screens can say what happened.

export type ApiFailure = { kind: "offline" | "signed_out" | "server" | "client"; status: number; code: string };

export class ApiErr extends Error {
  constructor(public f: ApiFailure) {
    super(f.code);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new ApiErr({ kind: "offline", status: 0, code: "offline" });
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiErr({ kind: "offline", status: 0, code: "offline" });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (data as { error?: string }).error ?? "error";
    if (res.status === 401) {
      if (typeof window !== "undefined" && !location.pathname.startsWith("/signin") && !location.pathname.startsWith("/signup")) location.href = "/signin";
      throw new ApiErr({ kind: "signed_out", status: 401, code });
    }
    throw new ApiErr({ kind: res.status >= 500 ? "server" : "client", status: res.status, code });
  }
  return data as T;
}

/** Shrink a photo on the phone before upload (max 1600px JPEG) and return its id. */
export async function uploadPhoto(file: File): Promise<string> {
  let blob: Blob = file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
  } catch {
    /* send the original */
  }
  const form = new FormData();
  form.append("photo", new File([blob], "photo.jpg", { type: blob.type || file.type }));
  const r = await api<{ id: string }>("/api/photos", { form });
  return r.id;
}

export const photoUrl = (id: string) => `/api/photos/${id}`;
