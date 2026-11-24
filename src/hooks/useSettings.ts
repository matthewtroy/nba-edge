import { useEffect, useState } from "react";
import type { AppSettings } from "@lib/types";

const KEY = "nba-edge-settings";

const defaults: AppSettings = {
  targetProfit: 300,
  minEdge: 0.08,
  showQ1Bets: true,
  showLongshots: true,
  myBookie: "bet365",
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { ...defaults, ...parsed, myBookie: parsed.myBookie ?? defaults.myBookie };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);

  return { settings, setSettings, defaults };
}