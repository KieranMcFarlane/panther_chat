alter table if exists public.graphiti_materialized_opportunities
  add column if not exists why_this_is_an_opportunity text not null default '',
  add column if not exists yellow_panther_fit_feedback text not null default '',
  add column if not exists next_steps jsonb not null default '[]'::jsonb,
  add column if not exists supporting_signals jsonb not null default '[]'::jsonb,
  add column if not exists read_more_context text not null default '';
