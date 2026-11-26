import { useEffect, useMemo } from "react";
import type { DataBundle } from "../hooks/useData";
import { useData } from "../hooks/useData";
import { topBeneficiaryLastNames } from "@lib/injury-beneficiaries";
import { sydneyTimeFromIso } from "../utils/format";
import {
  clearQuestionableAsOutStorage,
  standaloneInjuryBlocks,
} from "@lib/injuries-standalone";
import { InjuryStatusBadge } from "../components/InjuryStatusBadge";

interface Props {
  data: DataBundle;
  todayDate: string;
  tomorrowDate: string | null;
}

function teamAbbr(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
}

export function InjuriesScreen({
  data,
  todayDate,
  tomorrowDate,
}: Props) {
  useEffect(() => {
    clearQuestionableAsOutStorage();
  }, []);

  const nextBundle = useData(tomorrowDate ?? todayDate);
  const now = useMemo(() => new Date(), []);
  const blocks = useMemo(
    () =>
      standaloneInjuryBlocks({
        today: {
          slate: data.slate,
          injuries: data.injuries,
          injuriesAtTip: data.meta.injuriesAtTip,
        },
        next:
          tomorrowDate && tomorrowDate !== todayDate && !nextBundle.loading
            ? {
                slate: nextBundle.slate,
                injuries: nextBundle.injuries,
                injuriesAtTip: nextBundle.meta.injuriesAtTip,
              }
            : null,
        now,
      }),
    [data, nextBundle, tomorrowDate, todayDate, now]
  );

  return (
    <div className="pb-24">
      <h1 className="text-xl font-bold mb-1">Injuries</h1>
      <p className="text-xs text-white/45 mb-4">
        Live list · today{tomorrowDate ? " + next slate" : ""} teams · tip order
      </p>
      {blocks.length === 0 ? (
        <p className="text-sm text-white/50">No injury rows for this window.</p>
      ) : (
        blocks.map((block) => {
          const game = [...data.slate, ...nextBundle.slate].find((g) => g.id === block.gameId);
          const matchup = game
            ? `${teamAbbr(game.awayTeam)} @ ${teamAbbr(game.homeTeam)}`
            : block.gameId;
          return (
            <section key={`${block.gameId}:${block.teamId}`} className="mb-3 bg-card rounded-xl px-3 py-3">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h2 className="text-sm font-semibold text-white/85 truncate">{block.teamName}</h2>
                <span className="text-[11px] text-white/45 shrink-0 tabular-nums">
                  {sydneyTimeFromIso(block.tipIso)} · {matchup}
                </span>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {block.injuries.map((inj) => (
                  <li key={`${inj.playerId ?? inj.playerName}:${inj.status}`} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{inj.playerName}</span>
                      <InjuryStatusBadge status={inj.status} />
                    </div>
                    <p className="text-[11px] text-white/45 mt-0.5">
                      {inj.source} · {sydneyTimeFromIso(inj.updatedAt)}
                    </p>
                    {(inj.status === "Out" || inj.status === "Doubtful") && (
                      <p className="text-[11px] text-white/65 mt-1">
                        Who benefits:{" "}
                        {topBeneficiaryLastNames(inj, data.picks).join(", ") || "—"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}