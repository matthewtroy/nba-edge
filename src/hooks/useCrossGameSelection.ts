import { useCallback, useEffect, useMemo, useState } from "react";
import type { MultiBet, PickLeg, SlateGame } from "@lib/types";
import { gameShortLabel } from "@lib/games-sgm-ui";

function storageKey(multi: MultiBet): string {
  return `cross-games:${multi.type}:${multi.legs.join(",")}`;
}

export function useCrossGameSelection(
  multi: MultiBet,
  legs: PickLeg[],
  slate?: SlateGame[]
) {
  const gameIds = useMemo(() => {
    if (slate?.length) return slate.map((g) => g.id);
    return [...new Set(legs.map((l) => l.gameId))];
  }, [slate, legs]);

  const [enabled, setEnabled] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey(multi));
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        return new Set(arr);
      }
    } catch {
      /* ignore */
    }
    return new Set(gameIds);
  });

  useEffect(() => {
    setEnabled((prev) => {
      const next = new Set<string>();
      for (const id of gameIds) {
        if (prev.has(id)) next.add(id);
        else if (!prev.size) next.add(id);
      }
      if (!next.size) return new Set(gameIds);
      return next;
    });
  }, [gameIds, multi.legs.join(",")]);

  useEffect(() => {
    localStorage.setItem(storageKey(multi), JSON.stringify([...enabled]));
  }, [enabled, multi]);

  const toggle = useCallback((gameId: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        if (next.size <= 2) return next;
        next.delete(gameId);
      } else next.add(gameId);
      return next;
    });
  }, []);

  const filteredLegs = useMemo(
    () => legs.filter((l) => enabled.has(l.gameId)),
    [legs, enabled]
  );

  const chips = useMemo(() => {
    if (!slate?.length) {
      return gameIds.map((id) => ({
        id,
        label: id,
        legCount: legs.filter((l) => l.gameId === id).length,
      }));
    }
    return slate.map((g) => ({
      id: g.id,
      label: gameShortLabel(g),
      legCount: legs.filter((l) => l.gameId === g.id).length,
    }));
  }, [slate, gameIds, legs]);

  return { enabled, toggle, filteredLegs, chips };
}