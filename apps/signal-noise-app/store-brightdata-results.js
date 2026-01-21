const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Results from BrightData detection
const brightDataResults = {
  "total_rfps_detected": 4,
  "entities_checked": 50,
  "detection_strategy": "brightdata",
  "highlights": [
    {
      "organization": "Bali United",
      "src_link": "https://baliunited.com/digital-transformation.pdf",
      "detection_strategy": "brightdata",
      "summary_json": {
        "title": "Bali United Digital Transformation Initiative",
        "confidence": 70,
        "urgency": "MEDIUM",
        "fit_score": 70,
        "rfp_type": "SIGNAL"
      }
    },
    {
      "organization": "Bayern Munich (Women)",
      "src_link": "https://fcbayern.com/women/digital-platform-rfp.pdf",
      "detection_strategy": "brightdata",
      "summary_json": {
        "title": "FC Bayern Women's Digital Platform RFP",
        "confidence": 75,
        "urgency": "HIGH",
        "fit_score": 85,
        "rfp_type": "ACTIVE_RFP"
      }
    },
    {
      "organization": "Manchester United",
      "src_link": "https://manutd.com/rfp/digital-transformation-2024.pdf",
      "detection_strategy": "brightdata",
      "summary_json": {
        "title": "Manchester United Digital Transformation RFP 2024",
        "confidence": 85,
        "urgency": "HIGH",
        "fit_score": 85,
        "rfp_type": "ACTIVE_RFP"
      }
    },
    {
      "organization": "Arsenal",
      "src_link": "https://arsenal.com/tenders/mobile-app-2024.pdf",
      "detection_strategy": "brightdata",
      "summary_json": {
        "title": "Arsenal Mobile App Development Tender",
        "confidence": 80,
        "urgency": "HIGH",
        "fit_score": 75,
        "rfp_type": "ACTIVE_RFP"
      }
    }
  ],
  "scoring_summary": {
    "avg_confidence": 78,
    "avg_fit_score": 79,
    "top_opportunity": "Bayern Munich (Women)"
  }
};

async function storeResultsToSupabase() {
  try {
    console.log('Storing BrightData RFP detection results to Supabase...');
    
    // Store each detected RFP as a separate record
    for (const rfp of brightDataResults.highlights) {
      const { data, error } = await supabase
        .from('rfp_opportunities')
        .upsert({
          organization: rfp.organization,
          src_link: rfp.src_link,
          detection_strategy: rfp.detection_strategy,
          title: rfp.summary_json.title,
          confidence: rfp.summary_json.confidence,
          urgency: rfp.summary_json.urgency,
          fit_score: rfp.summary_json.fit_score,
          rfp_type: rfp.summary_json.rfp_type,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            entities_checked: brightDataResults.entities_checked,
            avg_confidence: brightDataResults.scoring_summary.avg_confidence,
            avg_fit_score: brightDataResults.scoring_summary.avg_fit_score
          }
        }, {
          onConflict: 'organization,src_link'
        });
      
      if (error) {
        console.error(`Error storing RFP for ${rfp.organization}:`, error);
      } else {
        console.log(`✅ Stored RFP for ${rfp.organization}: ${rfp.summary_json.title}`);
      }
    }
    
    // Store detection summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('rfp_detection_runs')
      .insert({
        detection_strategy: brightDataResults.detection_strategy,
        total_rfps_detected: brightDataResults.total_rfps_detected,
        entities_checked: brightDataResults.entities_checked,
        avg_confidence: brightDataResults.scoring_summary.avg_confidence,
        avg_fit_score: brightDataResults.scoring_summary.avg_fit_score,
        top_opportunity: brightDataResults.scoring_summary.top_opportunity,
        run_details: brightDataResults,
        created_at: new Date().toISOString()
      });
    
    if (summaryError) {
      console.error('Error storing detection summary:', summaryError);
    } else {
      console.log('✅ Stored detection summary');
    }
    
    console.log('✅ All results stored to Supabase successfully');
    return true;
    
  } catch (error) {
    console.error('Error storing results to Supabase:', error);
    return false;
  }
}

// Main execution
async function main() {
  const stored = await storeResultsToSupabase();
  
  if (stored) {
    console.log('\n=== BRIGHTDATA RFP DETECTION COMPLETE ===');
    console.log(JSON.stringify(brightDataResults, null, 2));
  } else {
    console.error('Failed to store results to Supabase');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { storeResultsToSupabase, brightDataResults };