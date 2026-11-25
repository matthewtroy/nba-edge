import type { ShareBetslipLayout } from "@lib/share-betslip-layout";
import { InjuryStatusBadge } from "./InjuryStatusBadge";

function SettleMarkIcon({ mark }: { mark?: string }) {
  if (mark === "won") {
    return <span className="text-price-green text-sm font-bold leading-none">✓</span>;
  }
  if (mark === "lost") {
    return <span className="text-red-400 text-sm font-bold leading-none">✕</span>;
  }
  if (mark === "pending") {
    return <span className="text-white/35 text-xs leading-none">⋯</span>;
  }
  return <span className="w-3.5" aria-hidden />;
}

/** Off-screen multi card PNG — matches app dark card, not a screen grab. */
export function ShareBetslipCard({ layout }: { layout: ShareBetslipLayout }) {
  return (
    <div
      data-testid="share-betslip-card"
      className="bg-card text-white font-sans box-border border border-white/[0.06]"
      style={{ width: layout.width, minHeight: layout.height }}
    >
      <header className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <p className="text-base font-semibold leading-snug">
          <span>{layout.cardTitle}</span>
          <span className="text-white/40 font-normal"> @ </span>
          <span className="text-lg font-bold text-price-green tabular-nums">
            {layout.totalText}
          </span>
          {layout.bookie ? (
            <>
              <span className="text-white/35 font-normal"> · </span>
              <span className="text-sm text-white/55">{layout.bookie}</span>
            </>
          ) : null}
        </p>
      </header>

      <div className="px-4 py-1">
        {layout.groups.map((group) => (
          <div key={group.gameKey}>
            {layout.groups.length > 1 && group.gameLabel ? (
              <p className="text-[11px] font-medium text-white/45 py-2">{group.gameLabel}</p>
            ) : null}
            {group.legs.map((leg, li) => (
              <div key={leg.key}>
                {li > 0 ? <div className="h-px bg-white/[0.05]" /> : null}
                <div className="grid grid-cols-[32px_1fr_auto] gap-2.5 py-2.5 items-start">
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-8 h-8 rounded-full bg-page border border-white/[0.08] inline-flex items-center justify-center text-[10px] font-semibold text-white/70">
                      {leg.initials}
                    </span>
                    <SettleMarkIcon mark={leg.settleMark} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug break-words">
                      {leg.playerName}{" "}
                      <span className="text-white/75">{leg.marketLine}</span>
                    </p>
                    {leg.matchup ? (
                      <p className="text-[11px] text-white/40 truncate mt-0.5">{leg.matchup}</p>
                    ) : null}
                    {leg.gameHint ? (
                      <p className="text-[10px] text-white/35 mt-0.5">{leg.gameHint}</p>
                    ) : null}
                    <div className="mt-1">
                      <InjuryStatusBadge status={leg.injuryStatus} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-price-green tabular-nums leading-tight">
                      {leg.priceText}
                    </p>
                    <p className="text-[11px] text-white/45 tabular-nums mt-0.5">{leg.fairText}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <footer className="px-4 py-3 border-t border-white/[0.06] flex justify-between items-center">
        <span className="text-[11px] font-semibold tracking-wide text-white/45 uppercase">
          NBA Edge
        </span>
        <span className="text-xs text-white/35 tabular-nums">{layout.legCount} legs</span>
      </footer>
    </div>
  );
}