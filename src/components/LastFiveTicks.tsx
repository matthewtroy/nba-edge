export function LastFiveTicks({
  ticks,
  compact = false,
  hideLabel = false,
  inline = false,
}: {
  ticks: ("hit" | "miss" | "na")[];
  compact?: boolean;
  hideLabel?: boolean;
  inline?: boolean;
}) {
  if (!ticks.length) return null;
  const dot = compact || inline ? "w-1.5 h-1.5 rounded-full" : "w-2 h-2 rounded-full";
  return (
    <span
      className={`inline-flex items-center shrink-0 ${
        compact || inline ? "gap-0.5" : "gap-1"
      }`}
    >
      {!hideLabel && !compact && !inline ? (
        <span className="text-xs text-white/45 mr-1">Last 5:</span>
      ) : null}
      {ticks.map((t, i) => (
        <span
          key={i}
          className={`${dot} ${
            t === "hit"
              ? "bg-price-green"
              : t === "miss"
                ? "bg-red-400"
                : "bg-white/20"
          }`}
          aria-label={t}
        />
      ))}
    </span>
  );
}