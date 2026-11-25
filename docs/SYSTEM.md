# NBA Edge — system reference

Phone-first static app + GitHub Actions pipeline. Canonical betting rules below; **Code vs spec** at the end lists today's implementation gaps (app code is unchanged until a task says otherwise).

---

## 1. Purpose & architecture

- **Purpose:** Injury-aware NBA player-prop projections → fair / take-at prices → standard multis (Main Play, Booster, Q1 Multi / Q1 Multi (Longshot), Cross-Game SGM, Boost SGM, Longshot). Copy-friendly cards; no auto betting.
- **Runtime today:** `npm run pipeline` writes JSON under `public/data/{slateDate}/`; Vite/React UI reads that JSON. GitHub Actions runs pipeline + Pages deploy.
- **Planned:** Supabase project **NBA Edge** (`dzikozvlfrvsstkhzkzj`) for pipeline storage, Auth, Stripe **entitlements**, subscriber APIs, and optional Discord—see `docs/SCHEMA.md` and `supabase/migrations/`. Migrations only in git; no agent `db push`.

---

## 2. Data sources

| Source | Use |
|--------|-----|
| ESPN scoreboard, summary, injuries, rosters, game logs | Slate, injuries, minutes, grading |
| NBA official injury PDF | Overrides ESPN when parsed; stale flag if missing |
| The Odds API v4 `regions=au` | Player props; **bet365 never ingested** |

Over **X.5** at the book → model prices **(X+1)+** rungs. Player-name matching normalises accents, suffixes, nicknames; `fixtures/player-aliases.json` for exceptions.

---

## 3. Model & pricing

### 3.1 Baseline

Per-minute PTS/REB/AST/3PM blend: 50% season, 30% last 10, 20% last 5. Projected minutes: median of last 5, nudged 30% toward season average. Players need ≥3 games and meaningful minutes.

### 3.2 Injury redistribution

Out/Doubtful teammates: with/without splits shrunk `diff × n/(n+5)`; generic position/minutes handoff when n&lt;3; +25% cap per stat; rebounds shared; questionable → dual projection + beneficiary list on Injuries.

### 3.3 Context

Opponent allowance ±8% cap; spread ≥10 → −6% minutes, ≥13 → −9%; B2B −3% minutes; age ≥32 on B2B → excluded from Main Play.

### 3.4 Distributions & Q1

Full-game: Normal PTS; NB REB/AST/3PM; MC for DD/TD milestone legs only (no Pts+Reb/Pts+Ast/Reb+Ast/PRA combo markets). Q1 share from PBP period 1 (last 10) or 0.26 default; Q1 NB dispersions per `lib/distributions.ts`.

### 3.5 Market blend (canonical spec)

When a book price exists for a rung (or **borrowed** implied from nearest priced rung on that player/market):

**Blended probability = 60% model / 40% market (configurable via `lib/pricing-config.ts`)** — `P_final = MODEL_WEIGHT × P_model + (1 − MODEL_WEIGHT) × P_market` with `MODEL_WEIGHT = 0.6` (then clamp 0.05–0.95).

Fair = 1/p; take-at = fair × (1 + min edge), default **8%**. **Check news:** model minus implied **&gt; 15 percentage points** → tag Check news (no Value / no Main anchor).

### 3.6 Tags & Value definition

- **High probability:** p ≥ 0.72.
- **Value:** only when **your selected bookie** (card bookie / My bookie) has a decimal price **≥ take-at** for that leg. Never Value on another book's best alone. No book quote → show take-at only.
- **Check news / Check prices:** wide model–market gap or suspiciously high price vs fair (see `lib/value-at-bookie.ts`, `lib/market-blend.ts`).

Legs kept with p ∈ (0.05, 0.95) for expected rotation players.

---

## 4. Clash & leg rules

**Clash** (never same multi): opposing reb vs pts/ast; two reb same game; two pts same team; same player twice (except Booster step / combo markets); Q1 pts + Q1 ast same player.

**Questionable:** never the Main Play anchor (highest p leg). Cross / Best SGM may include questionable legs (small **Q** tag); Check news does not block those bet types.

---

## 5. Generated bets

Ranking: injury news → probability → edge. **One AU bookie per built multi** (all legs priced at edge on that book). Each multi stores fair/take-at, **per-bookie combined totals** (`bookieTotals`), and chosen `bestBookie` / `bestBookieTotal`.

### Main Play

- 4–5 legs; starter main lines (pts ≥10, reb/ast ≥5, 3pm ≥2 for Main stat set); per-leg fair **1.40–2.50**, p ≥ 0.60; no Check news; no age-B2B.
- **Combined range on real bookie total: $7–$20** (decimal product at the chosen book). Spec prefers 1 leg/game; 2/game only on thin slates.
- Prefer pts/reb/ast; at most one 3pm leg.
- **No target-profit stake line on cards** (stake UI removed from multis JSON; settings may still store a personal target for future use only).

