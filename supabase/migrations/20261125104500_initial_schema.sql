-- NBA Edge — initial schema (project ref dzikozvlfrvsstkhzkzj)
-- Applied via Supabase GitHub integration on push to main; do not db push from agents.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper (single function for every table that carries updated_at)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core reference data (pipeline upserts)
-- ---------------------------------------------------------------------------

create table public.teams (
  id text primary key,
  name text not null,
  abbreviation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id text primary key,
  team_id text references public.teams (id) on delete set null,
  full_name text not null,
  headshot_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index players_team_id_idx on public.players (team_id);

create table public.games (
  id text primary key,
  slate_date date not null,
  start_time timestamptz not null,
  start_time_sydney text,
  home_team_id text not null references public.teams (id),
  away_team_id text not null references public.teams (id),
  spread numeric,
  total numeric,
  home_b2b boolean not null default false,
  away_b2b boolean not null default false,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_status_check check (
    status in ('scheduled', 'in_progress', 'final', 'postponed', 'cancelled')
  )
);

create index games_slate_date_idx on public.games (slate_date);
create index games_start_time_idx on public.games (start_time);

create table public.injury_reports (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.players (id) on delete cascade,
  game_id text references public.games (id) on delete set null,
  team_id text references public.teams (id) on delete set null,
  status text not null,
  source text not null,
  reported_at timestamptz not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint injury_reports_status_check check (
    status in ('Out', 'Doubtful', 'Questionable', 'Probable', 'Available')
  ),
  constraint injury_reports_source_check check (
    source in ('espn', 'nba_official', 'merged')
  ),
  constraint injury_reports_idempotent unique nulls not distinct (player_id, reported_at, source)
);

create index injury_reports_game_id_idx on public.injury_reports (game_id);
create index injury_reports_player_reported_idx on public.injury_reports (player_id, reported_at desc);

create table public.player_game_logs (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.players (id) on delete cascade,
  game_id text not null references public.games (id) on delete cascade,
  game_date date not null,
  minutes numeric not null default 0,
  pts smallint not null default 0,
  reb smallint not null default 0,
  ast smallint not null default 0,
  threes smallint not null default 0,
  is_starter boolean,
  q1_pts smallint,
  q1_reb smallint,
  q1_ast smallint,
  q1_minutes numeric,
  fga smallint,
  fta smallint,
  turnovers smallint,
  usage_rate numeric,
  extra jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint player_game_logs_idempotent unique nulls not distinct (player_id, game_date, game_id)
);

create index player_game_logs_player_date_idx on public.player_game_logs (player_id, game_date desc);

-- ---------------------------------------------------------------------------
-- Odds budget & pulls
-- ---------------------------------------------------------------------------

create table public.odds_budget (
  id uuid primary key default gen_random_uuid(),
  month_key text not null,
  credits_monthly integer not null default 500,
  credits_remaining integer,
  pause_below_fraction numeric not null default 0.2,
  reset_day smallint not null default 1,
  pretip_pull boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint odds_budget_month_key unique (month_key),
  constraint odds_budget_reset_day_check check (reset_day between 1 and 28)
);

create table public.odds_pulls (
  id uuid primary key default gen_random_uuid(),
  slate_date date not null,
  pull_trigger text not null,
  pulled_at timestamptz not null,
  credits_remaining integer,
  credits_used integer,
  paused boolean not null default false,
  games_pulled jsonb not null default '[]',
  ranking jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint odds_pulls_trigger_check check (
    pull_trigger in ('scheduled_9pm', 'pretip', 'force')
  ),
  constraint odds_pulls_slot_idempotent unique (slate_date, pull_trigger)
);

create index odds_pulls_pulled_at_idx on public.odds_pulls (pulled_at desc);

create table public.odds_prices (
  id uuid primary key default gen_random_uuid(),
  pull_id uuid not null references public.odds_pulls (id) on delete cascade,
  player_id text not null references public.players (id) on delete cascade,
  game_id text not null references public.games (id) on delete cascade,
  market text not null,
  line numeric not null,
  bookie text not null,
  price numeric not null,
  constraint odds_prices_idempotent unique nulls not distinct (pull_id, player_id, market, line, bookie)
);

create index odds_prices_pull_id_idx on public.odds_prices (pull_id);
create index odds_prices_game_id_idx on public.odds_prices (game_id);
create index odds_prices_lookup_idx on public.odds_prices (player_id, market, line, bookie);

-- ---------------------------------------------------------------------------
-- Slate, projections, official cards
-- ---------------------------------------------------------------------------

create table public.slates (
  slate_date date primary key,
  status text not null default 'draft',
  game_count integer not null default 0,
  meta jsonb not null default '{}',
  published_at timestamptz,
  locked_at timestamptz,
  last_updated timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slates_status_check check (
    status in ('draft', 'official', 'locked')
  )
);

create table public.projections (
  id text primary key,
  slate_date date not null,
  game_id text not null references public.games (id) on delete cascade,
  player_id text not null references public.players (id) on delete cascade,
  market text not null,
  line numeric not null,
  model_probability numeric,
  market_probability numeric,
  probability numeric not null,
  fair_price numeric not null,
  take_at numeric not null,
  tags text[] not null default '{}',
  reasons text[] not null default '{}',
  flags jsonb not null default '{}',
  odds_pull_id uuid references public.odds_pulls (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projections_slate_idempotent unique nulls not distinct (slate_date, player_id, market, line)
);

create index projections_slate_idx on public.projections (slate_date);
create index projections_game_idx on public.projections (game_id);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  slate_date date not null references public.slates (slate_date) on delete cascade,
  is_official boolean not null default false,
  is_settled boolean not null default false,
  locked_at timestamptz,
  published_at timestamptz,
  bookie text,
  what_changed text[] not null default '{}',
  odds_last_pulled timestamptz,
  not_built jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cards_one_official_per_slate
  on public.cards (slate_date)
  where is_official = true;

create index cards_settled_track_idx on public.cards (is_official, is_settled, slate_date desc);

comment on column public.cards.is_settled is
  'Pipeline sets true only when every card_bet on this card has a non-pending status and settled_at.';

create table public.card_bets (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  bet_type text not null,
  label text not null,
  variant text not null default '',
  status text not null default 'pending',
  stake_units numeric not null default 1,
  return_units numeric,
  profit_units numeric,
  settled_at timestamptz,
  combined_probability numeric,
  combined_fair_price numeric,
  combined_take_at numeric,
  best_bookie text,
  best_bookie_total numeric,
  bookie_totals jsonb not null default '{}',
  summary text,
  grade_overall text,
  constraint card_bets_status_check check (
    status in ('pending', 'won', 'lost', 'void', 'push')
  ),
  constraint card_bets_idempotent unique nulls not distinct (card_id, bet_type, variant)
);

create index card_bets_card_id_idx on public.card_bets (card_id);

create table public.card_legs (
  id uuid primary key default gen_random_uuid(),
  card_bet_id uuid not null references public.card_bets (id) on delete cascade,
  projection_id text references public.projections (id) on delete set null,
  leg_order smallint not null default 0,
  player_id text not null,
  player_name text not null,
  team_id text,
  game_id text,
  market text not null,
  line numeric not null,
  bookie text,
  price numeric,
  fair_price numeric,
  take_at numeric,
  probability numeric,
  injury_reason text,
  result text not null default 'pending',
  settled_at timestamptz,
  constraint card_legs_result_check check (
    result in ('pending', 'won', 'lost', 'void')
  ),
  constraint card_legs_idempotent unique nulls not distinct (card_bet_id, leg_order)
);

create index card_legs_card_bet_id_idx on public.card_legs (card_bet_id);

comment on table public.card_legs is
  'Frozen leg snapshot at publish; public track record queries card_legs/card_bets/cards only—never projections.';

-- ---------------------------------------------------------------------------
-- Auth extension: profiles, entitlements, personal multis
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  my_bookie text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Per-user preferences (My bookie, UI settings). Tier-gated extras read entitlements; free tier still gets profiles CRUD own row.';

create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  valid_until timestamptz,
  features jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entitlements_tier_check check (
    tier in ('free', 'subscriber', 'founder')
  )
);

comment on table public.entitlements is
  'Stripe-driven tier; subscriber-only APIs (narrative, synced multis, Discord) must check tier in app and via RLS when added—no user writes.';

create table public.personal_multis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  slate_date date,
  leg_ids text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_multis_user_idx on public.personal_multis (user_id, created_at desc);

comment on table public.personal_multis is
  'User-built multis; premium builder / cloud sync may require entitlements.tier = subscriber later.';

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

create trigger slates_set_updated_at
  before update on public.slates
  for each row execute function public.set_updated_at();

create trigger odds_budget_set_updated_at
  before update on public.odds_budget
  for each row execute function public.set_updated_at();

create trigger projections_set_updated_at
  before update on public.projections
  for each row execute function public.set_updated_at();

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

create trigger personal_multis_set_updated_at
  before update on public.personal_multis
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.injury_reports enable row level security;
alter table public.player_game_logs enable row level security;
alter table public.odds_budget enable row level security;
alter table public.odds_pulls enable row level security;
alter table public.odds_prices enable row level security;
alter table public.slates enable row level security;
alter table public.projections enable row level security;
alter table public.cards enable row level security;
alter table public.card_bets enable row level security;
alter table public.card_legs enable row level security;
alter table public.profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.personal_multis enable row level security;

create policy "teams_read_authenticated"
  on public.teams for select to authenticated using (true);

create policy "players_read_authenticated"
  on public.players for select to authenticated using (true);

create policy "games_read_authenticated"
  on public.games for select to authenticated using (true);

create policy "injury_reports_read_authenticated"
  on public.injury_reports for select to authenticated using (true);

create policy "player_game_logs_read_authenticated"
  on public.player_game_logs for select to authenticated using (true);

create policy "odds_pulls_read_authenticated"
  on public.odds_pulls for select to authenticated using (true);

create policy "odds_prices_read_authenticated"
  on public.odds_prices for select to authenticated using (true);

create policy "slates_read_authenticated"
  on public.slates for select to authenticated using (true);

create policy "projections_read_authenticated"
  on public.projections for select to authenticated using (true);

create policy "cards_read_authenticated"
  on public.cards for select to authenticated using (true);

create policy "card_bets_read_authenticated"
  on public.card_bets for select
  to authenticated
  using (
    exists (select 1 from public.cards c where c.id = card_id)
  );

create policy "card_legs_read_authenticated"
  on public.card_legs for select
  to authenticated
  using (
    exists (
      select 1 from public.card_bets b where b.id = card_bet_id
    )
  );

-- Public track record: settled official cards only (snapshot legs + bets; no projections).
create policy "cards_track_record_anon"
  on public.cards for select to anon
  using (is_official = true and is_settled = true);

create policy "card_bets_track_record_anon"
  on public.card_bets for select to anon
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id and c.is_official = true and c.is_settled = true
    )
  );

