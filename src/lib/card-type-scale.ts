/** Premium calm card tokens (390px-first). */
export const ui = {
  card: "theme-adaptive-card bg-card rounded-card border border-white/[0.06] p-4 mb-3",
  divider: "border-white/[0.05]",
  headerTitle: "text-base font-semibold text-white theme-adaptive-title leading-snug",
  headerTotal: "text-[22px] font-bold text-price-green tabular-nums leading-none",
  headerBookie: "text-xs text-white/45 theme-adaptive-muted leading-tight mt-1",
  legTitle: "text-sm font-medium text-white theme-adaptive-title leading-snug",
  legPrice: "text-lg font-bold text-price-green tabular-nums leading-tight",
  legFair: "text-[11px] text-white/45 theme-adaptive-muted tabular-nums",
  badge:
    "text-[10px] px-1 py-px rounded-full bg-white/[0.08] text-white/65 border-0 leading-tight",
  badgeDanger:
    "text-[10px] px-1 py-px rounded-full bg-white/[0.08] text-red-400 leading-tight",
  copyBtn:
    "w-full py-3 text-sm text-white/70 border-t border-white/[0.05] hover:bg-white/[0.03] transition-colors",
  chip:
    "text-[10px] px-2.5 py-1 rounded-full bg-white/[0.08] text-white/70 border-0",
  chipOn: "ring-1 ring-white/20 bg-white/[0.12] text-white",
  chipOff: "opacity-60",
  chipExcluded: "opacity-40",
} as const;