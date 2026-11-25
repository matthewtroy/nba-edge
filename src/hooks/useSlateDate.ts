import { useCallback, useEffect, useMemo, useState } from "react";
import type { DataIndexFile } from "@lib/data-index";

const STORAGE_KEY = "nba-edge-slate-date";

export function weekdayShort(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
  });
}

export function useSlateDate(index: DataIndexFile | null) {
  const defaultDate = index?.defaultDate ?? "";
  const [date, setDateState] = useState(defaultDate);

  useEffect(() => {
    if (!index?.dates.length) return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && index.dates.some((d) => d.date === stored)) {
      setDateState(stored);
      return;
    }
    setDateState(index.defaultDate);
  }, [index?.updatedAt, index?.defaultDate, index?.dates]);

  const setDate = useCallback(
    (d: string) => {
      setDateState(d);
      sessionStorage.setItem(STORAGE_KEY, d);
    },
    []
  );

  const segment = useMemo(() => {
    if (!index) return { today: "", tomorrow: null as string | null };
    return { today: index.todayDate, tomorrow: index.tomorrowDate };
  }, [index]);

  return { date, setDate, segment, defaultDate };
}