#!/usr/bin/env node

// Database Connection Test Script
const neo4j = require('neo4j-driver');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testConnections() {
  console.log('🔍 Testing Database Connections...\n');
  
  // Test Neo4j Connection
  console.log('1. Testing Neo4j Connection...');
  try {
    const driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
    );
    
    const session = driver.session();
    const result = await session.run('RETURN 1 as test');
    await session.close();
    await driver.close();
    
    console.log('   ✅ Neo4j connection successful');
  } catch (error) {
    console.log('   ❌ Neo4j connection failed:', error.message);
  }
  
  // Test Supabase Connection
  console.log('2. Testing Supabase Connection...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    
    console.log('   ✅ Supabase connection successful');
  } catch (error) {
    console.log('   ❌ Supabase connection failed:', error.message);
  }
  
  // Test API Keys (simple validation)
  console.log('3. Validating API Keys...');
  
  if (process.env.BRIGHTDATA_API_TOKEN && process.env.BRIGHTDATA_API_TOKEN.length > 20) {
    console.log('   ✅ BrightData API token configured');
  } else {
    console.log('   ❌ BrightData API token missing or invalid');
  }
  
  if (process.env.PERPLEXITY_API_KEY && process.env.PERPLEXITY_API_KEY.startsWith('pplx-')) {
    console.log('   ✅ Perplexity API key configured');
  } else {
    console.log('   ❌ Perplexity API key missing or invalid');
  }
  
  if (process.env.ANTHROPIC_AUTH_TOKEN && process.env.ANTHROPIC_AUTH_TOKEN.length > 20) {
    console.log('   ✅ Anthropic API token configured');
  } else {
    console.log('   ❌ Anthropic API token missing or invalid');
  }
  
  console.log('\n🎯 Connection testing complete!');
}

testConnections().catch(console.error);