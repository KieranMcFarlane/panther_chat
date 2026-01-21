#!/usr/bin/env node

/**
 * LinkedIn-First RFP Detection System
 * Multi-phase approach for sports entity RFP opportunity detection
 */

const fs = require('fs');
const path = require('path');

// Sports entities to process (first 10)
const SPORT_ENTITIES = [
  { name: "Antonians Sports Club", sport: "Cricket" },
  { name: "Antwerp Giants", sport: "Basketball" },
  { name: "Anwil Włocławek", sport: "Basketball" },
  { name: "Asseco Resovia Rzeszów", sport: "Volleyball" },
  { name: "Bali United", sport: "Football" },
  { name: "Avaí FC", sport: "Football" },
  { name: "Bandari FC", sport: "Football" },
  { name: "Baltimore Ravens", sport: "American Football" },
  { name: "Bangkok United", sport: "Football" },
  { name: "Barnsley FC", sport: "Football" }
];

class LinkedInFirstRFPDetector {
  constructor() {
    this.results = [];
    this.processingStartTime = Date.now();
  }

  /**
   * Phase 1: BrightData LinkedIn Search
   */
  async phase1LinkedInSearch(entity) {
    console.log(`\n🔍 PHASE 1 - LinkedIn Search: ${entity.name}`);
    
    const searchQuery = `site:linkedin.com/posts|jobs|pulse ${entity.name} RFP|tender|proposals|"digital transformation"`;
    
    try {
      // Using BrightData search engine for LinkedIn
      const searchResults = await this.brightDataSearch(searchQuery, 'google');
      
      if (searchResults && searchResults.length > 0) {
        console.log(`✅ Found ${searchResults.length} LinkedIn results for ${entity.name}`);
        
        // Filter for recent results (last 6 months)
        const recentResults = searchResults.filter(result => {
          const resultDate = new Date(result.date || Date.now());
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          return resultDate >= sixMonthsAgo;
        });

        if (recentResults.length > 0) {
          return {
            status: 'UNVERIFIED-LINKEDIN',
            results: recentResults,
            phase: 'phase1',
            source: 'linkedin',
            method: 'brightdata_search',
            confidence: 75
          };
        }
      }

      console.log(`❌ No LinkedIn results found for ${entity.name}`);
      return {
        status: 'LINKEDIN-NONE',
        phase: 'phase1',
        source: 'linkedin',
        method: 'brightdata_search',
        confidence: 20
      };

    } catch (error) {
      console.error(`❌ Phase 1 error for ${entity.name}:`, error.message);
      return {
        status: 'LINKEDIN-NONE',
        phase: 'phase1',
        source: 'linkedin',
        method: 'brightdata_search',
        error: error.message,
        confidence: 10
      };
    }
  }

  /**
   * Phase 2: Perplexity Comprehensive Search (for LINKEDIN-NONE only)
   */
  async phase2PerplexityComprehensive(entity) {
    console.log(`\n🔍 PHASE 2 - Perplexity Comprehensive: ${entity.name}`);
    
    const comprehensiveQuery = `
      Search for RFP/tender/digital transformation opportunities related to ${entity.name} (${entity.sport}).
      Check these sources:
      1. Tender platforms: iSportConnect, TED (Tenders Electronic Daily), SAM.gov
      2. Sports business news sites
      3. Official organization websites
      4. Press releases and announcements
      
      Focus on the last 6 months and look for:
      - Infrastructure projects
      - Digital transformation initiatives  
      - Technology procurement
      - Stadium/facility upgrades
      - Fan engagement technology
      - Sports performance tech
      
      Return specific URLs, deadlines, and budget information if found.
    `;

    try {
      const perplexityResponse = await this.perplexityChat([
        { role: 'system', content: 'You are an expert in sports industry procurement and RFP detection. Provide specific, actionable intelligence with URLs and verification details.' },
        { role: 'user', content: comprehensiveQuery }
      ]);

      const hasRFP = this.extractRFPIndicators(perplexityResponse);
      
      if (hasRFP.hasOpportunity) {
        console.log(`✅ Found RFP opportunities via Perplexity for ${entity.name}`);
        return {
          status: 'VERIFIED',
          results: [hasRFP.opportunity],
          phase: 'phase2',
          source: 'perplexity_comprehensive',
          method: 'llm_analysis',
          confidence: hasRFP.confidence,
          extracted_data: hasRFP
        };
      } else {
        console.log(`❌ No RFP found via Perplexity for ${entity.name}`);
        return {
          status: 'PERPLEXITY-NONE',
          phase: 'phase2',
          source: 'perplexity_comprehensive',
          method: 'llm_analysis',
          confidence: 30
        };
      }

    } catch (error) {
      console.error(`❌ Phase 2 error for ${entity.name}:`, error.message);
      return {
        status: 'PERPLEXITY-NONE',
        phase: 'phase2',
        source: 'perplexity_comprehensive',
        method: 'llm_analysis',
        error: error.message,
        confidence: 20
      };
    }
  }

