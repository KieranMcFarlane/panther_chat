begin;

with entity_mappings as (
  select
    d.id as dossier_row_id,
    d.entity_id as legacy_entity_id,
    ce.id::text as canonical_entity_id
  from entity_dossiers d
  join cached_entities ce on ce.neo4j_id::text = d.entity_id

  union all

  select
    d.id as dossier_row_id,
    d.entity_id as legacy_entity_id,
    t.id::text as canonical_entity_id
  from entity_dossiers d
  join teams t on t.neo4j_id::text = d.entity_id

  union all

  select
    d.id as dossier_row_id,
    d.entity_id as legacy_entity_id,
    l.id::text as canonical_entity_id
  from entity_dossiers d
  join leagues l on l.neo4j_id::text = d.entity_id
),
affected_targets as (
  select distinct canonical_entity_id
  from entity_mappings
),
ranked_rows as (
  select
    d.id,
    d.entity_id,
    coalesce(m.canonical_entity_id, d.entity_id) as target_entity_id,
    row_number() over (
      partition by coalesce(m.canonical_entity_id, d.entity_id)
      order by d.created_at desc nulls last, d.updated_at desc nulls last, d.id desc
    ) as row_rank
  from entity_dossiers d
  left join entity_mappings m on m.legacy_entity_id = d.entity_id
  where coalesce(m.canonical_entity_id, d.entity_id) in (
    select canonical_entity_id
    from affected_targets
  )
)
delete from entity_dossiers d
using ranked_rows r
where d.id = r.id
  and r.row_rank > 1;

with entity_mappings as (
  select
    d.id as dossier_row_id,
    d.entity_id as legacy_entity_id,
    ce.id::text as canonical_entity_id
  from entity_dossiers d
  join cached_entities ce on ce.neo4j_id::text = d.entity_id

  union all

  select
    d.id as dossier_row_id,
    d.entity_id as legacy_entity_id,
    t.id::text as canonical_entity_id
  from entity_dossiers d
  join teams t on t.neo4j_id::text = d.entity_id

  union all

  select
    d.id as dossier_row_id,
    d.entity_id as legacy_entity_id,
    l.id::text as canonical_entity_id
  from entity_dossiers d
  join leagues l on l.neo4j_id::text = d.entity_id
)
update entity_dossiers d
set entity_id = m.canonical_entity_id,
    dossier_data = case
      when jsonb_typeof(d.dossier_data -> 'metadata') = 'object' then
        jsonb_set(d.dossier_data, '{metadata,entity_id}', to_jsonb(m.canonical_entity_id), true)
      else d.dossier_data
    end,
    updated_at = now()
from entity_mappings m
where d.id = m.dossier_row_id
  and d.entity_id <> m.canonical_entity_id;

commit;
