import type { DataBundle } from "../hooks/useData";
import type { InjuryEntry } from "@lib/types";
import { topBeneficiaryLastNames } from "@lib/injury-beneficiaries";
import { sydneyTimeFromIso } from "../utils/format";
import { useQuestionableSwaps } from "../hooks/useQuestionableSwaps";

interface Props {
  data: DataBundle;
}

export function InjuriesScreen({ data }: Props) {
  const { swapAsOut, reset, isCountedOut } = useQuestionableSwaps();
  const byGame = new Map<string, InjuryEntry[]>();
  for (const inj of data.injuries) {
    const arr = byGame.get(inj.gameId) ?? [];
    arr.push(inj);
    byGame.set(inj.gameId, arr);
  }

  return (
    <div className="pb-24">
      <h1 className="text-xl font-bold mb-4">Injuries</h1>
      {[...byGame.entries()].map(([gameId, list]) => {
        const game = data.slate.find((g) => g.id === gameId);
        return (
          <section key={gameId} className="mb-4 bg-card rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white/80 mb-3">
              {game
                ? `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`
                : gameId}
            </h2>
            {list.map((inj) => (
              <InjuryRow
                key={inj.playerId}
                inj={inj}
                picks={data.picks}
                countedOut={
                  inj.status === "Questionable" && isCountedOut(inj.playerId)
                }
                onSwap={
                  inj.status === "Questionable"
                    ? () => swapAsOut(inj.playerId)
                    : undefined
                }
                onReset={
                  inj.status === "Questionable"
                    ? () => reset(inj.playerId)
                    : undefined
                }
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function InjuryRow({
  inj,
  picks,
  countedOut,
  onSwap,
  onReset,
}: {
  inj: InjuryEntry;
  picks: DataBundle["picks"];
  countedOut: boolean;
  onSwap?: () => void;
  onReset?: () => void;
}) {
  const chip =
    inj.status === "Out"
      ? "bg-red-500/20 text-red-300"
      : inj.status === "Doubtful"
        ? "bg-orange-500/20 text-orange-300"
        : "bg-accent-warn/20 text-accent-warn";

  const showBenefits =
    inj.status === "Out" ||
    inj.status === "Doubtful" ||
    (inj.status === "Questionable" && countedOut);

  const benefits = showBenefits
    ? topBeneficiaryLastNames(inj, picks).join(", ")
    : null;

  return (
    <div className="mb-3 pb-3 border-b border-white/5 last:border-0">
      <div className="flex justify-between items-center gap-2">
        <span className="font-medium">{inj.playerName}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${chip}`}>
          {countedOut ? "Counted as out" : inj.status}
        </span>
      </div>
      <p className="text-xs text-white/50 mt-1">
        {inj.teamName} · {inj.source} · {sydneyTimeFromIso(inj.updatedAt)}
      </p>
      {benefits && (
        <p className="text-xs text-white/70 mt-1">Who benefits: {benefits || "—"}</p>
      )}
      {inj.status === "Questionable" && (
        <div className="flex gap-2 mt-2">
          {!countedOut && onSwap && (
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10"
              onClick={onSwap}
            >
              Swap — count as out
            </button>
          )}
          {countedOut && onReset && (
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10"
              onClick={onReset}
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}