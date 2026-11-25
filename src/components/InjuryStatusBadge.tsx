import type { InjuryStatus } from "@lib/types";
export { injuryStatusForPlayer } from "@lib/injury-display";

const SHOW: Set<InjuryStatus> = new Set(["Questionable", "Doubtful"]);

export function InjuryStatusBadge({ status }: { status?: InjuryStatus }) {
  if (!status || !SHOW.has(status)) return null;
  const orange = status === "Questionable";
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
        orange ? "bg-orange-500/20 text-orange-300" : "bg-red-500/20 text-red-300"
      }`}
    >
      {status}
    </span>
  );
}