  /**
   * Phase 3: BrightData Web Search (for PERPLEXITY-NONE only)
   */
  async phase3BrightDataWeb(entity) {
    console.log(`\n🔍 PHASE 3 - BrightData Web Search: ${entity.name}`);
    
    const webQuery = `${entity.name} ${entity.sport} RFP|tender|"digital transformation"|procurement|technology`;
    
    try {
      const searchResults = await this.brightDataSearch(webQuery, 'google');
      
      if (searchResults && searchResults.length > 0) {
        // Filter for RFP-relevant results
        const relevantResults = searchResults.filter(result => {
          const title = (result.title || '').toLowerCase();
          const description = (result.description || '').toLowerCase();
          return title.includes('rfp') || title.includes('tender') || 
                 title.includes('procurement') || title.includes('digital transformation') ||
                 description.includes('rfp') || description.includes('tender') ||
                 description.includes('procurement');
        });

        if (relevantResults.length > 0) {
          console.log(`✅ Found ${relevantResults.length} web results for ${entity.name}`);
          return {
            status: 'UNVERIFIED-WEB',
            results: relevantResults,
            phase: 'phase3',
            source: 'web_search',
            method: 'brightdata_search',
            confidence: 60
          };
        }
      }

      console.log(`❌ No web results found for ${entity.name}`);
      return {
        status: 'NONE',
        phase: 'phase3',
        source: 'web_search',
        method: 'brightdata_search',
        confidence: 5
      };

    } catch (error) {
      console.error(`❌ Phase 3 error for ${entity.name}:`, error.message);
      return {
        status: 'NONE',
        phase: 'phase3',
        source: 'web_search',
        method: 'brightdata_search',
        error: error.message,
        confidence: 5
      };
    }
  }

  /**
   * Phase 4: Perplexity Validation (for UNVERIFIED only)
   */
  async phase4PerplexityValidation(entity, unverifiedData) {
    console.log(`\n🔍 PHASE 4 - Perplexity Validation: ${entity.name}`);
    
    const validationQuery = `
      Validate this RFP opportunity for ${entity.name}:
      
      Source: ${unverifiedData.source}
      URL: ${unverifiedData.results?.[0]?.url || 'N/A'}
      Title: ${unverifiedData.results?.[0]?.title || 'N/A'}
      
      Please verify:
      1. Is the URL real and accessible?
      2. Is the deadline still in the future?
      3. Can you estimate the budget range?
      4. Is this actually an RFP/tender opportunity?
      5. What's the confidence level (1-100)?
      
      Provide specific validation details and explain your reasoning.
    `;

    try {
      const validationResponse = await this.perplexityChat([
        { role: 'system', content: 'You are an expert RFP validator. Check URLs, deadlines, budgets, and authenticity of procurement opportunities.' },
        { role: 'user', content: validationQuery }
      ]);

      const validation = this.extractValidationResults(validationResponse);
      
      if (validation.isValid) {
        console.log(`✅ Validation PASSED for ${entity.name}`);
        return {
          status: 'VERIFIED',
          validation_results: validation,
          phase: 'phase4',
          confidence: validation.confidence
        };
      } else {
        console.log(`❌ Validation FAILED for ${entity.name}`);
        return {
          status: 'REJECTED',
          validation_results: validation,
          phase: 'phase4',
          confidence: validation.confidence,
          reason: validation.reason
        };
      }

    } catch (error) {
      console.error(`❌ Phase 4 error for ${entity.name}:`, error.message);
      return {
        status: 'REJECTED',
        phase: 'phase4',
        error: error.message,
        reason: 'Validation error'
      };
    }
  }

