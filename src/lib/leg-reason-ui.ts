/** Injury vs matchup / form copy (UI only). */
export function legReasonLineUi(reasonLine: string): {
  className: string;
  prefix: string;
} {
  if (/^role risk:/i.test(reasonLine)) {
    return {
      className:
        "text-xs text-amber-400/70 font-medium leading-snug break-words",
      prefix: "",
    };
  }
  const injury = /out →|only big left|without .+ →|missing \d+ big/i.test(
    reasonLine
  );
  return injury
    ? {
        className: "text-xs text-reason-injury font-medium leading-snug break-words",
        prefix: "⚡ ",
      }
    : {
        className: "text-xs text-reason-matchup font-medium leading-snug break-words",
        prefix: "▸ ",
      };
}