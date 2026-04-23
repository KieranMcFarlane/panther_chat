#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables.')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function getMissingSportStats() {
  console.log('\n=== ENTITIES WITH MISSING SPORT ===')
  
  // Get total count
  const { count: totalMissingSport } = await supabase
    .from('canonical_entities')
    .select('*', { count: 'exact', head: true })
    .eq('sport', '')
  
  console.log(`Total entities with missing sport: ${totalMissingSport}`)
  
  // Get distribution by entity type
  const { data: typeDistribution } = await supabase
    .from('canonical_entities')
    .select('entity_type')
    .eq('sport', '')
  
  const typeCounts = {}
  typeDistribution?.forEach(row => {
    const type = row.entity_type || 'unknown'
    typeCounts[type] = (typeCounts[type] || 0) + 1
  })
  
  console.log('\nDistribution by entity type:')
  Object.entries(typeCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count} (${Math.round(count/totalMissingSport*100)}%)`)
    })
  
  return { total: totalMissingSport, typeDistribution: typeCounts }
}

async function getMissingCountryStats() {
  console.log('\n=== ENTITIES WITH MISSING COUNTRY ===')
  
  // Get total count
  const { count: totalMissingCountry } = await supabase
    .from('canonical_entities')
    .select('*', { count: 'exact', head: true })
    .eq('country', '')
  
  console.log(`Total entities with missing country: ${totalMissingCountry}`)
  
  // Get distribution by entity type
  const { data: typeDistribution } = await supabase
    .from('canonical_entities')
    .select('entity_type')
    .eq('country', '')
  
  const typeCounts = {}
  typeDistribution?.forEach(row => {
    const type = row.entity_type || 'unknown'
    typeCounts[type] = (typeCounts[type] || 0) + 1
  })
  
  console.log('\nDistribution by entity type:')
  Object.entries(typeCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count} (${Math.round(count/totalMissingCountry*100)}%)`)
    })
  
  return { total: totalMissingCountry, typeDistribution: typeCounts }
}

async function getUndefinedStringsStats() {
  console.log('\n=== ENTITIES WITH "UNDEFINED" STRINGS ===')
  
  // Count sport="undefined"
  const { count: sportUndefined } = await supabase
    .from('canonical_entities')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'undefined')
  
  // Count country="undefined"
  const { count: countryUndefined } = await supabase
    .from('canonical_entities')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'undefined')
  
  // Count both
  const { count: bothUndefined } = await supabase
    .from('canonical_entities')
    .select('*', { count: 'exact', head: true })
    .or('sport.eq.undefined,country.eq.undefined')
  
  console.log(`sport="undefined": ${sportUndefined}`)
  console.log(`country="undefined": ${countryUndefined}`)
  console.log(`Total with either "undefined": ${bothUndefined}`)
  
  return { sportUndefined, countryUndefined, bothUndefined }
}

async function analyzeSampleEntities() {
  console.log('\n=== SAMPLE ENTITIES ANALYSIS ===')
  
  // Sample 10 entities with missing sport
  const { data: missingSportEntities } = await supabase
    .from('canonical_entities')
    .select('id, name, entity_type, sport, country, properties')
    .eq('sport', '')
    .limit(10)
  
  console.log('\nSample entities with missing sport:')
  missingSportEntities?.forEach(entity => {
    console.log(`  ${entity.id}: ${entity.name || entity.properties?.name || 'N/A'} (${entity.entity_type})`)
  })
  
  // Sample 10 entities with missing country
  const { data: missingCountryEntities } = await supabase
    .from('canonical_entities')
    .select('id, name, entity_type, sport, country, properties')
    .eq('country', '')
    .limit(10)
  
  console.log('\nSample entities with missing country:')
  missingCountryEntities?.forEach(entity => {
    console.log(`  ${entity.id}: ${entity.name || entity.properties?.name || 'N/A'} (${entity.entity_type})`)
  })
}

async function main() {
  console.log('🔍 Analyzing sport/country patterns in canonical_entities...')
  
  try {
    // Get basic statistics
    const missingSport = await getMissingSportStats()
    const missingCountry = await getMissingCountryStats()
    const undefinedStrings = await getUndefinedStringsStats()
    
    // Sample entities
    await analyzeSampleEntities()
    
    // Summary
    console.log('\n=== SUMMARY ===')
    console.log(`Total entities needing sport backfill: ${missingSport.total}`)
    console.log(`Total entities needing country backfill: ${missingCountry.total}`)
    console.log(`Total entities with "undefined" strings to clean: ${undefinedStrings.bothUndefined}`)
    
    console.log('\n💡 RECOMMENDATIONS:')
    console.log('1. Clean up "undefined" strings first (set to null/empty)')
    console.log('2. Use sports-hierarchy-taxonomy.mjs functions for backfill:')
    console.log('   - buildSportsHierarchyBackfill() can infer sport/country from entity names')
    console.log('   - deriveCountryFromName() has country prefix mappings')
    console.log('   - Only backfill entities with clear keywords (Organizations, Federations, Leagues)')
    console.log('3. Consider keeping Persons/Venues with missing sport/country as-is')
    
  } catch (error) {
    console.error('Analysis failed:', error?.message || error)
    process.exit(1)
  }
}

main()
