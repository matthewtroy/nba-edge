import { useCallback, useState } from "react";

const STORAGE_KEY = "games-sgm-preset";

export type GamesSgmPreset = { label: string; min: number; max: number };

export const GAMES_SGM_PRESETS: GamesSgmPreset[] = [
  { label: "1.5–4", min: 1.5, max: 4 },
  { label: "3–6", min: 3, max: 6 },
  { label: "4–10", min: 4, max: 10 },
  { label: "10–20", min: 10, max: 20 },
  { label: "20–50", min: 20, max: 50 },
  { label: "50+", min: 50, max: Number.POSITIVE_INFINITY },
];

function loadInitial(): GamesSgmPreset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GamesSgmPreset;
      const match = GAMES_SGM_PRESETS.find((p) => p.label === parsed.label);
      if (match) return match;
    }
  } catch {
    /* ignore */
  }
  return GAMES_SGM_PRESETS[0];
}

export function useGamesSgmPreset() {
  const [preset, setPresetState] = useState<GamesSgmPreset>(loadInitial);
  const setPreset = useCallback((next: GamesSgmPreset) => {
    setPresetState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);
  return { preset, setPreset, presets: GAMES_SGM_PRESETS };
}