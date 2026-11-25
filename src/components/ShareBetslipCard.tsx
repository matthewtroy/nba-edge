import type { ShareBetslipLayout } from "@lib/share-betslip-layout";

function SettleMarkIcon({ mark }: { mark?: string }) {
  if (mark === "won") {
    return <span className="text-emerald-400 text-sm font-bold">✓</span>;
  }
  if (mark === "lost") {
    return <span className="text-red-400 text-sm font-bold">✕</span>;
  }
  if (mark === "pending") {
    return <span className="text-white/35 text-xs">⋯</span>;
  }
  return null;
}

/** Off-screen bet365-style slip for PNG export (not a screen screenshot). */
export function ShareBetslipCard({ layout }: { layout: ShareBetslipLayout }) {
  return (
    <div
      data-testid="share-betslip-card"
      className="bg-[#0b4d2a] text-white font-sans box-border"
      style={{ width: layout.width, minHeight: layout.height }}
    >
      <header className="px-4 pt-4 pb-3 border-b border-white/10 bg-[#126b3a]">
        <p className="text-[11px] uppercase tracking-widest text-white/70">Same Game Multi</p>
        <p className="text-lg font-semibold leading-tight mt-0.5">{layout.cardTitle}</p>
        {layout.bookie ? (
          <p className="text-xs text-white/60 mt-1">{layout.bookie}</p>
        ) : null}
      </header>

      <div className="px-4 py-2 bg-[#0b4d2a]">
        {layout.groups.map((group, gi) => (
          <div key={group.gameKey}>
            {layout.groups.length > 1 && group.gameLabel ? (
              <p className="text-[11px] font-semibold text-[#7fd99a] py-2">{group.gameLabel}</p>
            ) : null}
            {group.legs.map((leg, li) => (
              <div key={leg.key}>
                {li > 0 || gi > 0 ? <div className="h-px bg-white/10" /> : null}
                <div className="flex items-start gap-2 py-3">
                  <div className="w-5 shrink-0 pt-0.5">
                    <SettleMarkIcon mark={leg.settleMark} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug break-words">{leg.playerLine}</p>
                    {leg.gameHint ? (
                      <p className="text-[10px] text-white/50 mt-0.5">{leg.gameHint}</p>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0 text-[#c6f29d]">
                    {leg.priceText}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <footer className="px-4 py-4 border-t border-white/15 bg-[#084025]">
        <div className="flex justify-between items-baseline">
          <span className="text-xs uppercase tracking-wide text-white/60">Multi odds</span>
          <span className="text-xl font-bold tabular-nums">{layout.totalText}</span>
        </div>
      </footer>
    </div>
  );
}