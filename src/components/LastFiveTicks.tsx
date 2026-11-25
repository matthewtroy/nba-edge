export function LastFiveTicks({
  ticks,
  compact = false,
  hideLabel = false,
}: {
  ticks: ("hit" | "miss" | "na")[];
  compact?: boolean;
  hideLabel?: boolean;
}) {
  if (!ticks.length) return null;
  return (
    <div
      className={`flex items-center gap-1 ${compact ? "text-[10px] text-white/55" : "text-sm text-white/70"}`}
    >
      {!hideLabel && !compact ? (
        <span className="text-xs">Last 5:</span>
      ) : null}
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