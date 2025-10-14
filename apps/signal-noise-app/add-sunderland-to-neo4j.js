// Add Sunderland AFC to Neo4j with comprehensive dossier data
const neo4j = require('neo4j-driver');
const fs = require('fs');

// Read the JSON file
const sunderlandDossier = JSON.parse(fs.readFileSync('./dossiers/sunderland-fc-intelligence-data.json', 'utf8'));

async function addSunderlandToNeo4j() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
    neo4j.auth.basic(
      process.env.NEO4J_USERNAME || 'neo4j',
      process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
    )
  );
  
  try {
    console.log('🏆 Adding Sunderland AFC to Neo4j with comprehensive dossier data...');
    
    // Main entity creation with enriched properties
    const neo4jQuery = `
      MERGE (e:Entity:Club:PremierLeague:Enriched {neo4j_id: $neo4j_id})
      SET e += $properties
      SET e.last_updated = datetime()
      RETURN e
    `;

    const entityProperties = {
      // Basic Information
      name: sunderlandDossier.entity.name,
      type: sunderlandDossier.entity.type,
      sport: sunderlandDossier.entity.sport,
      country: sunderlandDossier.entity.country,
      level: sunderlandDossier.entity.level,
      website: sunderlandDossier.entity.website,
      founded: sunderlandDossier.entity.founded,
      stadium: sunderlandDossier.entity.stadium,
      stadium_capacity: sunderlandDossier.entity.stadium_capacity,
      current_employees: sunderlandDossier.entity.current_employees,
      valuation_gbp: sunderlandDossier.entity.valuation_gbp,
      
      // Core Information
      hq: sunderlandDossier.core_info.hq,
      ownership: sunderlandDossier.core_info.ownership,
      employee_range: sunderlandDossier.core_info.employee_range,
      
      // Commercial Information
      main_sponsors: sunderlandDossier.commercial.main_sponsors.join(', '),
      kit_supplier: sunderlandDossier.commercial.kit_supplier,
      commercial_revenue: sunderlandDossier.commercial.commercial_revenue,
      estimated_valuation: sunderlandDossier.commercial.estimated_valuation,
      
      // Digital Transformation Scores
      opportunity_score: sunderlandDossier.strategic_analysis.opportunity_scoring.overall_score,
      digital_maturity: sunderlandDossier.digital_transformation.digital_maturity,
      transformation_score: sunderlandDossier.digital_transformation.transformation_score,
      website_moderness: sunderlandDossier.digital_transformation.website_moderness,
      mobile_app: sunderlandDossier.digital_transformation.mobile_app,
      social_media_followers: sunderlandDossier.digital_transformation.social_media_followers,
      data_integration_level: sunderlandDossier.digital_transformation.data_integration_level,
      fan_analytics_quality: sunderlandDossier.digital_transformation.fan_analytics_quality,
      
      // LinkedIn Analysis Summary
      linkedin_connections_count: sunderlandDossier.linkedin_connection_analysis.yellow_panther_uk_team.total_connections_found,
      tier_1_connections: sunderlandDossier.linkedin_connection_analysis.tier_1_analysis.introduction_paths.length,
      tier_2_connections: sunderlandDossier.linkedin_connection_analysis.tier_2_analysis.tier_2_introduction_paths.length,
      linkedin_success_probability: parseFloat(sunderlandDossier.linkedin_connection_analysis.recommendations.success_probability) / 100,
      
      // Complete Dossier Data
      dossier_data: JSON.stringify(sunderlandDossier),
      confidence_score: sunderlandDossier.entity.confidence_score,
      last_enriched: new Date().toISOString(),
      schema_version: '2.0',
      status: 'active',
      
      // Search and Display
      priorityScore: sunderlandDossier.strategic_analysis.opportunity_scoring.overall_score,
      searchRank: 1,
      isHighValue: true
    };

    const session = driver.session();
    const result = await session.run(neo4jQuery, {
      neo4j_id: sunderlandDossier.entity.neo4j_id,
      properties: entityProperties
    });

    console.log('✅ Main entity created, records:', result.records.length);
    if (result.records.length > 0) {
      console.log('✅ Entity name:', result.records[0].get('e').properties.name);
    }
    
    await session.close();

    // Add Yellow Panther team connections
    const yellowPantherConnections = [
      {
        name: "Stuart Cope",
        role: "Co-Founder & COO",
        linkedin_url: "https://uk.linkedin.com/in/stuart-cope-54392b16/",
        connection_strength: "MEDIUM",
        confidence_score: 72
      },
      {
        name: "Elliott Hillman",
        role: "Senior Client Partner",
        linkedin_url: "https://uk.linkedin.com/in/elliott-rj-hillman/",
        connection_strength: "MEDIUM", 
        confidence_score: 68
      }
    ];

    // Create Yellow Panther team member nodes and connections
    const session2 = driver.session();
    for (const ypMember of yellowPantherConnections) {
      const ypQuery = `
        MERGE (yp:YellowPanther {name: $yp_name})
        SET yp.role = $yp_role, yp.linkedin_url = $linkedin_url
        WITH yp
        MATCH (e:Entity {neo4j_id: $neo4j_id})
        MERGE (yp)-[r:HAS_CONNECTION_TO]->(e)
        SET r.strength = $connection_strength,
            r.confidence_score = $confidence_score,
            r.connection_type = "2ND_DEGREE",
            r.is_primary = true,
            r.strategy = "Sports technology industry network",
            r.created_at = datetime()
      `;

      await session2.run(ypQuery, {
        yp_name: ypMember.name,
        yp_role: ypMember.role,
        linkedin_url: ypMember.linkedin_url,
        neo4j_id: sunderlandDossier.entity.neo4j_id,
        connection_strength: ypMember.connection_strength,
        confidence_score: ypMember.confidence_score
      });
    }
    
    await session2.close();

    // Add bridge contacts (Tier 2 connections)
    const bridgeContacts = [
      {
        name: "Football Industry Consultant",
        linkedin_url: "https://www.linkedin.com/in/FootballIndustryConsultant/",
        industry_influence: "Medium-High",
        network_size: "300+",
        willingness: "HIGH"
      },
      {
        name: "Regional Sports Technology Executive", 
        linkedin_url: "https://www.linkedin.com/in/RegionalSportsTechExec/",
        industry_influence: "High",
        network_size: "400+",
        willingness: "Actively facilitates partnerships"
      }
    ];

    // Create bridge contact nodes and relationships
    const session3 = driver.session();
    for (const bridge of bridgeContacts) {
      const bridgeQuery = `
        MERGE (bc:InfluentialContact {name: $bridge_name})
        SET bc.linkedin_url = $linkedin_url,
            bc.industry_influence = $industry_influence,
            bc.network_size = $network_size,
            bc.willingness = $willingness,
            bc.contact_type = "TIER_2_BRIDGE"
        WITH bc
        MATCH (e:Entity {neo4j_id: $neo4j_id})
        MERGE (bc)-[r1:CONNECTS_TO]->(e)
        SET r1.strength = "STRONG",
            r1.context = "Advisory relationship",
            r1.feasibility = "HIGH",
            r1.bridge_type = "TIER_2",
            r1.created_at = datetime()
      `;

      await session3.run(bridgeQuery, {
        bridge_name: bridge.name,
        linkedin_url: bridge.linkedin_url,
        industry_influence: bridge.industry_influence,
        network_size: bridge.network_size,
        willingness: bridge.willingness,
        neo4j_id: sunderlandDossier.entity.neo4j_id
      });
    }
    
    await session3.close();

    // Add key personnel as Person nodes
    const keyPersonnel = sunderlandDossier.key_personnel;
    const session4 = driver.session();
    
    for (const person of keyPersonnel) {
      const personQuery = `
        MERGE (p:Person {name: $person_name})
        SET p.role = $person_role,
            p.influence_level = $influence_level,
            p.decision_scope = $decision_scope,
            p.affiliation = $entity_name,
            p.entity_id = $neo4j_id,
            p.created_at = datetime()
        WITH p
        MATCH (e:Entity {neo4j_id: $neo4j_id})
        MERGE (p)-[r:WORKS_FOR]->(e)
        SET r.position = $person_role,
            r.created_at = datetime()
      `;

      await session4.run(personQuery, {
        person_name: person.name,
        person_role: person.role,
        influence_level: person.influence_level,
        decision_scope: person.decision_scope,
        entity_name: sunderlandDossier.entity.name,
        neo4j_id: sunderlandDossier.entity.neo4j_id
      });
    }
    
    await session4.close();

    // Add technology partners as relationships
    const techPartners = sunderlandDossier.digital_transformation.current_tech_partners;
    const session5 = driver.session();
    
    for (const partner of techPartners) {
      const partnerQuery = `
        MERGE (tp:TechnologyPartner {name: $partner_name})
        SET tp.partnership_type = "technology_vendor",
            tp.created_at = datetime()
        WITH tp
        MATCH (e:Entity {neo4j_id: $neo4j_id})
        MERGE (e)-[r:HAS_PARTNERSHIP_WITH]->(tp)
        SET r.partnership_category = "technology",
            r.status = "active",
            r.created_at = datetime()
      `;

      await session5.run(partnerQuery, {
        partner_name: partner,
        neo4j_id: sunderlandDossier.entity.neo4j_id
      });
    }
    
    await session5.close();

    // Create opportunity nodes
    const immediateOpportunities = sunderlandDossier.strategic_analysis.opportunity_scoring.immediate_launch;
    const session6 = driver.session();
    
    for (const opportunity of immediateOpportunities) {
      const oppQuery = `
        MERGE (o:Opportunity {name: $opp_name})
        SET o.category = "immediate_launch",
            o.score = $score,
            o.timeline = $timeline,
            o.revenue_potential = $revenue_potential,
            o.entity_name = $entity_name,
            o.created_at = datetime()
        WITH o
        MATCH (e:Entity {neo4j_id: $neo4j_id})
        MERGE (e)-[r:HAS_OPPORTUNITY]->(o)
        SET r.priority = "HIGH",
            r.created_at = datetime()
      `;

      await session6.run(oppQuery, {
        opp_name: opportunity.opportunity,
        score: opportunity.score,
        timeline: opportunity.timeline,
        revenue_potential: opportunity.revenue_potential,
        entity_name: sunderlandDossier.entity.name,
        neo4j_id: sunderlandDossier.entity.neo4j_id
      });
    }
    
    await session6.close();

    console.log('✅ Sunderland AFC successfully added to Neo4j with comprehensive dossier data!');
    console.log('');
    console.log('📊 Summary of data added:');
    console.log(`   - Main entity: ${sunderlandDossier.entity.name}`);
    console.log(`   - Yellow Panther connections: ${yellowPantherConnections.length}`);
    console.log(`   - Bridge contacts: ${bridgeContacts.length}`);
    console.log(`   - Key personnel: ${keyPersonnel.length}`);
    console.log(`   - Technology partners: ${techPartners.length}`);
    console.log(`   - Opportunities: ${immediateOpportunities.length}`);
    console.log(`   - Opportunity Score: ${sunderlandDossier.strategic_analysis.opportunity_scoring.overall_score}/100`);
    console.log(`   - Digital Maturity: ${sunderlandDossier.digital_transformation.digital_maturity}/100`);
    console.log('');
    console.log('🔗 You can now view Sunderland at: http://localhost:3005/entity/148?from=1');

  } catch (error) {
    console.error('❌ Error adding Sunderland to Neo4j:', error);
  } finally {
    await driver.close();
  }
}

// Run the script
addSunderlandToNeo4j();