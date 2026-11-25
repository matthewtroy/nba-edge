-- Run 42: projection settlement columns, shadow probability, private projections RLS (NBA Edge only)

begin;

alter table public.projections
  add column if not exists actual_value numeric,
  add column if not exists result text,
  add column if not exists settled_at timestamptz,
  add column if not exists best_bookie text,
  add column if not exists best_price numeric,
  add column if not exists probability_matchup_shadow numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projections_result_check'
  ) then
    alter table public.projections
      add constraint projections_result_check check (
        result is null or result in ('won', 'lost', 'void', 'pending')
      );
  end if;
end $$;

create index if not exists projections_slate_result_idx
  on public.projections (slate_date, result);

drop policy if exists "projections_read_authenticated" on public.projections;

revoke select on table public.projections from authenticated;
revoke select on table public.projections from anon;

comment on column public.projections.probability_matchup_shadow is
  'Matchup shadow p (±4pp); never drives cards when MATCHUP_ENABLED=false.';

commit;