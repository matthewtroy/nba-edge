import { weekdayShort } from "../hooks/useSlateDate";
import { calendarTomorrowYmd, viewerTimeZone } from "@lib/viewer-slate";

interface Props {
  todayDate: string;
  tomorrowDate: string | null;
  selected: string;
  onSelect: (date: string) => void;
  viewerTimeZone?: string;
  className?: string;
}

export function DateSwitcher({
  todayDate,
  tomorrowDate,
  selected,
  onSelect,
  viewerTimeZone: tz = viewerTimeZone(),
  className = "",
}: Props) {
  if (!todayDate) return null;
  const tomorrow =
    tomorrowDate && tomorrowDate !== todayDate
      ? tomorrowDate
      : calendarTomorrowYmd(todayDate, tz);
  const opts = [
    { date: todayDate, label: `Today (${weekdayShort(todayDate, tz)})` },
    { date: tomorrow, label: `Tomorrow (${weekdayShort(tomorrow, tz)})` },
  ];
  return (
    <div
      className={`flex rounded-lg border border-white/15 overflow-hidden ${className}`.trim()}
      data-testid="date-switcher"
      role="tablist"
      aria-label="Slate date"
    >
      {opts.map((o) => (
        <button
          key={o.date}
          type="button"
          role="tab"
          aria-selected={selected === o.date}
          onClick={() => onSelect(o.date)}
          className={`flex-1 py-2 text-xs sm:text-sm font-medium ${
            selected === o.date
              ? "bg-white/[0.12] text-white"
              : "text-white/65"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}