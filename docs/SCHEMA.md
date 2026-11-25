# NBA Edge — database schema (Supabase)

Project **NBA Edge** only (`dzikozvlfrvsstkhzkzj`). Single migration `supabase/migrations/20261125104500_initial_schema.sql` (one transaction; never add a second “fix” migration for the same baseline). Applied on push to `main` via GitHub integration—not via local `db push`.

## Tables

| Table | Purpose |
|-------|---------|
| `teams` | NBA team ids and names |
| `players` | Player ids, team, headshot |
| `games` | Slate games, tip times, spread/total, B2B (`status` checked) |
| `injury_reports` | Status snapshots per player/source/time |
| `player_game_logs` | Box scores + optional Q1/volume columns; `game_id` required |
| `odds_budget` | Monthly credits, pause fraction, `reset_day`, `pretip_pull` — **service role only** |
| `odds_pulls` | One row per slate per `pull_trigger` (`scheduled_9pm`, `pretip`, `force`); `games_pulled`, `ranking` JSON |
| `odds_prices` | Book prices for a pull (idempotent per pull/leg/book) |
| `slates` | One row per slate date; `status` draft \| official \| locked; `published_at`, `locked_at` |
| `projections` | Live priced legs (fair, take-at, tags) — **not** used for public track record |
| `cards` | Official or draft card; `is_settled` when **all** `card_bets` are non-pending |
| `card_bets` | Multis on a card; `status`, `stake_units` (default 1), `return_units`, `profit_units`, `settled_at`; `variant` default `''` |
| `card_legs` | **Frozen snapshot** at publish (player, market, line, prices, probability, `injury_reason`, `result`, `settled_at`); optional `projection_id` ON DELETE SET NULL |
| `profiles` | User settings (My bookie, etc.) |
| `entitlements` | Stripe tier (`free` \| `subscriber` \| `founder`); user **SELECT only** |
| `personal_multis` | Saved leg lists per user |

## Grants (plain English)

| Role | Access |
|------|--------|
| **`service_role`** | Full access to every table (pipeline, Stripe webhooks, admin). Bypasses RLS. |
| **`authenticated`** | **SELECT** on: teams, players, games, injury_reports, player_game_logs, odds_pulls, odds_prices, slates, projections, cards, card_bets, card_legs. **Own row** on `profiles` (select/insert/update). **Own rows** CRUD on `personal_multis`. **SELECT own** on `entitlements`. **No** access to `odds_budget`. |
| **`anon`** | **SELECT only** on `cards`, `card_bets`, `card_legs` — and only rows allowed by RLS (settled **official** track record). |
| **`PUBLIC`** | **REVOKE ALL** on every table (no implicit public access). |

Schema **USAGE** is granted to `anon`, `authenticated`, and `service_role`.

RLS policies mirror the above; missing policy = deny even when a grant exists (except `service_role`).

## Public track record vs live slate

- **Anonymous / marketing track record:** query `cards` → `card_bets` → `card_legs` only. Leg rows store the published snapshot; do **not** join `projections` for history UI.
- **Signed-in live app:** read projections, unsettled cards, injuries, odds pulls, etc. via `authenticated` SELECT + future tier checks in the app.

## Odds pulls idempotency

Unique key is `(slate_date, pull_trigger)`. A **force** pull and a **scheduled_9pm** pull on the same slate are **both** stored (two rows). Re-running the same trigger for the same slate day upserts that slot only.

## Integrity notes

- `UNIQUE NULLS NOT DISTINCT` on idempotent keys (injury rows, game logs, odds prices, projections, card_bets, card_legs order).
- `player_game_logs.game_id` NOT NULL.
- `card_bets.variant` NOT NULL DEFAULT `''`.
- CHECK constraints on slate/game/injury/entitlement/bet/leg/pull statuses.
- Indexes: `odds_prices(pull_id)`, `odds_prices(game_id)`, `card_legs(card_bet_id)`, `injury_reports(player_id, reported_at desc)`.
- One shared `set_updated_at()` trigger on every table that has `updated_at`.

## Subscriber leak risks

1. **Projections + live cards:** `authenticated` can SELECT all projections and unpublished cards. Anyone with a valid session (including free tier) sees tonight’s full pick board unless the **app** gates screens by `entitlements.tier`. RLS does not tier-gate projections yet.
2. **`entitlements` SELECT-only:** users cannot self-upgrade, but they **can read** their tier row. Do not put secrets in `features` JSON.
3. **No INSERT on `entitlements` for users:** Stripe webhook must use **service_role**; a misconfigured client using anon key cannot write tiers (good), but a leaked **service_role** key exposes everything including `odds_budget`.
4. **`odds_budget` service-only:** authenticated users cannot read credit counters (reduces scraper signal). Pipeline must use service role for pause logic.
5. **Anon track record:** RLS limits anon to `is_official AND is_settled` cards. Mis-set `is_settled` or `is_official` flags would expose a draft card or hide results—pipeline must set flags with service role after grading.
6. **`personal_multis.leg_ids`:** only user-scoped via RLS; leg ids may reference projection ids — subscribers could stash picks; not public unless app shares them.
7. **Tier comments in SQL** mark future gating (narrative, Discord, premium builder); until enforced in API/UI, treat authenticated SELECT as “full slate visible.”

## Migration path

Filename `20261125104500_initial_schema.sql` replaces the never-applied `20251125104500_*` file. Fresh Supabase project: one push applies the full schema. Do not add migration #2 for the same baseline renames—edit this file only until first production apply.