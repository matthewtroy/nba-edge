/** Injury vs matchup / form copy (UI only). */
export function legReasonLineUi(reasonLine: string): {
  className: string;
  prefix: string;
} {
  const injury = /out →|only big left|opponent missing|missing \d+ big/i.test(
    reasonLine
  );
  return injury
    ? {
        className: "text-xs text-reason-injury font-medium leading-snug break-words",
        prefix: "⚡ ",
      }
    : {
        className: "text-xs text-reason-matchup font-medium leading-snug break-words",
        prefix: "",
      };
}