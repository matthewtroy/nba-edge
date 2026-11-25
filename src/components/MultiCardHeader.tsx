/** One-line multi header: "Main Play @ $8.26" with bookie below. */
export function parseMultiHeadline(headline: string): {
  name: string;
  suffix: string;
  amount: string;
} {
  const fair = /^(.+):\s*Fair\s+(\$[\d.]+)$/i.exec(headline);
  if (fair) {
    return { name: fair[1].trim(), suffix: "", amount: fair[2] };
  }
  const at = headline.indexOf(" @ ");
  if (at < 0) {
    return { name: headline, suffix: "", amount: "" };
  }
  const name = headline.slice(0, at).trim();
  const rest = headline.slice(at + 3).trim();
  const takeMatch = /^take\s+(\$[\d.]+)$/i.exec(rest);
  if (takeMatch) {
    return { name, suffix: "take", amount: takeMatch[1] };
  }
  if (rest.startsWith("$")) {
    return { name, suffix: "", amount: rest };
  }
  return { name, suffix: "", amount: rest };
}

export function MultiCardHeader({
  headline,
  bookie,
  publishedAt,
  lockedBookie,
  onRemove,
}: {
  headline: string;
  bookie?: string;
  publishedAt?: string;
  lockedBookie?: string;
  onRemove?: () => void;
}) {
  const { name, suffix, amount } = parseMultiHeadline(headline);

  return (
    <header className="mb-3">
      <p className="text-base leading-snug flex flex-wrap items-baseline gap-x-1">
        <span className="font-semibold text-white theme-adaptive-title">{name}</span>
        <span className="text-white/40 font-normal">@</span>
        {suffix === "take" ? (
          <>
            <span className="text-white/45 font-normal lowercase">take</span>
            <span className="text-lg font-bold text-price-green tabular-nums">
              {amount}
            </span>
          </>
        ) : amount ? (
          <span className="text-lg font-bold text-price-green tabular-nums">
            {amount}
          </span>
        ) : null}
      </p>
      {bookie ? (
        <p className="text-xs text-white/45 theme-adaptive-muted mt-1">{bookie}</p>
      ) : null}
      {publishedAt && lockedBookie && (
        <p className="text-[11px] text-white/40 mt-1">
          Published{" "}
          {new Date(publishedAt).toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
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