import { useCallback, useEffect, useState } from "react";
import type { MultiBet, PickLeg } from "@lib/types";
import { swapPlayerCandidates } from "@lib/multi-player-swap";

function storageKey(multi: MultiBet): string {
  return `multi-leg-edits:${multi.type}:${multi.variant ?? ""}:${multi.legs.join(",")}`;
}

export function useMultiLegEdits(multi: MultiBet, picks: PickLeg[]) {
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey(multi));
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey(multi), JSON.stringify(overrides));
  }, [multi, overrides]);

  const resolveLeg = useCallback(
    (legId: string): PickLeg | undefined => {
      const id = overrides[legId] ?? legId;
      return picks.find((p) => p.id === id);
    },
    [overrides, picks]
  );

  const swapLeg = useCallback(
    (legId: string) => {
      const current = resolveLeg(legId);
      if (!current) return;
      const candidates = swapPlayerCandidates(current, picks, multi.type);
      if (!candidates.length) return;
      const idx = candidates.findIndex((c) => c.id === current.id);
      const next = candidates[(idx + 1) % candidates.length];
      setOverrides((o) => ({ ...o, [legId]: next.id }));
    },
    [picks, resolveLeg]
  );

  const resetLeg = useCallback((legId: string) => {
    setOverrides((o) => {
      const next = { ...o };
      delete next[legId];
      return next;
    });
  }, []);

  const isEdited = useCallback(
    (legId: string) => overrides[legId] != null && overrides[legId] !== legId,
    [overrides]
  );

  return { resolveLeg, swapLeg, resetLeg, isEdited, displayLegIds: multi.legs };
}