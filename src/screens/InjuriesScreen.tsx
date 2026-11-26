import type { DataBundle } from "../hooks/useData";
import type { InjuryEntry } from "@lib/types";
import { topBeneficiaryLastNames } from "@lib/injury-beneficiaries";
import { sydneyTimeFromIso } from "../utils/format";
import { useQuestionableSwaps } from "../hooks/useQuestionableSwaps";
import { DateSwitcher } from "../components/DateSwitcher";
import { TomorrowSlateTease } from "../components/TomorrowSlateTease";
import { injuriesForInjuryPanel } from "@lib/injuries-at-tip";

interface Props {
  data: DataBundle;
  slateDate: string;
  todayDate: string;
  tomorrowDate: string | null;
  onSlateDateChange: (d: string) => void;
}

function teamAbbr(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
}

export function InjuriesScreen({
  data,
  slateDate,
  todayDate,
  tomorrowDate,
  onSlateDateChange,
}: Props) {
  const { swapAsOut, reset, isCountedOut } = useQuestionableSwaps();
  const panelInjuries = injuriesForInjuryPanel(
    data.injuries,
    data.meta.injuriesAtTip,
    data.slate,
    new Date()
  );
  const byGame = new Map<string, InjuryEntry[]>();
  for (const inj of panelInjuries) {
    const arr = byGame.get(inj.gameId) ?? [];
    arr.push(inj);
    byGame.set(inj.gameId, arr);
  }

  return (
    <div className="pb-24">
      <DateSwitcher
        todayDate={todayDate}
        tomorrowDate={tomorrowDate}
        selected={slateDate}
        onSelect={onSlateDateChange}
        className="mb-3"
      />
      <TomorrowSlateTease
        index={data.index}
        slateDate={slateDate}
        todayDate={todayDate}
        slateEmpty={!data.slate.length}
      />
      <h1 className="text-xl font-bold mb-4">Injuries</h1>
      {[...byGame.entries()].map(([gameId, list]) => {
        const game = data.slate.find((g) => g.id === gameId);
        const byTeam = new Map<string, InjuryEntry[]>();
        for (const inj of list) {
          const key = inj.teamId || inj.teamName;
          const arr = byTeam.get(key) ?? [];
          arr.push(inj);
          byTeam.set(key, arr);
        }
        const teamBlocks = [...byTeam.entries()].sort((a, b) =>
          a[1][0]!.teamName.localeCompare(b[1][0]!.teamName)
        );
        return (
          <section key={gameId} className="mb-4 bg-card rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white/80 mb-3">
              {game
                ? `${teamAbbr(game.awayTeam)} @ ${teamAbbr(game.homeTeam)}`
                : gameId}
            </h2>
            {teamBlocks.map(([teamKey, teamList]) => (
              <div key={teamKey} className="mb-4 last:mb-0">
                <h3 className="text-xs font-semibold text-white/55 mb-2 uppercase tracking-wide">
                  {teamList[0]?.teamName ?? teamKey}
                </h3>
                {teamList.map((inj) => (
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
              </div>
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
        {inj.source} · {sydneyTimeFromIso(inj.updatedAt)}
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