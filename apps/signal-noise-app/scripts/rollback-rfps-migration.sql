-- RFP Migration Rollback Script
-- Restores original tables in case of migration failure
-- 
-- WARNING: This will delete all data in rfp_opportunities_unified table
-- and restore rfps and rfp_opportunities tables from backups

BEGIN;

-- Log rollback start
DO $$
BEGIN
    RAISE NOTICE 'Starting RFP migration rollback at %', NOW();
    RAISE NOTICE 'This will delete unified table and restore from backups';
END $$;

-- Step 1: Verify backup tables exist and have data
DO $$
DECLARE
    rfps_backup_exists BOOLEAN;
    rfp_opps_backup_exists BOOLEAN;
    rfps_backup_count INTEGER;
    rfp_opps_backup_count INTEGER;
BEGIN
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rfps_backup_YYYYMMDD') INTO rfps_backup_exists;
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rfp_opportunities_backup_YYYYMMDD') INTO rfp_opps_backup_exists;
    
    IF NOT rfps_backup_exists OR NOT rfp_opps_backup_exists THEN
        RAISE EXCEPTION 'Backup tables do not exist. Cannot rollback.';
    END IF;
    
    EXECUTE 'SELECT COUNT(*) FROM rfps_backup_YYYYMMDD' INTO rfps_backup_count;
    EXECUTE 'SELECT COUNT(*) FROM rfp_opportunities_backup_YYYYMMDD' INTO rfp_opps_backup_count;
    
    RAISE NOTICE 'Backup tables verified: rfps (%) rfp_opportunities (%)', rfps_backup_count, rfp_opps_backup_count;
END $$;

-- Step 2: Clear current tables
DELETE FROM rfps;
DELETE FROM rfp_opportunities;

-- Step 3: Restore rfps table
INSERT INTO rfps 
SELECT * FROM rfps_backup_YYYYMMDD;

-- Step 4: Restore rfp_opportunities table
INSERT INTO rfp_opportunities 
SELECT * FROM rfp_opportunities_backup_YYYYMMDD;

-- Step 5: Drop unified table and related objects
DROP TABLE IF EXISTS rfp_opportunities_unified CASCADE;
DROP VIEW IF EXISTS active_rfp_opportunities;
DROP VIEW IF EXISTS ai_detected_rfps;
DROP VIEW IF EXISTS comprehensive_rfp_opportunities;
DROP VIEW IF EXISTS high_priority_opportunities;

-- Step 6: Drop migration functions
DROP FUNCTION IF EXISTS calculate_unified_rfp_priority(p_confidence DECIMAL, p_value DECIMAL, p_fit_score INTEGER, p_deadline DATE);
DROP FUNCTION IF EXISTS calculate_priority_score(p_confidence DECIMAL, p_value DECIMAL, p_fit_score INTEGER, p_deadline DATE);
DROP FUNCTION IF EXISTS parse_unified_numeric_value(p_value_string TEXT);
DROP FUNCTION IF EXISTS extract_unified_currency(p_value_string TEXT);
DROP FUNCTION IF EXISTS update_rfp_priorities();
DROP FUNCTION IF EXISTS update_rfp_unified_updated_at_column();

-- Step 7: Log rollback
INSERT INTO system_logs (timestamp, level, category, source, message, data)
VALUES (
    NOW(),
    'info',
    'database',
    'rfp-migration-rollback',
    'Completed RFP migration rollback - restored original tables',
    jsonb_build_object(
        'rfps_restored', (SELECT COUNT(*) FROM rfps),
        'rfp_opportunities_restored', (SELECT COUNT(*) FROM rfp_opportunities),
        'rollback_completed_at', NOW()
    )
);

-- Commit the rollback
COMMIT;

-- Log completion
DO $$
DECLARE
    rfps_count INTEGER;
    rfp_opps_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rfps_count FROM rfps;
    SELECT COUNT(*) INTO rfp_opps_count FROM rfp_opportunities;
    
    RAISE NOTICE 'RFP Migration rollback completed successfully at %', NOW();
    RAISE NOTICE 'Restored rfps: % records', rfps_count;
    RAISE NOTICE 'Restored rfp_opportunities: % records', rfp_opps_count;
    RAISE NOTICE 'Unified table and related objects have been dropped.';
    RAISE NOTICE 'System is back to original state.';
END $$;