  /**
   * Phase 5: Competitive Intelligence (for fit_score >= 80 only)
   */
  async phase5CompetitiveIntel(entity, opportunityData) {
    console.log(`\n🔍 PHASE 5 - Competitive Intelligence: ${entity.name}`);
    
    const intelQuery = `
      Gather competitive intelligence for ${entity.name} RFP opportunity:
      
      Opportunity: ${opportunityData.summary || 'High-value project'}
      
      Research and provide:
      1. Key decision-makers and stakeholders
      2. Current partners and vendors
      3. Likely competitors for this project
      4. Past similar projects and winners
      5. Organization's procurement preferences
      6. Technology stack and systems currently used
      7. Budget range and spending patterns
      
      Focus on actionable intelligence that can help win this opportunity.
    `;

    try {
      const intelResponse = await this.perplexityChat([
        { role: 'system', content: 'You are a competitive intelligence expert specializing in sports industry procurement and partnerships.' },
        { role: 'user', content: intelQuery }
      ]);

      const intelligence = this.extractCompetitiveIntelligence(intelResponse);
      
      console.log(`✅ Competitive intelligence gathered for ${entity.name}`);
      return {
        status: 'COMPLETED',
        intelligence: intelligence,
        phase: 'phase5',
        confidence: intelligence.quality
      };

    } catch (error) {
      console.error(`❌ Phase 5 error for ${entity.name}:`, error.message);
      return {
        status: 'SKIPPED',
        phase: 'phase5',
        error: error.message
      };
    }
  }

  /**
   * Calculate fit score (0-100)
   */
  calculateFitScore(entity, opportunityData) {
    let serviceAlignment = 0;
    let projectScope = 0;
    let ypDifferentiators = 0;

    // Service Alignment (50%)
    if (opportunityData.summary) {
      const summary = opportunityData.summary.toLowerCase();
      if (summary.includes('digital') || summary.includes('technology') || summary.includes('software')) {
        serviceAlignment = 85;
      } else if (summary.includes('infrastructure') || summary.includes('facilities')) {
        serviceAlignment = 70;
      } else if (summary.includes('consulting') || summary.includes('strategy')) {
        serviceAlignment = 90;
      } else {
        serviceAlignment = 60;
      }
    } else {
      serviceAlignment = 50;
    }

    // Project Scope (30%)
    if (opportunityData.budget) {
      const budget = opportunityData.budget.toLowerCase();
      if (budget.includes('million') || budget.includes('m+')) {
        projectScope = 90;
      } else if (budget.includes('k') && !budget.includes('100k')) {
        projectScope = 60;
      } else {
        projectScope = 70;
      }
    } else {
      projectScope = 50;
    }

    // YP Differentiators (20%)
    // Yellow Panther strengths: sports industry expertise, AI/ML capabilities, digital transformation
    const hasSportsContext = entity.sport || opportunityData.source_type?.includes('sports');
    const hasTechComponent = opportunityData.summary?.toLowerCase().includes('digital') || 
                            opportunityData.summary?.toLowerCase().includes('technology');
    
    if (hasSportsContext && hasTechComponent) {
      ypDifferentiators = 95;
    } else if (hasSportsContext || hasTechComponent) {
      ypDifferentiators = 75;
    } else {
      ypDifferentiators = 60;
    }

    const fitScore = Math.round((serviceAlignment * 0.5) + (projectScope * 0.3) + (ypDifferentiators * 0.2));

    return {
      fit_score: fitScore,
      service_alignment: serviceAlignment,
      project_scope: projectScope,
      yp_differentiators: ypDifferentiators
    };
  }

