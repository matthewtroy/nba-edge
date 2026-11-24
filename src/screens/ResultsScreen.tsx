import type { DataBundle } from "../hooks/useData";

interface Props {
  data: DataBundle;
}

export function ResultsScreen({ data }: Props) {
  const recentLegs = data.history.legs.filter((l) => l.result);
  const mainHits = recentLegs.filter((l) => l.result === "hit").length;
  const mainTotal = recentLegs.length || 1;

  return (
    <div className="pb-24">
      <h1 className="text-xl font-bold mb-4">Results</h1>
      <section className="bg-card rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2">Yesterday</h2>
        {data.history.multis.length === 0 ? (
          <p className="text-sm text-white/60">No graded multis yet.</p>
        ) : (
          data.history.multis.slice(-3).map((m) => (
            <p key={m.id} className="text-sm mb-2">
              {m.type} {m.result === "hit" ? "✅" : m.result === "miss" ? "❌" : "➖"}
            </p>
          ))
        )}
      </section>
      <section className="bg-card rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2">Hit rates (sample)</h2>
        <p className="text-sm">Last 7d Main / Q1 / Longshot: tracking via history.json</p>
        <p className="text-sm mt-2">
          Graded legs: {mainHits}/{mainTotal} ({((mainHits / mainTotal) * 100).toFixed(0)}%)
        </p>
      </section>
      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">Calibration</h2>
        <ul className="text-sm space-y-2">
          {data.history.calibration.map((b) => (
            <li key={b.range}>
              {b.range}: expected {(b.expected * 100).toFixed(0)}%, actual{" "}
              {(b.actual * 100).toFixed(0)}% (n={b.count})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}