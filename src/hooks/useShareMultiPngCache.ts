import { useCallback, useEffect, useRef, useState } from "react";
import {
  captureMultiCardSharePng,
  type CaptureMultiCardShareInput,
} from "../lib/share-multi-image";
import {
  SHARE_PNG_DEBOUNCE_MS,
  SHARE_PNG_LIVE_REFRESH_MS,
  sharePngCacheVersion,
} from "../lib/share-multi-cache";

type CacheEntry = { blob: Blob; version: string; at: number };

export function useShareMultiPngCache(
  input: CaptureMultiCardShareInput | null,
  enabled: boolean,
  liveRefresh: boolean,
  onPrepareError: (message: string) => void
) {
  const globalCache = useRef<Map<string, CacheEntry>>(new Map());
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const version = input ? sharePngCacheVersion(input) : "";

  const runCapture = useCallback(
    async (force = false) => {
      if (!input || !enabled) return;
      const v = sharePngCacheVersion(input);
      const hit = globalCache.current.get(v);
      if (hit && !force) {
        setBlob(hit.blob);
        return hit.blob;
      }
      setPreparing(true);
      try {
        const next = await captureMultiCardSharePng(input);
        globalCache.current.set(v, { blob: next, version: v, at: Date.now() });
        if (sharePngCacheVersion(input) === v) setBlob(next);
        return next;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Share prepare failed";
        onPrepareError(msg);
        return null;
      } finally {
        setPreparing(false);
      }
    },
    [input, enabled, onPrepareError]
  );

  useEffect(() => {
    if (!enabled || !input) {
      setBlob(null);
      return;
    }
    const hit = globalCache.current.get(version);
    if (hit) {
      setBlob(hit.blob);
      return;
    }
    const t = window.setTimeout(() => {
      const start = () => void runCapture(false);
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(start, { timeout: 3000 });
      } else {
        start();
      }
    }, SHARE_PNG_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [version, enabled, input, runCapture]);

  useEffect(() => {
    if (!liveRefresh || !enabled || !input) return;
    const id = window.setInterval(() => {
      void runCapture(true);
    }, SHARE_PNG_LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [liveRefresh, enabled, version, input, runCapture]);

  return { blob, preparing, runCapture };
}