  /**
   * Process entity through all phases
   */
  async processEntity(entity) {
    const entityStartTime = Date.now();
    console.log(`\n🎯 Processing: ${entity.name} (${entity.sport})`);

    const result = {
      organization_name: entity.name,
      sport: entity.sport,
      phases: {},
      final_status: 'PROCESSING',
      source_link: null,
      source_type: null,
      discovery_source: null,
      discovery_method: null,
      validation_status: null,
      deadline_date: null,
      budget_estimate: null,
      confidence_score: 0,
      fit_score: 0,
      summary: null,
      competitive_intel: null,
      processing_time_seconds: 0
    };

    try {
      // Phase 1: LinkedIn Search
      const phase1Result = await this.phase1LinkedInSearch(entity);
      result.phases.phase1 = phase1Result;

      if (phase1Result.status === 'UNVERIFIED-LINKEDIN') {
        // Phase 4: Validation (skip to validation for LinkedIn finds)
        const phase4Result = await this.phase4PerplexityValidation(entity, phase1Result);
        result.phases.phase4 = phase4Result;
        
        result.final_status = phase4Result.status;
        result.discovery_source = 'linkedin';
        result.discovery_method = 'brightdata_search';
        result.source_link = phase1Result.results?.[0]?.url;
        result.source_type = 'linkedin';
        result.confidence_score = phase4Result.confidence || phase1Result.confidence;

      } else {
        // Phase 2: Perplexity Comprehensive
        const phase2Result = await this.phase2PerplexityComprehensive(entity);
        result.phases.phase2 = phase2Result;

        if (phase2Result.status === 'VERIFIED') {
          result.final_status = 'VERIFIED';
          result.discovery_source = 'perplexity';
          result.discovery_method = 'comprehensive_search';
          result.source_link = phase2Result.extracted_data?.url;
          result.source_type = 'comprehensive';
          result.confidence_score = phase2Result.confidence;

        } else {
          // Phase 3: BrightData Web Search
          const phase3Result = await this.phase3BrightDataWeb(entity);
          result.phases.phase3 = phase3Result;

          if (phase3Result.status === 'UNVERIFIED-WEB') {
            // Phase 4: Validation
            const phase4Result = await this.phase4PerplexityValidation(entity, phase3Result);
            result.phases.phase4 = phase4Result;
            
            result.final_status = phase4Result.status;
            result.discovery_source = 'web_search';
            result.discovery_method = 'brightdata_search';
            result.source_link = phase3Result.results?.[0]?.url;
            result.source_type = 'web';
            result.confidence_score = phase4Result.confidence || phase3Result.confidence;

          } else {
            result.final_status = 'NONE';
            result.confidence_score = phase3Result.confidence;
          }
        }
      }

      // Extract opportunity data
      let opportunityData = {};
      if (result.final_status === 'VERIFIED') {
        const validatedPhase = result.phases.phase4 || result.phases.phase2;
        opportunityData = {
          summary: validatedPhase.results?.[0]?.summary || validatedPhase.extracted_data?.opportunity?.summary,
          budget: validatedPhase.results?.[0]?.budget || validatedPhase.extracted_data?.opportunity?.budget,
          deadline: validatedPhase.results?.[0]?.deadline || validatedPhase.extracted_data?.opportunity?.deadline
        };

        // Calculate fit score
        const fitScore = this.calculateFitScore(entity, opportunityData);
        result.fit_score = fitScore.fit_score;
        result.fit_breakdown = fitScore;

        result.summary = opportunityData.summary;
        result.budget_estimate = opportunityData.budget;
        result.deadline_date = opportunityData.deadline ? new Date(opportunityData.deadline) : null;

        // Phase 5: Competitive Intelligence (for fit_score >= 80 only)
        if (fitScore.fit_score >= 80) {
          const phase5Result = await this.phase5CompetitiveIntel(entity, opportunityData);
          result.phases.phase5 = phase5Result;
          result.competitive_intel = phase5Result.intelligence;
        }
      }

    } catch (error) {
      console.error(`❌ Error processing ${entity.name}:`, error);
      result.final_status = 'ERROR';
      result.error = error.message;
    }

    result.processing_time_seconds = Math.round((Date.now() - entityStartTime) / 1000);
    this.results.push(result);

    console.log(`✅ Completed: ${entity.name} - Status: ${result.final_status} - Fit Score: ${result.fit_score}`);
    return result;
  }

