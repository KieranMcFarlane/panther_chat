import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Neo4jService } from '@/lib/neo4j';

/**
 * LinkedIn Connection Analysis Webhook
 * 
 * TRIGGERS:
 * 1. RFP Detection → Immediate connection analysis
 * 2. Personnel Changes → Network update analysis  
 * 3. Organization Updates → Relationship mapping
 * 4. Manual Request → On-demand analysis
 */

const YELLOW_PANTHER_UK_TEAM = {
  primary: {
    name: "Stuart Cope",
    linkedin_url: "https://uk.linkedin.com/in/stuart-cope-54392b16/",
    role: "Co-Founder & COO",
    weight: 1.5
  },
  team: [
    {
      name: "Gunjan Parikh", 
      linkedin_url: "https://uk.linkedin.com/in/gunjan-parikh/",
      role: "Founder & CEO",
      weight: 1.3
    },
    {
      name: "Andrew Rapley",
      linkedin_url: "https://uk.linkedin.com/in/andrew-rapley/",
      role: "Head of Projects", 
      weight: 1.2
    },
    {
      name: "Sarfraz Hussain",
      linkedin_url: "https://uk.linkedin.com/in/sarfraz-hussain/",
      role: "Head of Strategy",
      weight: 1.2
    },
    {
      name: "Elliott Hillman", 
      linkedin_url: "https://uk.linkedin.com/in/elliott-hillman/",
      role: "Senior Client Partner",
      weight: 1.2
    }
  ]
};

interface ConnectionAnalysisRequest {
  trigger_type: 'rfp_detection' | 'personnel_change' | 'organization_update' | 'manual_request';
  target_organization: string;
  target_linkedin_url?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rfp_context?: {
    rfp_title: string;
    estimated_value: string;
    deadline?: string;
    yellow_panther_fit: number;
  };
  request_metadata: {
    request_id: string;
    timestamp: string;
    source_system: string;
  };
}

interface ConnectionAnalysisResponse {
  request_id: string;
  analysis_timestamp: string;
  processing_time_seconds: number;
  target_organization: string;
  
  yellow_panther_team_analysis: {
    total_connections_found: number;
    strong_paths_count: number;
    medium_paths_count: number;
    weak_paths_count: number;
    primary_connection_available: boolean; // Stuart Cope
  };
  
  optimal_introduction_paths: Array<{
    yellow_panther_contact: string;
    connection_strength: 'STRONG' | 'MEDIUM' | 'WEAK';
    confidence_score: number;
    path_description: string;
    mutual_connections?: Array<{
      name: string;
      linkedin_url: string;
      relationship_context: string;
      years_known: number;
    }>;
    messaging_strategy: string;
    estimated_timeline: string;
  }>;
  
  opportunity_enhancement: {
    base_score: number;
    connection_boost: number;
    final_score: number;
    success_probability: number;
    competitive_advantage: string;
  };
  
  recommended_actions: Array<{
    action: string;
    priority: 'IMMEDIATE' | 'WITHIN_24H' | 'WITHIN_48H';
    contact_person?: string;
    talking_points: string[];
  }>;
}

class LinkedInConnectionAnalyzer {
  private readonly claudeConfig = {
    name: "linkedin-connection-analyzer",
    description: "Specialized agent for LinkedIn network analysis and introduction strategy",
    
    mcpServers: {
      "brightdata": {
        command: "npx",
        args: ["-y", "@brightdata/mcp"],
        env: {
          API_TOKEN: process.env.BRIGHTDATA_API_TOKEN
        }
      },
      "neo4j-mcp": {
        command: "npx", 
        args: ["-y", "@alanse/mcp-neo4j-server"],
        env: {
          NEO4J_URI: process.env.NEO4J_URI,
          NEO4J_USERNAME: process.env.NEO4J_USERNAME,
          NEO4J_PASSWORD: process.env.NEO4J_PASSWORD
        }
      }
    },
    
    allowedTools: [
      "mcp__brightdata__scrape_as_markdown",
      "mcp__brightdata__search_engine", 
      "mcp__neo4j-mcp__execute_query",
      "mcp__neo4j-mcp__create_relationship"
    ],
    
    maxTurns: 8,
    temperature: 0.3
  };

