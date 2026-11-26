function formatUnits(units: number): string {
  return `${Number(units.toFixed(2))}u`;
}

/** Multi header: bet type, total, best bookie and a stake chip — nothing else. */
export function MultiCardHeader({
  title,
  total,
  bookie,
  stakeUnits,
}: {
  title: string;
  total?: number;
  bookie?: string;
  stakeUnits?: number;
}) {
  const amount =
    total != null && Number.isFinite(total) ? `$${total.toFixed(2)}` : undefined;

  return (
    <header className="mb-3" data-testid="multi-card-header">
      <p className="text-base leading-snug flex flex-wrap items-baseline gap-x-1">
        <span className="font-semibold text-white theme-adaptive-title">{title}</span>
        {amount ? (
          <>
            <span className="text-white/40 font-normal theme-adaptive-muted">@</span>
            <span className="text-lg font-bold text-price-green tabular-nums">{amount}</span>
          </>
        ) : null}
        {bookie ? (
          <>
            <span className="text-white/35 font-normal theme-adaptive-muted">·</span>
            <span className="text-sm text-white/55 theme-adaptive-muted">{bookie}</span>
          </>
        ) : null}
        {stakeUnits != null && stakeUnits > 0 ? (
          <span
            className="ml-1 self-center text-[10px] font-semibold px-1.5 py-px rounded-full bg-white/10 text-white/70 tabular-nums theme-adaptive-chip"
            data-testid="multi-card-stake"
          >
            {formatUnits(stakeUnits)}
          </span>
        ) : null}
      </p>
    </header>
  );
}
