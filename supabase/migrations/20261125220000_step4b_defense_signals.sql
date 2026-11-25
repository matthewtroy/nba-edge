-- Step 4b: defense vs position, pace ranks, leg signals / confluence (NBA Edge only)

begin;

alter table public.players
  add column if not exists position text,
  add column if not exists previous_team_ids text[] not null default '{}';

alter table public.player_game_logs
  add column if not exists team_id text,
  add column if not exists opponent_team_id text,
  add column if not exists is_home boolean,
  add column if not exists fga smallint,
  add column if not exists fta smallint,
  add column if not exists turnovers smallint;

alter table public.projections
  add column if not exists signals jsonb not null default '{}',
  add column if not exists confluence smallint not null default 0,
  add column if not exists reason_line text;

alter table public.card_legs
  add column if not exists signals jsonb not null default '{}',
  add column if not exists confluence smallint,
  add column if not exists reason_line text;

create table public.team_defense_vs_position (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams (id) on delete cascade,
  position_bucket text not null,
  window_key text not null,
  stat text not null,
  allowed_per48 numeric not null,
  rank smallint not null,
  updated_at timestamptz not null default now(),
  constraint team_defense_vs_position_bucket_check check (
    position_bucket in ('G', 'F', 'C')
  ),
  constraint team_defense_vs_position_window_check check (
    window_key in ('last15', 'season')
  ),
  constraint team_defense_vs_position_stat_check check (
    stat in ('pts', 'reb', 'ast', '3pm')
  ),
  constraint team_defense_vs_position_rank_check check (rank between 1 and 30),
  constraint team_defense_vs_position_idempotent unique nulls not distinct (
    team_id,
    position_bucket,
    window_key,
    stat
  )
);

create index team_defense_vs_position_team_idx on public.team_defense_vs_position (team_id);

create table public.team_pace_ranks (
  team_id text primary key references public.teams (id) on delete cascade,
  pace_per48 numeric not null,
  rank smallint not null,
  window_key text not null default 'season',
  updated_at timestamptz not null default now(),
  constraint team_pace_ranks_rank_check check (rank between 1 and 30)
);

-- injury_reports: collapse duplicates keyed on report minute (pipeline used run time before)
delete from public.injury_reports a
using public.injury_reports b
where a.id < b.id
  and a.player_id = b.player_id
  and a.source = b.source
  and date_trunc('minute', a.reported_at) = date_trunc('minute', b.reported_at);

alter table public.team_defense_vs_position enable row level security;
alter table public.team_pace_ranks enable row level security;

create policy "team_defense_vs_position_read_authenticated"
  on public.team_defense_vs_position for select to authenticated using (true);

create policy "team_pace_ranks_read_authenticated"
  on public.team_pace_ranks for select to authenticated using (true);

grant select on table public.team_defense_vs_position to authenticated;
grant select on table public.team_pace_ranks to authenticated;

revoke all on table public.team_defense_vs_position from public;
revoke all on table public.team_pace_ranks from public;

commit;