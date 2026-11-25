import { useCallback, useState } from "react";

export const GAMES_ROUGHIES_STORAGE_KEY = "games-roughies-on";

function loadInitial(): boolean {
  try {
    const raw = localStorage.getItem(GAMES_ROUGHIES_STORAGE_KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return false;
}

export function useGamesRoughies() {
  const [roughiesOn, setRoughiesState] = useState<boolean>(loadInitial);
  const setRoughiesOn = useCallback((next: boolean) => {
    setRoughiesState(next);
    localStorage.setItem(GAMES_ROUGHIES_STORAGE_KEY, next ? "1" : "0");
  }, []);
  return { roughiesOn, setRoughiesOn };
}