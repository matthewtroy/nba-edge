import { useCallback, useEffect, useMemo, useState } from "react";
import type { DataIndexFile } from "@lib/data-index";
import {
  localDateFromIso,
  resolveViewerSlateSegment,
  viewerTimeZone,
} from "@lib/viewer-slate";

const STORAGE_KEY = "nba-edge-slate-date";

export function weekdayShort(ymd: string, timeZone = viewerTimeZone()): string {
  const noon =
    ymd.length >= 10
      ? new Date(`${ymd}T12:00:00Z`)
      : new Date();
  return noon.toLocaleDateString("en-AU", { timeZone, weekday: "short" });
}

export function useSlateDate(index: DataIndexFile | null) {
  const timeZone = viewerTimeZone();
  const [clock, setClock] = useState(0);

  const bump = useCallback(() => setClock((c) => c + 1), []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(bump, 60_000);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [bump]);

  const viewerSegment = useMemo(() => {
    if (!index) {
      return {
        today: "",
        tomorrow: null as string | null,
        noGamesToday: false,
      };
    }
    const v = resolveViewerSlateSegment(index, new Date(), timeZone);
    const today = v.todayFolder ?? index.todayDate;
    const tomorrow = v.tomorrowFolder ?? index.tomorrowDate;
    const noGamesToday = v.todayFolder == null && index.dates.length > 0;
    return { today, tomorrow, noGamesToday };
  }, [index, timeZone, clock]);

  const defaultPick = viewerSegment.today || index?.defaultDate || "";

  const [date, setDateState] = useState(defaultPick);

  useEffect(() => {
    if (!index?.dates.length) return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && index.dates.some((d) => d.date === stored)) {
      setDateState(stored);
      return;
    }
    setDateState(defaultPick);
  }, [index?.updatedAt, index?.defaultDate, index?.dates, defaultPick]);

  const setDate = useCallback(
    (d: string) => {
      setDateState(d);
      sessionStorage.setItem(STORAGE_KEY, d);
    },
    []
  );

  return {
    date,
    setDate,
    segment: {
      today: viewerSegment.today,
      tomorrow: viewerSegment.tomorrow,
    },
    noGamesToday: viewerSegment.noGamesToday,
    timeZone,
    defaultDate: index?.defaultDate ?? "",
    slateLocalLabel: (folderDate: string) => {
      const entry = index?.dates.find((d) => d.date === folderDate);
      if (entry?.firstTipIso) {
        return localDateFromIso(entry.firstTipIso, timeZone);
      }
      return folderDate;
    },
  };
}