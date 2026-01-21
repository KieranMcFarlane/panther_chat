/**
 * 🔗 Link Verification Script for Unified RFP Opportunities
 * 
 * This script verifies the genuineness of links in the unified RFP table
 * and identifies 404 errors or invalid URLs.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// BrightData API configuration
const BRIGHTDATA_API_TOKEN = process.env.BRIGHTDATA_API_TOKEN;
const BRIGHTDATA_API_URL = 'https://api.brightdata.com';

/**
 * Check if a URL is genuine and accessible using BrightData
 */
async function checkUrlStatus(url) {
  try {
    // Use BrightData to check the URL
    const response = await fetch(`${BRIGHTDATA_API_URL}/request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BRIGHTDATA_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zone: 'web_scraping',
        url: url,
        format: 'raw'
      })
    });

    if (response.ok) {
      const result = await response.json();
      return {
        status: 'valid',
        http_status: result.status || 200,
        error: null
      };
    } else {
      return {
        status: 'error',
        http_status: null,
        error: `BrightData API error: ${response.status}`
      };
    }
  } catch (error) {
    // Fallback to basic HEAD request if BrightData fails
    try {
      const basicResponse = await fetch(url, { method: 'HEAD' });
      return {
        status: basicResponse.ok ? 'valid' : 'invalid',
        http_status: basicResponse.status,
        error: null
      };
    } catch (fallbackError) {
      return {
        status: 'invalid',
        http_status: null,
        error: fallbackError.message
      };
    }
  }
}

/**
 * Get all unverified links from unified table
 */
async function getUnverifiedLinks() {
  const { data, error } = await supabase
    .from('rfp_opportunities_unified')
    .select('id, title, organization, source_url, link_status, source')
    .not('source_url', 'is', null)
    .in('link_status', ['unverified', null]);

  if (error) {
    console.error('❌ Error fetching unverified links:', error);
    return [];
  }

  return data;
}

/**
 * Update link status in database
 */
async function updateLinkStatus(id, status, httpStatus = null, linkError = null) {
  const { data, error } = await supabase
    .from('rfp_opportunities_unified')
    .update({
      link_status: status,
      link_verified_at: new Date().toISOString(),
      link_http_status: httpStatus,
      link_error: linkError
    })
    .eq('id', id);

  if (error) {
    console.error(`❌ Error updating status for ${id}:`, error);
    return false;
  }

  return true;
}

/**
 * Process links in batches to avoid overwhelming services
 */
async function processBatch(links, batchSize = 5) {
  console.log(`🔗 Processing batch of ${links.length} links...`);
  
  const results = [];
  
  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);
    
    console.log(`📊 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(links.length/batchSize)} (${batch.length} links)`);
    
    const batchPromises = batch.map(async (link) => {
      console.log(`🔍 Checking: ${link.title} - ${link.source_url}`);
      
      const startTime = Date.now();
      const urlCheck = await checkUrlStatus(link.source_url);
      const duration = Date.now() - startTime;
      
      // Update database
      const updated = await updateLinkStatus(
        link.id, 
        urlCheck.status, 
        urlCheck.http_status, 
        urlCheck.error
      );
      
      const result = {
        id: link.id,
        title: link.title,
        organization: link.organization,
        url: link.source_url,
        previous_status: link.link_status,
        new_status: urlCheck.status,
        http_status: urlCheck.http_status,
        error: urlCheck.error,
        updated: updated,
        check_duration_ms: duration
      };
      
      console.log(`${urlCheck.status === 'valid' ? '✅' : '❌'} ${result.title}: ${urlCheck.status} (${duration}ms)`);
      
      return result;
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to be respectful
    if (i + batchSize < links.length) {
      console.log('⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔗 Starting RFP Link Verification Process...');
  console.log('=====================================');
  
  try {
    // Get all unverified links
    const unverifiedLinks = await getUnverifiedLinks();
    
    console.log(`📊 Found ${unverifiedLinks.length} unverified links to check`);
    
    if (unverifiedLinks.length === 0) {
      console.log('✅ No links need verification. All links have been checked.');
      return;
    }
    
    // Process links in batches
    const results = await processBatch(unverifiedLinks, 3); // Smaller batches for reliability
    
    // Generate summary report
    const valid = results.filter(r => r.new_status === 'valid');
    const invalid = results.filter(r => r.new_status === 'invalid');
    const errors = results.filter(r => r.new_status === 'error');
    
    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('=======================');
    console.log(`✅ Valid links: ${valid.length}`);
    console.log(`❌ Invalid links: ${invalid.length}`);
    console.log(`⚠️  Error links: ${errors.length}`);
    console.log(`📊 Total processed: ${results.length}`);
    
    // Show invalid links for review
    if (invalid.length > 0) {
      console.log('\n❌ INVALID LINKS (404s or dead links):');
      console.log('=======================================');
      invalid.forEach(link => {
        console.log(`❌ ${link.title}`);
        console.log(`   Organization: ${link.organization}`);
        console.log(`   URL: ${link.url}`);
        console.log(`   HTTP Status: ${link.http_status}`);
        console.log(`   Error: ${link.error || 'No error details'}`);
        console.log('');
      });
    }
    
    // Show error links for review
    if (errors.length > 0) {
      console.log('\n⚠️ ERROR LINKS (checking failed):');
      console.log('=================================');
      errors.forEach(link => {
        console.log(`⚠️  ${link.title}`);
        console.log(`   Organization: ${link.organization}`);
        console.log(`   URL: ${link.url}`);
        console.log(`   Error: ${link.error}`);
        console.log('');
      });
    }
    
    // Log verification completion to system_logs
    const { error: logError } = await supabase
      .from('system_logs')
      .insert({
        timestamp: new Date().toISOString(),
        level: 'info',
        category: 'data_quality',
        source: 'link-verification',
        message: `RFP link verification completed`,
        data: {
          total_links_checked: results.length,
          valid_links: valid.length,
          invalid_links: invalid.length,
          error_links: errors.length,
          verification_completed_at: new Date().toISOString()
        }
      });
    
    if (logError) {
      console.error('❌ Error logging verification completion:', logError);
    } else {
      console.log('✅ Verification completed and logged to system');
    }
    
  } catch (error) {
    console.error('❌ Link verification process failed:', error);
    
    // Log error to system
    await supabase
      .from('system_logs')
      .insert({
        timestamp: new Date().toISOString(),
        level: 'error',
        category: 'data_quality',
        source: 'link-verification',
        message: `RFP link verification failed: ${error.message}`,
        data: {
          error: error.message,
          failed_at: new Date().toISOString()
        }
      });
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkUrlStatus,
  getUnverifiedLinks,
  updateLinkStatus,
  processBatch,
  main
};