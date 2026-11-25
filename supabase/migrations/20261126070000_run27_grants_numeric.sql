-- Run #27: defense table grants, default privileges, numeric column types (NBA Edge only)

begin;

alter table public.team_defense_vs_position enable row level security;
alter table public.team_pace_ranks enable row level security;

grant select on table public.team_defense_vs_position to authenticated, service_role;
grant select on table public.team_pace_ranks to authenticated, service_role;
grant all on table public.team_defense_vs_position to service_role;
grant all on table public.team_pace_ranks to service_role;

alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;

alter table public.player_game_logs
  alter column minutes type numeric using minutes::numeric;

alter table public.player_game_logs
  alter column q1_minutes type numeric using q1_minutes::numeric;

alter table public.player_game_logs
  alter column usage_rate type numeric using usage_rate::numeric;

do $$
begin
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
  alter column last_credits_per_game type numeric using last_credits_per_game::numeric;

alter table public.odds_budget
  alter column pause_below_fraction type numeric using pause_below_fraction::numeric;

commit;