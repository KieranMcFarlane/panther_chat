import { NextRequest, NextResponse } from 'next/server';

// Sample data since we can't access MCP functions directly in API routes
const SAMPLE_ENTITIES = [
  {
    neo4j_id: "4366",
    labels: ["Person"],
    properties: {
      name: "Andy Smith",
      role: "Financial Director",
      focus: "Financial planning and budget management",
      contactType: "FINANCIAL_DECISION_MAKER",
      currentCompany: "Harrogate Town",
      yellowPantherPriority: "MEDIUM",
      yellowPantherAccessibility: "HIGH"
    },
    badge_s3_url: null
  },
  {
    neo4j_id: "3048",
    labels: ["Entity"],
    properties: {
      name: "FIA World Rallycross Championship (WRX)",
      tier: "",
      type: "Tournament",
      level: "FIA Rallycross",
      notes: "",
      sport: "Motorsport",
      source: "csv_seed",
      country: "Global",
      website: "https://www.fiaworldrallycross.com/",
      linkedin: "",
      mobileApp: "",
      description: "",
      priorityScore: "",
      estimatedValue: "",
      digitalWeakness: "",
      opportunityType: ""
    },
    badge_s3_url: null
  },
  {
    neo4j_id: "3716",
    labels: ["Person"],
    properties: {
      name: "Thomas Strakosha",
      role: "Director of Football",
      focus: "Advanced analytics, recruitment technology",
      priority: "CRITICAL",
      influence: { low: 89, high: 0 },
      contact_type: "DECISION_MAKER"
    },
    badge_s3_url: null
  },
  {
    neo4j_id: "591",
    labels: ["Entity"],
    properties: {
      name: "Botswana Football Association",
      tier: "",
      type: "Federation",
      level: "FIFA Member",
      notes: "",
      sport: "Football",
      source: "csv_seed",
      country: "Botswana",
      website: "https://www.bfa.co.bw/",
      linkedin: "Not publicly available",
      mobileApp: "",
      description: "",
      priorityScore: "",
      estimatedValue: "",
      digitalWeakness: "",
      opportunityType: ""
    },
    badge_s3_url: null
  },
  {
    neo4j_id: "676",
    labels: ["Entity"],
    properties: {
      name: "Madagascar Football Federation",
      tier: "",
      type: "Federation",
      level: "FIFA Member",
      notes: "",
      sport: "Football",
      source: "csv_seed",
      country: "Madagascar",
      website: "-",
      linkedin: "Not publicly available",
      mobileApp: "",
      description: "",
      priorityScore: "",
      estimatedValue: "",
      digitalWeakness: "",
      opportunityType: ""
    },
    badge_s3_url: null
  }
];

export async function POST(request: NextRequest) {
  try {
    const { offset = 0, limit = 100 } = await request.json();
    
    console.log(`📦 Fetching batch: offset ${offset}, limit ${limit}`);
    
    // Since we can't use MCP functions directly, return empty for now
    // In a real scenario, we'd use the MCP Supabase functions
    const entities = offset === 0 ? SAMPLE_ENTITIES : [];
    
    if (!entities || entities.length === 0) {
      return NextResponse.json({
        success: true,
        entities: [],
        count: 0,
        offset: offset,
        message: 'No more entities - MCP functions cannot be used directly in API routes'
      });
    }
    
    console.log(`✅ Retrieved ${entities.length} sample entities`);
    
    return NextResponse.json({
      success: true,
      entities: entities,
      count: entities.length,
      offset: offset
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch batch:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}