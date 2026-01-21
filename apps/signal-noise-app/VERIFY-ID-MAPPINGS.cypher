
-- Verify restored ID mappings
MATCH (e:Entity)
WHERE e.id_mapping_restored = true
RETURN e.name, e.sport, e.supabase_id, id(e) as neo4j_id
ORDER BY e.name;

-- Check for any remaining mapping issues
MATCH (e:Entity)
WHERE e.supabase_id IS NULL
RETURN e.name, e.sport, count(*) as missing_mappings;

-- Verify critical entities specifically
MATCH (e:Entity)
WHERE e.name IN ['Sada Cruzeiro', 'Newcastle United', 'Atlanta United', 'Red Bull Racing', 'Chicago Cubs']
RETURN e.name, e.supabase_id, e.id_mapping_restored;
