/** Multi header: "Main Play @ $7.14 · Ladbrokes" with optional published / best lines. */
export function MultiCardHeader({
  title,
  total,
  bookie,
  bestBookie,
  bestTotal,
  onSelectBest,
  publishedBookie,
  publishedTotal,
  publishedAt,
  republishedAt,
  onRemove,
  fairOnly,
  fairNote,
}: {
  title: string;
  total?: number;
  bookie?: string;
  bestBookie?: string;
  bestTotal?: number;
  onSelectBest?: () => void;
  publishedBookie?: string;
  publishedTotal?: number;
  publishedAt?: string;
  republishedAt?: string;
  onRemove?: () => void;
  fairOnly?: boolean;
  fairNote?: string;
}) {
  const amount =
    total != null && Number.isFinite(total) ? `$${total.toFixed(2)}` : undefined;

  return (
    <header className="mb-3">
      <p className="text-base leading-snug flex flex-wrap items-baseline gap-x-1">
        <span className="font-semibold text-white theme-adaptive-title">{title}</span>
        {!fairOnly && amount ? (
          <>
            <span className="text-white/40 font-normal">@</span>
            <span className="text-lg font-bold text-price-green tabular-nums">
              {amount}
            </span>
            {bookie ? (
              <>
                <span className="text-white/35 font-normal">·</span>
                <span className="text-sm text-white/55 theme-adaptive-muted">
                  {bookie}
                </span>
              </>
            ) : null}
          </>
        ) : fairOnly && fairNote ? (
          <span className="text-sm text-white/55 ml-1">{fairNote}</span>
        ) : null}
      </p>

      {bestBookie &&
        bestTotal != null &&
        bookie &&
        bestBookie !== bookie &&
        bestTotal > (total ?? 0) &&
        onSelectBest && (
          <button
            type="button"
            className="text-[11px] text-white/50 mt-1 w-full text-left"
            onClick={onSelectBest}
          >
            Best: {bestBookie} ${bestTotal.toFixed(2)}
          </button>
        )}

      {publishedBookie && publishedTotal != null && (
        <p className="text-[11px] text-white/40 mt-1">
          Published @ ${publishedTotal.toFixed(2)} {publishedBookie}
          {publishedAt
            ? ` · ${new Date(publishedAt).toLocaleString("en-AU", {
                timeZone: "Australia/Sydney",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}`
            : null}
          {republishedAt
            ? ` · Republished ${new Date(republishedAt).toLocaleString("en-AU", {
                timeZone: "Australia/Sydney",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}`
            : null}
        </p>
      )}

      {onRemove && (
        <button
          type="button"
          className="text-[11px] text-white/40 mt-1"
          onClick={onRemove}
        >
          Remove
        </button>
      )}
    </header>
  );
}