"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiErr, type ApiFailure } from "./api";

/** Load a GET endpoint; `reload` refetches; `setData` lets a screen update optimistically. */
export function useApi<T>(path: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [loading, setLoading] = useState(!!path);
  const alive = useRef(true);
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      if (alive.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (alive.current && e instanceof ApiErr) setError(e.f);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading from the API is the external sync this effect exists for
    reload();
    let t: ReturnType<typeof setInterval> | undefined;
    if (opts.poll) {
      t = setInterval(() => {
        if (document.visibilityState === "visible") reload();
      }, opts.poll);
    }
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => {
      alive.current = false;
      if (t) clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload, opts.poll]);
  return { data, setData, error, loading, reload };
}