  async analyzeConnections(request: ConnectionAnalysisRequest): Promise<ConnectionAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 Starting LinkedIn Connection Analysis for ${request.target_organization}`);
      
      const analysisPrompt = this.buildAnalysisPrompt(request);
      
      const result = await query({
        prompt: analysisPrompt,
        options: this.claudeConfig
      });

      const processingTime = (Date.now() - startTime) / 1000;
      
      // Parse and structure the response
      const structuredResponse = this.parseAnalysisResult(result, request, processingTime);
      
      // Store in Neo4j for future reference
      await this.storeAnalysisResults(structuredResponse);
      
      console.log(`✅ Connection Analysis completed in ${processingTime}s - ${structuredResponse.yellow_panther_team_analysis.total_connections_found} connections found`);
      
      return structuredResponse;
      
    } catch (error) {
      console.error('❌ LinkedIn Connection Analysis failed:', error);
      throw error;
    }
  }

  private buildAnalysisPrompt(request: ConnectionAnalysisRequest): string {
    const yellowPantherTeamText = YELLOW_PANTHER_UK_TEAM.team.map(member => 
      `- ${member.name}: ${member.linkedin_url} (${member.role})`
    ).join('\n');

    let contextSection = '';
    if (request.trigger_type === 'rfp_detection' && request.rfp_context) {
      contextSection = `
RFP CONTEXT:
- RFP Title: ${request.rfp_context.rfp_title}
- Estimated Value: ${request.rfp_context.estimated_value}
- Yellow Panther Fit: ${request.rfp_context.yellow_panther_fit}%
- Deadline: ${request.rfp_context.deadline || 'Not specified'}

This is a HIGH-PRIORITY RFP opportunity. Focus on finding the WARMEST introduction paths.
`;
    }

    return `
IMMEDIATE LinkedIn Connection Analysis Required

TARGET ORGANIZATION: ${request.target_organization}
TARGET LINKEDIN: ${request.target_linkedin_url || 'To be discovered'}
PRIORITY: ${request.priority} (${request.trigger_type})
REQUEST ID: ${request.request_metadata.request_id}

${contextSection}

YELLOW PANTHER UK TEAM:

PRIMARY CONNECTION (highest priority):
- Stuart Cope: ${YELLOW_PANTHER_UK_TEAM.primary.linkedin_url} (${YELLOW_PANTHER_UK_PRIMARY.primary.role}) - Weight: 1.5x

SECONDARY CONNECTIONS:
${yellowPantherTeamText}

ANALYSIS TASKS:
1. Map ALL Yellow Panther UK team connections to ${request.target_organization}
2. Give 1.5x weight to any connections through Stuart Cope (primary connection)
3. Identify mutual connections, company overlaps, alumni networks
4. Analyze 2nd-degree connections through bridge contacts
5. Score each introduction path by strength and confidence
6. Provide specific messaging strategies for each path

CONNECTION STRENGTH CRITERIA:
- STRONG: Direct connections with recent interaction, or Stuart Cope mutual connections
- MEDIUM: Mutual connections from current/recent workplace, or 2nd-degree with strong context  
- WEAK: Distant connections, minimal professional context, or outdated relationships

INTRODUCTION STRATEGY FOCUS:
- For RFP opportunities: Emphasize speed and fit with project requirements
- Leverage Stuart Cope's role as COO for credibility
- Provide specific talking points for each Yellow Panther team member
- Include estimated timelines for warm introductions

OUTPUT FORMAT (JSON):
{
  "analysis_summary": {
    "total_connections_found": number,
    "strong_paths_count": number,
    "stuart_cope_connections": number,
    "primary_connection_available": boolean
  },
  "introduction_paths": [
    {
      "yellow_panther_contact": "Stuart Cope",
      "connection_strength": "STRONG|MEDIUM|WEAK",
      "confidence_score": number (0-100),
      "path_description": "Clear description of the connection path",
      "mutual_connections": [{"name": "...", "linkedin_url": "...", "context": "..."}],
      "messaging_strategy": "Specific approach for this contact",
      "estimated_timeline": "Time to get introduction"
    }
  ],
  "opportunity_enhancement": {
    "connection_boost": number (0-25 points),
    "success_probability": number (percentage),
    "competitive_advantage": "Description of network advantage"
  },
  "recommended_actions": [
    {
      "action": "Specific next step",
      "priority": "IMMEDIATE|WITHIN_24H|WITHIN_48H",
      "contact_person": "Who to contact",
      "talking_points": ["Key messages"]
    }
  ]
}

Focus on ACTIONABLE insights that can be used immediately to secure warm introductions.
`;

  }

  private parseAnalysisResult(result: any, request: ConnectionAnalysisRequest, processingTime: number): ConnectionAnalysisResponse {
    try {
      // Extract JSON from Claude response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const analysisData = JSON.parse(jsonMatch[0]);
      
      // Calculate opportunity enhancement
      const baseScore = request.rfp_context?.yellow_panther_fit || 70;
      const connectionBoost = Math.min(analysisData.analysis_summary.stuart_cope_connections > 0 ? 25 : 15, 25);
      const finalScore = baseScore + connectionBoost;
      const successProbability = Math.min(45 + (analysisData.analysis_summary.strong_paths_count * 15), 85);

      return {
        request_id: request.request_metadata.request_id,
        analysis_timestamp: new Date().toISOString(),
        processing_time_seconds: processingTime,
        target_organization: request.target_organization,
        
        yellow_panther_team_analysis: {
          total_connections_found: analysisData.analysis_summary.total_connections_found,
          strong_paths_count: analysisData.analysis_summary.strong_paths_count,
          medium_paths_count: analysisData.introduction_paths?.filter((p: any) => p.connection_strength === 'MEDIUM').length || 0,
          weak_paths_count: analysisData.introduction_paths?.filter((p: any) => p.connection_strength === 'WEAK').length || 0,
          primary_connection_available: analysisData.analysis_summary.stuart_cope_connections > 0
        },
        
        optimal_introduction_paths: analysisData.introduction_paths || [],
        
        opportunity_enhancement: {
          base_score: baseScore,
          connection_boost: connectionBoost,
          final_score: finalScore,
          success_probability: successProbability,
          competitive_advantage: analysisData.opportunity_enhancement?.competitive_advantage || "Network-based warm introductions"
        },
        
        recommended_actions: analysisData.recommended_actions || []
      };
      
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      
      // Return a fallback response
      return {
        request_id: request.request_metadata.request_id,
        analysis_timestamp: new Date().toISOString(),
        processing_time_seconds: processingTime,
        target_organization: request.target_organization,
        
        yellow_panther_team_analysis: {
          total_connections_found: 0,
          strong_paths_count: 0,
          medium_paths_count: 0,
          weak_paths_count: 0,
          primary_connection_available: false
        },
        
        optimal_introduction_paths: [],
        
        opportunity_enhancement: {
          base_score: request.rfp_context?.yellow_panther_fit || 70,
          connection_boost: 0,
          final_score: request.rfp_context?.yellow_panther_fit || 70,
          success_probability: 45,
          competitive_advantage: "No network advantage identified"
        },
        
        recommended_actions: [{
          action: "Proceed with cold outreach",
          priority: "WITHIN_48H",
          talking_points: ["Standard Yellow Panther value proposition"]
        }]
      };
    }
  }

  private async storeAnalysisResults(response: ConnectionAnalysisResponse): Promise<void> {
    try {
      const neo4jService = new Neo4jService();
      
      // Create/update connection analysis node
      const cypher = `
        MERGE (ca:ConnectionAnalysis {request_id: $request_id})
        SET ca.target_organization = $target_organization,
            ca.analysis_timestamp = $analysis_timestamp,
            ca.total_connections = $total_connections,
            ca.primary_connection_available = $primary_connection_available,
            ca.connection_boost = $connection_boost,
            ca.success_probability = $success_probability,
            ca.final_score = $final_score,
            ca.optimal_paths = $optimal_paths
      `;
      
      await neo4jService.executeQuery(cypher, {
        request_id: response.request_id,
        target_organization: response.target_organization,
        analysis_timestamp: response.analysis_timestamp,
        total_connections: response.yellow_panther_team_analysis.total_connections_found,
        primary_connection_available: response.yellow_panther_team_analysis.primary_connection_available,
        connection_boost: response.opportunity_enhancement.connection_boost,
        success_probability: response.opportunity_enhancement.success_probability,
        final_score: response.opportunity_enhancement.final_score,
        optimal_paths: JSON.stringify(response.optimal_introduction_paths)
      });
      
    } catch (error) {
      console.error('Error storing analysis results:', error);
      // Don't throw - this is non-critical
    }
  }
}

// Webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Verify webhook signature (if implemented)
    const signature = request.headers.get('x-signature');
    if (signature && !verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const analyzer = new LinkedInConnectionAnalyzer();
    const result = await analyzer.analyzeConnections(body);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('LinkedIn Connection Analysis webhook error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function verifyWebhookSignature(body: any, signature: string): boolean {
  // Implement signature verification if needed
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if no secret
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}