# NBA Edge — database schema (Supabase)

Project **NBA Edge** only (`dzikozvlfrvsstkhzkzj`). Migrations in `supabase/migrations/`; applied on push to `main` via GitHub integration—not via local `db push`.

| Table | Purpose | RLS (plain English) |
|-------|---------|---------------------|
| `teams` | NBA team ids and names | Signed-in users can read; pipeline writes with service role |
| `players` | Player ids, team, headshot | Signed-in users read |
| `games` | Slate games, tip times, spread/total, B2B | Signed-in users read |
| `injury_reports` | Status snapshots per player/source/time | Signed-in users read |
| `player_game_logs` | Box-score lines for model + grading | Signed-in users read |
| `odds_budget` | Monthly credit cap and pause threshold | Signed-in users read |
| `odds_pulls` | One row per slate slot (evening / 07:00 / pre-tip) | Signed-in users read |
| `odds_prices` | Book prices from a pull (idempotent per pull/leg/book) | Signed-in users read |
| `slates` | One row per slate date + pipeline meta JSON | Signed-in users read |
| `projections` | Priced legs (fair, take-at, tags) per slate | Signed-in users read |
| `cards` | Official or draft card for a slate | Signed-in read; **anon** read only if official **and** settled |
| `card_bets` | Multis on a card (type, book totals, grades) | Same as parent card |
| `card_legs` | Bet → projection links + leg grade | Same as parent card |
| `profiles` | User settings (My bookie, etc.) | User **read/insert/update own** row only |
| `entitlements` | Stripe tier / feature flags | User **read own** row only (writes via service/Stripe webhook later) |
| `personal_multis` | Saved leg lists per user | User **CRUD own** rows only |

## Subscriber pitfalls

1. **Anon vs authed:** Live slate, picks, and odds require **authenticated** (or service) access. Anonymous clients only see **settled official** `cards` + child bets/legs—not tonight’s card.
2. **`entitlements` has no insert/update policy for users.** Until a secure Stripe webhook (service role) exists, clients cannot self-grant tiers.
3. **`profiles` must be created on signup** (trigger or app)—otherwise RLS allows insert but nothing seeds the row.
4. **Pipeline writes** must use the **service role** key (`NBA_EDGE_SUPABASE_SERVICE_ROLE_KEY` when wired); anon/authenticated tokens cannot upsert projections or cards.
5. **`card_legs.projection_id`** must exist before linking; pipeline should upsert projections before card legs on each run.
6. **Tier-gated UI** (extra narrative, personal multis sync, Discord) is **not enforced in the static app yet**—comments in migrations mark where gating lands later.