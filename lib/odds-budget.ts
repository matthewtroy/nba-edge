/** Pure odds credit budgeting (no I/O). */

export interface OddsBudgetConfig {
  monthlyLimit: number;
  resetDay: number;
  pretipPull: boolean;
  creditsRemaining?: number;
  creditsUsedThisMonth?: number;
}

export interface AllowanceResult {
  allowance: number;
  pullsLeft: number;
  reserve: number;
  spendable: number;
}

export function sydneyYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

function sydneyMonthYear(d: Date): { y: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  return {
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
  };
}

/** Calendar days until the next reset_day (inclusive of today's slot if before 9pm). */
export function daysUntilReset(now: Date, resetDay: number): number {
  const { y, m } = sydneyMonthYear(now);
  const day = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      day: "numeric",
    }).format(now)
  );
  let targetY = y;
  let targetM = m;
  if (day >= resetDay) {
    targetM += 1;
    if (targetM > 12) {
      targetM = 1;
      targetY += 1;
    }
  }
  const resetDate = new Date(
    Date.UTC(targetY, targetM - 1, resetDay, 12, 0, 0)
  );
  const todayNoon = new Date(sydneyYmd(now) + "T12:00:00Z");
  const diffMs = resetDate.getTime() - todayNoon.getTime();
  return Math.max(1, Math.ceil(diffMs / 86400000));
}

export function pullsLeftBeforeReset(now: Date, config: OddsBudgetConfig): number {
  const days = daysUntilReset(now, config.resetDay);
  const perDay = config.pretipPull ? 2 : 1;
  return days * perDay;
}

export function computeAllowance(
  now: Date,
  config: OddsBudgetConfig
): AllowanceResult {
  const remaining =
    config.creditsRemaining ??
    Math.max(0, config.monthlyLimit - (config.creditsUsedThisMonth ?? 0));
  const reserve = config.monthlyLimit * 0.2;
  const spendable = Math.max(0, remaining - reserve);
  const pullsLeft = pullsLeftBeforeReset(now, config);
  const allowance =
    pullsLeft > 0 ? Math.floor(spendable / pullsLeft) : spendable;
  return { allowance, pullsLeft, reserve, spendable };
}

/** Select top-ranked games until per-pull game budget (excludes list-events credit). */
export function selectGamesForAllowance<T extends { gameId: string }>(
  ranked: T[],
  allowanceCredits: number,
  listEventCost = 1
): T[] {
  const budget = Math.max(0, allowanceCredits - listEventCost);
  if (budget <= 0) return [];
  return ranked.slice(0, budget);
}

export function shouldPauseForReserve(
  creditsRemaining: number | undefined,
  monthlyLimit: number
): boolean {
  if (creditsRemaining === undefined) return false;
  return creditsRemaining < monthlyLimit * 0.2;
}