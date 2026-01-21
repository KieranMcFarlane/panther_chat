#!/usr/bin/env node

/**
 * Data Normalization Script for Football Leagues
 * 
 * This script fixes data inconsistencies in the cached_entities table to ensure
 * proper LeagueNav navigation functionality.
 * 
 * Issues being fixed:
 * 1. Inconsistent league/competition naming
 * 2. Missing or inconsistent level data
 * 3. Duplicate Premier League entries with different metadata
 */

const { createClient } = require('@supabase/supabase-js')

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * League normalization mapping
 */
const LEAGUE_NORMALIZATION = {
  // Championship variations
  'championship': 'English League Championship',
  'efl championship': 'English League Championship',
  'english league championship': 'English League Championship',
  
  // Premier League variations
  'premier league': 'Premier League',
  'english premier league': 'Premier League',
  'barclays premier league': 'Premier League',
  
  // League One variations
  'league one': 'League One',
  'efl league one': 'League One',
  'english league one': 'League One',
  
  // League Two variations
  'league two': 'League Two',
  'efl league two': 'League Two',
  'english league two': 'League Two'
}

/**
 * Level mapping for each league
 */
const LEVEL_MAPPING = {
  'Premier League': 'Tier 1',
  'English League Championship': 'Tier 2',
  'League One': 'Tier 3',
  'League Two': 'Tier 4'
}

/**
 * Normalize league name
 */
function normalizeLeagueName(league) {
  if (!league) return null
  
  const normalized = league.toLowerCase().trim()
  return LEAGUE_NORMALIZATION[normalized] || league
}

/**
 * Get correct level for league
 */
function getCorrectLevel(league) {
  if (!league) return null
  return LEVEL_MAPPING[league] || null
}

/**
 * Analyze current data state
 */
async function analyzeCurrentData() {
  console.log('\n🔍 ANALYZING CURRENT DATA STATE')
  console.log('=' .repeat(60))
  
  const { data, error } = await supabase
    .from('cached_entities')
    .select('id, properties')
    .eq('properties->>sport', 'Football')
    .not('properties->>league', 'is', null)
  
  if (error) {
    console.error('❌ Error fetching data:', error)
    throw error
  }
  
  const stats = {
    total: data.length,
    premierLeague: 0,
    championship: 0,
    leagueOne: 0,
    leagueTwo: 0,
    missingLevels: 0,
    inconsistent: 0
  }
  
  const issues = []
  
  data.forEach(entity => {
    const props = entity.properties
    const league = normalizeLeagueName(props.league)
    const level = props.level
    
    // Count by league
    switch (league) {
      case 'Premier League':
        stats.premierLeague++
        break
      case 'English League Championship':
        stats.championship++
        break
      case 'League One':
        stats.leagueOne++
        break
      case 'League Two':
        stats.leagueTwo++
        break
    }
    
    // Check for missing levels
    if (!level || level === null) {
      stats.missingLevels++
      issues.push({
        id: entity.id,
        name: props.name,
        issue: 'Missing level',
        league: props.league,
        level: props.level
      })
    }
    
    // Check for inconsistent data
    if (props.league !== normalizeLeagueName(props.league)) {
      stats.inconsistent++
      issues.push({
        id: entity.id,
        name: props.name,
        issue: 'League name needs normalization',
        current: props.league,
        normalized: normalizeLeagueName(props.league)
      })
    }
  })
  
  console.log('📊 Current Data Statistics:')
  console.log(`   Total Football Teams: ${stats.total}`)
  console.log(`   Premier League: ${stats.premierLeague}`)
  console.log(`   Championship: ${stats.championship}`)
  console.log(`   League One: ${stats.leagueOne}`)
  console.log(`   League Two: ${stats.leagueTwo}`)
  console.log(`   Missing Levels: ${stats.missingLevels}`)
  console.log(`   Inconsistent Names: ${stats.inconsistent}`)
  
  if (issues.length > 0) {
    console.log('\n⚠️  Data Issues Found (first 10):')
    issues.slice(0, 10).forEach(issue => {
      console.log(`   ${issue.name}: ${issue.issue}`)
    })
  }
  
  return { data, issues, stats }
}

/**
 * Update entities with normalized data
 */
