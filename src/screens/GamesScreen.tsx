import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { gameSgmBlocks } from "@lib/games-sgm";
import { gameSgmAsMulti, gameShortLabel } from "@lib/games-sgm-ui";
import { hasValueAtBookie } from "@lib/value-at-bookie";
import { gamesForCards, isGameLive } from "@lib/slate-game-ui";
import { slateHasFeedOdds, slateOddsAvailabilityNote } from "@lib/slate-odds-ui";
import { MultiCard } from "../components/MultiCard";
import { DateSwitcher } from "../components/DateSwitcher";
import { useGamesSgmPreset } from "../hooks/useGamesSgmPreset";
import { formatOddsBand } from "@lib/game-sgm-builder";

interface Props {
  data: DataBundle;
  slateDate: string;
  todayDate: string;
  tomorrowDate: string | null;
  onSlateDateChange: (d: string) => void;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (text: string) => void;
}

export function GamesScreen({
  data,
  slateDate,
  todayDate,
  tomorrowDate,
  onSlateDateChange,
  myBookie = "Sportsbet",
  onLegTap,
  onCopy,
}: Props) {
  const { preset, setPreset, presets } = useGamesSgmPreset();
  const activeSlate = useMemo(() => gamesForCards(data.slate), [data.slate]);
  const useOfficial =
    data.officialCard != null &&
    data.officialCard.slateDate === data.meta.slateTipDate;
  const multis = useOfficial ? data.officialCard!.multis : data.multis;
  const picksById = useMemo(
    () => new Map(data.picks.map((p) => [p.id, p])),
    [data.picks]
  );

  const blocks = useMemo(
    () =>
      gameSgmBlocks(
        activeSlate,
        data.picks,
        multis,
        picksById,
        preset.min,
        preset.max
      ),
    [activeSlate, data.picks, multis, picksById, preset]
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of activeSlate) {
      if (isGameLive(g.status)) init[g.id] = true;
    }
    return init;
  });

  const valueCount = data.picks.filter((l) => hasValueAtBookie(l, myBookie)).length;
  const slateFairOnly = !slateHasFeedOdds(data.picks);
  const oddsNote = slateOddsAvailabilityNote(data.meta, data.picks);
  const bandLabel = formatOddsBand(preset.min, preset.max);

  return (
    <div className="pb-24">
      <DateSwitcher
        todayDate={todayDate}
        tomorrowDate={tomorrowDate}
        selected={slateDate}
        onSelect={onSlateDateChange}
      />
      <h1 className="text-xl font-bold mb-1">Games</h1>
      <p className="text-sm text-white/70 mb-3">
        SGM by bookie total ({bandLabel}) · Value @ {myBookie}: {valueCount}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPreset(p)}
            className={`text-[11px] px-3 py-1.5 rounded-full border ${
              preset.label === p.label
                ? "border-white/30 text-white"
                : "border-white/20"
            }`}
          >
            ${p.label}
          </button>
        ))}
      </div>

      {activeSlate.length === 0 && (
        <p className="text-sm text-white/50">No games on this slate yet.</p>
      )}

      {blocks.map(({ game, card, crossGameLegs, boostLegs, notBuiltReason }) => {
        const short = gameShortLabel(game);
        const live = isGameLive(game.status);
        if (!card) {
          const reason =
            notBuiltReason ??
            `${short}: nothing fits ${bandLabel} with edge or high-probability rules.`;
          return (
            <p key={game.id} className="text-[13px] text-white/50 mb-2 leading-snug px-1">
              {live ? `${reason} (live)` : reason}
            </p>
          );
        }
        const multi = gameSgmAsMulti(card, game);
        const isCollapsed = collapsed[game.id] ?? false;

        return (
          <div key={game.id} className="mb-1">
            {live && (
              <button
                type="button"
                className="text-xs text-white/60 mb-1 px-1"
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [game.id]: !isCollapsed }))
                }
              >
                {short} · live · {isCollapsed ? "Show SGM" : "Hide"}
              </button>
            )}
            {(!live || !isCollapsed) && (
              <>
                <p className="text-[11px] text-white/45 px-1 mb-1">
                  {game.startTimeSydney} · {bandLabel}
                  {game.spread != null && Math.abs(game.spread) >= 14.5 && (
                    <span className="text-accent-value ml-1">· Blowout risk</span>
                  )}
                  {crossGameLegs.length > 0 &&
                    ` · Cross (${crossGameLegs.length})`}
                  {boostLegs.length > 0 && " · Best SGM"}
                </p>
                <MultiCard
                  multi={multi}
                  picksById={picksById}
                  injuries={data.injuries}
                  slate={activeSlate}
                  lockedBookie={slateFairOnly ? undefined : card.bestBookie}
                  fairOnly={slateFairOnly}
                  oddsNote={oddsNote}
                  hideBookieSelect={slateFairOnly}
                  compact
                  onLegTap={onLegTap}
                  onCopy={onCopy}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}