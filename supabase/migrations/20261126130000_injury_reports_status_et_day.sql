-- injury_reports: dedupe on player, source, status, report calendar day (US Eastern)

begin;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'injury_reports'
  ) then
    delete from public.injury_reports a
    using public.injury_reports b
    where a.id < b.id
      and a.player_id = b.player_id
      and a.source = b.source
      and a.status = b.status
      and ((a.reported_at at time zone 'America/New_York')::date =
           (b.reported_at at time zone 'America/New_York')::date);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'injury_reports_idempotent'
  ) then
    alter table public.injury_reports drop constraint injury_reports_idempotent;
  end if;
exception
  when others then null;
end $$;

create unique index if not exists injury_reports_player_source_status_et_day
  on public.injury_reports (
    player_id,
    source,
    status,
    ((reported_at at time zone 'America/New_York')::date)
  );

commit;