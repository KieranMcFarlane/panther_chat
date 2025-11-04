const neo4j = require("neo4j-driver");

// Neo4j connection setup
const driver = neo4j.driver(
  process.env.NEO4J_URI || "neo4j+s://your-instance.databases.neo4j.io",
  neo4j.auth.basic(process.env.NEO4J_USERNAME || "neo4j", process.env.NEO4J_PASSWORD || "your-password")
);

async function researchYellowPantherClients() {
  console.log("🔍 Researching Yellow Panther clients and RFP opportunities...");
  
  const session = driver.session();
  
  try {
    // Get first 100 entities from Neo4j
    console.log("📊 Fetching first 100 entities from Neo4j...");
    
    const entityQuery = `
      MATCH (e:Entity)
      RETURN e.name as name, 
             e.type as type,
             e.country as country,
             e.sport as sport,
             e.league as league,
             e.description as description,
             e.website as website,
             e.digitalPresenceScore as digitalScore,
             e.opportunityScore as opportunityScore,
             e.estimatedValue as estimatedValue,
             e.yellowPantherFit as ypFit,
             e.yellowPantherPriority as ypPriority,
             e.yellowPantherStrategy as ypStrategy,
             e.yellowPantherRationale as ypRationale,
             e.digitalTransformationScore as transformScore,
             e.websiteModernnessTier as siteTier,
             e.yellowPantherContactAccessibility as contactAccess,
             e.yellowPantherNextAction as nextAction
      LIMIT 100
    `;
    
    const entityResult = await session.run(entityQuery);
    const entities = entityResult.records.map(record => record.toObject());
    
    console.log(`✅ Found ${entities.length} entities`);
    
    // Research Yellow Panther's actual client portfolio from website data
    console.log("\n📋 Yellow Panther's Current Client Portfolio (From Website Research):");
    
    const ypClients = {
      "Major Sports Clients": [
        "Team GB - Olympic mobile app (STA Award winner)",
        "Premier Padel - Extended partnership 2024, official app development",
        "Ligue Nationale de Basket (LNB) - French basketball digital platform",
        "International Skating Union (ISU) - Global digital transformation",
        "FIBA 3×3 - Basketball technology solutions",
        "BNP Paribas Open - Tennis tournament digital platform"
      ],
      "Recent Partnerships & Extensions": [
        "Premier Padel: 3-year extension announced May 2024",
        "LNB: New technology partnership appointed May 2024",
        "Multiple sports organizations seeking digital transformation"
      ],
      "Technology Capabilities Demonstrated": [
        "Mobile app development (iOS/Android)",
        "Digital transformation consulting",
        "Fan engagement platforms",
        "Sports analytics systems",
        "Multi-platform solutions",
        "Award-winning user experiences"
      ],
      "Market Position": [
        "Strong presence in Olympic sports",
        "Growing in international federations",
        "Expertise in mobile-first sports solutions",
        "Award-winning design and development"
      ]
    };
    
    console.log("🎯 Major Sports Clients:");
    ypClients["Major Sports Clients"].forEach(client => {
      console.log(`   • ${client}`);
    });
    
    console.log("\n🔄 Recent Partnerships & Extensions:");
    ypClients["Recent Partnerships & Extensions"].forEach(partnership => {
      console.log(`   • ${partnership}`);
    });
    
    // Analyze entities for RFP opportunities
    console.log("\n🚀 Analyzing entities for RFP opportunities...");
    
    const rfpOpportunities = [];
    
    entities.forEach(entity => {
      // High-priority RFP indicators
      if (entity.ypPriority && entity.ypPriority <= 4) {
        rfpOpportunities.push({
          entity: entity.name,
          type: entity.type,
          priority: entity.ypPriority,
          fit: entity.ypFit,
          strategy: entity.ypStrategy,
          rationale: entity.ypRationale,
          opportunityScore: entity.opportunityScore || 0,
          estimatedValue: entity.estimatedValue || "Unknown",
          digitalTransformationScore: entity.transformScore || 0,
          contactAccessibility: entity.contactAccess || "Unknown",
          nextAction: entity.nextAction || "Unknown",
          rfpIndicators: generateRFPIndicators(entity),
          recommendedApproach: generateRecommendedApproach(entity)
        });
      }
      
      // High digital transformation opportunity
      if (entity.transformScore && entity.transformScore >= 70) {
        if (!rfpOpportunities.find(opp => opp.entity === entity.name)) {
          rfpOpportunities.push({
            entity: entity.name,
            type: entity.type,
            opportunityType: "Digital Transformation",
            opportunityScore: entity.transformScore,
            rationale: `High digital transformation score (${entity.transformScore}/100) indicates significant backend modernization needs`,
            estimatedValue: estimateValueFromScore(entity.transformScore),
            rfpIndicators: generateRFPIndicators(entity),
            recommendedApproach: generateRecommendedApproach(entity)
          });
        }
      }
    });
    
    // Sort by priority/score
    rfpOpportunities.sort((a, b) => {
      const aScore = a.priority || a.opportunityScore || 0;
      const bScore = b.priority || b.opportunityScore || 0;
      return bScore - aScore;
    });
    
    console.log(`\n🎯 Found ${rfpOpportunities.length} RFP opportunities in first 100 entities`);
    
    // Log opportunities to JSON
    const researchData = {
      researchDate: new Date().toISOString(),
      yellowPantherProfile: {
        company: "Yellow Panther Ltd",
        tagline: "Wild Creativity x Boundless Technology",
        website: "yellowpanther.io",
        certifications: ["ISO 9001", "ISO 27001", "GDPR Compliant", "AWS Solutions Architect"],
        headquarters: "Leamington Spa, UK",
        developmentCenters: ["India"],
        founded: "Specialized sports digital agency",
        teamSize: "2-8 specialists per project"
      },
      currentClientPortfolio: ypClients,
      keyCapabilities: [
        "Mobile App Development (iOS/Android/Cross-platform)",
        "Digital Transformation Consulting",
        "Fan Engagement Platforms",
        "Sports Analytics Systems",
        "UI/UX Design",
        "E-commerce Solutions",
        "Gamification",
        "Backend System Integration",
        "Real-time Data Processing"
      ],
      rfpOpportunities: rfpOpportunities.slice(0, 20), // Top 20 opportunities
      researchMethodology: "Neo4j entity analysis + BrightData web research"
    };
    
    // Save to JSON file
    const fs = require('fs');
    const outputPath = '/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/yellow-panther-rfp-research.json';
    
    fs.writeFileSync(outputPath, JSON.stringify(researchData, null, 2));
    console.log(`\n💾 Research data saved to: ${outputPath}`);
    
    return researchData;
    
  } catch (error) {
    console.error("❌ Error researching Yellow Panther clients:", error);
    throw error;
  } finally {
    await session.close();
  }
}

