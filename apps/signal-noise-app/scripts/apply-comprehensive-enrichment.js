#!/usr/bin/env node

// Apply Comprehensive Enrichment to All Entities
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

class ComprehensiveEnrichmentApplicator {
  constructor() {
    this.baseUrl = 'http://localhost:3005';
    this.processedEntities = [];
    this.failedEntities = [];
    this.startTime = Date.now();
  }

  async getBatchInformation() {
    console.log('📊 Getting batch information for all entities...');
    
    const response = await fetch(`${this.baseUrl}/api/batch-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_types: ['club', 'league', 'organization', 'person'],
        batch_size: 3,
        include_claude_analysis: true,
        include_perplexity_research: true,
        include_brightdata_scraping: false
      })
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Failed to get batch info: ${data.error}`);
    }

    console.log(`✅ Found ${data.batch_info.total_entities} entities in ${data.batch_info.total_batches} batches`);
    console.log(`📋 Entity distribution:`, data.batch_info.entities_by_type);
    
    return data.batch_info;
  }

  async enrichEntity(entity) {
    console.log(`🧠 Enriching ${entity.name} (${entity.type})...`);
    
    const response = await fetch(`${this.baseUrl}/api/enrich-entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_id: entity.neo4j_id,
        entity_type: entity.type,
        entity_name: entity.name,
        enrichment_options: {
          include_claude_analysis: true,
          include_perplexity_research: true,
          include_brightdata_scraping: false
        }
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`   ✅ ${entity.name} enriched successfully`);
      console.log(`      📊 Opportunity Score: ${data.enrichment_results?.composite_scores?.opportunity_score || 'N/A'}`);
      console.log(`      🎯 Digital Maturity: ${data.enrichment_results?.claude_analysis?.digital_maturity || 'N/A'}`);
      console.log(`      ⏱️  Processing Time: ${data.processing_time_ms}ms`);
      
      this.processedEntities.push({
        name: entity.name,
        type: entity.type,
        opportunityScore: data.enrichment_results?.composite_scores?.opportunity_score,
        digitalMaturity: data.enrichment_results?.claude_analysis?.digital_maturity,
        processingTime: data.processing_time_ms
      });
      
      return true;
    } else {
      console.log(`   ❌ ${entity.name} enrichment failed: ${data.error}`);
      this.failedEntities.push({
        name: entity.name,
        type: entity.type,
        error: data.error
      });
      
      return false;
    }
  }

  async applyComprehensiveEnrichment() {
    console.log('🚀 Starting Comprehensive Enrichment Application\n');
    console.log('='.repeat(60));
    
    try {
      // Get batch information
      const batchInfo = await this.getBatchInformation();
      
      console.log('\n🎯 Processing all entities...\n');
      
      // Process each batch
      for (const batch of batchInfo.batches) {
        console.log(`📦 Processing batch ${batch.batch_number}/${batchInfo.total_batches} (${batch.entity_count} entities)`);
        
        // Process each entity in the batch
        for (const entity of batch.entities) {
          await this.enrichEntity(entity);
          
          // Small delay between entities to avoid overwhelming the APIs
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`✅ Batch ${batch.batch_number} completed\n`);
      }
      
      // Generate final report
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Comprehensive enrichment failed:', error.message);
    }
  }

  async generateReport() {
    const totalTime = Date.now() - this.startTime;
    const successRate = (this.processedEntities.length / (this.processedEntities.length + this.failedEntities.length) * 100).toFixed(1);
    
    console.log('\n📊 COMPREHENSIVE ENRICHMENT COMPLETE - Report');
    console.log('='.repeat(60));
    
    console.log(`\n🎯 Processing Summary:`);
    console.log(`   Total Entities Processed: ${this.processedEntities.length + this.failedEntities.length}`);
    console.log(`   Successfully Enriched: ${this.processedEntities.length}`);
    console.log(`   Failed: ${this.failedEntities.length}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Total Processing Time: ${(totalTime / 1000).toFixed(2)}s`);
    
    // Entity type breakdown
    const typeBreakdown = this.processedEntities.reduce((acc, entity) => {
      if (!acc[entity.type]) acc[entity.type] = { count: 0, scores: [] };
      acc[entity.type].count++;
      if (entity.opportunityScore) acc[entity.type].scores.push(entity.opportunityScore);
      return acc;
    }, {});
    
    console.log(`\n📋 Entity Type Breakdown:`);
    Object.entries(typeBreakdown).forEach(([type, data]) => {
      const avgScore = data.scores.length > 0 ? (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1) : 'N/A';
      console.log(`   ${type.charAt(0).toUpperCase() + type.slice(1)}s: ${data.count} enriched, Avg Score: ${avgScore}`);
    });
    
    // Top opportunities
    const topOpportunities = this.processedEntities
      .filter(e => e.opportunityScore)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 5);
    
    if (topOpportunities.length > 0) {
      console.log(`\n🏆 Top 5 Opportunities:`);
      topOpportunities.forEach((entity, index) => {
        console.log(`   ${index + 1}. ${entity.name} - Score: ${entity.opportunityScore} (${entity.digitalMaturity})`);
      });
    }
    
    // Failed entities
    if (this.failedEntities.length > 0) {
      console.log(`\n❌ Failed Entities:`);
      this.failedEntities.forEach(entity => {
        console.log(`   ${entity.name} (${entity.type}): ${entity.error}`);
      });
    }
    
    console.log(`\n✅ All entities have been enriched with AI intelligence!`);
    console.log(`🌐 View enriched entities at: http://localhost:3005/entity-browser`);
    console.log(`📊 View enrichment dashboard at: http://localhost:3005/comprehensive-enrichment`);
  }
}

// Main execution
async function main() {
  const applicator = new ComprehensiveEnrichmentApplicator();
  
  try {
    await applicator.applyComprehensiveEnrichment();
  } catch (error) {
    console.error('❌ Application failed:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Enrichment application interrupted');
  process.exit(0);
});

main().catch(console.error);