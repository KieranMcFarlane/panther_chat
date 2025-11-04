-- Helper function to list all tables in your Supabase database
-- Run this in your Supabase SQL Editor to see available tables

CREATE OR REPLACE FUNCTION get_user_tables()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  size_mb NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname || '.' || tablename as table_name,
    n_tup_ins - n_tup_del as row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_mb
  FROM pg_tables 
  WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    AND tablename NOT LIKE 'pg_%'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$;

-- Also create a function to get sample data from any table
CREATE OR REPLACE FUNCTION get_table_sample(
  table_name TEXT,
  limit_count INT DEFAULT 5
)
RETURNS TABLE (
  sample_columns JSONB,
  column_count INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  sql_query TEXT;
BEGIN
  sql_query := format('SELECT * FROM %s LIMIT %s', table_name, limit_count);
  
  RETURN QUERY
  SELECT 
    row_to_json(t) as sample_columns,
    array_length(string_to_array(column_name::text, ','), 1) as column_count
  FROM (
    SELECT * FROM 
      (EXECUTE sql_query) as t,
      (SELECT array_agg(column_name::text) as column_name 
       FROM information_schema.columns 
       WHERE table_name = split_part(table_name, '.', 2)) as cols
  ) as sample_data;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::jsonb, 0;
END;
$$;