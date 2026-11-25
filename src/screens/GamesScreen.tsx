import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { gameSgmBlocks } from "@lib/games-sgm";
import { marketLabel } from "@lib/market-label";
import { displayTagsForBookie } from "@lib/value-at-bookie";
import { legOddsDisplayLine } from "@lib/multi-combined";
import { hasValueAtBookie } from "@lib/value-at-bookie";
import { sydneyDateString } from "@lib/official-card-time";

const PRESETS: { label: string; min: number; max: number }[] = [
  { label: "4–10", min: 4, max: 10 },
  { label: "7–15", min: 7, max: 15 },
  { label: "10–30", min: 10, max: 30 },
];

interface Props {
  data: DataBundle;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
}

export function GamesScreen({ data, myBookie = "bet365", onLegTap }: Props) {
  const [preset, setPreset] = useState(PRESETS[0]);
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
        SGM fair presets · Value @ {myBookie}: {valueCount}
      </p>
      <div className="flex gap-2 mb-4">
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
            Fair {p.label}
          </button>
        ))}
      </div>

      {blocks.map(({ game, card, crossGameLegs, boostLegs }) => {
        const short = `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;
        if (!card) {
          return (
            <p key={game.id} className="text-sm text-white/50 mb-3">
              {short}: no 3-leg SGM in fair {preset.min}–{preset.max}
            </p>
          );
        }
        const headline =
          card.bestTotal != null
            ? `${short} SGM @ $${card.bestTotal.toFixed(2)}`
            : `${short} SGM @ take at $${card.takeAt.toFixed(2)}+`;
        const sub =
          card.bestBookie && card.bestTotal != null
            ? `${card.bestBookie} · take at $${card.takeAt.toFixed(2)}+ (fair $${card.fair.toFixed(2)})`
            : "No single bookie prices every leg: check bet365";

        return (
          <section
            key={game.id}
            className="bg-card rounded-xl border border-white/10 mb-3 overflow-hidden"
          >
            <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
              <h2 className="font-semibold text-lg">{headline}</h2>
              <p className="text-sm text-white/70 mt-0.5">{sub}</p>
              <p className="text-xs text-white/50 mt-1">
                {game.startTimeSydney} · Guide: bet365 SGM · fair {preset.min}–{preset.max}
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
              {card.legs.map((leg) => (
                <button
                  key={leg.id}
                  type="button"
                  onClick={() => onLegTap(leg)}
                  className="w-full py-3 px-1 text-left active:bg-white/5"
                >
                  <div className="font-medium text-sm">
                    {leg.playerName} {marketLabel(leg.market, leg.line)}
                  </div>
                  <div className="text-xs text-white/70 mt-1">
                    {legOddsDisplayLine(leg, myBookie)}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {displayTagsForBookie(leg, myBookie).map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}