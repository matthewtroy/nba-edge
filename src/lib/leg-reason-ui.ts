/** Injury / redistribution vs matchup / form styling on reason copy. */
export function legReasonLineUi(reasonLine: string): {
  className: string;
  prefix: string;
} {
  const injury = /out →|only big left|opponent missing|missing \d+ big/i.test(
    reasonLine
  );
  return injury
    ? { className: "text-sm text-amber-400/95 font-medium", prefix: "⚡ " }
    : { className: "text-sm text-green-400/90 font-medium", prefix: "↗ " };
}