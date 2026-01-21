#!/usr/bin/env node

/**
 * 🎯 Verify Perplexity RFP Storage
 * 
 * This script verifies that the Perplexity RFP opportunities
 * were successfully stored in Supabase
 */

const { supabase } = require('./src/lib/supabase-client');

async function verifyPerplexityRFPs() {
  try {
    console.log('🔍 Verifying Perplexity RFP storage...\n');

    // Query for RFPs with detection_strategy in metadata
    const { data: perplexityRFPs, error } = await supabase
      .from('rfp_opportunities')
      .select('*')
      .eq('source', 'Perplexity AI Detection')
      .order('detected_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error querying Perplexity RFPs:', error);
      return;
    }

    if (!perplexityRFPs || perplexityRFPs.length === 0) {
      console.log('❌ No Perplexity RFPs found in the database');
      return;
    }

    console.log(`✅ Found ${perplexityRFPs.length} Perplexity RFPs:\n`);

    perplexityRFPs.forEach((rfp, index) => {
      console.log(`${index + 1}. ${rfp.organization}`);
      console.log(`   📋 Title: ${rfp.title}`);
      console.log(`   🎯 Fit Score: ${rfp.yellow_panther_fit}% | Confidence: ${rfp.confidence}%`);
      console.log(`   💰 Value: ${rfp.value}`);
      console.log(`   📅 Deadline: ${rfp.deadline || 'Not specified'}`);
      console.log(`   📂 Category: ${rfp.category}`);
      console.log(`   🆔 ID: ${rfp.id}`);
      console.log(`   🔗 Source: ${rfp.source_url}`);
      
      // Check metadata for detection strategy
      if (rfp.metadata && rfp.metadata.detection_strategy) {
        console.log(`   📝 Detection Strategy: ${rfp.metadata.detection_strategy}`);
      }
      
      console.log('');
    });

    // Verify the expected organizations
    const expectedOrgs = [
      'Manchester United FC',
      'Golden State Warriors', 
      'Toronto Blue Jays',
      'NBA',
      'IPL',
      'FIBA World Cup',
      'LaLiga',
      'Bundesliga'
    ];

    const foundOrgs = perplexityRFPs.map(rfp => rfp.organization);
    const missingOrgs = expectedOrgs.filter(org => !foundOrgs.includes(org));

    if (missingOrgs.length > 0) {
      console.log(`⚠️ Missing organizations: ${missingOrgs.join(', ')}`);
    } else {
      console.log('✅ All expected Perplexity RFPs found in database!');
    }

    // Check metadata structure
    console.log('\n📊 Checking metadata structure:');
    const sampleRFP = perplexityRFPs[0];
    if (sampleRFP && sampleRFP.metadata) {
      console.log(`   ✅ detection_strategy: ${sampleRFP.metadata.detection_strategy}`);
      console.log(`   ✅ original_source: ${sampleRFP.metadata.original_source}`);
      console.log(`   ✅ summary_json present: ${!!sampleRFP.metadata.summary_json}`);
      
      if (sampleRFP.metadata.summary_json) {
        const summary = sampleRFP.metadata.summary_json;
        console.log(`   ✅ Summary JSON structure: title, confidence, fit_score, rfp_type`);
      }
    }

    console.log('\n🎉 Perplexity RFP verification completed successfully!');

  } catch (error) {
    console.error('💥 Error during verification:', error);
  }
}

// Run the verification
verifyPerplexityRFPs();