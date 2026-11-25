import type { DataBundle } from "../hooks/useData";

interface Props {
  data: DataBundle;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function ResultsScreen({ data }: Props) {
  const results = data.results;
  const legTotal = results?.legs.length ?? 0;

  if (!results || legTotal < 30) {
    return (
      <div className="pb-24">
        <h1 className="text-xl font-bold mb-4">Results</h1>
        <p className="text-sm text-white/60">
          Official track record builds as slates settle — need at least 30 graded
          official legs ({legTotal} so far).
        </p>
      </div>
    );
  }

  const { official, model } = results;
  const { won, lost, void: voided, roi } = official.record;

  return (
    <div className="pb-24 space-y-4">
      <h1 className="text-xl font-bold">Results</h1>

      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">Official W–L · ROI</h2>
        <p className="text-lg tabular-nums">
          {won}–{lost}
          {voided ? ` (${voided} void)` : ""} · ROI {pct(roi)}
        </p>
        <p className="text-xs text-white/50 mt-1">
          Last 14d card legs tracked: {official.last14dLegs}
        </p>
      </section>

      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">By bet type</h2>
        <ul className="text-sm space-y-1">
          {Object.entries(official.byBetType).map(([type, row]) => (
            <li key={type}>
              {type}: {row.won}W {row.lost}L {row.void}V · {row.legs} legs
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">Model buckets</h2>
        <ul className="text-sm space-y-1">
          {model.calibration.map((b) => (
            <li key={b.range}>
              {b.range}: expected {pct(b.expected)}, actual {pct(b.actual)} (n=
              {b.count})
            </li>
          ))}
        </ul>
        {model.valueRoi != null && (
          <p className="text-sm mt-2">Value ROI (unit stake): {pct(model.valueRoi)}</p>
        )}
        {model.brierShadow != null && (
          <p className="text-sm text-white/70">
            Brier (published p): {model.brierShadow.toFixed(3)}
          </p>
        )}
      </section>

      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">Tag hit rates</h2>
        <ul className="text-sm space-y-1">
          {Object.entries(model.tagHitRates).map(([tag, row]) => (
            <li key={tag}>
              {tag}: {row.hits}/{row.total} ({pct(row.hits / Math.max(1, row.total))})
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">Recent legs</h2>
        <ul className="text-sm space-y-2 max-h-64 overflow-y-auto">
          {results.legs.slice(-20).map((leg) => (
            <li key={`${leg.slateDate}-${leg.id}`}>
              {leg.playerName} {leg.market} {leg.line}+ · {leg.result}
              {leg.actualValue != null ? ` (${leg.actualValue})` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}