import { useEffect, useState } from "react";
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
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return res.json() as Promise<T>;
}

export function useData(selectedDate: string): DataBundle {
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
          setState({
            index,
            selectedDate: dateKey ?? "",
            slate,
            injuries,
            picks,
            multis: bets,
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
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : "Failed to load data",
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