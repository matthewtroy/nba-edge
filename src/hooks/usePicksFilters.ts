import { useCallback, useEffect, useState } from "react";
import type { Market } from "@lib/types";

export type PicksShowFilter = "value" | "high" | "all";
export type PicksMultiFilter = "all" | "inMulti";
export type PicksSortKey = "edge" | "prob" | "price" | "l5" | "tip";

export interface PicksFilterState {
  multi: PicksMultiFilter;
  market: "all" | Market | "combos";
  show: PicksShowFilter;
  sort: PicksSortKey;
  sortAsc: boolean;
}

const STORAGE_KEY = "picks-ui-v2";

const DEFAULT: PicksFilterState = {
  multi: "all",
  market: "all",
  show: "value",
  sort: "edge",
  sortAsc: false,
};

function readStored(): PicksFilterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<PicksFilterState>;
    return {
      multi: parsed.multi === "inMulti" ? "inMulti" : "all",
      market: (parsed.market ?? "all") as PicksFilterState["market"],
      show:
        parsed.show === "high" || parsed.show === "all" ? parsed.show : "value",
      sort:
        parsed.sort === "prob" ||
        parsed.sort === "price" ||
        parsed.sort === "l5" ||
        parsed.sort === "tip"
          ? parsed.sort
          : "edge",
      sortAsc: Boolean(parsed.sortAsc),
    };
  } catch {
    return DEFAULT;
  }
}

export function usePicksFilters(): [
  PicksFilterState,
  (patch: Partial<PicksFilterState>) => void,
  () => void,
] {
  const [state, setState] = useState<PicksFilterState>(DEFAULT);

  useEffect(() => {
    setState(readStored());
  }, []);

  const patch = useCallback((p: Partial<PicksFilterState>) => {
    setState((prev) => {
      const next = { ...prev, ...p };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleSortDir = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, sortAsc: !prev.sortAsc };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return [state, patch, toggleSortDir];
}

export function picksFilterSummaryLabels(f: PicksFilterState): {
  show: string;
  sort: string;
} {
  const show =
    f.show === "value" ? "Value" : f.show === "high" ? "High prob" : "All";
  const sortNames: Record<PicksSortKey, string> = {
    edge: "Edge",
    prob: "Prob",
    price: "Price",
    l5: "L5",
    tip: "Tip",
  };
  return {
    show,
    sort: `${sortNames[f.sort]}${f.sortAsc ? " ↑" : " ↓"}`,
  };
}