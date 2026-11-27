import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { LiveTrackingState } from "../hooks/useLiveTracking";
import type { InjuryEntry, PickLeg, ReasonAtTipSnapshot, SlateGame } from "@lib/types";
import { gameSgmBlocks } from "@lib/games-sgm";
import { frozenGameSgmBlocks } from "@lib/games-sgm-freeze";
import { gameSgmAsMulti, gameListRowLabel } from "@lib/games-sgm-ui";
import { gamesForGamesTab } from "@lib/slate-game-ui";
import {
  PRICES_PENDING_LABEL,
  slateAwaitingPrices,
  slateHasFeedOdds,
  slateOddsAvailabilityNote,
} from "@lib/slate-odds-ui";
import { picksByIdFromOfficialSnapshots } from "@lib/official-leg-snapshot";
import { viewerUsesOfficialCard } from "@lib/slate-viewer-official";
import { MultiCard } from "../components/MultiCard";
import { PickLegRow } from "../components/PickLegRow";
import { ui } from "../lib/card-type-scale";
import { DateSwitcher } from "../components/DateSwitcher";
import { TomorrowSlateTease } from "../components/TomorrowSlateTease";
import { useGamesSgmPreset } from "../hooks/useGamesSgmPreset";
import { useGamesRoughies } from "../hooks/useGamesRoughies";
import { formatOddsBand } from "@lib/game-sgm-builder";
import { formatGameOddsAge } from "@lib/odds-freshness-ui";
import { injuriesForBadges } from "@lib/injury-display";
import type { LiveGameBoard } from "@lib/live-source";
import { liveBetView } from "@lib/live-bet";
import { legStatesForMulti } from "@lib/live-tracking";

interface Props {
  data: DataBundle;
  slateDate: string;
  todayDate: string;
  tomorrowDate: string | null;
  viewerTodayYmd: string;
  settledTabLabel?: string | null;
  viewerTimeZone?: string;
  onIndexRefreshed?: (index: import("@lib/data-index").DataIndexFile) => void;
  onSlateDateChange: (d: string) => void;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (text: string) => void;
  onShareError: (message: string) => void;
  liveTracking: LiveTrackingState;
}

