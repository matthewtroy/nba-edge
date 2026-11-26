import { useEffect, useRef, useState } from "react";
import { mergeViewerBundleOnRefresh } from "@lib/viewer-bundle-freeze";
import { freezeInjuriesAtTip } from "@lib/injury-tip-freeze";
import { mergeInjuriesReportTime } from "@lib/injury-tip-freeze";
import type {
  SlateGame,
  InjuryEntry,
  PickLeg,
  MultiBet,
  MultiNotBuilt,
  MetaJson,
  HistoryJson,
} from "@lib/types";
import type { ResultsJson } from "@lib/results-types";
import type { OfficialCardFile } from "@lib/official-card-time";
import type { DataIndexFile } from "@lib/data-index";
import { DataLoadError, type DataLoadKind } from "@lib/data-load-error";

export interface DataBundle {
  index: DataIndexFile | null;
  selectedDate: string;
  slate: SlateGame[];
  injuries: InjuryEntry[];
  picks: PickLeg[];
  multis: MultiBet[];
  multisNotBuilt: MultiNotBuilt[];
  officialCard: OfficialCardFile | null;
  meta: MetaJson & { whatChanged?: string[] };
  history: HistoryJson;
  results: ResultsJson | null;
  loading: boolean;
  error?: string;
  errorKind?: DataLoadKind;
}

function parseMultisJson(raw: unknown): { bets: MultiBet[]; notBuilt: MultiNotBuilt[] } {
  if (Array.isArray(raw)) {
    return { bets: raw as MultiBet[], notBuilt: [] };
  }
  const obj = raw as { bets?: MultiBet[]; notBuilt?: MultiNotBuilt[] };
  return {
    bets: obj.bets ?? [],
    notBuilt: obj.notBuilt ?? [],
  };
}

const dataBase = `${import.meta.env.BASE_URL}data/`;

async function fetchDataJson<T>(file: string, version: string): Promise<T> {
  const url = `${dataBase}${file}?v=${encodeURIComponent(version)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const kind = res.status === 404 ? "missing" : "network";
    throw new DataLoadError(kind);
  }
  return res.json() as Promise<T>;
}

export function useData(selectedDate: string): DataBundle {
  const lastBundleRef = useRef<{
    date: string;
    slate: SlateGame[];
    picks: PickLeg[];
    multis: MultiBet[];
    injuries: InjuryEntry[];
  } | null>(null);
  const [state, setState] = useState<DataBundle>({
    index: null,
    selectedDate,
    slate: [],
    injuries: [],
    picks: [],
    multis: [],
    multisNotBuilt: [],
    officialCard: null,
    meta: { lastUpdated: "", sources: {}, slateSize: 0 },
    history: { legs: [], multis: [], calibration: [] },
    results: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, loading: true, selectedDate, error: undefined }));
      try {
        let index: DataIndexFile | null = null;
        try {
          index = await fetchDataJson<DataIndexFile>("index.json", "idx");
        } catch {
          /* legacy flat layout */
        }

        const dateKey = selectedDate || index?.defaultDate;
        const prefix = index && dateKey ? `${dateKey}/` : "";

        const meta = await fetchDataJson<MetaJson & { whatChanged?: string[] }>(
          `${prefix}meta.json`,
          dateKey || "bootstrap"
        );
        const v = meta.lastUpdated || "0";
        const [slate, injuries, picks, multisRaw, history] = await Promise.all([
          fetchDataJson<SlateGame[]>(`${prefix}slate.json`, v),
          fetchDataJson<InjuryEntry[]>(`${prefix}injuries.json`, v),
          fetchDataJson<PickLeg[]>(`${prefix}picks.json`, v),
          fetchDataJson<unknown>(`${prefix}multis.json`, v),
          fetchDataJson<HistoryJson>("history.json", v),
        ]);
        let results: ResultsJson | null = null;
        try {
          results = await fetchDataJson<ResultsJson>("results.json", v);
        } catch {
          results = null;
        }
        const { bets, notBuilt } = parseMultisJson(multisRaw);
        let officialCard: OfficialCardFile | null = null;
        try {
          officialCard = await fetchDataJson<OfficialCardFile>(
            `${prefix}official-card.json`,
            v
          );
        } catch {
          /* no lock yet */
        }
        if (!cancelled) {
          const date = dateKey ?? "";
          const prev = lastBundleRef.current;
          let slateOut = slate;
          let picksOut = picks;
          let multisOut = bets;
          let injuriesOut = mergeInjuriesReportTime(injuries);
          if (
            prev &&
            prev.date === date &&
            prev.slate.length &&
            (prev.picks.length || picks.length)
          ) {
            const merged = mergeViewerBundleOnRefresh({
              previous: {
                slate: prev.slate,
                picks: prev.picks,
                multis: prev.multis,
              },
              incoming: { slate, picks, multis: bets },
            });
            slateOut = merged.slate;
            picksOut = merged.picks;
            multisOut = merged.multis;
          }
          const atTipSeed = meta.injuriesAtTip?.length
            ? meta.injuriesAtTip
            : officialCard?.injuries;
          const injuryHistory =
            prev && prev.date === date
              ? [...prev.injuries, ...injuries]
              : [...(atTipSeed ?? []), ...injuries];
          injuriesOut = freezeInjuriesAtTip(
            injuryHistory,
            injuriesOut,
            slateOut,
            new Date()
          );
          lastBundleRef.current = {
            date,
            slate: slateOut,
            picks: picksOut,
            multis: multisOut,
            injuries: injuriesOut,
          };
          setState({
            index,
            selectedDate: date,
            slate: slateOut,
            injuries: injuriesOut,
            picks: picksOut,
            multis: multisOut,
            multisNotBuilt: notBuilt,
            officialCard,
            meta,
            history,
            results,
            loading: false,
          });
        }
      } catch (e) {
        if (!cancelled) {
          const kind =
            e instanceof DataLoadError
              ? e.kind
              : e instanceof TypeError
                ? "network"
                : "unknown";
          setState((s) => ({
            ...s,
            loading: false,
            errorKind: kind,
            error: kind,
          }));
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  return state;
}

export async function loadDataIndex(): Promise<DataIndexFile | null> {
  try {
    return await fetchDataJson<DataIndexFile>("index.json", "idx");
  } catch {
    return null;
  }
}