-- Historical box scores may reference games not present on the current slate.
-- Keep game_id NOT NULL and the idempotent unique constraint; drop FK to games only.

alter table public.player_game_logs
  drop constraint if exists player_game_logs_game_id_fkey;