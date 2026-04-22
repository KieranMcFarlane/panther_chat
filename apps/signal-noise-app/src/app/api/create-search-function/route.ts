import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/pg-client'

export async function POST(request: NextRequest) {
  try {
    // SQL to create the search function for canonical_entities
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION search_canonical_entities(
          search_term TEXT DEFAULT '',
          entity_type TEXT DEFAULT '',
          page_num INTEGER DEFAULT 1,
          limit_num INTEGER DEFAULT 20,
          sort_by TEXT DEFAULT 'name',
          sort_order TEXT DEFAULT 'asc'
      )
      RETURNS TABLE (
          id UUID,
          name TEXT,
          entity_type_col TEXT,
          sport TEXT,
          country TEXT,
          league TEXT,
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
          start_offset := (page_num - 1) * limit_num;

          sort_column := CASE
              WHEN sort_by = 'name' THEN 'name'
              WHEN sort_by = 'type' THEN 'entity_type'
              WHEN sort_by = 'sport' THEN 'sport'
              WHEN sort_by = 'country' THEN 'country'
              ELSE 'name'
          END;

          order_direction := CASE
              WHEN LOWER(sort_order) = 'desc' THEN 'DESC'
              ELSE 'ASC'
          END;

          IF search_term IS NOT NULL AND search_term != '' THEN
              SELECT COUNT(*) INTO total_result
              FROM canonical_entities
              WHERE
                  (entity_type = '' OR entity_type = 'all' OR entity_type = ANY(labels))
                  AND (
                      LOWER(name) LIKE '%' || LOWER(search_term) || '%'
                      OR LOWER(entity_type) LIKE '%' || LOWER(search_term) || '%'
                      OR LOWER(sport) LIKE '%' || LOWER(search_term) || '%'
                      OR LOWER(country) LIKE '%' || LOWER(search_term) || '%'
                      OR LOWER(league) LIKE '%' || LOWER(search_term) || '%'
                  );
          ELSE
              SELECT COUNT(*) INTO total_result
              FROM canonical_entities
              WHERE entity_type = '' OR entity_type = 'all' OR entity_type = ANY(labels);
          END IF;

          RETURN QUERY
          SELECT
              ce.id,
              ce.name,
              ce.entity_type,
              ce.sport,
              ce.country,
              ce.league,
              ce.labels,
              ce.properties,
              total_result
          FROM canonical_entities ce
          WHERE
              (entity_type = '' OR entity_type = 'all' OR entity_type = ANY(ce.labels))
              AND (
                  search_term IS NULL
                  OR search_term = ''
                  OR LOWER(ce.name) LIKE '%' || LOWER(search_term) || '%'
                  OR LOWER(ce.entity_type) LIKE '%' || LOWER(search_term) || '%'
                  OR LOWER(ce.sport) LIKE '%' || LOWER(search_term) || '%'
                  OR LOWER(ce.country) LIKE '%' || LOWER(search_term) || '%'
                  OR LOWER(ce.league) LIKE '%' || LOWER(search_term) || '%'
              )
          ORDER BY
              CASE WHEN sort_column = 'name' AND order_direction = 'ASC' THEN ce.name END ASC,
              CASE WHEN sort_column = 'name' AND order_direction = 'DESC' THEN ce.name END DESC,
              CASE WHEN sort_column = 'entity_type' AND order_direction = 'ASC' THEN ce.entity_type END ASC,
              CASE WHEN sort_column = 'entity_type' AND order_direction = 'DESC' THEN ce.entity_type END DESC,
              CASE WHEN sort_column = 'sport' AND order_direction = 'ASC' THEN ce.sport END ASC,
              CASE WHEN sort_column = 'sport' AND order_direction = 'DESC' THEN ce.sport END DESC,
              CASE WHEN sort_column = 'country' AND order_direction = 'ASC' THEN ce.country END ASC,
              CASE WHEN sort_column = 'country' AND order_direction = 'DESC' THEN ce.country END DESC
          LIMIT limit_num OFFSET start_offset;
      END;
      $$;
    `

    const { data, error } = await supabase.rpc('exec', { sql: createFunctionSQL })

    if (error) {
      const { data: rawData, error: rawError } = await supabase
        .from('canonical_entities')
        .select('id')
        .limit(1)

      if (rawError) {
        return NextResponse.json({ error: 'Failed to connect to database' }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Database connection verified. Please create the RPC function manually in Supabase SQL editor.',
        sql: createFunctionSQL
      })
    }

    return NextResponse.json({
      message: 'Search function created successfully',
      function: 'search_canonical_entities'
    })

  } catch (error) {
    console.error('❌ Failed to create search function:', error)
    return NextResponse.json(
      { error: 'Failed to create search function' },
      { status: 500 }
    )
  }
}
