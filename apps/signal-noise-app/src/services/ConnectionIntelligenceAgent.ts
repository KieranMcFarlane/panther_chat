/**
 * Connection Intelligence Agent - A2A Orchestra Member
 * 
 * Specializes in LinkedIn network analysis and introduction strategy generation
 * Integrates with Claude Agent SDK and MCP tools for intelligent connection mapping
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { supabase } from '@/lib/supabase-client';
import { liveLogService } from './LiveLogService';

interface ConnectionRequest {
  organization: string;
  linkedin_url?: string;
  rfp_context?: {
    title: string;
    value: string;
    fit_score: number;
    deadline?: string;
  };
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  trigger_source: 'rfp_detection' | 'personnel_change' | 'manual_request';
  request_id: string;
}

interface ConnectionAnalysis {
  request_id: string;
  target_organization: string;
  analysis_timestamp: string;
  processing_time_ms: number;
  
  team_connections: {
    stuart_cope_connections: number;
    total_team_connections: number;
    strong_paths: number;
    medium_paths: number;
    primary_path_available: boolean;
  };
  
  optimal_introduction_paths: Array<{
    yellow_panther_contact: string;
    connection_strength: 'STRONG' | 'MEDIUM' | 'WEAK';
    confidence_score: number;
    path_description: string;
    mutual_contacts?: Array<{
      name: string;
      linkedin_url: string;
      relationship_context: string;
      years_known: number;
    }>;
    messaging_strategy: string;
    timeline_to_introduction: string;
  }>;
  
  opportunity_enhancement: {
    base_score: number;
    network_boost: number;
    enhanced_score: number;
    success_probability: number;
    competitive_advantage: string;
  };
  
  actionable_next_steps: Array<{
    action: string;
    priority: 'IMMEDIATE' | 'WITHIN_24H' | 'WITHIN_48H';
    contact_person?: string;
    talking_points: string[];
    alternative_approach?: string;
  }>;
}

export class ConnectionIntelligenceAgent {
  private readonly agentConfig = {
    name: "connection-intelligence-agent",
    description: "LinkedIn network analysis and warm introduction strategy specialist",
    
    mcpServers: {
      "brightdata": {
        command: "npx",
        args: ["-y", "@brightdata/mcp"],
        env: {
          API_TOKEN: process.env.BRIGHTDATA_API_TOKEN
        }
      }
    },
    
    allowedTools: [
      "mcp__brightdata__scrape_as_markdown",
      "mcp__brightdata__search_engine",
      "mcp__brightdata__scrape_batch"
    ],
    
    maxTurns: 10,
    temperature: 0.2 // Lower temperature for consistent, factual analysis
  };

  private readonly yellowPantherUKTeam = {
    primary: {
      name: "Stuart Cope",
      linkedin_url: "https://uk.linkedin.com/in/stuart-cope-54392b16/",
      role: "Co-Founder & COO",
      weight: 1.5,
      expertise: ["Operations", "Client Relationships", "Strategic Partnerships"]
    },
    
    senior_team: [
      {
        name: "Gunjan Parikh",
        linkedin_url: "https://uk.linkedin.com/in/gunjan-parikh/",
        role: "Founder & CEO",
        weight: 1.3,
        expertise: ["Strategic Vision", "Business Development", "Client Strategy"]
      },
      {
        name: "Andrew Rapley",
        linkedin_url: "https://uk.linkedin.com/in/andrew-rapley/",
        role: "Head of Projects",
        weight: 1.2,
        expertise: ["Project Management", "Delivery Excellence", "Client Success"]
      },
      {
        name: "Sarfraz Hussain",
        linkedin_url: "https://uk.linkedin.com/in/sarfraz-hussain/",
        role: "Head of Strategy",
        weight: 1.2,
        expertise: ["Strategic Planning", "Market Analysis", "Growth Strategy"]
      },
      {
        name: "Elliott Hillman",
        linkedin_url: "https://uk.linkedin.com/in/elliott-hillman/",
        role: "Senior Client Partner",
        weight: 1.2,
        expertise: ["Client Partnerships", "Sports Industry", "Business Development"]
      }
    ],
    
    bridge_contacts: [
      {
        name: "Ben Foster",
        relationship: "Former Professional Footballer",
        network_reach: "Sports Industry Contacts",
        introduction_capability: "High credibility in sports sector"
      }
    ]
  };

  /**
   * Analyze LinkedIn connections for optimal introduction paths
   */
  async analyzeConnections(request: ConnectionRequest): Promise<ConnectionAnalysis> {
    const startTime = Date.now();
    
    try {
      liveLogService.info('🔗 Connection Intelligence Agent activated', {
        request_id: request.request_id,
        target_organization: request.organization,
        priority: request.priority,
        trigger_source: request.trigger_source
      });

      // Build comprehensive analysis prompt
      const analysisPrompt = this.buildComprehensiveAnalysisPrompt(request);
      
      // Execute Claude Agent with MCP tools
      const result = await query({
        prompt: analysisPrompt,
        options: this.agentConfig
      });

      // Parse and structure the response
      const processingTime = Date.now() - startTime;
      const analysis = this.parseAndStructureResponse(result, request, processingTime);
      
      // Store analysis results in Supabase cache
      await this.persistAnalysisResults(analysis);
      
      // Log completion
      liveLogService.success('✅ Connection analysis completed', {
        request_id: request.request_id,
        target_organization: request.organization,
        total_connections: analysis.team_connections.total_team_connections,
        stuart_cope_connections: analysis.team_connections.stuart_cope_connections,
        network_boost: analysis.opportunity_enhancement.network_boost,
        processing_time_ms: processingTime
      });

      return analysis;

    } catch (error) {
      liveLogService.error('❌ Connection analysis failed', {
        request_id: request.request_id,
        target_organization: request.organization,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  /**
   * Get cached connection analysis if available and recent
   */
  async getCachedAnalysis(organization: string, maxAgeHours: number = 72): Promise<ConnectionAnalysis | null> {
    try {
      const minCreatedAt = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('entity_cache')
        .select('data, updated_at, created_at')
        .eq('entity_type', 'connection_analysis')
        .eq('organization', organization)
        .gte('created_at', minCreatedAt)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      const cachedAnalysis = data?.[0]?.data as ConnectionAnalysis | undefined;
      if (cachedAnalysis) {
        return cachedAnalysis;
      }
      
      return null;
      
    } catch (error) {
      liveLogService.error('❌ Failed to retrieve cached analysis', {
        organization,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Build comprehensive analysis prompt for Claude Agent
   */
  private buildComprehensiveAnalysisPrompt(request: ConnectionRequest): string {
    const rfpContextSection = request.rfp_context ? `
RFP OPPORTUNITY CONTEXT:
- Title: ${request.rfp_context.title}
- Estimated Value: ${request.rfp_context.value}
- Yellow Panther Fit Score: ${request.rfp_context.fit_score}%
- Deadline: ${request.rfp_context.deadline || 'Not specified'}

This RFP represents an IMMEDIATE business opportunity. Focus on finding the WARMEST, FASTEST introduction paths.
` : '';

    const teamSection = `
YELLOW PANTHER UK TEAM - CONNECTION ANALYSIS:

PRIMARY CONNECTION (1.5x weight - highest priority):
- Stuart Cope: ${this.yellowPantherUKTeam.primary.linkedin_url}
  Role: ${this.yellowPantherUKTeam.primary.role}
  Expertise: ${this.yellowPantherUKTeam.primary.expertise.join(', ')}
  Weight: 1.5x for all connection scoring

SENIOR TEAM MEMBERS:
${this.yellowPantherUKTeam.senior_team.map(member => `
- ${member.name}: ${member.linkedin_url}
  Role: ${member.role}
  Expertise: ${member.expertise.join(', ')}
  Weight: ${member.weight}x multiplier
`).join('')}

BRIDGE CONTACTS (for 2nd-degree analysis):
${this.yellowPantherUKTeam.bridge_contacts.map(contact => `
- ${contact.name}: ${contact.relationship}
  Network: ${contact.network_reach}
  Capability: ${contact.introduction_capability}
`).join('')}
`;

    const analysisTasks = `
ANALYSIS TASKS - EXECUTE IN ORDER:

1. ENTITY DISCOVERY:
   - Search for "${request.organization}" LinkedIn company page
   - Identify key decision makers (CEO, CTO, Digital Director, Commercial Director)
   - Map organizational structure and recent personnel changes

2. PRIMARY CONNECTION ANALYSIS (Stuart Cope Priority):
   - Analyze Stuart Cope's direct connections to ${request.organization}
   - Search for mutual connections with high influence
   - Identify any shared company history or alumni networks
   - Calculate connection strength using 1.5x weight multiplier

3. TEAM NETWORK ANALYSIS:
   - Map connections from all Yellow Panther UK team members
   - Identify overlapping networks and shared contacts
   - Analyze connection strength and recency for each team member
   - Prioritize connections with relevant industry expertise

4. SECOND-DEGREE ANALYSIS:
   - Leverage bridge contacts for extended network reach
   - Identify influential intermediaries who can facilitate introductions
   - Map two-hop connection paths with high probability of success

5. STRATEGIC ASSESSMENT:
   - Score each introduction path (0-100 confidence)
   - Calculate network boost to opportunity score (0-25 points)
   - Estimate success probability increase vs cold outreach
   - Identify competitive advantages from network access

6. ACTIONABLE STRATEGY:
   - Provide specific messaging for each introduction path
   - Create talking points tailored to each Yellow Panther team member
   - Estimate timelines for warm introductions
   - Recommend immediate next steps with priorities
`;

    const outputFormat = `
REQUIRED OUTPUT FORMAT (JSON):
{
  "analysis_summary": {
    "target_organization": "Organization name",
    "decision_makers_identified": number,
    "total_connections_found": number,
    "stuart_cope_primary_connections": number,
    "primary_path_available": boolean,
    "analysis_confidence": number (0-100)
  },
  
  "introduction_paths": [
    {
      "yellow_panther_contact": "Team member name",
      "connection_strength": "STRONG|MEDIUM|WEAK",
      "confidence_score": number (0-100),
      "path_description": "Clear explanation of the connection route",
      "mutual_connections": [
        {
          "name": "Contact name",
          "linkedin_url": "URL",
          "relationship_context": "How they know both parties",
          "years_known": number,
          "influence_level": "HIGH|MEDIUM|LOW"
        }
      ],
      "messaging_strategy": "Specific approach and key messages",
      "timeline_to_introduction": "Estimated time to get introduction"
    }
  ],
  
  "opportunity_enhancement": {
    "base_score": number (from RFP context or default 70),
    "network_boost": number (0-25 points based on connections),
    "enhanced_score": number,
    "success_probability": number (percentage vs ~20% cold outreach),
    "competitive_advantage": "Description of unique network advantage"
  },
  
  "actionable_next_steps": [
    {
      "action": "Specific action to take",
      "priority": "IMMEDIATE|WITHIN_24H|WITHIN_48H",
      "contact_person": "Who to engage",
      "talking_points": ["Key message 1", "Key message 2"],
      "alternative_approach": "Backup plan if primary fails"
    }
  ]
}

FOCUS AREAS:
- For RFP opportunities: Emphasize speed and project fit
- Leverage Stuart Cope's COO role for executive-level credibility
- Provide industry-specific talking points for sports organizations
- Include clear call-to-action recommendations for each step
`;

    return `
LINKEDIN CONNECTION INTELLIGENCE ANALYSIS

TARGET: ${request.organization}
LINKEDIN: ${request.linkedin_url || 'To be discovered'}
PRIORITY: ${request.priority}
REQUEST ID: ${request.request_id}
TRIGGER: ${request.trigger_source}

${rfpContextSection}

${teamSection}

${analysisTasks}

${outputFormat}

EXECUTION REQUIREMENTS:
1. Use BrightData tools to scrape LinkedIn profiles and company pages
2. Use cached relationship and analysis history where available
3. Cross-reference with existing Yellow Panther network data
4. Prioritize Stuart Cope connections with 1.5x scoring weight
5. Focus on ACTIONABLE insights that can be used immediately

TIMING: This analysis supports an active business opportunity. Provide results that can be acted upon within 24-48 hours.
`;
  }

  /**
   * Parse Claude Agent response and structure into ConnectionAnalysis format
   */
  private parseAndStructureResponse(result: any, request: ConnectionRequest, processingTime: number): ConnectionAnalysis {
    try {
      // Extract JSON from Claude response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const analysisData = JSON.parse(jsonMatch[0]);
      
      // Calculate opportunity enhancement
      const baseScore = request.rfp_context?.fit_score || 70;
      const networkBoost = this.calculateNetworkBoost(analysisData);
      const enhancedScore = baseScore + networkBoost;
      const successProbability = this.calculateSuccessProbability(analysisData);

      return {
        request_id: request.request_id,
        target_organization: request.organization,
        analysis_timestamp: new Date().toISOString(),
        processing_time_ms: processingTime,
        
        team_connections: {
          stuart_cope_connections: analysisData.analysis_summary?.stuart_cope_primary_connections || 0,
          total_team_connections: analysisData.analysis_summary?.total_connections_found || 0,
          strong_paths: analysisData.introduction_paths?.filter((p: any) => p.connection_strength === 'STRONG').length || 0,
          medium_paths: analysisData.introduction_paths?.filter((p: any) => p.connection_strength === 'MEDIUM').length || 0,
          primary_path_available: analysisData.analysis_summary?.primary_path_available || false
        },
        
        optimal_introduction_paths: analysisData.introduction_paths || [],
        
        opportunity_enhancement: {
          base_score: baseScore,
          network_boost: networkBoost,
          enhanced_score: enhancedScore,
          success_probability: successProbability,
          competitive_advantage: analysisData.opportunity_enhancement?.competitive_advantage || "Network-based warm introductions"
        },
        
        actionable_next_steps: analysisData.actionable_next_steps || []
      };
      
    } catch (error) {
      liveLogService.error('❌ Failed to parse Claude response', {
        request_id: request.request_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Return fallback analysis
      return this.createFallbackAnalysis(request, processingTime);
    }
  }

  /**
   * Calculate network boost based on connection quality and quantity
   */
  private calculateNetworkBoost(analysisData: any): number {
    let boost = 0;
    
    // Boost for Stuart Cope connections (primary)
    if (analysisData.analysis_summary?.stuart_cope_primary_connections > 0) {
      boost += 15; // Significant boost for primary connections
    }
    
    // Boost for strong paths
    const strongPaths = analysisData.introduction_paths?.filter((p: any) => p.connection_strength === 'STRONG').length || 0;
    boost += Math.min(strongPaths * 5, 10);
    
    // Boost for total connections
    const totalConnections = analysisData.analysis_summary?.total_connections_found || 0;
    boost += Math.min(totalConnections * 2, 5);
    
    return Math.min(boost, 25); // Cap at 25 points
  }

  /**
   * Calculate success probability based on network access
   */
  private calculateSuccessProbability(analysisData: any): number {
    let baseProbability = 45; // Base vs 20% cold outreach
    
    // Increase for strong connections
    const strongPaths = analysisData.introduction_paths?.filter((p: any) => p.connection_strength === 'STRONG').length || 0;
    baseProbability += strongPaths * 15;
    
    // Increase for Stuart Cope primary connections
    if (analysisData.analysis_summary?.stuart_cope_primary_connections > 0) {
      baseProbability += 20;
    }
    
    return Math.min(baseProbability, 85); // Cap at 85%
  }

  /**
   * Create fallback analysis when parsing fails
   */
  private createFallbackAnalysis(request: ConnectionRequest, processingTime: number): ConnectionAnalysis {
    return {
      request_id: request.request_id,
      target_organization: request.organization,
      analysis_timestamp: new Date().toISOString(),
      processing_time_ms: processingTime,
      
      team_connections: {
        stuart_cope_connections: 0,
        total_team_connections: 0,
        strong_paths: 0,
        medium_paths: 0,
        primary_path_available: false
      },
      
      optimal_introduction_paths: [],
      
      opportunity_enhancement: {
        base_score: request.rfp_context?.fit_score || 70,
        network_boost: 0,
        enhanced_score: request.rfp_context?.fit_score || 70,
        success_probability: 45,
        competitive_advantage: "No network advantage identified - proceed with standard outreach"
      },
      
      actionable_next_steps: [{
        action: "Proceed with cold outreach approach",
        priority: "WITHIN_48H",
        talking_points: ["Standard Yellow Panther value proposition", "Relevant case studies and expertise"]
      }]
    };
  }

  /**
   * Persist analysis results in Supabase cache for future reference
   */
  private async persistAnalysisResults(analysis: ConnectionAnalysis): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('entity_cache')
        .upsert({
          id: `connection_analysis:${analysis.request_id}`,
          entity_id: analysis.request_id,
          entity_type: 'connection_analysis',
          organization: analysis.target_organization,
          status: 'completed',
          data: analysis,
          expires_at: expiresAt,
          created_at: analysis.analysis_timestamp,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        throw error;
      }

      liveLogService.info('💾 Persisted connection analysis in Supabase cache', {
        request_id: analysis.request_id,
        target_organization: analysis.target_organization
      });
      
    } catch (error) {
      liveLogService.error('❌ Failed to persist analysis results', {
        request_id: analysis.request_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - this is non-critical for the analysis itself
    }
  }

  /**
   * Get connection analysis statistics for monitoring
   */
  async getAnalysisStats(timeframeDays: number = 30): Promise<any> {
    try {
      const minCreatedAt = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('entity_cache')
        .select('organization, data, created_at')
        .eq('entity_type', 'connection_analysis')
        .gte('created_at', minCreatedAt);

      if (error) {
        throw error;
      }

      const analyses = (data || []).map((row: any) => row.data as ConnectionAnalysis);
      if (analyses.length === 0) {
        return {};
      }

      const uniqueOrganizations = new Set(analyses.map((analysis) => analysis.target_organization)).size;
      const totalConnections = analyses.reduce((sum, analysis) => sum + (analysis.team_connections.total_team_connections || 0), 0);
      const stuartConnections = analyses.reduce((sum, analysis) => sum + (analysis.team_connections.stuart_cope_connections || 0), 0);
      const networkBoostTotal = analyses.reduce((sum, analysis) => sum + (analysis.opportunity_enhancement.network_boost || 0), 0);
      const successProbabilityTotal = analyses.reduce((sum, analysis) => sum + (analysis.opportunity_enhancement.success_probability || 0), 0);

      return {
        total_analyses: analyses.length,
        unique_organizations: uniqueOrganizations,
        avg_connections: totalConnections / analyses.length,
        stuart_connections: stuartConnections,
        avg_network_boost: networkBoostTotal / analyses.length,
        avg_success_probability: successProbabilityTotal / analyses.length
      };
      
    } catch (error) {
      liveLogService.error('❌ Failed to get analysis stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }
}
