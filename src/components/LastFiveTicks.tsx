export function LastFiveTicks({
  ticks,
  compact = false,
}: {
  ticks: ("hit" | "miss" | "na")[];
  compact?: boolean;
}) {
  if (!ticks.length) return null;
  return (
    <div
      className={`flex items-center gap-2 ${compact ? "text-[10px] text-white/55" : "text-sm text-white/70"}`}
    >
      <span className={compact ? "" : "text-xs"}>Last 5:</span>
      <div className="flex gap-0.5">
        {ticks.map((t, i) => (
          <span
            key={i}
            className={
              t === "hit"
                ? "text-green-400"
                : t === "miss"
                  ? "text-red-400"
                  : "text-white/30"
            }
            aria-label={t}
          >
            {t === "hit" ? "✓" : t === "miss" ? "✗" : "·"}
          </span>
        ))}
      </div>
    </div>
  );
}