-- Dedupe injury_reports: same player, source, status, and report calendar day.

delete from public.injury_reports a
using public.injury_reports b
where a.id < b.id
  and a.player_id = b.player_id
  and a.source = b.source
  and a.status = b.status
  and (a.reported_at at time zone 'UTC')::date = (b.reported_at at time zone 'UTC')::date;