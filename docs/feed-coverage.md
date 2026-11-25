# AU props feed coverage (cached pull)

Metadata from the **cached Odds API snapshot** merged into the pipeline (no new API call for this document).

| Field | Value |
|--------|--------|
| **lastPulled (UTC)** | 2026-11-25T05:16:23.081Z |
| **Sydney** | 25 Nov 2026, 4:16 pm AEDT |
| **Slate priced** | 2026-11-26 (9 games) |
| **Merged keys (26 Nov run)** | 10,712 (7,690 cached + attach) |
| **Priced legs (26 Nov run)** | 1,093 |

## Markets requested

`player_points`, `player_rebounds`, `player_assists`, plus `_alternate` for pts/reb/ast, `player_threes`, `player_threes_alternate`, `player_double_double`, `player_triple_double`.

## AU bookies (canonical)

Sportsbet, TAB, Ladbrokes/Neds, PointsBet, Unibet (see `lib/types.ts` `AU_BOOKMAKERS`).

## Gaps

- **Q1 player props:** not in feed — Q1 multis use model fair and **Take fair×1.08** on cards.
- **bet365:** manual UI only; never claimed from API.
- **Nearest line:** when a rung is missing at the chosen bookie, the app uses the closest priced main/alternate rung with model **p ≥ 0.55** (see `lib/nearest-bookie-line.ts`).

## Jaden McDaniels reb 5+ (2026-11-26)

- **Sportsbet:** no price on the 5+ rung; 10+ exists at **8.50** but **p ≈ 0.13** (below nearest-line floor).
- **Ladbrokes / Neds:** **1.52** on 5+ — used for **Main Play** @ Ladbrokes $10.43.