create policy "card_legs_track_record_anon"
  on public.card_legs for select to anon
  using (
    exists (
      select 1
      from public.card_bets b
      join public.cards c on c.id = b.card_id
      where b.id = card_bet_id
        and c.is_official = true
        and c.is_settled = true
    )
  );

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "entitlements_select_own"
  on public.entitlements for select to authenticated
  using (auth.uid() = user_id);

create policy "personal_multis_select_own"
  on public.personal_multis for select to authenticated
  using (auth.uid() = user_id);

create policy "personal_multis_insert_own"
  on public.personal_multis for insert to authenticated
  with check (auth.uid() = user_id);

create policy "personal_multis_update_own"
  on public.personal_multis for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "personal_multis_delete_own"
  on public.personal_multis for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Explicit grants (RLS still applies; service_role bypasses RLS)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;

grant select on table public.teams to authenticated;
grant select on table public.players to authenticated;
grant select on table public.games to authenticated;
grant select on table public.injury_reports to authenticated;
grant select on table public.player_game_logs to authenticated;
grant select on table public.odds_pulls to authenticated;
grant select on table public.odds_prices to authenticated;
grant select on table public.slates to authenticated;
grant select on table public.projections to authenticated;
grant select on table public.cards to authenticated;
grant select on table public.card_bets to authenticated;
grant select on table public.card_legs to authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select on table public.entitlements to authenticated;
grant select, insert, update, delete on table public.personal_multis to authenticated;

grant select on table public.cards to anon;
grant select on table public.card_bets to anon;
grant select on table public.card_legs to anon;

revoke all on table public.teams from public;
revoke all on table public.players from public;
revoke all on table public.games from public;
revoke all on table public.injury_reports from public;
revoke all on table public.player_game_logs from public;
revoke all on table public.odds_budget from public;
revoke all on table public.odds_pulls from public;
revoke all on table public.odds_prices from public;
revoke all on table public.slates from public;
revoke all on table public.projections from public;
revoke all on table public.cards from public;
revoke all on table public.card_bets from public;
revoke all on table public.card_legs from public;
revoke all on table public.profiles from public;
revoke all on table public.entitlements from public;
revoke all on table public.personal_multis from public;

commit;