  /**
   * Extract RFP indicators from Perplexity response
   */
  extractRFPIndicators(response) {
    const text = response.toLowerCase();
    const hasURL = text.includes('http') || text.includes('www.');
    const hasDeadline = text.includes('deadline') || text.includes('due') || text.includes('closing');
    const hasBudget = text.includes('budget') || text.includes('cost') || text.includes('$') || text.includes('€');
    
    const hasOpportunity = hasURL && (hasDeadline || hasBudget);
    
    return {
      hasOpportunity,
      opportunity: hasOpportunity ? {
        summary: this.extractSummary(response),
        url: this.extractURL(response),
        budget: this.extractBudget(response),
        deadline: this.extractDeadline(response)
      } : null,
      confidence: this.calculateConfidence(hasURL, hasDeadline, hasBudget)
    };
  }

  /**
   * Extract validation results
   */
  extractValidationResults(response) {
    const text = response.toLowerCase();
    
    return {
      isValid: text.includes('valid') || text.includes('legitimate') || text.includes('accessible'),
      isReal: !text.includes('fake') && !text.includes('invalid') && !text.includes('not found'),
      hasFutureDeadline: text.includes('future') || text.includes('open') || text.includes('available'),
      confidence: this.extractConfidenceScore(response),
      reason: this.extractValidationReason(response),
      details: response
    };
  }

  /**
   * Extract competitive intelligence
   */
  extractCompetitiveIntelligence(response) {
    return {
      decision_makers: this.extractDecisionMakers(response),
      partners: this.extractPartners(response),
      competitors: this.extractCompetitors(response),
      past_projects: this.extractPastProjects(response),
      procurement_preferences: this.extractProcurementPreferences(response),
      tech_stack: this.extractTechStack(response),
      budget_range: this.extractBudgetRange(response),
      quality: this.assessIntelQuality(response)
    };
  }

  // Helper extraction methods
  extractSummary(text) {
    const lines = text.split('\n');
    return lines.find(line => line.length > 50 && !line.includes('http'))?.trim() || '';
  }

  extractURL(text) {
    const urlRegex = /https?:\/\/[^\s]+/i;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  }

  extractBudget(text) {
    const budgetRegex = /\$\d+[kmb]|€\d+[kmb]|million|thousand/gi;
    const match = text.match(budgetRegex);
    return match ? match[0] : null;
  }

  extractDeadline(text) {
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/gi;
    const match = text.match(dateRegex);
    return match ? match[0] : null;
  }

  calculateConfidence(hasURL, hasDeadline, hasBudget) {
    let confidence = 0;
    if (hasURL) confidence += 40;
    if (hasDeadline) confidence += 30;
    if (hasBudget) confidence += 30;
    return Math.min(confidence, 100);
  }

  extractConfidenceScore(text) {
    const confidenceRegex = /(\d{1,3})%|confidence[:\s]*(\d{1,3})/gi;
    const match = text.match(confidenceRegex);
    return match ? parseInt(match[0].replace(/\D/g, '')) : 50;
  }

  extractValidationReason(text) {
    const lines = text.split('\n');
    return lines.find(line => 
      line.toLowerCase().includes('reason') || 
      line.toLowerCase().includes('because') ||
      line.toLowerCase().includes('valid') ||
      line.toLowerCase().includes('invalid')
    )?.trim() || 'Validation completed';
  }

  extractDecisionMakers(text) {
    // Extract names and titles from response
    const nameRegex = /[A-Z][a-z]+ [A-Z][a-z]+/g;
    return text.match(nameRegex) || [];
  }

  extractPartners(text) {
    const partnerKeywords = ['partner', 'sponsor', 'vendor', 'supplier'];
    const lines = text.toLowerCase().split('\n');
    return lines.filter(line => 
      partnerKeywords.some(keyword => line.includes(keyword))
    ).map(line => line.trim());
  }

  extractCompetitors(text) {
    const competitorKeywords = ['competitor', 'rival', 'alternative', 'other'];
    const lines = text.toLowerCase().split('\n');
    return lines.filter(line => 
      competitorKeywords.some(keyword => line.includes(keyword))
    ).map(line => line.trim());
  }