async function normalizeData() {
  console.log('\n🔧 STARTING DATA NORMALIZATION')
  console.log('=' .repeat(60))
  
  const { data: entities, error } = await supabase
    .from('cached_entities')
    .select('id, properties')
    .eq('properties->>sport', 'Football')
    .not('properties->>league', 'is', null)
  
  if (error) {
    console.error('❌ Error fetching entities:', error)
    throw error
  }
  
  console.log(`📝 Processing ${entities.length} football entities...`)
  
  let updateCount = 0
  const errors = []
  
  for (const entity of entities) {
    try {
      const props = entity.properties
      const originalLeague = props.league
      const originalLevel = props.level
      
      // Normalize league name
      const normalizedLeague = normalizeLeagueName(originalLeague)
      const correctLevel = getCorrectLevel(normalizedLeague)
      
      // Check if update is needed
      const needsUpdate = 
        originalLeague !== normalizedLeague ||
        originalLevel !== correctLevel
      
      if (needsUpdate) {
        const updatedProperties = {
          ...props,
          league: normalizedLeague,
          level: correctLevel
        }
        
        const { error: updateError } = await supabase
          .from('cached_entities')
          .update({ properties: updatedProperties })
          .eq('id', entity.id)
        
        if (updateError) {
          errors.push({
            id: entity.id,
            name: props.name,
            error: updateError.message
          })
        } else {
          updateCount++
          console.log(`✅ Updated ${props.name}:`)
          console.log(`   League: ${originalLeague} → ${normalizedLeague}`)
          console.log(`   Level: ${originalLevel} → ${correctLevel}`)
        }
      }
    } catch (err) {
      errors.push({
        id: entity.id,
        error: err.message
      })
    }
  }
  
  console.log(`\n📈 Normalization Summary:`)
  console.log(`   Entities processed: ${entities.length}`)
  console.log(`   Entities updated: ${updateCount}`)
  console.log(`   Errors: ${errors.length}`)
  
  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:')
    errors.forEach(err => {
      console.log(`   ${err.id}: ${err.error}`)
    })
  }
  
  return { updated: updateCount, errors: errors.length }
}

/**
 * Verify normalization results
 */
async function verifyNormalization() {
  console.log('\n✅ VERIFYING NORMALIZATION RESULTS')
  console.log('=' .repeat(60))
  
  const { data, error } = await supabase
    .from('cached_entities')
    .select('properties')
    .eq('properties->>sport', 'Football')
    .not('properties->>league', 'is', null)
  
  if (error) {
    console.error('❌ Error verifying:', error)
    return
  }
  
  const stats = {
    premierLeague: 0,
    championship: 0,
    leagueOne: 0,
    leagueTwo: 0,
    correctLevels: 0,
    total: data.length
  }
  
  data.forEach(entity => {
    const props = entity.properties
    const league = props.league
    const level = props.level
    
    switch (league) {
      case 'Premier League':
        stats.premierLeague++
        if (level === 'Tier 1') stats.correctLevels++
        break
      case 'English League Championship':
        stats.championship++
        if (level === 'Tier 2') stats.correctLevels++
        break
      case 'League One':
        stats.leagueOne++
        if (level === 'Tier 3') stats.correctLevels++
        break
      case 'League Two':
        stats.leagueTwo++
        if (level === 'Tier 4') stats.correctLevels++
        break
    }
  })
  
  console.log('📊 Normalized Data Statistics:')
  console.log(`   Total Football Teams: ${stats.total}`)
  console.log(`   Premier League (Tier 1): ${stats.premierLeague}`)
  console.log(`   Championship (Tier 2): ${stats.championship}`)
  console.log(`   League One (Tier 3): ${stats.leagueOne}`)
  console.log(`   League Two (Tier 4): ${stats.leagueTwo}`)
  console.log(`   Correct Levels: ${stats.correctLevels}/${stats.total}`)
  console.log(`   Normalization Success: ${Math.round((stats.correctLevels / stats.total) * 100)}%`)
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🏆 FOOTBALL LEAGUE DATA NORMALIZATION')
    console.log('=' .repeat(60))
    
    // Step 1: Analyze current state
    const analysis = await analyzeCurrentData()
    
    // Step 2: Ask for confirmation
    console.log('\n❓ Do you want to proceed with normalization?')
    console.log('   This will update league names and levels for consistency.')
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...')
    
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Step 3: Perform normalization
    const results = await normalizeData()
    
    // Step 4: Verify results
    await verifyNormalization()
    
    console.log('\n🎉 NORMALIZATION COMPLETE!')
    console.log(`✅ Successfully updated ${results.updated} entities`)
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
  analyzeCurrentData,
  normalizeData,
  verifyNormalization,
  LEAGUE_NORMALIZATION,
  LEVEL_MAPPING
}