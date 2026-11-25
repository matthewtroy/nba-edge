-- Run #41: injury_reports upsert key + service_role grants for sync tables (NBA Edge only)

begin;

alter table public.injury_reports
  add column if not exists reported_et_date date
  generated always as ((reported_at at time zone 'America/New_York')::date) stored;

create unique index if not exists injury_reports_player_source_status_et_day_uidx
  on public.injury_reports (player_id, source, status, reported_et_date);

do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'injury_reports'
  ) then
  execute 'grant select on table public.injury_reports to authenticated, service_role';
    execute 'grant insert, update, delete on table public.injury_reports to service_role';
  end if;
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'player_game_logs'
  ) then
    execute 'grant select on table public.player_game_logs to authenticated, service_role';
    execute 'grant insert, update, delete on table public.player_game_logs to service_role';
  end if;
end $$;

commit;