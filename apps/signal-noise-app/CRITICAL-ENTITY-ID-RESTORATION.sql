-- CRITICAL: Entity ID Mapping Restoration
-- Fixes ID reassignment issues from cleanup process
-- Preserves Supabase UUID relationships with Neo4j entities
-- Generated: 2025-11-16T02:11:20.415Z
-- RUN IMMEDIATELY to prevent further mapping issues

-- Restore ID mapping for Sada Cruzeiro
MATCH (e:Entity {name: 'Sada Cruzeiro', sport: 'Volleyball'})
WHERE e.supabase_id = '50b22eb1-bde3-4bf3-98ac-5beafa2a87b7' OR e.name = 'Sada Cruzeiro'
SET e.supabase_id = '50b22eb1-bde3-4bf3-98ac-5beafa2a87b7',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;

-- Restore ID mapping for BG Göttingen
MATCH (e:Entity {name: 'BG Göttingen', sport: 'Basketball'})
WHERE e.supabase_id = '50c6fb95-1e23-4eea-bb07-3df051454d0c' OR e.name = 'BG Göttingen'
SET e.supabase_id = '50c6fb95-1e23-4eea-bb07-3df051454d0c',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;

-- Restore ID mapping for Pirelli F1
MATCH (e:Entity {name: 'Pirelli F1', sport: 'Formula 1'})
WHERE e.supabase_id = '50d306a5-5db7-402c-97e8-35dd596215f6' OR e.name = 'Pirelli F1'
SET e.supabase_id = '50d306a5-5db7-402c-97e8-35dd596215f6',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;

-- Restore ID mapping for Central Districts
MATCH (e:Entity {name: 'Central Districts', sport: 'Cricket'})
WHERE e.supabase_id = '5125e835-9b65-4767-957e-c5e4db49cbec' OR e.name = 'Central Districts'
SET e.supabase_id = '5125e835-9b65-4767-957e-c5e4db49cbec',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;

-- Restore ID mapping for Genoa
MATCH (e:Entity {name: 'Genoa', sport: 'Football'})
WHERE e.supabase_id = '5129731f-7d41-4cbe-9eed-4f2d37303015' OR e.name = 'Genoa'
SET e.supabase_id = '5129731f-7d41-4cbe-9eed-4f2d37303015',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;

-- Restore ID mapping for Newcastle United
MATCH (e:Entity {name: 'Newcastle United', sport: 'Football'})
WHERE e.supabase_id = '5377d14f-2dff-40a2-9d6c-18e99efe9e40' OR e.name = 'Newcastle United'
SET e.supabase_id = '5377d14f-2dff-40a2-9d6c-18e99efe9e40',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;

-- Restore ID mapping for Shrewsbury Town
MATCH (e:Entity {name: 'Shrewsbury Town', sport: 'Football'})
WHERE e.supabase_id = '54963d57-e85b-4197-ae16-8cc48232371f' OR e.name = 'Shrewsbury Town'
SET e.supabase_id = '54963d57-e85b-4197-ae16-8cc48232371f',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;

-- Restore ID mapping for Atlanta United
MATCH (e:Entity {name: 'Atlanta United', sport: 'Football'})
WHERE e.supabase_id = '577a7cd7-7b3e-4835-b0e6-482ccb278cd6' OR e.name = 'Atlanta United'
SET e.supabase_id = '577a7cd7-7b3e-4835-b0e6-482ccb278cd6',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;

-- Restore ID mapping for Red Bull Racing
MATCH (e:Entity {name: 'Red Bull Racing', sport: 'Formula 1'})
WHERE e.supabase_id = '57ae585f-0ab5-4639-a5f9-55d8d0c6b091' OR e.name = 'Red Bull Racing'
SET e.supabase_id = '57ae585f-0ab5-4639-a5f9-55d8d0c6b091',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;

-- Restore ID mapping for Chicago Cubs
MATCH (e:Entity {name: 'Chicago Cubs', sport: 'Baseball'})
WHERE e.supabase_id = '56e9ef97-5b34-476e-9e03-46cf90616ae5' OR e.name = 'Chicago Cubs'
SET e.supabase_id = '56e9ef97-5b34-476e-9e03-46cf90616ae5',
    e.id_mapping_restored = true,
    e.mapping_status = 'fixed',
    e.last_updated = datetime(),
    e.restoration_note = 'ID mapping restored after cleanup-induced reassignment'
RETURN e.name as entity_name, e.supabase_id as supabase_id, id(e) as neo4j_id;
