create or replace function requeue_stale_entity_import_batches(stale_before timestamptz)
returns setof entity_import_batches
language plpgsql
as $$
begin
  return query
  update entity_import_batches
  set status = 'queued',
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'recovered_at', now(),
          'last_error', 'Recovered stale batch lease',
          'retry_state', 'queued',
          'lease_expires_at', null
        )
  where status = 'running'
    and (
      coalesce((metadata->>'heartbeat_at')::timestamptz, started_at) < stale_before
      or coalesce((metadata->>'lease_expires_at')::timestamptz, started_at) < now()
    )
  returning *;
end;
$$;
