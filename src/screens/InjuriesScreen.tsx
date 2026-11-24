import type { DataBundle } from "../hooks/useData";
import type { InjuryEntry } from "@lib/types";
import { sydneyTimeFromIso } from "../utils/format";

interface Props {
  data: DataBundle;
}

export function InjuriesScreen({ data }: Props) {
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
              <InjuryRow key={inj.playerId} inj={inj} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function InjuryRow({ inj }: { inj: InjuryEntry }) {
  const chip =
    inj.status === "Out"
      ? "bg-red-500/20 text-red-300"
      : inj.status === "Doubtful"
        ? "bg-orange-500/20 text-orange-300"
        : "bg-accent-warn/20 text-accent-warn";

  const benefits: string | null = null;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center">
        <span className="font-medium">{inj.playerName}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${chip}`}>{inj.status}</span>
      </div>
      <p className="text-xs text-white/50 mt-1">
        {inj.teamName} · {inj.source} · {sydneyTimeFromIso(inj.updatedAt)}
      </p>
      {benefits && (
        <p className="text-xs text-white/70 mt-1">Who benefits: {benefits}</p>
      )}
    </div>
  );
}
