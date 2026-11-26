import { useEffect } from "react";
import { loadDataIndex } from "./useData";
import type { DataIndexFile } from "@lib/data-index";

/** When publish countdown hits zero, poll index until the next slate folder appears. */
export function usePublishPoll(
  index: DataIndexFile | null,
  enabled: boolean,
  onIndex: (next: DataIndexFile) => void
): void {
  useEffect(() => {
    if (!enabled || !index?.nextPublishAt) return;
    const target = new Date(index.nextPublishAt).getTime();
    let cancelled = false;
    const tick = async () => {
      if (cancelled || Date.now() < target) return;
      const fresh = await loadDataIndex();
      if (!fresh || cancelled) return;
      onIndex(fresh);
      if (fresh.dates.some((d) => d.date === fresh.nextSlateDate)) {
        clearInterval(timer);
      }
    };

    const timer = window.setInterval(() => {
      void tick();
    }, 5_000);
    void tick();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, index?.nextPublishAt, index?.updatedAt, onIndex]);
}