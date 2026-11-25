import { useCallback, useEffect, useState } from "react";
import type { MultiBet, PickLeg } from "@lib/types";
import {
  buildPersonalMultiBet,
  type PersonalMultiDraft,
} from "@lib/personal-multi";

const STORAGE = "nba-edge-personal-multis-v1";

function loadDrafts(): PersonalMultiDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return [];
    return JSON.parse(raw) as PersonalMultiDraft[];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: PersonalMultiDraft[]) {
  localStorage.setItem(STORAGE, JSON.stringify(drafts));
}

export function usePersonalMultis(picks: PickLeg[]) {
  const [drafts, setDrafts] = useState<PersonalMultiDraft[]>([]);

  useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  const picksById = new Map(picks.map((p) => [p.id, p]));

  const multis = drafts
    .map((d) => {
      const multi = buildPersonalMultiBet(d, picksById);
      return multi ? { multi, draftId: d.id } : null;
    })
    .filter(Boolean) as { multi: MultiBet; draftId: string }[];

  const addMulti = useCallback(
    (legIds: string[], label: string) => {
      const draft: PersonalMultiDraft = {
        id: `p-${Date.now()}`,
        label: label.trim() || "My multi",
        legIds,
        createdAt: new Date().toISOString(),
      };
      const next = [...loadDrafts(), draft];
      saveDrafts(next);
      setDrafts(next);
    },
    []
  );

  const removeMulti = useCallback((id: string) => {
    const next = loadDrafts().filter((d) => d.id !== id);
    saveDrafts(next);
    setDrafts(next);
  }, []);

  return { multis, addMulti, removeMulti };
}