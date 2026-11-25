import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { gameSgmBlocks } from "@lib/games-sgm";
import { gameSgmAsMulti, gameListRowLabel } from "@lib/games-sgm-ui";
import { gamesForCards, isGameLive } from "@lib/slate-game-ui";
import { slateHasFeedOdds, slateOddsAvailabilityNote } from "@lib/slate-odds-ui";
import { picksByIdFromOfficialSnapshots } from "@lib/official-leg-snapshot";
import { MultiCard } from "../components/MultiCard";
import { DateSwitcher } from "../components/DateSwitcher";
import { useGamesSgmPreset } from "../hooks/useGamesSgmPreset";
import { formatOddsBand } from "@lib/game-sgm-builder";
import { formatGameOddsAge, formatOddsFreshnessSummary } from "@lib/odds-freshness-ui";

interface Props {
  data: DataBundle;
  slateDate: string;
  todayDate: string;
  tomorrowDate: string | null;
  onSlateDateChange: (d: string) => void;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (text: string) => void;
  myBookie?: string;
}

export function GamesScreen({
  data,
  slateDate,
  todayDate,
  tomorrowDate,
  onSlateDateChange,
  onLegTap,
  onCopy,
  myBookie,
}: Props) {
  const { preset, setPreset, presets } = useGamesSgmPreset();
  const activeSlate = useMemo(() => gamesForCards(data.slate), [data.slate]);
  const useOfficial =
    data.officialCard != null &&
    data.officialCard.slateDate === data.meta.slateTipDate;
  const multis = useOfficial ? data.officialCard!.multis : data.multis;
  const picksById = useMemo(
    () =>
      useOfficial
        ? picksByIdFromOfficialSnapshots(data.officialCard!.legSnapshots, data.picks)
        : new Map(data.picks.map((p) => [p.id, p])),
    [data.picks, useOfficial, data.officialCard]
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

  const built = useMemo(() => blocks.filter((b) => b.card), [blocks]);
  const empty = useMemo(() => blocks.filter((b) => !b.card), [blocks]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of activeSlate) {
      if (isGameLive(g.status)) init[g.id] = true;
    }
    return init;
  });
  const [emptyOpen, setEmptyOpen] = useState(false);

  const slateFairOnly = !slateHasFeedOdds(data.picks);
  const oddsNote = slateOddsAvailabilityNote(data.meta, data.picks);
  const bandLabel = formatOddsBand(preset.min, preset.max);
  const oddsFreshness = formatOddsFreshnessSummary(
    data.picks,
    data.slate,
    data.meta.oddsLastPulled
  );

  return (
    <div className="pb-24">
      <DateSwitcher
        todayDate={todayDate}
        tomorrowDate={tomorrowDate}
        selected={slateDate}
        onSelect={onSlateDateChange}
      />
      <header className="mb-4">
        <h1 className="text-xl font-bold text-white theme-adaptive-title">Games</h1>
        <p className="text-sm text-white/45 theme-adaptive-muted mt-0.5">
          SGMs by bookie total · {bandLabel}
        </p>
        {oddsFreshness && (
          <p className="text-[11px] text-white/45 mt-1">{oddsFreshness}</p>
        )}
      </header>
      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPreset(p)}
            className={`text-[11px] px-3 py-1.5 rounded-full border ${
              preset.label === p.label
                ? "border-white/30 text-white"
                : "border-white/20 text-white/55"
            }`}
          >
            ${p.label}
          </button>
        ))}
      </div>

      {activeSlate.length === 0 && (
        <p className="text-sm text-white/50">No games on this slate yet.</p>
      )}

      {multis
        .filter((m) => m.type === "crossGameSgm")
        .map((m) => (
          <MultiCard
            key={`${m.type}-${m.legs.join()}`}
            multi={m}
            picksById={picksById}
            injuries={data.injuries}
            slate={activeSlate}
            preferredBookie={myBookie}
            fairOnly={slateFairOnly}
            oddsNote={oddsNote}
            hideBookieSelect={slateFairOnly}
            liveCatalog={data.picks}
            compact
            onLegTap={onLegTap}
            onCopy={onCopy}
          />
        ))}

      {built.map(({ game, card }) => {
        if (!card) return null;
        const multi = gameSgmAsMulti(card, game);
        const isCollapsed = collapsed[game.id] ?? false;
        const live = isGameLive(game.status);
        const gameOddsAge = formatGameOddsAge(
          data.picks,
          game.id,
          data.meta.oddsLastPulled
        );

        return (
          <div key={game.id} className="mb-4">
            {live && (
              <button
                type="button"
                className="text-xs text-white/50 mb-1"
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [game.id]: !isCollapsed }))
                }
              >
                {isCollapsed ? "Show live SGM" : "Hide live SGM"}
              </button>
            )}
            {(!live || !isCollapsed) && (
              <>
                <p className="text-[13px] font-semibold text-white theme-adaptive-title mb-2">
                  {gameListRowLabel(game)}
                  {gameOddsAge ? (
                    <span className="text-white/40 font-normal text-[11px] ml-2">
                      {gameOddsAge}
                    </span>
                  ) : null}
                  {game.spread != null && Math.abs(game.spread) >= 14.5 && (
                    <span className="text-red-400 font-normal text-xs ml-2">
                      Blowout
                    </span>
                  )}
                </p>
                <MultiCard
                  multi={multi}
                  picksById={picksById}
                  injuries={data.injuries}
                  slate={activeSlate}
                  preferredBookie={myBookie}
                  fairOnly={slateFairOnly}
                  oddsNote={oddsNote}
                  hideBookieSelect={slateFairOnly}
                  liveCatalog={data.picks}
                  compact
                  onLegTap={onLegTap}
                  onCopy={onCopy}
                />
              </>
            )}
          </div>
        );
      })}

      {empty.length > 0 && (
        <MotionEmptyBlock
          count={empty.length}
          open={emptyOpen}
          onToggle={() => setEmptyOpen((o) => !o)}
          reasons={empty.map((b) => ({
            id: b.game.id,
            text:
              b.notBuiltReason ??
              `${gameListRowLabel(b.game)}: nothing fits ${bandLabel}.`,
          }))}
        />
      )}
    </div>
  );
}

function MotionEmptyBlock({
  count,
  open,
  onToggle,
  reasons,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
  reasons: { id: string; text: string }[];
}) {
  return (
    <div className="mt-2 border-t border-white/[0.05] pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="text-sm text-white/45 w-full text-left"
      >
        {count} game{count === 1 ? "" : "s"} have no SGM in this range{" "}
        <span className="text-white/30">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-2 pl-1">
          {reasons.map((r) => (
            <li key={r.id} className="text-[12px] text-white/45 leading-snug">
              {r.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}