export function GamesScreen({
  data,
  slateDate,
  todayDate,
  tomorrowDate,
  viewerTodayYmd,
  settledTabLabel,
  viewerTimeZone,
  onIndexRefreshed,
  onSlateDateChange,
  onLegTap,
  onCopy,
  onShareError,
  myBookie,
  liveTracking,
}: Props) {
  const badgeInjuries = injuriesForBadges(data.injuries, {
    slate: data.slate,
    now: new Date(),
    previous: data.meta.injuriesAtTip,
  });
  const { preset, setPreset, presets } = useGamesSgmPreset();
  const { roughiesOn, setRoughiesOn } = useGamesRoughies();
  const activeSlate = useMemo(() => gamesForGamesTab(data.slate), [data.slate]);
  const useOfficial = viewerUsesOfficialCard({
    index: data.index,
    officialCard: data.officialCard,
    slateDate,
    slateTipDate: data.meta.slateTipDate,
  });
  const multis = useOfficial ? data.officialCard!.multis : data.multis;
  const frozenGamesSgms = useOfficial ? data.officialCard!.gamesSgms : undefined;
  const picksById = useMemo(
    () =>
      useOfficial
        ? picksByIdFromOfficialSnapshots(
            { ...frozenGamesSgms?.legSnapshots, ...data.officialCard!.legSnapshots },
            data.picks
          )
        : new Map(data.picks.map((p) => [p.id, p])),
    [data.picks, useOfficial, data.officialCard, frozenGamesSgms]
  );

  const blocks = useMemo(
    () =>
      frozenGamesSgms && !roughiesOn
        ? frozenGameSgmBlocks(activeSlate, frozenGamesSgms, preset, picksById)
        : gameSgmBlocks(
            activeSlate,
            data.picks,
            multis,
            picksById,
            preset.min,
            preset.max,
            roughiesOn
          ),
    [activeSlate, data.picks, multis, picksById, preset, roughiesOn, frozenGamesSgms]
  );

  const built = useMemo(() => blocks.filter((b) => b.card), [blocks]);
  const empty = useMemo(() => blocks.filter((b) => !b.card), [blocks]);

  const [emptyOpen, setEmptyOpen] = useState(false);

  const awaitingPrices = slateAwaitingPrices({
    slateDate,
    todayDate,
    picks: data.picks,
    officialSlateDate: data.officialCard?.slateDate,
  });
  const slateFairOnly = !slateHasFeedOdds(data.picks);
  const oddsNote = slateOddsAvailabilityNote(data.meta, data.picks);
  const bandLabel = formatOddsBand(preset.min, preset.max);
  const liveBoardByGame = useMemo(() => {
    const m = new Map<string, LiveGameBoard>();
    for (const g of liveTracking.snapshot?.games ?? []) {
      m.set(g.gameId, g);
    }
    return m;
  }, [liveTracking.snapshot]);

  return (
    <div className="pb-24">
      <DateSwitcher
        todayDate={todayDate}
        viewerTodayYmd={viewerTodayYmd}
        nextSlateDate={tomorrowDate}
        selected={slateDate}
        onSelect={onSlateDateChange}
        viewerTimeZone={viewerTimeZone}
        firstTabLabel={settledTabLabel}
        className="mb-3"
      />
      <TomorrowSlateTease
        index={data.index}
        slateDate={slateDate}
        todayDate={todayDate}
        viewerTodayYmd={viewerTodayYmd}
        viewerTimeZone={viewerTimeZone}
        slateEmpty={!data.slate.length}
        slate={data.slate}
        awaitingPrices={awaitingPrices}
        onIndexRefreshed={onIndexRefreshed}
      />
      <header className="mb-4">
        <h1 className="text-xl font-bold text-white theme-adaptive-title">SGMs</h1>
      </header>
      {awaitingPrices ? (
        <PricesPendingGames
          slate={activeSlate}
          picks={data.picks}
          injuries={badgeInjuries}
          myBookie={myBookie}
          onLegTap={onLegTap}
          reasonsAtTip={data.meta.reasonsAtTip}
        />
      ) : (
        <>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
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
          <button
            type="button"
            onClick={() => setRoughiesOn(!roughiesOn)}
            className={`text-[11px] px-3 py-1.5 rounded-full border ${
              roughiesOn
                ? "border-amber-400/50 text-amber-200"
                : "border-white/20 text-white/55"
            }`}
          >
            Roughies {roughiesOn ? "on" : "off"}
          </button>
        </div>

        {activeSlate.length === 0 && (
          <p className="text-sm text-white/50">No games on this slate yet.</p>
        )}

        {built.map(({ game, card }) => {
          if (!card) return null;
          const multi = gameSgmAsMulti(card, game, data.picks);
          const gameLiveBetView = liveBetView(
            legStatesForMulti(multi, liveTracking.legViews)
          );
          const board = liveBoardByGame.get(game.id);
          const gameOddsAge = formatGameOddsAge(
            data.picks,
            game.id,
            data.meta.oddsLastPulled
          );

          return (
            <div key={game.id} className="mb-4">
              <p className="text-[13px] font-semibold text-white theme-adaptive-title mb-2">
                {gameListRowLabel(game)}
                {board && board.phase !== "scheduled" ? (
                  <span
                    className="text-sky-400/90 font-normal text-[11px] ml-2 tabular-nums"
                    data-testid="games-header-live-score"
                  >
                    {board.statusDetail}
                  </span>
                ) : null}
                {card.roughie && (
                  <span className="text-[10px] font-medium px-1.5 py-px rounded-full bg-amber-500/20 text-amber-200 ml-2 align-middle">
                    Roughie
                  </span>
                )}
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
                injuries={badgeInjuries}
                slate={activeSlate}
                preferredBookie={myBookie}
                fairOnly={slateFairOnly}
                oddsNote={oddsNote}
                hideBookieSelect={slateFairOnly}
                liveCatalog={data.picks}
                bookieStorageScope="games"
                compact
                onLegTap={onLegTap}
                onCopy={onCopy}
                onShareError={onShareError}
                legViews={liveTracking.legViews}
                liveBetView={gameLiveBetView}
                reasonsAtTip={data.meta.reasonsAtTip}
                liveSnapshot={liveTracking.snapshot}
              />
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
        </>
      )}
    </div>
  );
}

const PENDING_LEGS_PER_GAME = 5;

/** Before the 9pm odds pull there are no SGMs to build: show each game's strongest model legs. */
function PricesPendingGames({
  slate,
  picks,
  injuries,
  myBookie,
  onLegTap,
  reasonsAtTip,
}: {
  slate: SlateGame[];
  picks: PickLeg[];
  injuries: InjuryEntry[];
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
  reasonsAtTip?: ReasonAtTipSnapshot[];
}) {
  return (
    <div data-testid="games-prices-pending">
      {slate.map((game) => {
        const legs = picks
          .filter((l) => l.gameId === game.id)
          .sort((a, b) => b.probability - a.probability);
        return (
          <div key={game.id} className="mb-4" data-testid="games-pending-game">
            <p className="text-[13px] font-semibold text-white theme-adaptive-title mb-2">
              {gameListRowLabel(game)}
              <span className="text-white/40 font-normal text-[11px] ml-2">
                {legs.length} model legs · {PRICES_PENDING_LABEL}
              </span>
            </p>
            {legs.length > 0 && (
              <section className={`${ui.card} !p-0 overflow-hidden divide-y divide-white/[0.04]`}>
                {legs.slice(0, PENDING_LEGS_PER_GAME).map((leg) => (
                  <PickLegRow
                    key={leg.id}
                    leg={leg}
                    injuries={injuries}
                    slate={slate}
                    myBookie={myBookie ?? ""}
                    onTap={onLegTap}
                    reasonsAtTip={reasonsAtTip}
                    pricesPending
                  />
                ))}
              </section>
            )}
          </div>
        );
      })}
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