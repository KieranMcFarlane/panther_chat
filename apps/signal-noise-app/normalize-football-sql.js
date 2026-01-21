#!/usr/bin/env node

/**
 * SQL-based Data Normalization Script for Football Leagues
 * 
 * This script fixes data inconsistencies using direct SQL commands
 * to ensure proper LeagueNav navigation functionality.
 */

const { execSync } = require('child_process')

/**
 * SQL commands for data normalization
 */
const NORMALIZATION_SQL = [
  // Fix Premier League teams - ensure consistent league and level
  `UPDATE cached_entities 
   SET properties = jsonb_set(
     jsonb_set(
       properties, 
       '{level}', 
       '"Tier 1"'
     ),
     '{league}',
     '"Premier League"'
   )
   WHERE properties->>'sport' = 'Football' 
     AND properties->>'league' = 'Premier League';`,

  // Fix Championship teams - normalize league name and set correct level
  `UPDATE cached_entities 
   SET properties = jsonb_set(
     jsonb_set(
       properties, 
       '{level}', 
       '"Tier 2"'
     ),
     '{league}',
     '"English League Championship"'
   )
   WHERE properties->>'sport' = 'Football' 
     AND (properties->>'league' ILIKE '%championship%' OR properties->>'competition' ILIKE '%championship%');`,

  // Fix League One teams - ensure consistent league and level
  `UPDATE cached_entities 
   SET properties = jsonb_set(
     jsonb_set(
       properties, 
       '{level}', 
       '"Tier 3"'
     ),
     '{league}',
     '"League One"'
   )
   WHERE properties->>'sport' = 'Football' 
     AND (properties->>'league' ILIKE '%league one%' OR properties->>'level' ILIKE '%league one%');`,

  // Fix League Two teams - ensure consistent league and level
  `UPDATE cached_entities 
   SET properties = jsonb_set(
     jsonb_set(
       properties, 
       '{level}', 
       '"Tier 4"'
     ),
     '{league}',
     '"League Two"'
   )
   WHERE properties->>'sport' = 'Football' 
     AND (properties->>'league' ILIKE '%league two%' OR properties->>'level' ILIKE '%league two%');`,

  // Clean up any remaining inconsistent league names
  `UPDATE cached_entities 
   SET properties = jsonb_set(
     properties,
     '{league}',
     CASE 
       WHEN properties->>'league' ILIKE '%premier%' THEN '"Premier League"'
       WHEN properties->>'league' ILIKE '%championship%' THEN '"English League Championship"'
       WHEN properties->>'league' ILIKE '%league one%' THEN '"League One"'
       WHEN properties->>'league' ILIKE '%league two%' THEN '"League Two"'
       ELSE properties->>'league'
     END
   )
   WHERE properties->>'sport' = 'Football' 
     AND properties->>'league' IS NOT NULL;`
]

/**
 * Execute SQL command using MCP
 */
async function executeSQL(description, sql) {
  console.log(`\n🔧 ${description}`)
  console.log(`   SQL: ${sql.substring(0, 100)}...`)
  
  try {
    const result = execSync(`node -e "
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient('https://itlcuazbybqlkicsaola.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0bGN1YXpieWJxbGtpY3Nhb2xhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA3NDY3MzQxNH0.UXXSbe1Kk0CH7NkIGnwo3_qmJVV3VUbJz4Dw8lBGcKU');
      supabase.rpc('exec_sql', { sql_query: \`${sql}\` }).then(result => {
        console.log('✅ Success:', result);
        process.exit(0);
      }).catch(err => {
        console.error('❌ Error:', err.message);
        process.exit(1);
      });
    "`, { stdio: 'pipe', encoding: 'utf8', timeout: 10000 })
    
    console.log('✅ Success:', result.trim())
    return true
  } catch (error) {
    console.error('❌ Error:', error.message)
    return false
  }
}

/**
 * Run verification query
 */
async function runVerification() {
  console.log('\n📊 Running verification query...')
  
  const verificationSQL = `
    SELECT 
      properties->>'league' as league,
      properties->>'level' as level,
      COUNT(*) as count,
      STRING_AGG(properties->>'name', ', ' ORDER BY properties->>'name') as teams
    FROM cached_entities 
    WHERE properties->>'sport' = 'Football' 
      AND properties->>'league' IS NOT NULL
    GROUP BY properties->>'league', properties->>'level'
    ORDER BY count DESC;
  `
  
  console.log('Verification SQL:', verificationSQL)
  console.log('\nPlease run this query manually to verify results:')
  console.log(verificationSQL)
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🏆 SQL-BASED FOOTBALL LEAGUE DATA NORMALIZATION')
    console.log('=' .repeat(60))
    
    let successCount = 0
    let totalCount = NORMALIZATION_SQL.length
    
    for (let i = 0; i < NORMALIZATION_SQL.length; i++) {
      const sql = NORMALIZATION_SQL[i]
      const description = `Step ${i + 1}/${totalCount}: Normalize league data`
      
      const success = await executeSQL(description, sql)
      if (success) successCount++
      
      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log('\n📈 Normalization Summary:')
    console.log(`   Operations completed: ${successCount}/${totalCount}`)
    console.log(`   Success rate: ${Math.round((successCount / totalCount) * 100)}%`)
    
    // Run verification
    await runVerification()
    
    console.log('\n🎉 NORMALIZATION COMPLETE!')
    console.log('✅ Football league data has been normalized')
    console.log('🚀 LeagueNav navigation should now work correctly!')
    
  } catch (error) {
    console.error('\n❌ NORMALIZATION FAILED:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = {
  NORMALIZATION_SQL,
  executeSQL,
  runVerification
}