// Helper functions
function generateRFPIndicators(entity) {
  const indicators = [];
  
  if (entity.transformScore && entity.transformScore >= 70) {
    indicators.push("High digital transformation opportunity");
  }
  
  if (entity.siteTier && ["LEGACY_SITE", "OUTDATED_SITE"].includes(entity.siteTier)) {
    indicators.push("Outdated website/technology stack");
  }
  
  if (entity.digitalScore && entity.digitalScore <= 6) {
    indicators.push("Low digital presence score");
  }
  
  if (entity.contactAccessibility === "HIGH") {
    indicators.push("Accessible decision makers");
  }
  
  if (entity.ypFit === "PERFECT_FIT") {
    indicators.push("Perfect budget and scope alignment");
  }
  
  return indicators;
}

function generateRecommendedApproach(entity) {
  if (entity.ypStrategy === "DIRECT_APPROACH") {
    return {
      approach: "Direct outreach to CEO/MD",
      timeline: "Immediate contact",
      proposalFocus: "Comprehensive digital transformation package",
      budgetRange: "£150K-£300K"
    };
  } else if (entity.ypStrategy === "STRETCH_TARGET") {
    return {
      approach: "Strategic pilot project",
      timeline: "Phased engagement",
      proposalFocus: "Specific pain point solution",
      budgetRange: "£100K-£200K"
    };
  } else if (entity.ypStrategy === "PHASE_BASED") {
    return {
      approach: "Multi-phase implementation",
      timeline: "Long-term partnership",
      proposalFocus: "Rolling transformation program",
      budgetRange: "£200K-£500K"
    };
  } else {
    return {
      approach: "Consultative assessment",
      timeline: "Discovery phase first",
      proposalFocus: "Digital audit and roadmap",
      budgetRange: "£50K-£150K"
    };
  }
}

function estimateValueFromScore(score) {
  if (score >= 80) return "£300K-£500K";
  if (score >= 70) return "£200K-£400K";
  if (score >= 60) return "£150K-£300K";
  return "£80K-£200K";
}

// Execute research
researchYellowPantherClients()
  .then(data => {
    console.log("\n✅ Yellow Panther client research completed successfully!");
    console.log(`📊 Found ${data.rfpOpportunities.length} RFP opportunities`);
    process.exit(0);
  })
  .catch(error => {
    console.error("\n❌ Research failed:", error);
    process.exit(1);
  });