import {
  nextSlateTabLabel,
  todayTabLabel,
} from "@lib/slate-tab-labels";
import { viewerTimeZone } from "@lib/viewer-slate";

interface Props {
  todayDate: string;
  viewerTodayYmd: string;
  nextSlateDate: string | null;
  selected: string;
  onSelect: (date: string) => void;
  viewerTimeZone?: string;
  /** When viewer local day has no slate (settled fallback tab). */
  firstTabLabel?: string | null;
  className?: string;
}

export function DateSwitcher({
  todayDate,
  viewerTodayYmd,
  nextSlateDate,
  selected,
  onSelect,
  viewerTimeZone: tz = viewerTimeZone(),
  firstTabLabel,
  className = "",
}: Props) {
  if (!todayDate) return null;
  if (!nextSlateDate || nextSlateDate === todayDate) return null;

  const opts = [
    {
      date: todayDate,
      label: firstTabLabel ?? todayTabLabel(viewerTodayYmd, tz),
    },
    {
      date: nextSlateDate,
      label: nextSlateTabLabel(nextSlateDate, tz),
    },
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
          data-date={o.date}
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