import type { MetaJson, SlateGame } from "./types.js";
import type { OfficialCardFile } from "./official-card-time.js";
import { sydneyDateString } from "./official-card-time.js";
import { slateTipDateFromGames } from "./slate-today.js";
import { isGameFinal, isGameLive } from "./slate-game-ui.js";

export type SlatePublicationStatus = "draft" | "official" | "locked_at_tip";

const SYDNEY = "Australia/Sydney";

function gameHasStarted(game: SlateGame, now: Date): boolean {
  if (isGameLive(game.status) || isGameFinal(game.status)) return true;
  return new Date(game.startTime).getTime() <= now.getTime();
}

/** True when every slate game has tipped (live, final, or past scheduled start). */
export function allGamesStartedForSlate(slate: SlateGame[], now: Date): boolean {
  if (!slate.length) return false;
  return slate.every((g) => gameHasStarted(g, now));
}

function formatSydneyPublishTime(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-AU", {
      timeZone: SYDNEY,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(/\s/g, "");
}

function resolveTipDate(slate: SlateGame[], meta: MetaJson): string {
  return meta.slateTipDate ?? slateTipDateFromGames(slate) ?? sydneyDateString(new Date());
}

export function computeSlateStatus(
  slate: SlateGame[],
  meta: MetaJson,
  officialCard: OfficialCardFile | null,
  now: Date
): { status: SlatePublicationStatus; statusLabel: string } {
  const tipDate = resolveTipDate(slate, meta);

  if (allGamesStartedForSlate(slate, now)) {
    return { status: "locked_at_tip", statusLabel: "Locked at tip" };
  }

  const cardForSlate =
    officialCard && officialCard.slateDate === tipDate ? officialCard : null;

  if (cardForSlate?.publishedAt) {
    const when = formatSydneyPublishTime(cardForSlate.publishedAt);
    return {
      status: "official",
      statusLabel: `Official · published ${when}`,
    };
  }

  if (cardForSlate) {
    return { status: "official", statusLabel: "Official" };
  }

  const eveningHint = "9pm";
  return {
    status: "draft",
    statusLabel: `Draft · updates until ${eveningHint}`,
  };
}