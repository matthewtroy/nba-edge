# NBA Edge — system reference

**Dated:** 2026-11-26 (Australia/Sydney). Canonical betting rules as implemented on `main` after bet-builder corrections A–F.

Phone-first static app + GitHub Actions pipeline. JSON under `public/data/{slateDate}/`; Vite/React UI. Official slate **2026-11-26** is locked (`official-card.json` on the `data` branch) — do not overwrite.

---

## 1. Purpose & architecture

- **Purpose:** Injury-aware NBA player-prop projections → fair / take-at prices → standard multis: **Main Play, Best Double Up (`doubleUp`), Booster, Q1 Multi, Cross-Game SGM Multi (`crossGameSgm`), Best SGM (`boostSgm`), one Longshot**. Copy-friendly cards; no auto betting; **bet365 never claimed**.
- **Runtime:** `npm run pipeline` → `public/data/`; Actions deploy Pages.
- **Planned backend:** Supabase project **NBA Edge** (`dzikozvlfrvsstkhzkzj`) — migrations in git only; no agent `db push`. Env prefix **`NBA_EDGE_*`** when wired.

---

## 2. Data sources

| Source | Use |
|--------|-----|
| ESPN scoreboard, summary, injuries, rosters, game logs | Slate, injuries, minutes, grading |
| NBA official injury PDF | Overrides ESPN when parsed; stale if missing |
| The Odds API v4 `regions=au` | Player props only |

Over **X.5** at the book → model prices **(X+1)+**. Name match via normalisation + `fixtures/player-aliases.json`.

---

## 3. Model & pricing

Baseline / injury redistribution / context / distributions: unchanged (see `lib/baseline.ts`, `lib/injury-redistribution.ts`, `lib/distributions.ts`).

**Blend:** `P_final = 0.6 × P_model + 0.4 × P_market` (`MODEL_WEIGHT` in `lib/pricing-config.ts`). Fair = 1/p; take-at = fair × (1 + min edge), default 8%. **Check news** when model−implied &gt; 15pp.

**Tags:** High probability p ≥ 0.72; **Value** only at My bookie / card bookie when price ≥ take-at.

---

## 4. Clash & line floors

**Clash** (never same multi): opposing reb vs pts/ast; two reb same game; two pts same team; same player twice (except Booster / combo); Q1 pts + Q1 ast same player.

**Line floors (all non-Q1 builders):** pts ≥10, reb/ast ≥5, **3pm ≥1** (no 2+ / 4+ 3PM mins anywhere). Q1 markets only in Q1 Multi.

---

## 5. Generated bets

One AU bookie per built multi. Home card order (`TodayScreen` `ORDER`):

**Main Play → Best Double Up → Booster → Q1 Multi → Cross-Game SGM → Best SGM → Longshot**

### Main Play (`mainPlay`)

- 3–5 legs (builder); starter main lines; per-leg bookie **1.40–2.50**; p ≥ 0.60; no Check news; no age-B2B; ≤1× 3pm leg.
- Combined bookie total **$5–$20** (`MAIN_PLAY_COMBINED_MIN` / `MAX`).
- **Sweet spot** **$6–$12** (`MAIN_PLAY_SWEET_MIN` / `MAX`): prefer in-band candidates before the rest of $5–$20. **Surplus compares only inside the same band** (in sweet vs in sweet, or outside vs outside) — never surplus across sweet vs non-sweet. Build trace logs `path sweetSpot` or `path fullBand`.
- **Edge curve** (`lib/pricing-config.ts`):
  - `MAIN_PLAY_EDGE_AT_MIN = 0.10`, `MAIN_PLAY_EDGE_AT_MAX = 0.75`
  - `requiredEdge(total) = 0.10 + (total − 5) × (0.65 ÷ 15)`
  - Require `(bookieTotal / combinedFair) − 1 ≥ requiredEdge(total)`
  - Within a band: highest **surplus** = `actualEdge / requiredEdge`; tie-break higher combined probability
  - Fail → `notBuilt` shortfall e.g. `$14.20, needs 50% edge, has 38%`

### Best Double Up (`doubleUp`) — **new type, not a rename**

- Label **Best Double Up**. Separate from Cross-Game SGM.
- Combined bookie **$1.80–$2.20** (`DOUBLE_UP_MIN` / `MAX`); 2–3 legs; `DOUBLE_UP_EXTRA_LEG_PP = 0.03` score penalty per leg beyond 2.
- Wired into official settle labels, results aggregation, and Today order after Main Play.
- Fixture: `tests/fixtures/tonight-double-up.json`.

### Booster

Same Main Play bookie/players; +1 rung when Main leg bookie price ≤ 4.00, else same rung.

### Q1 Multi

Blend 0.3 model + 0.4 L10 Q1 + 0.3 L5 Q1; 24+ min; fair ≥ 1.30; 1/team; 3–6 teams. No AU Q1 feed → take fair×1.08.

### Cross-Game SGM (`crossGameSgm`)

Label **Cross-Game SGM Multi** (restored — never “Best Double Up”). Up to 5 games, 1–2 legs/game, combined **$15–$50** at one bookie.

### Best SGM (`boostSgm`)

Same-game **2–5** legs; combined total **≥ $2** (no upper cap). Same `requiredEdge` / surplus as Main Play (linear beyond $20).

### Longshot

One card; DD/TD or 30+ pts; take-at **$30–$150**; no 3PM legs.

### Small slate

≤4 games: Main Play first, then at most two others; `smallSlateNote` when applicable.

---

## 6. Odds pulls & budget

Sydney windows: evening official-card, 07:00, pre-tip (~60 min). One pull per slot per slate day. Pause if credits &lt; 20% monthly. **8 markets/game** in budget math.

---

## 7. Official card & results

Evening lock → `official-card.json`. Restore from `data` branch before build. Settle / results use `BET_LABELS` including **Best Double Up** and **Cross-Game SGM Multi**. Home settle strip: `lib/home-settle-summary.ts`.

---

## 8. Tests

Vitest for distributions, clash, Main Play edge curve, Double Up builder, Best SGM $2/curve ($4 / $25 / &lt;$2), 3pm 1+, multis schema. Prefer `tests/fixtures/`. Gates: `npm run typecheck`, `npm run typecheck:tests`, `npm test`.

---

## Code map

| Area | Path |
|------|------|
| Pricing / edge curve / Double Up constants | `lib/pricing-config.ts` |
| Multis builders | `lib/multis.ts` |
| Gates | `lib/multi-gate.ts`, `lib/main-play-eligibility.ts`, `lib/starter-eligibility.ts` |
| Best SGM search | `lib/same-game-sgm-search.ts` |
| Today order | `src/screens/TodayScreen.tsx` |
| Settle labels | `lib/official-bet-settle.ts` |
| Double Up fixture | `tests/fixtures/tonight-double-up.json` |
| Official card | `lib/official-card.ts` |
| Schema / migrations | `docs/SCHEMA.md`, `supabase/migrations/` |
