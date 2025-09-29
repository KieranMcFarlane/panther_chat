-- Create a function for searching cached entities with full-text search capabilities
CREATE OR REPLACE FUNCTION search_cached_entities(
    search_term TEXT DEFAULT '',
    entity_type TEXT DEFAULT '',
    page_num INTEGER DEFAULT 1,
    limit_num INTEGER DEFAULT 20,
    sort_by TEXT DEFAULT 'name',
    sort_order TEXT DEFAULT 'asc'
)
RETURNS TABLE (
    id UUID,
    neo4j_id TEXT,
    labels TEXT[],
    properties JSONB,
    total_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    start_offset INTEGER;
    total_result INTEGER;
    sort_column TEXT;
    order_direction TEXT;
BEGIN
    -- Calculate pagination offset
    start_offset := (page_num - 1) * limit_num;
    
    -- Determine sort column
    sort_column := CASE 
        WHEN sort_by = 'name' THEN 'properties->>name'
        WHEN sort_by = 'type' THEN 'properties->>type'
        WHEN sort_by = 'sport' THEN 'properties->>sport'
        WHEN sort_by = 'country' THEN 'properties->>country'
        WHEN sort_by = 'priorityScore' THEN 'properties->>priorityScore'
        WHEN sort_by = 'estimatedValue' THEN 'properties->>estimatedValue'
        ELSE 'properties->>name'
    END;
    
    -- Determine sort direction
    order_direction := CASE 
        WHEN LOWER(sort_order) = 'desc' THEN 'DESC'
        ELSE 'ASC'
    END;
    
    -- Get total count for pagination
    IF search_term IS NOT NULL AND search_term != '' THEN
        -- Count with search conditions
        SELECT COUNT(*) INTO total_result
        FROM cached_entities
        WHERE 
            (entity_type = '' OR entity_type = 'all' OR entity_type = ANY(labels))
            AND (
                LOWER(properties->>'name') LIKE '%' || LOWER(search_term) || '%'
                OR LOWER(properties->>'description') LIKE '%' || LOWER(search_term) || '%'
                OR LOWER(properties->>'type') LIKE '%' || LOWER(search_term) || '%'
                OR LOWER(properties->>'sport') LIKE '%' || LOWER(search_term) || '%'
                OR LOWER(properties->>'country') LIKE '%' || LOWER(search_term) || '%'
                OR (properties->>'level' IS NOT NULL AND LOWER(properties->>'level') LIKE '%' || LOWER(search_term) || '%')
            );
    ELSE
        -- Count without search
        SELECT COUNT(*) INTO total_result
        FROM cached_entities
        WHERE entity_type = '' OR entity_type = 'all' OR entity_type = ANY(labels);
    END IF;
    
    -- Return the query results
    RETURN QUERY
    SELECT 
        ce.id,
        ce.neo4j_id,
        ce.labels,
        ce.properties,
        total_result
    FROM cached_entities ce
    WHERE 
        (entity_type = '' OR entity_type = 'all' OR entity_type = ANY(ce.labels))
        AND (
            search_term IS NULL 
            OR search_term = ''
            OR LOWER(ce.properties->>'name') LIKE '%' || LOWER(search_term) || '%'
            OR LOWER(ce.properties->>'description') LIKE '%' || LOWER(search_term) || '%'
            OR LOWER(ce.properties->>'type') LIKE '%' || LOWER(search_term) || '%'
            OR LOWER(ce.properties->>'sport') LIKE '%' || LOWER(search_term) || '%'
            OR LOWER(ce.properties->>'country') LIKE '%' || LOWER(search_term) || '%'
            OR (ce.properties->>'level' IS NOT NULL AND LOWER(ce.properties->>'level') LIKE '%' || LOWER(search_term) || '%')
        )
    ORDER BY 
        CASE 
            WHEN sort_column = 'properties->>name' AND order_direction = 'ASC' THEN ce.properties->>'name'
            WHEN sort_column = 'properties->>name' AND order_direction = 'DESC' THEN ce.properties->>'name'
        END ASC,
        CASE 
            WHEN sort_column = 'properties->>type' AND order_direction = 'ASC' THEN ce.properties->>'type'
            WHEN sort_column = 'properties->>type' AND order_direction = 'DESC' THEN ce.properties->>'type'
        END ASC,
        CASE 
            WHEN sort_column = 'properties->>sport' AND order_direction = 'ASC' THEN ce.properties->>'sport'
            WHEN sort_column = 'properties->>sport' AND order_direction = 'DESC' THEN ce.properties->>'sport'
        END ASC,
        CASE 
            WHEN sort_column = 'properties->>country' AND order_direction = 'ASC' THEN ce.properties->>'country'
            WHEN sort_column = 'properties->>country' AND order_direction = 'DESC' THEN ce.properties->>'country'
        END ASC,
        CASE 
            WHEN sort_column = 'properties->>priorityScore' AND order_direction = 'ASC' THEN (ce.properties->>'priorityScore')::INTEGER
            WHEN sort_column = 'properties->>priorityScore' AND order_direction = 'DESC' THEN (ce.properties->>'priorityScore')::INTEGER
        END ASC,
        CASE 
            WHEN sort_column = 'properties->>estimatedValue' AND order_direction = 'ASC' THEN (ce.properties->>'estimatedValue')::NUMERIC
            WHEN sort_column = 'properties->>estimatedValue' AND order_direction = 'DESC' THEN (ce.properties->>'estimatedValue')::NUMERIC
        END ASC
    LIMIT limit_num OFFSET start_offset;
    
    -- If no results, return empty set with total count
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT[], NULL::JSONB, total_result WHERE false;
    END IF;
END;
$$;