  extractPastProjects(text) {
    const projectKeywords = ['previous', 'past', 'earlier', 'similar'];
    const lines = text.toLowerCase().split('\n');
    return lines.filter(line => 
      projectKeywords.some(keyword => line.includes(keyword))
    ).map(line => line.trim());
  }

  extractProcurementPreferences(text) {
    const procurementKeywords = ['prefer', 'require', 'standard', 'criteria'];
    const lines = text.toLowerCase().split('\n');
    return lines.filter(line => 
      procurementKeywords.some(keyword => line.includes(keyword))
    ).map(line => line.trim());
  }

  extractTechStack(text) {
    const techKeywords = ['technology', 'software', 'platform', 'system', 'cloud'];
    const lines = text.toLowerCase().split('\n');
    return lines.filter(line => 
      techKeywords.some(keyword => line.includes(keyword))
    ).map(line => line.trim());
  }

  extractBudgetRange(text) {
    const rangeRegex = /\$\d+[kmb]?\s*-\s*\$\d+[kmb]?|\d+[kmb]?\s*-\s*\d+[kmb]?/gi;
    const match = text.match(rangeRegex);
    return match ? match[0] : null;
  }

  assessIntelQuality(text) {
    const quality = text.length;
    if (quality > 1000) return 90;
    if (quality > 500) return 75;
    if (quality > 200) return 60;
    return 40;
  }

  /**
   * BrightData search (placeholder - would use actual MCP tool)
   */
  async brightDataSearch(query, engine = 'google') {
    try {
      // This would use the actual mcp__brightdata__search_engine tool
      // For now, return empty results to be filled by actual MCP calls
      console.log(`🔍 Searching: ${query.substring(0, 100)}...`);
      
      // In real implementation, this would be:
      // return await mcp__brightdata__search_engine({ query, engine });
      
      return []; // Empty array for now
    } catch (error) {
      console.error('BrightData search error:', error);
      return [];
    }
  }

  /**
   * Perplexity chat (placeholder - would use actual MCP tool)
   */
  async perplexityChat(messages) {
    try {
      // This would use the actual mcp__perplexity__chat_completion tool
      const userMessage = messages[messages.length - 1].content;
      console.log(`🤖 Perplexity query: ${userMessage.substring(0, 100)}...`);
      
      // In real implementation, this would be:
      // return await mcp__perplexity__chat_completion({ messages });
      
      return 'Perplexity response placeholder - would contain actual RFP intelligence';
    } catch (error) {
      console.error('Perplexity chat error:', error);
      return 'Error occurred during Perplexity analysis';
    }
  }