### Booster

Same **Main Play bookie** and players; **+1 rung** when that Main leg’s bookie price ≤ 4.00, else same rung. No per-leg edge gate. Nearest main/alternate line at bookie.

### Q1 Multi (names & rules)

| Variant | Label | Rules |
|---------|--------|--------|
| **Core** | Q1 Multi | Blend p = 0.3 model + 0.4 L10 Q1 + 0.3 L5 Q1; 24+ min starters; −20pp L10 gap; fair ≥ **1.30**; rank legs, **1/team**, **3–6** teams |
| **Longshot** | Q1 Multi (Longshot) | Same structure; each leg fair ≥ **2.50** |

No AU Q1 feed — card shows **Take fair×1.08** prominently.

### Cross-Game SGM / Boost SGM / Longshot

Per `lib/multis.ts` + `lib/main-play-eligibility.ts`: cross-game legs need starter + main-line floors; Boost SGM 3 legs one game; Longshot DD/TD/high pts, fair band 30–100.

### Small slate

≤4 games: Main Play first, then at most two other types; `smallSlateNote` on card.

---

## 6. Odds pulls & budget

Windows (Australia/Sydney): **evening** (official-card window, 21:00–01:00), **07:00**, **pre-tip** (~60 min before first tip). Labels recorded in `odds-cache.json` (`pullSlotsToday`) for idempotent **one pull per slot per slate day**.

Before pull: if remaining credits **&lt; 20%** of monthly budget → pause day (`paused (credit limit)` in meta). Budget row in DB: `odds_budget` (see schema).

Odds API requests use **8 markets per game** (core pts/reb/ast + alternates + threes)—**10 credits/game** in budget math; stat-combo and DD/TD API markets are not pulled.

Injury-ranked event ordering for pulls is **planned** when Supabase stores slate priority (not in static pipeline yet).

---

## 7. Official card & slates

First qualifying evening with AU props → lock `official-card.json` (see `lib/official-card-time.ts`). Each pipeline run restores must-persist files from the `data` branch (`lib/restore-data-branch.ts`) before build; normal runs log `official card: kept (published …)` instead of overwriting an existing lock. Dual today/tomorrow folders under `public/data/{date}/`. UI: official vs draft, My bookie, Value filter, Q1/longshot toggles, questionable Swap (localStorage).

---

## 8. Volume & narrative (planned)

Not implemented in pipeline JSON today. Planned layer on top of picks/multis: short slate narrative, volume hints, injury-led storyline for Today header—will read from Supabase or enriched meta when built.

---

## 9. Subscriber backend (planned)

- **Auth:** Supabase Auth → `profiles`.
- **Stripe:** webhook → `entitlements` tier; **tier gating** on extra screens/APIs later (comments in migrations).
- **Discord:** manual copy today; optional post via entitled users later.
- Env: **`NBA_EDGE_*`** only when wired.

---

## 10. Tests & quality bar

Vitest: distributions, injury fixture, clash, exposure, odds pause, Main Play range, multis schema (no stake on bets). Keep tests light.

---

## Code vs spec (current repo)

| Topic | Spec (this doc) | Code today |
|--------|-----------------|------------|
| Market blend | 60% market / 40% model | `lib/market-blend.ts`: **60% model / 40% market** |
| Main Play combined total | **$7–$20** at chosen bookie | `lib/multis.ts` `findMainPlaySubset`: **$7–$10** |
| Exposure cap | Removed (clash only) | `lib/exposure.ts` no-op |
| Main stake / targetProfit | Not on cards | Settings UI still has targetProfit; multis omit stake |
| Q1 Multi fair band | Core p ≥ 0.70; Longshot fair 2.20–4.00 | Matches `buildQ1Multi` |
| Value chip | At **My bookie** / card bookie | `lib/value-at-bookie.ts` |
| Volume / narrative | Planned | Not in JSON |
| Supabase persistence | Migrations + future pipeline | Static `public/data` only |
| Injury-ranked odds pulls | Planned | Schedule by time only |

---

## Where to look (code)

| Area | Path |
|------|------|
| Pipeline entry | `scripts/run-live.ts`, `scripts/pipeline.ts` |
| Model | `scripts/model-engine.ts`, `lib/baseline.ts`, `lib/injury-redistribution.ts` |
| Blend & Value | `lib/market-blend.ts`, `lib/value-at-bookie.ts` |
| Multis | `lib/multis.ts`, `lib/multi-gate.ts`, `lib/bookie-edge-pool.ts` |
| Odds schedule | `scripts/odds-schedule.ts`, `lib/odds.ts` |
| Official card | `lib/official-card.ts`, `lib/official-card-time.ts` |
| UI | `src/screens/TodayScreen.tsx`, `src/components/MultiCard.tsx` |
| Workflow | `.github/workflows/pipeline.yml` |
| DB schema | `docs/SCHEMA.md`, `supabase/migrations/` |