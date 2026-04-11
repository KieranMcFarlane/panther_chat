create or replace function claim_next_entity_import_batch(worker_id text, lease_seconds int default 90)
returns setof entity_import_batches
language plpgsql
as $$
declare
  claimed entity_import_batches%rowtype;
  claim_time timestamptz := now();
  lease_expiry timestamptz := claim_time + make_interval(secs => lease_seconds);
begin
  with next_batch as (
    select id
    from entity_import_batches
    where status = 'queued'
      and completed_at is null
    order by started_at
    limit 1
    for update skip locked
  )
  update entity_import_batches b
  set status = 'running',
      metadata = coalesce(b.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'queue_mode', 'durable_worker',
          'worker_id', worker_id,
          'claimed_at', claim_time,
          'heartbeat_at', claim_time,
          'lease_expires_at', lease_expiry
        )
  from next_batch
  where b.id = next_batch.id
  returning b.* into claimed;

  if claimed.id is not null then
    return next claimed;
  end if;
  return;
end;
$$;

create or replace function renew_entity_import_batch_lease(batch_id text, worker_id text, lease_seconds int default 90)
returns void
language plpgsql
as $$
declare
  renew_time timestamptz := now();
  lease_expiry timestamptz := renew_time + make_interval(secs => lease_seconds);
begin
  update entity_import_batches
  set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'worker_id', worker_id,
      'heartbeat_at', renew_time,
      'lease_expires_at', lease_expiry
    )
  where id = batch_id;
end;
$$;

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
          'last_error', 'Recovered stale batch lease'
        )
  where status = 'running'
    and completed_at is null
    and (
      (metadata->>'heartbeat_at')::timestamptz < stale_before
      or (metadata->>'lease_expires_at')::timestamptz < now()
    )
  returning *;
end;
$$;

create or replace function fail_entity_pipeline_run(batch_id text, entity_id text, error_message text, retryable boolean)
returns void
language plpgsql
as $$
declare
  current_attempts int;
begin
  select coalesce((metadata->>'attempt_count')::int, 0)
    into current_attempts
  from entity_pipeline_runs
  where entity_pipeline_runs.batch_id = fail_entity_pipeline_run.batch_id
    and entity_pipeline_runs.entity_id = fail_entity_pipeline_run.entity_id;

  update entity_pipeline_runs
  set status = case when retryable then 'retrying' else 'failed' end,
      error_message = fail_entity_pipeline_run.error_message,
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'attempt_count', coalesce(current_attempts, 0) + 1,
          'retryable', retryable,
          'last_error', fail_entity_pipeline_run.error_message,
          'last_error_at', now()
        )
  where entity_pipeline_runs.batch_id = fail_entity_pipeline_run.batch_id
    and entity_pipeline_runs.entity_id = fail_entity_pipeline_run.entity_id;
end;
$$;

create or replace function complete_entity_import_batch(batch_id text, worker_id text)
returns void
language plpgsql
as $$
begin
  update entity_import_batches
  set status = 'completed',
      completed_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'worker_id', worker_id,
          'heartbeat_at', now(),
          'lease_expires_at', null
        )
  where id = batch_id;
end;
$$;