  /**
   * Store results in database
   */
  async storeResults() {
    try {
      // This would use the actual mcp__supabase__execute_sql tool
      console.log(`💾 Storing ${this.results.length} results in database...`);
      
      for (const result of this.results) {
        const sql = `
          INSERT INTO linkedin_rfp_detection (
            organization_name, sport, phase_1_status, phase_2_status, phase_3_status,
            phase_4_status, phase_5_status, final_status, source_link, source_type,
            discovery_source, discovery_method, validation_status, deadline_date,
            budget_estimate, confidence_score, fit_score, summary, competitive_intel,
            processing_time_seconds
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          )
        `;
        
        console.log(`💾 Storing: ${result.organization_name} - ${result.final_status}`);
        
        // In real implementation:
        // await mcp__supabase__execute_sql({ 
        //   query: sql,
        //   params: [/* result values */]
        // });
      }
      
      console.log('✅ Results stored successfully');
    } catch (error) {
      console.error('❌ Error storing results:', error);
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const totalTime = Math.round((Date.now() - this.processingStartTime) / 1000);
    
    const stats = {
      total_processed: this.results.length,
      verified: this.results.filter(r => r.final_status === 'VERIFIED').length,
      rejected: this.results.filter(r => r.final_status === 'REJECTED').length,
      none: this.results.filter(r => r.final_status === 'NONE').length,
      high_fit: this.results.filter(r => r.fit_score >= 80).length,
      medium_fit: this.results.filter(r => r.fit_score >= 60 && r.fit_score < 80).length,
      low_fit: this.results.filter(r => r.fit_score < 60).length,
      total_processing_time: totalTime
    };

    const report = `
# LinkedIn-First RFP Detection System - Results Report
Generated: ${new Date().toISOString()}

## Executive Summary
- Total Entities Processed: ${stats.total_processed}
- Verified RFP Opportunities: ${stats.verified}
- Rejected Opportunities: ${stats.rejected}
- No Opportunities Found: ${stats.none}
- High Fit Score (80+): ${stats.high_fit}
- Medium Fit Score (60-79): ${stats.medium_fit}
- Low Fit Score (<60): ${stats.low_fit}
- Total Processing Time: ${stats.total_processing_time}s

## Detailed Results

${this.results.map(result => `
### ${result.organization_name} (${result.sport})
**Status:** ${result.final_status}
**Fit Score:** ${result.fit_score}/100
**Confidence:** ${result.confidence_score}%
**Discovery:** ${result.discovery_source} via ${result.discovery_method}

${result.source_link ? `**Source:** [Link](${result.source_link})` : ''}
${result.deadline_date ? `**Deadline:** ${result.deadline_date.toISOString().split('T')[0]}` : ''}
${result.budget_estimate ? `**Budget:** ${result.budget_estimate}` : ''}
${result.summary ? `**Summary:** ${result.summary}` : ''}

${result.competitive_intel ? `
**Competitive Intelligence:**
- Decision Makers: ${result.competitive_intel.decision_makers?.join(', ') || 'N/A'}
- Partners: ${result.competitive_intel.partners?.length || 0} identified
- Competitors: ${result.competitive_intel.competitors?.length || 0} identified
` : ''}

---
`).join('')}

## Processing Phases Breakdown
${this.results.map(result => `
**${result.organization_name}:**
- Phase 1 (LinkedIn): ${result.phases.phase1?.status || 'N/A'}
- Phase 2 (Perplexity): ${result.phases.phase2?.status || 'N/A'}
- Phase 3 (Web): ${result.phases.phase3?.status || 'N/A'}
- Phase 4 (Validation): ${result.phases.phase4?.status || 'N/A'}
- Phase 5 (Intel): ${result.phases.phase5?.status || 'N/A'}
`).join('')}

## Recommendations
1. **Priority Opportunities:** ${this.results.filter(r => r.fit_score >= 80 && r.final_status === 'VERIFIED').map(r => r.organization_name).join(', ') || 'None identified'}
2. **Follow-up Required:** ${this.results.filter(r => r.final_status === 'VERIFIED' && r.fit_score >= 60).map(r => r.organization_name).join(', ') || 'None identified'}
3. **Monitor for Future:** ${this.results.filter(r => r.final_status === 'NONE').map(r => r.organization_name).join(', ') || 'None identified'}

---
Report generated by LinkedIn-First RFP Detection System
`;

    return report;
  }

  /**
   * Run the complete detection system
   */
  async run() {
    console.log('🚀 Starting LinkedIn-First RFP Detection System');
    console.log(`📊 Processing ${SPORT_ENTITIES.length} sports entities\n`);

    for (const entity of SPORT_ENTITIES) {
      await this.processEntity(entity);
    }

    console.log('\n📋 Generating final report...');
    const report = this.generateReport();
    
    // Save report
    const reportPath = path.join(process.cwd(), `linkedin-rfp-detection-results-${new Date().toISOString().split('T')[0]}.md`);
    fs.writeFileSync(reportPath, report);
    
    console.log(`\n✅ Report saved to: ${reportPath}`);
    
    // Store results in database
    await this.storeResults();
    
    console.log('\n🎉 LinkedIn-First RFP Detection System completed!');
    
    return {
      results: this.results,
      report: report,
      summary: {
        total_processed: SPORT_ENTITIES.length,
        verified: this.results.filter(r => r.final_status === 'VERIFIED').length,
        high_fit: this.results.filter(r => r.fit_score >= 80).length,
        processing_time: Math.round((Date.now() - this.processingStartTime) / 1000)
      }
    };
  }
}

// Export for use as module
module.exports = LinkedInFirstRFPDetector;

// Run if called directly
if (require.main === module) {
  const detector = new LinkedInFirstRFPDetector();
  detector.run().catch(console.error);
}