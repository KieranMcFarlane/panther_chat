/**
 * Verify All RFPs Script
 * 
 * Processes all RFPs in the database through the verification system
 */

const http = require('http');
const https = require('https');

function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function getAllRFPs() {
  console.log('📊 Fetching all RFPs from database...');
  
  const response = await makeRequest('http://localhost:3005/api/tenders?action=opportunities&limit=100', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (response.status !== 200) {
    throw new Error(`Failed to fetch RFPs: ${response.status}`);
  }

  const rfpData = response.data;
  console.log(`✅ Retrieved ${rfpData.opportunities.length} RFPs`);
  
  return rfpData.opportunities;
}

async function batchVerifyRFPs(rfpConfigs, batchSize = 10) {
  console.log(`🔍 Starting batch verification of ${rfpConfigs.length} RFPs in batches of ${batchSize}`);
  
  const results = [];
  const totalBatches = Math.ceil(rfpConfigs.length / batchSize);
  
  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * batchSize;
    const endIdx = Math.min(startIdx + batchSize, rfpConfigs.length);
    const batch = rfpConfigs.slice(startIdx, endIdx);
    
    console.log(`📦 Processing batch ${i + 1}/${totalBatches} (${batch.length} RFPs)...`);
    
    try {
      const response = await makeRequest('http://localhost:3005/api/rfp-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, {
        action: 'batch_verify_rfps',
        batchConfigs: batch,
        businessInfo: {
          contact_name: 'Yellow Panther Business Development',
          email: 'business@yellowpanther.com',
          phone: '+44-20-1234-5678',
          company: 'Yellow Panther Digital Studio'
        }
      });

      if (response.status === 200) {
        const result = response.data;
        results.push(...result.batch_result.batch_results);
        
        console.log(`✅ Batch ${i + 1} completed: ${result.summary.successful}/${result.summary.total_verified} successful`);
        console.log(`   Average authenticity: ${result.summary.average_authenticity}%`);
        
        // Wait between batches to be respectful
        if (i < totalBatches - 1) {
          console.log('⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        console.error(`❌ Batch ${i + 1} failed: ${response.status}`);
        console.error('Response:', response.data);
      }
    } catch (error) {
      console.error(`❌ Batch ${i + 1} error:`, error.message);
    }
  }
  
  return results;
}

function analyzeResults(results) {
  console.log('\n📈 VERIFICATION RESULTS ANALYSIS');
  console.log('='.repeat(50));
  
  const total = results.length;
  const successful = results.filter(r => r.result.success).length;
  const failed = total - successful;
  const avgAuthenticity = Math.round(
    results.reduce((sum, r) => sum + r.result.authenticity_score, 0) / total
  );
  
  console.log(`Total RFPs Verified: ${total}`);
  console.log(`Successful: ${successful} (${((successful/total)*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
  console.log(`Average Authenticity: ${avgAuthenticity}%`);
  
  // Find highest authenticity scores
  const topResults = results
    .filter(r => r.result.success)
    .sort((a, b) => b.result.authenticity_score - a.result.authenticity_score)
    .slice(0, 5);
    
  if (topResults.length > 0) {
    console.log('\n🏆 TOP 5 HIGHEST AUTHENTICITY SCORES:');
    topResults.forEach((r, i) => {
      console.log(`${i + 1}. ${r.organization_name}: ${r.result.authenticity_score}% (${r.url})`);
    });
  }
  
  // Show failure patterns
  const failures = results.filter(r => !r.result.success);
  if (failures.length > 0) {
    console.log('\n❌ COMMON FAILURE PATTERNS:');
    const domainCounts = {};
    failures.forEach(r => {
      try {
        const domain = new URL(r.url).hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch (e) {
        domainCounts['Invalid URL'] = (domainCounts['Invalid URL'] || 0) + 1;
      }
    });
    
    Object.entries(domainCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([domain, count]) => {
        console.log(`  ${domain}: ${count} failures`);
      });
  }
}

async function main() {
  console.log('🚀 STARTING FULL RFP VERIFICATION');
  console.log('=====================================');
  
  try {
    // Step 1: Get all RFPs
    const allRFPs = await getAllRFPs();
    
    // Step 2: Prepare batch configs
    const batchConfigs = allRFPs
      .filter(rfp => rfp.source_url && rfp.source_url.startsWith('http'))
      .map(rfp => ({
        url: rfp.source_url,
        organization_name: rfp.organization,
        organization_type: 'club' // Default type
      }));
      
    console.log(`\n🎯 Found ${batchConfigs.length} RFPs with valid URLs for verification`);
    
    if (batchConfigs.length === 0) {
      console.log('❌ No RFPs with valid URLs found');
      return;
    }
    
    // Step 3: Run batch verification
    const results = await batchVerifyRFPs(batchConfigs, 5); // Smaller batches for stability
    
    // Step 4: Analyze results
    analyzeResults(results);
    
    console.log('\n🎉 FULL VERIFICATION COMPLETE!');
    console.log('Check your RFP Verification Dashboard at: http://localhost:3005/rfp-verification');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Run the verification
main();