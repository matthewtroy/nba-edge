import type { InjuryEntry, MultiBet, PickLeg, SlateGame } from "@lib/types";
import { FEED_BOOKIES, isFeedBookie } from "@lib/card-bookie";
import { MultiLegRow } from "./MultiLegRow";
import { renderMultiCardCopyText } from "@lib/multi-card-text";
import { useMultiBookieSelect } from "../hooks/useMultiBookieSelect";
import { multiCardTitle } from "@lib/multi-combined";

interface Props {
  multi: MultiBet;
  picksById: Map<string, PickLeg>;
  injuries: InjuryEntry[];
  slate?: SlateGame[];
  preferredBookie?: string;
  lockedBookie?: string;
  publishedAt?: string;
  discordCopy?: boolean;
  onRemove?: () => void;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (text: string) => void;
}

export const FORBIDDEN_MULTI_CARD_STRINGS = [
  "~1 in",
  "Stake",
  "My (",
  "legs @",
  "Bookie:",
  "Best mix",
  "Copy betslip",
  "Small slate",
  "cross-book",
  "Best across books",
  "Best multi odds",
  "once",
] as const;

export function multiCardPlainText(multi: MultiBet, legs: PickLeg[] = []): string {
  return legs.length ? renderMultiCardCopyText(multi, legs) : multi.label;
}

export function MultiCard({
  multi,
  picksById,
  injuries,
  preferredBookie,
  lockedBookie,
  publishedAt,
  discordCopy = false,
  onRemove,
  onLegTap,
  onCopy,
}: Props) {
  const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];

  const { bookie, select } = useMultiBookieSelect(
    multi,
    legs,
    preferredBookie,
    lockedBookie
  );
  const rawBook = lockedBookie ?? bookie ?? multi.bestBookie;
  const displayBook = isFeedBookie(rawBook) ? rawBook : bookie ?? multi.bestBookie;

  const { headline, subline, cardBookie } = multiCardTitle(multi, legs);
  const legBookie = displayBook ?? cardBookie;

  return (
    <section className="bg-card rounded-xl border border-white/10 overflow-hidden mb-3">
      <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
        <div className="flex justify-between gap-2">
          <h3 className="font-semibold text-lg leading-snug">{headline}</h3>
          {onRemove && (
            <button type="button" className="text-xs text-white/50" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
        {publishedAt && lockedBookie && (
          <p className="text-xs text-white/55 mt-0.5">
            Published {new Date(publishedAt).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
        )}
        <p className="text-sm text-white/70 mt-1">{subline}</p>
      </header>
      <div className="px-2 divide-y divide-white/5">
        {legs.map((leg) => (
          <MultiLegRow
            key={leg.id}
            leg={leg}
            injuries={injuries}
            picks={Array.from(picksById.values())}
            bookie={legBookie}
            onTap={onLegTap}
          />
        ))}
      </div>
      <div className="p-3 bg-surface/40">
        <div className="flex gap-2 items-center">
          {lockedBookie ? (
            <p className="flex-1 text-sm text-white/70 py-2">Bookie: {lockedBookie}</p>
          ) : (
            <select
              className="flex-1 py-2 px-2 text-sm bg-surface border border-white/10 rounded-lg"
              value={displayBook ?? ""}
              onChange={(e) => select(e.target.value)}
            >
              <option value="" disabled>
                Bookie
              </option>
              {FEED_BOOKIES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="flex-1 py-2 text-sm bg-surface border border-white/10 rounded-lg font-medium"
            onClick={() =>
              onCopy(renderMultiCardCopyText(multi, legs, legBookie))
            }
          >
            {discordCopy ? "Copy for Discord" : "Copy"}
          </button>
        </div>
      </div>
    </section>
  );
}