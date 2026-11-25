import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import { bookieMarketLabel } from "./market-label.js";
import { legGameTipSubtitle } from "./leg-game-label.js";
import { legPriceAtBookieWithCatalog } from "./single-bookie.js";
import { formatLegCardLine } from "./leg-card-odds.js";

export const SHARE_BETSLIP_WIDTH_PX = 540;
export const SHARE_BETSLIP_DPR = 2;

export type SettleMark = "won" | "lost" | "pending";

export interface ShareBetslipLegBlock {
  key: string;
  playerLine: string;
  gameHint?: string;
  priceText: string;
  settleMark?: SettleMark;
}

export interface ShareBetslipGameGroup {
  gameKey: string;
  gameLabel: string;
  legs: ShareBetslipLegBlock[];
}

export interface ShareBetslipLayout {
  width: number;
  height: number;
  dpr: number;
  cardTitle: string;
  bookie: string;
  totalText: string;
  groups: ShareBetslipGameGroup[];
  legCount: number;
}

const HEADER_PX = 92;
const FOOTER_PX = 80;
const LEG_BLOCK_PX = 68;
const GROUP_HEADER_PX = 34;
const DIVIDER_PX = 1;

export function shareBetslipHeightPx(
  legCount: number,
  groupCount: number
): number {
  const groups = Math.max(1, groupCount);
  const extraGroupHeaders = Math.max(0, groups - 1) * GROUP_HEADER_PX;
  const dividers = Math.max(0, legCount - 1) * DIVIDER_PX;
  return HEADER_PX + extraGroupHeaders + legCount * LEG_BLOCK_PX + dividers + FOOTER_PX;
}

function settleFromLeg(leg: PickLeg): SettleMark | undefined {
  const r = (leg as PickLeg & { result?: string }).result;
  if (r === "won" || r === "lost" || r === "pending") return r;
  return undefined;
}

export function buildShareBetslipLayout(input: {
  multi: MultiBet;
  legs: PickLeg[];
  slate?: SlateGame[];
  bookie?: string;
  total?: number;
  catalog?: PickLeg[];
}): ShareBetslipLayout {
  const { multi, legs, slate, catalog } = input;
  const bookie = input.bookie ?? multi.bestBookie ?? "";
  let total = input.total;
  if (total == null && bookie) {
    const priced = legs
      .map((l) => legPriceAtBookieWithCatalog(l, bookie, catalog ?? legs))
      .filter((p): p is number => p != null && p > 1);
    if (priced.length === legs.length) {
      total = Math.round(priced.reduce((a, p) => a * p, 1) * 100) / 100;
    }
  }
  total ??= multi.bestBookieTotal ?? multi.combinedFairPrice;

  const byGame = new Map<string, ShareBetslipLegBlock[]>();
  const gameLabels = new Map<string, string>();

  for (const leg of legs) {
    const gid = leg.gameId || "unknown";
    const gameLabel =
      slate && leg.gameId
        ? legGameTipSubtitle(leg, slate)?.split("·")[0]?.trim() ??
          `${leg.team} vs ${leg.opponent}`
        : `${leg.team} vs ${leg.opponent}`;
    gameLabels.set(gid, gameLabel);

    const quoted =
      bookie && legPriceAtBookieWithCatalog(leg, bookie, catalog ?? legs);
    const price =
      typeof quoted === "number" && Number.isFinite(quoted) ? quoted : undefined;
    const priceText =
      price != null && price > 1
        ? `$${price.toFixed(2)}`
        : formatLegCardLine(leg, bookie);

    const block: ShareBetslipLegBlock = {
      key: leg.id,
      playerLine: `${leg.playerName} — ${bookieMarketLabel(leg.market, leg.line)}`,
      gameHint: multi.type === "crossGameSgm" ? gameLabel : undefined,
      priceText,
      settleMark: settleFromLeg(leg),
    };
    const list = byGame.get(gid) ?? [];
    list.push(block);
    byGame.set(gid, list);
  }

  const groups: ShareBetslipGameGroup[] =
    multi.type === "crossGameSgm"
      ? [...byGame.entries()].map(([gameKey, groupLegs]) => ({
          gameKey,
          gameLabel: gameLabels.get(gameKey) ?? gameKey,
          legs: groupLegs,
        }))
      : [
          {
            gameKey: "sgm",
            gameLabel: "",
            legs: legs.map((leg) => {
              const quoted =
                bookie && legPriceAtBookieWithCatalog(leg, bookie, catalog ?? legs);
              const price =
                typeof quoted === "number" && Number.isFinite(quoted) ? quoted : undefined;
              return {
                key: leg.id,
                playerLine: `${leg.playerName} — ${bookieMarketLabel(leg.market, leg.line)}`,
                priceText:
                  price != null && price > 1
                    ? `$${price.toFixed(2)}`
                    : formatLegCardLine(leg, bookie),
                settleMark: settleFromLeg(leg),
              };
            }),
          },
        ];

  const legCount = legs.length;
  const height = shareBetslipHeightPx(legCount, groups.length);

  return {
    width: SHARE_BETSLIP_WIDTH_PX,
    height,
    dpr: SHARE_BETSLIP_DPR,
    cardTitle: multi.label,
    bookie,
    totalText: `$${total.toFixed(2)}`,
    groups,
    legCount,
  };
}

export function shareMultiCanvasSize(legCount: number): { width: number; height: number } {
  return {
    width: SHARE_BETSLIP_WIDTH_PX,
    height: shareBetslipHeightPx(legCount, 1),
  };
}