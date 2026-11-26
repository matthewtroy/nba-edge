import { useCallback, useState } from "react";
import { GAMES_SGM_PRESETS, type GamesSgmPreset } from "@lib/games-sgm-presets";

export { GAMES_SGM_PRESETS, type GamesSgmPreset };

const STORAGE_KEY = "games-sgm-preset";

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