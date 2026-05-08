-- Support entity pipeline worker upserts:
--   on_conflict = "entity_id,page_class,url"
--
-- Postgres can only use ON CONFLICT(column list) when a matching unique or
-- exclusion constraint/index exists. Keep the freshest row if historical local
-- data already contains duplicates for the natural source key.

delete from entity_source_registry
where ctid in (
  select ctid
  from (
    select
      ctid,
      row_number() over (
        partition by entity_id, page_class, url
        order by
          is_canonical desc,
          last_verified_at desc nulls last,
          updated_at desc,
          id desc
      ) as row_rank
    from entity_source_registry
  ) ranked
  where row_rank > 1
);

create unique index if not exists entity_source_registry_entity_page_url_uidx
  on entity_source_registry (entity_id, page_class, url);

select setval(
  'entity_source_registry_id_seq',
  greatest(
    coalesce((select max(id) from entity_source_registry), 0),
    1
  ),
  true
);
