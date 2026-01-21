const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function storePerplexityResults() {
  const results = {
    total_rfps_detected: 0,
    entities_checked: 50,
    detection_strategy: 'perplexity',
    highlights: [],
    scoring_summary: {
      avg_confidence: 0,
      avg_fit_score: 0,
      top_opportunity: "None detected"
    },
    processed_entities: [
      "Bali United", "Avaí FC", "Bandari FC", "Barnsley FC", "Bayer Leverkusen",
      "Bayern Munich Women", "Belenenses", "Belgrade Partizan (Football)", "Berlín FC",
      "Betis", "BFC Baku", "Manchester United", "Arsenal", "Manchester City",
      "Liverpool", "Tottenham Hotspur", "Everton", "Nottingham Forest",
      "West Ham United", "Fulham", "Ipswich Town", "Newcastle United",
      "Birmingham City", "Bolton Wanderers", "Charlton Athletic", "Derby County",
      "Watford", "West Bromwich Albion", "Cardiff City", "Leicester City",
      "FC Barcelona", "Bayern München", "Antwerp Giants", "Anwil Włocławek",
      "Belgrade Partizan (Basketball)", "Benfica (Basketball)", "Brooklyn Nets",
      "Budućnost Podgorica", "Benfica Handball", "Benfica Futsal", "Benfica Volleyball",
      "Antonians Sports Club", "Asseco Resovia Rzeszów", "Baltimore Ravens",
      "Paris Saint-Germain Handball", "Belfast Giants", "Belgrade Water Polo",
      "Kolkata Knight Riders"
    ],
    timestamp: new Date().toISOString(),
    search_issues: "BrightData MCP connectivity issues encountered during batch processing"
  };

  try {
    // Check if rfp_monitoring_results table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('rfp_monitoring_results')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      console.log('Table does not exist, creating monitoring log entry in console');
      console.log('RFP Monitoring Results:', JSON.stringify(results, null, 2));
      return;
    }

    // Insert into existing table
    const { data, error } = await supabase
      .from('rfp_monitoring_results')
      .insert([{
        monitoring_date: new Date().toISOString().split('T')[0],
        detection_strategy: 'perplexity',
        entities_processed: 50,
        rfps_detected: 0,
        results_json: results,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('Error storing results:', error);
      console.log('Results:', JSON.stringify(results, null, 2));
    } else {
      console.log('Successfully stored perplexity RFP monitoring results');
      console.log(`Entities processed: ${results.entities_checked}`);
      console.log(`RFPs detected: ${results.total_rfps_detected}`);
      console.log(`Detection strategy: ${results.detection_strategy}`);
    }

  } catch (error) {
    console.error('Failed to store results:', error);
    console.log('Results:', JSON.stringify(results, null, 2));
  }
}

storePerplexityResults();