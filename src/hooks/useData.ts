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
import type { OfficialCardFile } from "@lib/official-card-time";

export interface DataBundle {
  slate: SlateGame[];
  injuries: InjuryEntry[];
  picks: PickLeg[];
  multis: MultiBet[];
  multisNotBuilt: MultiNotBuilt[];
  officialCard: OfficialCardFile | null;
  meta: MetaJson & { whatChanged?: string[] };
  history: HistoryJson;
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

export function useData(): DataBundle {
  const [state, setState] = useState<DataBundle>({
    slate: [],
    injuries: [],
    picks: [],
    multis: [],
    multisNotBuilt: [],
    officialCard: null,
    meta: { lastUpdated: "", sources: {}, slateSize: 0 },
    history: { legs: [], multis: [], calibration: [] },
    loading: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const meta = await fetchDataJson<MetaJson & { whatChanged?: string[] }>(
          "meta.json",
          "bootstrap"
        );
        const v = meta.lastUpdated || "0";
        const [slate, injuries, picks, multisRaw, history] = await Promise.all([
          fetchDataJson<SlateGame[]>("slate.json", v),
          fetchDataJson<InjuryEntry[]>("injuries.json", v),
          fetchDataJson<PickLeg[]>("picks.json", v),
          fetchDataJson<unknown>("multis.json", v),
          fetchDataJson<HistoryJson>("history.json", v),
        ]);
        const { bets, notBuilt } = parseMultisJson(multisRaw);
        let officialCard: OfficialCardFile | null = null;
        try {
          officialCard = await fetchDataJson<OfficialCardFile>("official-card.json", v);
        } catch {
          /* no lock yet */
        }
        setState({
          slate,
          injuries,
          picks,
          multis: bets,
          multisNotBuilt: notBuilt,
          officialCard,
          meta,
          history,
          loading: false,
        });
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load data",
        }));
      }
    }
    load();
  }, []);

  return state;
}