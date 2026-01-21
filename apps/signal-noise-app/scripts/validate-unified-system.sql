-- RFP Unified System Validation and Testing Script
-- This script validates that the entire unified RFP system is working correctly

DO $$
DECLARE
    total_unified INTEGER;
    ai_detected_count INTEGER;
    comprehensive_count INTEGER;
    static_count INTEGER;
    validation_errors TEXT[] := '{}';
    validation_passed BOOLEAN := TRUE;
BEGIN
    RAISE NOTICE '🔍 Starting Unified RFP System Validation...';
    
    -- Test 1: Check unified table exists and has data
    SELECT COUNT(*) INTO total_unified FROM rfp_opportunities_unified;
    
    IF total_unified = 0 THEN
        validation_errors := array_append(validation_errors, 'Unified table is empty');
        validation_passed := FALSE;
    ELSE
        RAISE NOTICE '✅ Unified table contains % records', total_unified;
    END IF;
    
    -- Test 2: Check source distribution
    SELECT COUNT(*) INTO ai_detected_count FROM rfp_opportunities_unified WHERE source = 'ai-detected';
    SELECT COUNT(*) INTO comprehensive_count FROM rfp_opportunities_unified WHERE source = 'comprehensive';
    SELECT COUNT(*) INTO static_count FROM rfp_opportunities_unified WHERE source = 'static';
    
    RAISE NOTICE '📊 Source Distribution:';
    RAISE NOTICE '   AI-Detected: % records', ai_detected_count;
    RAISE NOTICE '   Comprehensive: % records', comprehensive_count;
    RAISE NOTICE '   Static: % records', static_count;
    
    IF (ai_detected_count + comprehensive_count + static_count) <> total_unified THEN
        validation_errors := array_append(validation_errors, 'Source counts do not match total');
        validation_passed := FALSE;
    END IF;
    
    -- Test 3: Check required fields are not null
    DECLARE
        null_titles INTEGER;
        null_orgs INTEGER;
        invalid_confidence INTEGER;
        invalid_fit_scores INTEGER;
    BEGIN
        SELECT COUNT(*) INTO null_titles FROM rfp_opportunities_unified WHERE title IS NULL;
        SELECT COUNT(*) INTO null_orgs FROM rfp_opportunities_unified WHERE organization IS NULL;
        SELECT COUNT(*) INTO invalid_confidence FROM rfp_opportunities_unified 
            WHERE confidence_score IS NOT NULL AND (confidence_score < 0 OR confidence_score > 1);
        SELECT COUNT(*) INTO invalid_fit_scores FROM rfp_opportunities_unified 
            WHERE yellow_panther_fit IS NOT NULL AND (yellow_panther_fit < 0 OR yellow_panther_fit > 100);
        
        IF null_titles > 0 THEN
            validation_errors := array_append(validation_errors, format('Found % records with NULL titles', null_titles));
            validation_passed := FALSE;
        END IF;
        
        IF null_orgs > 0 THEN
            validation_errors := array_append(validation_errors, format('Found % records with NULL organizations', null_orgs));
            validation_passed := FALSE;
        END IF;
        
        IF invalid_confidence > 0 THEN
            validation_errors := array_append(validation_errors, format('Found % records with invalid confidence scores', invalid_confidence));
            validation_passed := FALSE;
        END IF;
        
        IF invalid_fit_scores > 0 THEN
            validation_errors := array_append(validation_errors, format('Found % records with invalid fit scores', invalid_fit_scores));
            validation_passed := FALSE;
        END IF;
        
        IF null_titles = 0 AND null_orgs = 0 AND invalid_confidence = 0 AND invalid_fit_scores = 0 THEN
            RAISE NOTICE '✅ All required fields are properly populated';
        END IF;
    END;
    
    -- Test 4: Check views are working
    DECLARE
        view_count INTEGER;
    BEGIN
        -- Test ai_detected_rfps view
        PERFORM 1 FROM ai_detected_rfps LIMIT 1;
        
        -- Test comprehensive_rfp_opportunities view
        PERFORM 1 FROM comprehensive_rfp_opportunities LIMIT 1;
        
        -- Test active_rfp_opportunities view
        PERFORM 1 FROM active_rfp_opportunities LIMIT 1;
        
        RAISE NOTICE '✅ All database views are working correctly';
        
    EXCEPTION WHEN OTHERS THEN
        validation_errors := array_append(validation_errors, 'Database views are not working correctly');
        validation_passed := FALSE;
    END;
    
    -- Test 5: Check functions are working
    DECLARE
        test_priority TEXT;
        test_score INTEGER;
    BEGIN
        SELECT calculate_unified_rfp_priority(0.85, 1500000, 90, CURRENT_DATE + 30) INTO test_priority;
        SELECT calculate_priority_score(0.85, 1500000, 90, CURRENT_DATE + 30) INTO test_score;
        
        IF test_priority IS NULL OR test_score IS NULL THEN
            validation_errors := array_append(validation_errors, 'Priority calculation functions are not working');
            validation_passed := FALSE;
        ELSE
            RAISE NOTICE '✅ Priority calculation functions are working correctly';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        validation_errors := array_append(validation_errors, 'Priority calculation functions failed');
        validation_passed := FALSE;
    END;
    
    -- Test 6: Check indexes exist for performance
    DECLARE
        index_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO index_count 
        FROM pg_indexes 
        WHERE tablename = 'rfp_opportunities_unified' 
        AND indexname NOT LIKE '%_pkey';
        
        IF index_count < 10 THEN
            validation_errors := array_append(validation_errors, format('Insufficient indexes: only % found (expected at least 10)', index_count));
            validation_passed := FALSE;
        ELSE
            RAISE NOTICE '✅ Sufficient database indexes are present (%)', index_count;
        END IF;
    END;
    
    -- Test 7: Check real-time subscriptions would work (RLS policies)
    DECLARE
        rls_enabled BOOLEAN;
    BEGIN
        SELECT relrowsecurity INTO rls_enabled 
        FROM pg_class 
        WHERE relname = 'rfp_opportunities_unified';
        
        IF rls_enabled THEN
            RAISE NOTICE '✅ Row Level Security is enabled for real-time subscriptions';
        ELSE
            validation_errors := array_append(validation_errors, 'Row Level Security is not enabled');
            validation_passed := FALSE;
        END IF;
    END;
    
    -- Final validation result
    IF validation_passed THEN
        -- Log successful validation
        INSERT INTO system_logs (timestamp, level, category, source, message, data)
        VALUES (
            NOW(),
            'info',
            'database',
            'unified-system-validation',
            'Unified RFP system validation passed successfully',
            jsonb_build_object(
                'total_records', total_unified,
                'ai_detected', ai_detected_count,
                'comprehensive', comprehensive_count,
                'static', static_count,
                'validation_passed', true,
                'validated_at', NOW()
            )
        );
        
        RAISE NOTICE '';
        RAISE NOTICE '🎉 UNIFIED RFP SYSTEM VALIDATION PASSED 🎉';
        RAISE NOTICE '';
        RAISE NOTICE '📊 System Summary:';
        RAISE NOTICE '   Total Records: %', total_unified;
        RAISE NOTICE '   AI-Detected: %', ai_detected_count;
        RAISE NOTICE '   Comprehensive: %', comprehensive_count;
        RAISE NOTICE '   Static Fallback: %', static_count;
        RAISE NOTICE '';
        RAISE NOTICE '✅ All validation tests passed successfully!';
        RAISE NOTICE '✅ System is ready for production use';
        RAISE NOTICE '';
        RAISE NOTICE '🚀 Next Steps:';
        RAISE NOTICE '   1. Test the frontend (/tenders page)';
        RAISE NOTICE '   2. Verify API endpoints work correctly';
        RAISE NOTICE '   3. Test real-time subscriptions';
        RAISE NOTICE '   4. Monitor system performance';
        RAISE NOTICE '';
        
    ELSE
        -- Log validation failure
        INSERT INTO system_logs (timestamp, level, category, source, message, data)
        VALUES (
            NOW(),
            'error',
            'database',
            'unified-system-validation',
            'Unified RFP system validation FAILED',
            jsonb_build_object(
                'validation_errors', validation_errors,
                'total_records', total_unified,
                'validation_failed_at', NOW()
            )
        );
        
        RAISE NOTICE '';
        RAISE NOTICE '❌ UNIFIED RFP SYSTEM VALIDATION FAILED ❌';
        RAISE NOTICE '';
        RAISE NOTICE 'Validation Errors Found:';
        FOREACH error IN ARRAY validation_errors LOOP
            RAISE NOTICE '   - %', error;
        END LOOP;
        RAISE NOTICE '';
        RAISE NOTICE '🔧 Required Actions:';
        RAISE NOTICE '   1. Fix validation errors listed above';
        RAISE NOTICE '   2. Re-run validation script';
        RAISE NOTICE '   3. Ensure all data integrity checks pass';
        RAISE NOTICE '';
        
        -- Raise exception to prevent further processing
        RAISE EXCEPTION 'System validation failed. See logs for details.';
    END IF;
    
END $$;