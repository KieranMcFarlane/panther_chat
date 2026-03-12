begin;

delete from entity_dossiers d
where not exists (
  select 1
  from cached_entities ce
  where ce.id::text = d.entity_id
)
and not exists (
  select 1
  from teams t
  where t.id::text = d.entity_id
)
and not exists (
  select 1
  from leagues l
  where l.id::text = d.entity_id
);

update cached_entities
set properties = properties - 'dossier_data'
where properties ? 'dossier_data';

commit;
