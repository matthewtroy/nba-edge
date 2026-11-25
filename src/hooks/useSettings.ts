import { useEffect, useState } from "react";
import type { AppSettings } from "@lib/types";
import { FEED_BOOKIES } from "@lib/card-bookie";

const KEY = "nba-edge-settings";

const defaults: AppSettings = {
  targetProfit: 300,
  minEdge: 0.08,
  showQ1Bets: true,
  showLongshots: true,
  myBookie: "Sportsbet",
};

function sanitizeBookie(raw: string | undefined): string {
  if (raw === "Betfair") return "Sportsbet";
  if (raw && raw !== "bet365" && FEED_BOOKIES.includes(raw as (typeof FEED_BOOKIES)[number]))
    return raw;
  return defaults.myBookie;
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        ...defaults,
        ...parsed,
        myBookie: sanitizeBookie(parsed.myBookie),
      };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);

  return { settings, setSettings, defaults };
}