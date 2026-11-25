import { displayTicksChronological } from "@lib/form-ticks";

export function LastFiveTicks({
  ticks,
  compact = false,
  hideLabel = false,
  inline = false,
  past5Label = false,
}: {
  ticks: ("hit" | "miss" | "na")[];
  compact?: boolean;
  hideLabel?: boolean;
  inline?: boolean;
  /** Show "Past 5" label on leg rows (meta row). */
  past5Label?: boolean;
}) {
  if (!ticks.length) return null;
  const ordered = displayTicksChronological(ticks);
  const dot = compact || inline ? "w-1.5 h-1.5 rounded-full" : "w-2 h-2 rounded-full";
  return (
    <span
      className={`inline-flex items-center shrink-0 ${
        compact || inline ? "gap-0.5" : "gap-1"
      }`}
    >
      {(past5Label || (!hideLabel && !compact && !inline)) && (
        <span className="text-[10px] text-white/45 mr-0.5">
          {past5Label ? "Past 5" : "Last 5:"}
        </span>
      )}
      {ordered.map((t, i) => (
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