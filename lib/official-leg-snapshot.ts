import type { Market, MultiBet, PickLeg } from "./types.js";
import type { OfficialLegSnapshot } from "./official-card-time.js";
import { legPriceAtBookieWithCatalog } from "./single-bookie.js";

export function freezeOfficialLegSnapshots(
  multis: MultiBet[],
  picksById: Map<string, PickLeg>,
  catalog: PickLeg[]
): Record<string, OfficialLegSnapshot> {
  const out: Record<string, OfficialLegSnapshot> = {};
  for (const multi of multis) {
    const bookie = multi.bestBookie ?? "";
    for (const id of multi.legs) {
      if (out[id]) continue;
      const leg = picksById.get(id);
      if (!leg) continue;
      const price =
        bookie && bookie.length
          ? legPriceAtBookieWithCatalog(leg, bookie, catalog)
          : leg.bestPrice ?? undefined;
      out[id] = {
        id: leg.id,
        playerId: leg.playerId,
        playerName: leg.playerName,
        headshotUrl: leg.headshotUrl,
        gameId: leg.gameId,
        team: leg.team,
        opponent: leg.opponent,
        market: leg.market,
        line: leg.line,
        publishedBookie: bookie,
        publishedPrice: price != null && price > 1 ? price : undefined,
        fairPrice: leg.fairPrice,
        takeAt: leg.takeAt,
        probability: leg.probability,
        reasons: [...(leg.reasons ?? [])],
        reasonLine: leg.reasonLine,
        recentVsLine: leg.recentVsLine,
        recentTenVsLine: leg.recentTenVsLine,
        bookiePrices: leg.bookiePrices ? { ...leg.bookiePrices } : undefined,
        feedLineNote: leg.feedLineNote,
        questionable: leg.questionable,
        tags: leg.tags ? [...leg.tags] : undefined,
      };
    }
  }
  return out;
}

export function officialCardPrimaryBookie(multis: MultiBet[]): string {
  const main = multis.find((m) => m.type === "mainPlay");
  return main?.bestBookie ?? multis.find((m) => m.bestBookie)?.bestBookie ?? "";
}

export function pickLegFromSnapshot(snap: OfficialLegSnapshot): PickLeg {
  const bookie = snap.publishedBookie;
  const price = snap.publishedPrice;
  const bookiePrices = snap.bookiePrices
    ? { ...snap.bookiePrices }
    : price != null && bookie
      ? { [bookie]: price }
      : undefined;
  return {
    id: snap.id,
    playerId: snap.playerId,
    playerName: snap.playerName,
    headshotUrl: snap.headshotUrl ?? "",
    gameId: snap.gameId,
    team: snap.team,
    opponent: snap.opponent ?? "",
    market: snap.market as Market,
    line: snap.line,
    probability: snap.probability,
    fairPrice: snap.fairPrice,
    takeAt: snap.takeAt,
    tags: snap.tags ?? [],
    reasons: [...snap.reasons],
    reasonLine: snap.reasonLine,
    recentVsLine: snap.recentVsLine,
    recentTenVsLine: snap.recentTenVsLine,
    bookiePrices,
    bestBookie: bookie,
    bestPrice: price,
    feedLineNote: snap.feedLineNote,
    questionable: snap.questionable,
    starterEligible: true,
  };
}

export function picksByIdFromOfficialSnapshots(
  snapshots: Record<string, OfficialLegSnapshot> | undefined,
  livePicks: PickLeg[]
): Map<string, PickLeg> {
  const live = new Map(livePicks.map((p) => [p.id, p]));
  if (!snapshots) return live;
  const out = new Map<string, PickLeg>();
  for (const [id, snap] of Object.entries(snapshots)) {
    out.set(id, pickLegFromSnapshot(snap));
  }
  for (const p of livePicks) {
    if (!out.has(p.id)) out.set(p.id, p);
  }
  return out;
}