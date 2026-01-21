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

// RFP detection results from LinkedIn analysis
const rfpResults = [
  {
    organization: "NBA Finals",
    src_link: "https://www.linkedin.com/jobs/view/senior-technical-project-manager-video-platform-lead-at-national-basketball-association-nba-4270527474",
    detection_strategy: "linkedin",
    summary_json: {
      title: "NBA hiring Senior Technical Project Manager - Video Platform Lead",
      confidence: 85,
      urgency: "medium",
      fit_score: 75,
      rfp_type: "EARLY_SIGNAL"
    }
  },
  {
    organization: "NBA Finals", 
    src_link: "https://www.linkedin.com/jobs/view/senior-technical-project-manager-platform-architecture-delivery-lead-at-national-basketball-association-nba-4305034927",
    detection_strategy: "linkedin",
    summary_json: {
      title: "NBA hiring Senior Technical Project Manager - Platform Architecture",
      confidence: 85,
      urgency: "medium", 
      fit_score: 75,
      rfp_type: "EARLY_SIGNAL"
    }
  },
  {
    organization: "NBA Finals",
    src_link: "https://uk.linkedin.com/jobs/view/programme-manager-at-aston-martin-f1-team-4308746102",
    detection_strategy: "linkedin", 
    summary_json: {
      title: "Aston Martin F1 Team hiring Programme Manager",
      confidence: 80,
      urgency: "medium",
      fit_score: 70,
      rfp_type: "EARLY_SIGNAL"
    }
  },
  {
    organization: "FIA Formula 1 World Championship",
    src_link: "https://uk.linkedin.com/jobs/view/finance-transformation-and-process-improvement-lead-at-mercedes-amg-petronas-formula-one-team-4316682673",
    detection_strategy: "linkedin",
    summary_json: {
      title: "Mercedes F1 Team hiring Finance Transformation and Process Improvement Lead",
      confidence: 80,
      urgency: "medium",
      fit_score: 70,
      rfp_type: "EARLY_SIGNAL"
    }
  },
  {
    organization: "FIA World Endurance Championship (WEC)",
    src_link: "https://www.linkedin.com/posts/momasoft_ifsc-momapix-sportclimbing-activity-7341408830246772738-AmJA",
    detection_strategy: "linkedin",
    summary_json: {
      title: "FIA WEC TV official app mentioned in sports tech context",
      confidence: 65,
      urgency: "low",
      fit_score: 60,
      rfp_type: "SIGNAL"
    }
  },
  {
    organization: "Volleyball Nations League",
    src_link: "https://www.linkedin.com/posts/malcolmlemmons_youth-sports-are-undergoing-unprecedented-activity-7384581508478717953-ZEft",
    detection_strategy: "linkedin",
    summary_json: {
      title: "Sports management software platform discussion for leagues/governing bodies",
      confidence: 60,
      urgency: "low",
      fit_score: 55,
      rfp_type: "SIGNAL"
    }
  },
  {
    organization: "Tour de France Femmes",
    src_link: "https://www.linkedin.com/posts/praveen-shankar-capgemini_telcotransformation-digital-innovation-activity-7354062735539589122-XdmM",
    detection_strategy: "linkedin",
    summary_json: {
      title: "Capgemini as Official Technology Partner of Tour de France Femmes - AI and digital transformation",
      confidence: 70,
      urgency: "low",
      fit_score: 65,
      rfp_type: "SIGNAL"
    }
  }
];

async function storeResults() {
  console.log('📊 Storing LinkedIn RFP detection results to Supabase...');
  
  try {
    for (const result of rfpResults) {
      const { data, error } = await supabase
        .from('rfp_opportunities')
        .insert({
          organization: result.organization,
          src_link: result.src_link,
          detection_strategy: result.detection_strategy,
          summary_json: result.summary_json,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`❌ Error storing ${result.organization}:`, error);
      } else {
        console.log(`✅ Stored: ${result.organization}`);
      }
    }
    
    console.log(`\n🎯 Successfully stored ${rfpResults.length} RFP opportunities`);
    
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

storeResults();