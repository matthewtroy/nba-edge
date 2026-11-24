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

export interface DataBundle {
  slate: SlateGame[];
  injuries: InjuryEntry[];
  picks: PickLeg[];
  multis: MultiBet[];
  multisNotBuilt: MultiNotBuilt[];
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

export function useData(): DataBundle {
  const [state, setState] = useState<DataBundle>({
    slate: [],
    injuries: [],
    picks: [],
    multis: [],
    multisNotBuilt: [],
    meta: { lastUpdated: "", sources: {}, slateSize: 0 },
    history: { legs: [], multis: [], calibration: [] },
    loading: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const [slate, injuries, picks, multisRaw, meta, history] = await Promise.all([
          fetch(`${dataBase}slate.json`).then((r) => r.json()),
          fetch(`${dataBase}injuries.json`).then((r) => r.json()),
          fetch(`${dataBase}picks.json`).then((r) => r.json()),
          fetch(`${dataBase}multis.json`).then((r) => r.json()),
          fetch(`${dataBase}meta.json`).then((r) => r.json()),
          fetch(`${dataBase}history.json`).then((r) => r.json()),
        ]);
        const { bets, notBuilt } = parseMultisJson(multisRaw);
        setState({
          slate,
          injuries,
          picks,
          multis: bets,
          multisNotBuilt: notBuilt,
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