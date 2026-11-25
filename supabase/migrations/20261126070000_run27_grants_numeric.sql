-- Run #27: defense table grants, default privileges, numeric column types (NBA Edge only)
-- Safe against cumulative schema: guards on table/column existence.

begin;

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'team_defense_vs_position'
  ) then
    execute 'alter table public.team_defense_vs_position enable row level security';
    execute 'grant select on table public.team_defense_vs_position to authenticated, service_role';
    execute 'grant all on table public.team_defense_vs_position to service_role';
  end if;

  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'team_pace_ranks'
  ) then
    execute 'alter table public.team_pace_ranks enable row level security';
    execute 'grant select on table public.team_pace_ranks to authenticated, service_role';
    execute 'grant all on table public.team_pace_ranks to service_role';
  end if;
end $$;

alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_game_logs'
      and column_name = 'minutes'
  ) then
    execute 'alter table public.player_game_logs alter column minutes type numeric using minutes::numeric';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_game_logs'
      and column_name = 'q1_minutes'
  ) then
    execute 'alter table public.player_game_logs alter column q1_minutes type numeric using q1_minutes::numeric';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_game_logs'
      and column_name = 'usage_rate'
  ) then
    execute 'alter table public.player_game_logs alter column usage_rate type numeric using usage_rate::numeric';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_game_logs'
      and column_name = 'usage_pct'
  ) then
    execute 'alter table public.player_game_logs alter column usage_pct type numeric using usage_pct::numeric';
  end if;
end $$;

alter table public.odds_budget
  add column if not exists last_credits_per_game numeric not null default 10;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'odds_budget'
      and column_name = 'last_credits_per_game'
  ) then
    execute 'alter table public.odds_budget alter column last_credits_per_game type numeric using last_credits_per_game::numeric';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'odds_budget'
      and column_name = 'pause_below_fraction'
  ) then
    execute 'alter table public.odds_budget alter column pause_below_fraction type numeric using pause_below_fraction::numeric';
  end if;
end $$;

commit;