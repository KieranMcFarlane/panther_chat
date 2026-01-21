-- RFP Migration Validation Script
-- Validates that the migration completed successfully with no data loss
-- 
-- Run this after the migration script to ensure data integrity

DO $$
DECLARE
    -- Variables for counting
    rfps_original_count INTEGER;
    rfp_opps_original_count INTEGER;
    unified_total_count INTEGER;
    ai_detected_count INTEGER;
    comprehensive_count INTEGER;
    
    -- Variables for validation
    validation_errors TEXT[] := '{}';
    validation_passed BOOLEAN := TRUE;
    
    -- Record counts
    rfps_backup_count INTEGER;
    rfp_opps_backup_count INTEGER;
    
BEGIN
    RAISE NOTICE 'Starting RFP migration validation at %', NOW();
    
    -- Step 1: Check backup tables exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rfps_backup_YYYYMMDD') THEN
        validation_errors := array_append(validation_errors, 'Backup table rfps_backup_YYYYMMDD does not exist');
        validation_passed := FALSE;
    END IF;
    
    IF NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rfp_opportunities_backup_YYYYMMDD') THEN
        validation_errors := array_append(validation_errors, 'Backup table rfp_opportunities_backup_YYYYMMDD does not exist');
        validation_passed := FALSE;
    END IF;
    
    -- Step 2: Get original counts from backups
    BEGIN
        EXECUTE 'SELECT COUNT(*) FROM rfps_backup_YYYYMMDD' INTO rfps_original_count;
        EXECUTE 'SELECT COUNT(*) FROM rfp_opportunities_backup_YYYYMMDD' INTO rfp_opps_original_count;
        
        RAISE NOTICE 'Original data counts - rfps: %, rfp_opportunities: %', rfps_original_count, rfp_opps_original_count;
    EXCEPTION WHEN OTHERS THEN
        validation_errors := array_append(validation_errors, 'Failed to get counts from backup tables: ' || SQLERRM);
        validation_passed := FALSE;
    END;
    
    -- Step 3: Check unified table exists and has data
    IF NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rfp_opportunities_unified') THEN
        validation_errors := array_append(validation_errors, 'Unified table rfp_opportunities_unified does not exist');
        validation_passed := FALSE;
    ELSE
        SELECT COUNT(*) INTO unified_total_count FROM rfp_opportunities_unified;
        RAISE NOTICE 'Unified table has % total records', unified_total_count;
        
        -- Check total count matches
        IF unified_total_count <> (rfps_original_count + rfp_opps_original_count) THEN
            validation_errors := array_append(validation_errors, 
                format('Total count mismatch: expected % (rfps) + % (opportunities) = %, but found % in unified table',
                    rfps_original_count, rfp_opps_original_count, 
                    rfps_original_count + rfp_opps_original_count, unified_total_count));
            validation_passed := FALSE;
        END IF;
    END IF;
    
    -- Step 4: Validate AI-detected records
    IF validation_passed THEN
        SELECT COUNT(*) INTO ai_detected_count 
        FROM rfp_opportunities_unified 
        WHERE source = 'ai-detected';
        
        RAISE NOTICE 'AI-detected records in unified table: %', ai_detected_count;
        
        IF ai_detected_count <> rfps_original_count THEN
            validation_errors := array_append(validation_errors, 
                format('AI-detected count mismatch: expected %, found %', rfps_original_count, ai_detected_count));
            validation_passed := FALSE;
        END IF;
    END IF;
    
    -- Step 5: Validate comprehensive records
    IF validation_passed THEN
        SELECT COUNT(*) INTO comprehensive_count 
        FROM rfp_opportunities_unified 
        WHERE source = 'comprehensive';
        
        RAISE NOTICE 'Comprehensive records in unified table: %', comprehensive_count;
        
        IF comprehensive_count <> rfp_opps_original_count THEN
            validation_errors := array_append(validation_errors, 
                format('Comprehensive count mismatch: expected %, found %', rfp_opps_original_count, comprehensive_count));
            validation_passed := FALSE;
        END IF;
    END IF;
    
    -- Step 6: Validate data integrity for key fields
    IF validation_passed THEN
        -- Check for NULL titles (shouldn't happen)
        DECLARE
            null_titles INTEGER;
        BEGIN
            SELECT COUNT(*) INTO null_titles FROM rfp_opportunities_unified WHERE title IS NULL;
            IF null_titles > 0 THEN
                validation_errors := array_append(validation_errors, 
                    format('Found % records with NULL titles', null_titles));
                validation_passed := FALSE;
            END IF;
        END;
        
        -- Check for NULL organizations
        DECLARE
            null_orgs INTEGER;
        BEGIN
            SELECT COUNT(*) INTO null_orgs FROM rfp_opportunities_unified WHERE organization IS NULL;
            IF null_orgs > 0 THEN
                validation_errors := array_append(validation_errors, 
                    format('Found % records with NULL organizations', null_orgs));
                validation_passed := FALSE;
            END IF;
        END;
        
        -- Check confidence scores are in valid range for AI-detected
        DECLARE
            invalid_confidence INTEGER;
        BEGIN
            SELECT COUNT(*) INTO invalid_confidence 
            FROM rfp_opportunities_unified 
            WHERE source = 'ai-detected' 
            AND (confidence_score IS NOT NULL AND (confidence_score < 0 OR confidence_score > 1));
            
            IF invalid_confidence > 0 THEN
                validation_errors := array_append(validation_errors, 
                    format('Found % AI-detected records with invalid confidence scores', invalid_confidence));
                validation_passed := FALSE;
            END IF;
        END;
        
        -- Check fit scores are in valid range for comprehensive
        DECLARE
            invalid_fit INTEGER;
        BEGIN
            SELECT COUNT(*) INTO invalid_fit 
            FROM rfp_opportunities_unified 
            WHERE source = 'comprehensive' 
            AND (yellow_panther_fit IS NOT NULL AND (yellow_panther_fit < 0 OR yellow_panther_fit > 100));
            
            IF invalid_fit > 0 THEN
                validation_errors := array_append(validation_errors, 
                    format('Found % comprehensive records with invalid fit scores', invalid_fit));
                validation_passed := FALSE;
            END IF;
        END;
    END IF;
    
    -- Step 7: Validate views exist and work
    IF validation_passed THEN
        -- Test ai_detected_rfps view
        BEGIN
            PERFORM 1 FROM ai_detected_rfps LIMIT 1;
            RAISE NOTICE 'ai_detected_rfps view works correctly';
        EXCEPTION WHEN OTHERS THEN
            validation_errors := array_append(validation_errors, 'ai_detected_rfps view failed: ' || SQLERRM);
            validation_passed := FALSE;
        END;
        
        -- Test comprehensive_rfp_opportunities view
        BEGIN
            PERFORM 1 FROM comprehensive_rfp_opportunities LIMIT 1;
            RAISE NOTICE 'comprehensive_rfp_opportunities view works correctly';
        EXCEPTION WHEN OTHERS THEN
            validation_errors := array_append(validation_errors, 'comprehensive_rfp_opportunities view failed: ' || SQLERRM);
            validation_passed := FALSE;
        END;
        
        -- Test active_rfp_opportunities view
        BEGIN
            PERFORM 1 FROM active_rfp_opportunities LIMIT 1;
            RAISE NOTICE 'active_rfp_opportunities view works correctly';
        EXCEPTION WHEN OTHERS THEN
            validation_errors := array_append(validation_errors, 'active_rfp_opportunities view failed: ' || SQLERRM);
            validation_passed := FALSE;
        END;
    END IF;
    
    -- Step 8: Validate functions work
    IF validation_passed THEN
        -- Test priority calculation function
        BEGIN
            PERFORM calculate_unified_rfp_priority(0.8, 1000000, 85, CURRENT_DATE + 30);
            RAISE NOTICE 'Priority calculation function works correctly';
        EXCEPTION WHEN OTHERS THEN
            validation_errors := array_append(validation_errors, 'Priority calculation function failed: ' || SQLERRM);
            validation_passed := FALSE;
        END;
        
        -- Test priority score calculation function
        BEGIN
            PERFORM calculate_priority_score(0.8, 1000000, 85, CURRENT_DATE + 30);
            RAISE NOTICE 'Priority score calculation function works correctly';
        EXCEPTION WHEN OTHERS THEN
            validation_errors := array_append(validation_errors, 'Priority score calculation function failed: ' || SQLERRM);
            validation_passed := FALSE;
        END;
    END IF;
    
    -- Step 9: Final validation result
    IF validation_passed THEN
        -- Log successful validation
        INSERT INTO system_logs (timestamp, level, category, source, message, data)
        VALUES (
            NOW(),
            'info',
            'database',
            'rfp-migration-validation',
            'RFP migration validation passed successfully',
            jsonb_build_object(
                'rfps_original', rfps_original_count,
                'rfp_opportunities_original', rfp_opps_original_count,
                'unified_total', unified_total_count,
                'ai_detected', ai_detected_count,
                'comprehensive', comprehensive_count,
                'validation_completed_at', NOW()
            )
        );
        
        RAISE NOTICE '';
        RAISE NOTICE '✅ RFP Migration Validation PASSED ✅';
        RAISE NOTICE 'Migration completed successfully with no data loss!';
        RAISE NOTICE 'Summary:';
        RAISE NOTICE '  - Original rfps: % → Unified AI-detected: %', rfps_original_count, ai_detected_count;
        RAISE NOTICE '  - Original opportunities: % → Unified comprehensive: %', rfp_opps_original_count, comprehensive_count;
        RAISE NOTICE '  - Total unified records: %', unified_total_count;
        RAISE NOTICE '  - All views and functions working correctly';
        RAISE NOTICE '';
        RAISE NOTICE 'You can now proceed with updating the application services.';
        
    ELSE
        -- Log validation failure
        INSERT INTO system_logs (timestamp, level, category, source, message, data)
        VALUES (
            NOW(),
            'error',
            'database',
            'rfp-migration-validation',
            'RFP migration validation FAILED',
            jsonb_build_object(
                'validation_errors', validation_errors,
                'rfps_original', rfps_original_count,
                'rfp_opportunities_original', rfp_opps_original_count,
                'unified_total', COALESCE(unified_total_count, 0),
                'validation_failed_at', NOW()
            )
        );
        
        RAISE NOTICE '';
        RAISE NOTICE '❌ RFP Migration Validation FAILED ❌';
        RAISE NOTICE 'Validation errors found:';
        FOREACH error IN ARRAY validation_errors LOOP
            RAISE NOTICE '  - %', error;
        END LOOP;
        RAISE NOTICE '';
        RAISE NOTICE 'Please review the errors and run the rollback script if needed:';
        RAISE NOTICE '  psql -f scripts/rollback-rfps-migration.sql';
        RAISE NOTICE '';
        
        -- Raise exception to prevent further processing
        RAISE EXCEPTION 'Migration validation failed. See logs for details.';
    END IF;
    
END $$;