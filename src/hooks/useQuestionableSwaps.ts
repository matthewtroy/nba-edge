import { useCallback, useEffect, useState } from "react";

const KEY = "nba-edge-questionable-as-out";

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeSet(ids: Set<string>) {
  localStorage.setItem(KEY, JSON.stringify([...ids]));
}

export function useQuestionableSwaps() {
  const [asOut, setAsOut] = useState<Set<string>>(() => readSet());

  useEffect(() => {
    writeSet(asOut);
  }, [asOut]);

  const swapAsOut = useCallback((playerId: string) => {
    setAsOut((prev) => new Set(prev).add(playerId));
  }, []);

  const reset = useCallback((playerId: string) => {
    setAsOut((prev) => {
      const next = new Set(prev);
      next.delete(playerId);
      return next;
    });
  }, []);

  const isCountedOut = useCallback(
    (playerId: string) => asOut.has(playerId),
    [asOut]
  );

  return { swapAsOut, reset, isCountedOut };
}