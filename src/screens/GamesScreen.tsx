import { useMemo } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { gameSgmBlocks } from "@lib/games-sgm";
import { marketLabel } from "@lib/market-label";
import { displayTagsForBookie } from "@lib/value-at-bookie";
import { hasValueAtBookie } from "@lib/value-at-bookie";
import { legPriceAtBookie } from "@lib/single-bookie";
import { sydneyDateString } from "@lib/official-card-time";

interface Props {
  data: DataBundle;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
}

export function GamesScreen({ data, myBookie = "bet365", onLegTap }: Props) {
  const today = sydneyDateString(new Date());
  const useOfficial =
    data.officialCard != null && data.officialCard.slateDate === today;
  const multis = useOfficial ? data.officialCard!.multis : data.multis;
  const picksById = useMemo(
    () => new Map(data.picks.map((p) => [p.id, p])),
    [data.picks]
  );

  const blocks = useMemo(
    () => gameSgmBlocks(data.slate, data.picks, multis, picksById),
    [data.slate, data.picks, multis, picksById]
  );

  const valueCount = data.picks.filter((l) => hasValueAtBookie(l, myBookie)).length;

  return (
    <div className="pb-24">
      <h1 className="text-xl font-bold mb-1">Games</h1>
      <p className="text-sm text-white/70 mb-4">
        SGM main lines · Value @ {myBookie}: {valueCount}
      </p>

      {blocks.map(({ game, sgmLegs, crossGameLegs, boostLegs }) => {
        const title = `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;
        return (
          <section
            key={game.id}
            className="bg-card rounded-xl border border-white/10 mb-3 overflow-hidden"
          >
            <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
              <h2 className="font-semibold">{title}</h2>
              <p className="text-xs text-white/55 mt-0.5">
                {game.startTimeSydney} · {sgmLegs.length} SGM lines
              </p>
              {crossGameLegs.length > 0 && (
                <p className="text-xs text-accent-value mt-1">
                  Cross-Game: {crossGameLegs.length} leg
                  {crossGameLegs.length !== 1 ? "s" : ""}
                </p>
              )}
              {boostLegs.length > 0 && (
                <p className="text-xs text-accent-high mt-0.5">
                  Boost SGM: {boostLegs.map((l) => l.playerName.split(" ").pop()).join(", ")}
                </p>
              )}
            </header>
            <div className="px-2 divide-y divide-white/5">
              {sgmLegs.length === 0 ? (
                <p className="text-sm text-white/50 py-3 px-2">No starter main lines for SGM</p>
              ) : (
                sgmLegs.slice(0, 12).map((leg) => {
                  const tags = displayTagsForBookie(leg, myBookie);
                  const at = legPriceAtBookie(leg, myBookie);
                  return (
                    <button
                      key={leg.id}
                      type="button"
                      onClick={() => onLegTap(leg)}
                      className="w-full flex items-start gap-3 py-3 text-left px-1 active:bg-white/5"
                    >
                      <img
                        src={leg.headshotUrl}
                        alt=""
                        className="w-9 h-9 rounded-full bg-surface object-cover shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="flex-1 min-w-0 text-sm">
                        <div className="font-medium leading-snug">
                          {leg.playerName} {marketLabel(leg.market, leg.line)}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.map((t) => (
                            <span
                              key={t}
                              className={`text-[10px] px-2 py-0.5 rounded-full ${
                                t === "Value"
                                  ? "bg-accent-value/20 text-accent-value"
                                  : "bg-accent-high/20 text-accent-high"
                              }`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right text-xs shrink-0">
                        <div>${leg.takeAt.toFixed(2)}+</div>
                        {at != null ? (
                          <div className="text-accent-value">{myBookie} ${at.toFixed(2)}+</div>
                        ) : (
                          <div className="text-white/45">—</div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}