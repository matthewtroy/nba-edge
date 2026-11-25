import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { gameSgmBlocks } from "@lib/games-sgm";
import { marketLabel } from "@lib/market-label";
import { displayTagsForBookie } from "@lib/value-at-bookie";
import { legPriceAtCardBookie } from "@lib/leg-card-odds";
import { hasValueAtBookie } from "@lib/value-at-bookie";
import { sydneyDateString } from "@lib/official-card-time";
import { LastFiveTicks } from "../components/LastFiveTicks";

const PRESETS: { label: string; min: number; max: number }[] = [
  { label: "1.5–4", min: 1.5, max: 4 },
  { label: "3–6", min: 3, max: 6 },
  { label: "4–10", min: 4, max: 10 },
  { label: "10–20", min: 10, max: 20 },
  { label: "20–50", min: 20, max: 50 },
];

interface Props {
  data: DataBundle;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
}

export function GamesScreen({ data, myBookie = "Sportsbet", onLegTap }: Props) {
  const [preset, setPreset] = useState(PRESETS[2]);
  const today = sydneyDateString(new Date());
  const useOfficial =
    data.officialCard != null && data.officialCard.slateDate === today;
  const multis = useOfficial ? data.officialCard!.multis : data.multis;
  const picksById = useMemo(
    () => new Map(data.picks.map((p) => [p.id, p])),
    [data.picks]
  );

  const blocks = useMemo(
    () =>
      gameSgmBlocks(
        data.slate,
        data.picks,
        multis,
        picksById,
        preset.min,
        preset.max
      ),
    [data.slate, data.picks, multis, picksById, preset]
  );

  const valueCount = data.picks.filter((l) => hasValueAtBookie(l, myBookie)).length;

  return (
    <div className="pb-24">
      <h1 className="text-xl font-bold mb-1">Games</h1>
      <p className="text-sm text-white/70 mb-3">
        SGM by bookie total · Value @ {myBookie}: {valueCount}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPreset(p)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              preset.label === p.label
                ? "border-accent-high text-accent-high"
                : "border-white/20"
            }`}
          >
            ${p.label}
          </button>
        ))}
      </div>

      {blocks.map(({ game, card, crossGameLegs, boostLegs }) => {
        const short = `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;
        if (!card) {
          return (
            <p key={game.id} className="text-sm text-white/50 mb-3">
              {short}: no 3-leg SGM with one AU bookie in ${preset.min.toFixed(1)}–
              {preset.max}
            </p>
          );
        }
        const headline = `${short} SGM @ $${card.bestTotal.toFixed(2)}`;
        const sub = `${card.bestBookie} · Fair $${card.fair.toFixed(2)}`;

        return (
          <section
            key={game.id}
            className="bg-card rounded-xl border border-white/10 mb-3 overflow-hidden"
          >
            <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
              <h2 className="font-semibold text-lg">{headline}</h2>
              <p className="text-sm text-white/70 mt-0.5">{sub}</p>
              <p className="text-xs text-white/50 mt-1">
                {game.startTimeSydney} · Bookie total ${preset.label}
              </p>
              {crossGameLegs.length > 0 && (
                <p className="text-xs text-accent-value mt-1">
                  On Cross-Game card ({crossGameLegs.length} leg
                  {crossGameLegs.length > 1 ? "s" : ""})
                </p>
              )}
              {boostLegs.length > 0 && (
                <p className="text-xs text-accent-high mt-0.5">On Boost SGM</p>
              )}
            </header>
            <div className="px-2 divide-y divide-white/5">
              {card.legs.map((leg) => {
                const price = legPriceAtCardBookie(leg, card.bestBookie);
                return (
                  <button
                    key={leg.id}
                    type="button"
                    onClick={() => onLegTap(leg)}
                    className="w-full py-3 px-1 text-left active:bg-white/5 flex gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {leg.playerName} {marketLabel(leg.market, leg.line)}
                      </div>
                      <LastFiveTicks ticks={leg.recentVsLine ?? []} compact />
                      <div className="flex gap-1 mt-1">
                        {displayTagsForBookie(leg, myBookie).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-white/10"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {price != null && (
                        <div className="text-lg font-semibold text-green-400">
                          ${price.toFixed(2)}
                        </div>
                      )}
                      <div className="text-xs text-white/70">{card.bestBookie}</div>
                      <div className="text-xs text-white/55">
                        Fair ${leg.fairPrice.toFixed(2)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}