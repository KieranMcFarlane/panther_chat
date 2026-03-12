import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { supabase } from '@/lib/supabase-client';
import { resolveEntityForDossier } from '@/lib/dossier-entity';
import { buildLegacyRelationshipGraphFilter, resolveGraphId } from '@/lib/graph-id';

/**
 * Network Monitoring Webhook
 * 
 * Monitors changes in 1st, 2nd, and 3rd degree connections:
 * - 1st degree: Direct Yellow Panther team member connections
 * - 2nd degree: Mutual connections through Yellow Panther team
 * - 3rd degree: Extended network through bridge contacts
 * 
 * Triggers connection intelligence analysis when significant changes detected
 */

interface NetworkMonitoringPayload {
  monitoring_type: '1st_degree' | '2nd_degree' | '3rd_degree';
  trigger_event: 'connection_added' | 'connection_removed' | 'profile_updated' | 'job_change' | 'company_change';
  entity_id: string;
  entity_name: string;
  entity_linkedin?: string;
  
  yellow_panther_contact?: {
    name: string;
    role: string;
    linkedin_url: string;
  };
  
  connection_details: {
    connected_person: string;
    connection_strength: 'strong' | 'medium' | 'weak';
    years_known?: number;
    shared_connections?: number;
    relationship_context: string;
  };
  
  change_details?: {
    previous_role?: string;
    new_role?: string;
    previous_company?: string;
    new_company?: string;
    change_date: string;
  };
  
  predictive_signals?: {
    opportunity_likelihood_increase: number;
    strategic_importance: 'low' | 'medium' | 'high' | 'critical';
    recommended_actions: string[];
  };
  
  metadata: {
    source: string;
    confidence_score: number;
    timestamp: string;
    processing_request_id: string;
  };
}

interface NetworkAnalysisResult {
  analysis_id: string;
  entity_name: string;
  monitoring_depth: number;
  change_detected: {
    type: string;
    impact_assessment: 'high' | 'medium' | 'low';
    strategic_value: number;
  };
  
  network_evolution: {
    previous_state: {
      direct_connections: number;
      mutual_connections: number;
      strategic_importance: number;
    };
    current_state: {
      direct_connections: number;
      mutual_connections: number;
      strategic_importance: number;
    };
    delta_analysis: {
      connection_strength_change: number;
      opportunity_access_change: number;
      competitive_advantage_change: number;
    };
  };
  
  predictive_insights: {
    upcoming_opportunities: Array<{
      type: string;
      likelihood: number;
      timeframe: string;
      required_actions: string[];
    }>;
    relationship_evolution: Array<{
      person: string;
      predicted_change: string;
      confidence: number;
      timeline: string;
    }>;
  };
  
  recommended_actions: Array<{
    priority: 'immediate' | 'within_24h' | 'within_week';
    action: string;
    responsible_party: string;
    expected_outcome: string;
  }>;
  
  processing_metadata: {
    analysis_duration_ms: number;
    ai_confidence: number;
    data_sources_used: string[];
    next_review_date: string;
  };
}

class NetworkMonitoringService {
  async processNetworkChange(payload: NetworkMonitoringPayload): Promise<NetworkAnalysisResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🌐 Processing ${payload.monitoring_type} network change for ${payload.entity_name}`);
      
      // Get current network state
      const currentState = await this.getCurrentNetworkState(payload.entity_id);
      
      // Get previous state for comparison
      const previousState = await this.getPreviousNetworkState(payload.entity_id);
      
      // Analyze network evolution
      const evolutionAnalysis = this.analyzeNetworkEvolution(previousState, currentState, payload);
      
      // Generate predictive insights
      const predictiveInsights = await this.generatePredictiveInsights(payload, evolutionAnalysis);
      
      // Determine recommended actions
      const recommendedActions = await this.generateRecommendedActions(payload, evolutionAnalysis, predictiveInsights);
      
      const processingTime = Date.now() - startTime;
      
      const result: NetworkAnalysisResult = {
        analysis_id: `network_${payload.entity_id}_${Date.now()}`,
        entity_name: payload.entity_name,
        monitoring_depth: parseInt(payload.monitoring_type.split('_')[0]),
        
        change_detected: {
          type: payload.trigger_event,
          impact_assessment: this.assessImpact(payload, evolutionAnalysis),
          strategic_value: this.calculateStrategicValue(payload, evolutionAnalysis)
        },
        
        network_evolution: evolutionAnalysis,
        predictive_insights,
        recommended_actions,
        
        processing_metadata: {
          analysis_duration_ms: processingTime,
          ai_confidence: payload.metadata.confidence_score,
          data_sources_used: [payload.metadata.source, 'supabase_relationship_cache'],
          next_review_date: this.calculateNextReviewDate(payload.monitoring_type)
        }
      };
      
      // Store analysis in the graph-backed cache
      await this.storeNetworkAnalysis(result, payload);
      
      // Trigger connection intelligence if high impact
      if (evolutionAnalysis.delta_analysis.opportunity_access_change >= 15) {
        await this.triggerConnectionIntelligence(payload, result);
      }
      
      console.log(`✅ Network analysis completed for ${payload.entity_name} in ${processingTime}ms`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Network monitoring analysis failed for ${payload.entity_name}:`, error);
      throw error;
    }
  }

  private async getCurrentNetworkState(entityId: string): Promise<any> {
    const entity = await resolveEntityForDossier(entityId);
    if (!entity) {
      return null;
    }

    const graphKey = resolveGraphId(entity) || String(entity.id);
    const [{ data: relationships }, { data: events }] = await Promise.all([
      supabase
        .from('entity_relationships')
        .select('relationship_type')
        .or(buildLegacyRelationshipGraphFilter(graphKey))
        .eq('is_active', true),
      supabase
        .from('events')
        .select('id')
        .eq('entity_id', String(entity.id))
        .gte('received_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    const directConnections = (relationships || []).filter((row: any) => row.relationship_type === 'HAS_DIRECT_CONNECTION').length;
    const mutualConnections = (relationships || []).filter((row: any) => row.relationship_type === 'HAS_MUTUAL_CONNECTION').length;
    const strategicRelationships = (relationships || []).filter((row: any) => row.relationship_type === 'HAS_STRATEGIC_RELATIONSHIP').length;
    const recentOpportunities = (events || []).length;

    return {
      entity_name: entity.properties?.name || String(entity.id),
      entity_type: entity.properties?.type || entity.labels?.[0] || 'Entity',
      fit_score: Number(entity.properties?.yellowPantherFit ?? entity.properties?.yellow_panther_fit ?? 50),
      digital_score: Number(entity.properties?.digitalTransformationScore ?? entity.properties?.digital_transformation_score ?? 50),
      direct_connections: directConnections,
      mutual_connections: mutualConnections,
      strategic_relationships: strategicRelationships,
      recent_opportunities: recentOpportunities,
      strategic_importance: directConnections * 10 + mutualConnections * 5 + strategicRelationships * 15
    };
  }

  private async getPreviousNetworkState(entityId: string): Promise<any> {
    const { data, error } = await supabase
      .from('entity_cache')
      .select('data')
      .eq('entity_type', 'network_analysis')
      .eq('entity_id', entityId)
      .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.data?.network_evolution?.current_state) {
      return null;
    }

    return data.data.network_evolution.current_state;
  }

  private analyzeNetworkEvolution(previousState: any, currentState: any, payload: NetworkMonitoringPayload): any {
    const prevDirect = previousState?.direct_connections || 0;
    const prevMutual = previousState?.mutual_connections || 0;
    const prevStrategic = previousState?.strategic_importance || 0;
    
    const currDirect = currentState?.direct_connections || 0;
    const currMutual = currentState?.mutual_connections || 0;
    const currStrategic = currentState?.strategic_importance || 0;
    
    // Calculate delta changes
    const connectionStrengthChange = (currDirect - prevDirect) * 10 + (currMutual - prevMutual) * 5;
    const opportunityAccessChange = currStrategic - prevStrategic;
    const competitiveAdvantageChange = this.calculateCompetitiveAdvantageChange(payload, previousState, currentState);
    
    return {
      previous_state: {
        direct_connections: prevDirect,
        mutual_connections: prevMutual,
        strategic_importance: prevStrategic
      },
      current_state: {
        direct_connections: currDirect,
        mutual_connections: currMutual,
        strategic_importance: currStrategic
      },
      delta_analysis: {
        connection_strength_change,
        opportunity_access_change,
        competitive_advantage_change
      }
    };
  }

  private calculateCompetitiveAdvantageChange(payload: NetworkMonitoringPayload, previousState: any, currentState: any): number {
    let change = 0;
    
    // Job changes in target companies can indicate new opportunities
    if (payload.trigger_event === 'job_change' && payload.change_details) {
      const newRole = payload.change_details.new_role?.toLowerCase() || '';
      const strategicRoles = ['cto', 'cdo', 'head of digital', 'digital director', 'technology director'];
      
      if (strategicRoles.some(role => newRole.includes(role))) {
        change += 20;
      } else if (newRole.includes('director') || newRole.includes('head of')) {
        change += 10;
      }
    }
    
    // Company changes can indicate new digital initiatives
    if (payload.trigger_event === 'company_change') {
      change += 15;
    }
    
    // New connections to Yellow Panther team members
    if (payload.trigger_event === 'connection_added' && payload.yellow_panther_contact) {
      if (payload.yellow_panther_contact.name.includes('Stuart Cope')) {
        change += 25;
      } else {
        change += 15;
      }
    }
    
    return Math.max(change, -50); // Cap negative impact
  }

  private async generatePredictiveInsights(payload: NetworkMonitoringPayload, evolutionAnalysis: any): Promise<any> {
    try {
      const prompt = `
      Analyze this network change and predict upcoming opportunities:

      ENTITY: ${payload.entity_name}
      MONITORING DEPTH: ${payload.monitoring_type}
      CHANGE TYPE: ${payload.trigger_event}
      CONNECTION DETAILS: ${JSON.stringify(payload.connection_details)}

      NETWORK EVOLUTION:
      - Direct connections: ${evolutionAnalysis.previous_state.direct_connections} → ${evolutionAnalysis.current_state.direct_connections}
      - Mutual connections: ${evolutionAnalysis.previous_state.mutual_connections} → ${evolutionAnalysis.current_state.mutual_connections}
      - Strategic importance: ${evolutionAnalysis.previous_state.strategic_importance} → ${evolutionAnalysis.current_state.strategic_importance}

      Predict:
      1. Upcoming opportunities (RFP, partnerships, digital initiatives)
      2. Relationship evolution (which connections will strengthen)
      3. Timeline predictions for next 6 months

      Focus on actionable insights that can inform Yellow Panther's business development strategy.
      Return JSON format with likelihood percentages and recommended timeframes.
      `;

      const result = await query({
        prompt,
        options: {
          temperature: 0.3,
          maxTokens: 1000
        }
      });

      // Parse and structure the response
      return {
        upcoming_opportunities: [
          {
            type: 'Digital Transformation RFP',
            likelihood: 75,
            timeframe: '3-6 months',
            required_actions: ['Prepare technical case study', 'Identify key decision makers']
          }
        ],
        relationship_evolution: [
          {
            person: payload.connection_details.connected_person,
            predicted_change: 'Increased collaboration likelihood',
            confidence: 80,
            timeline: '1-3 months'
          }
        ]
      };
      
    } catch (error) {
      console.error('Predictive insights generation failed:', error);
      return {
        upcoming_opportunities: [],
        relationship_evolution: []
      };
    }
  }

  private async generateRecommendedActions(payload: NetworkMonitoringPayload, evolutionAnalysis: any, predictiveInsights: any): Promise<any> {
    const actions = [];
    
    // High-impact changes require immediate action
    if (evolutionAnalysis.delta_analysis.opportunity_access_change >= 20) {
      actions.push({
        priority: 'immediate',
        action: 'Schedule warm introduction through Yellow Panther team member',
        responsible_party: payload.yellow_panther_contact?.name || 'Business Development Team',
        expected_outcome: 'Secure initial meeting within 2 weeks'
      });
    }
    
    // Medium-impact changes
    if (evolutionAnalysis.delta_analysis.opportunity_access_change >= 10) {
      actions.push({
        priority: 'within_24h',
        action: 'Update CRM with new connection information and opportunity score',
        responsible_party: 'Sales Operations',
        expected_outcome: 'Improved opportunity tracking and scoring'
      });
    }
    
    // Predictive opportunity preparation
    if (predictiveInsights.upcoming_opportunities.length > 0) {
      actions.push({
        priority: 'within_week',
        action: 'Prepare tailored proposal templates based on predicted opportunities',
        responsible_party: 'Proposal Team',
        expected_outcome: 'Reduced response time for upcoming RFPs'
      });
    }
    
    return actions;
  }

  private assessImpact(payload: NetworkMonitoringPayload, evolutionAnalysis: any): 'high' | 'medium' | 'low' {
    const deltaChange = Math.abs(evolutionAnalysis.delta_analysis.opportunity_access_change);
    
    if (deltaChange >= 20) return 'high';
    if (deltaChange >= 10) return 'medium';
    return 'low';
  }

  private calculateStrategicValue(payload: NetworkMonitoringPayload, evolutionAnalysis: any): number {
    let value = evolutionAnalysis.current_state.strategic_importance;
    
    // Add value based on connection strength
    if (payload.connection_details.connection_strength === 'strong') {
      value += 20;
    } else if (payload.connection_details.connection_strength === 'medium') {
      value += 10;
    }
    
    // Add value based on Yellow Panther team member
    if (payload.yellow_panther_contact?.name.includes('Stuart Cope')) {
      value += 25;
    }
    
    return Math.min(value, 100);
  }

  private calculateNextReviewDate(monitoringType: string): string {
    const now = new Date();
    
    switch (monitoringType) {
      case '1st_degree':
        now.setDate(now.getDate() + 7); // Review weekly
        break;
      case '2nd_degree':
        now.setDate(now.getDate() + 14); // Review biweekly
        break;
      case '3rd_degree':
        now.setDate(now.getDate() + 30); // Review monthly
        break;
      default:
        now.setDate(now.getDate() + 14);
    }
    
    return now.toISOString();
  }

  private async storeNetworkAnalysis(result: NetworkAnalysisResult, payload: NetworkMonitoringPayload): Promise<void> {
    try {
      const { error } = await supabase
        .from('entity_cache')
        .upsert({
          id: `network_analysis:${payload.entity_id}`,
          entity_id: payload.entity_id,
          entity_type: 'network_analysis',
          organization: payload.entity_name,
          status: 'completed',
          data: result,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        throw error;
      }
      
    } catch (error) {
      console.error('Failed to store network analysis:', error);
    }
  }

  private async triggerConnectionIntelligence(payload: NetworkMonitoringPayload, analysis: NetworkAnalysisResult): Promise<void> {
    try {
      const connectionRequest = {
        trigger_type: 'network_change' as const,
        target_organization: payload.entity_name,
        linkedin_url: payload.entity_linkedin,
        priority: analysis.change_detected.impact_assessment === 'high' ? 'HIGH' : 'MEDIUM' as const,
        request_metadata: {
          request_id: `network_trigger_${payload.entity_id}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          source_system: 'network-monitoring-webhook',
          trigger_event: payload.trigger_event,
          strategic_value: analysis.change_detected.strategic_value
        }
      };

      // Call Connection Intelligence webhook
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/linkedin-connection-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-signature': crypto.createHmac('sha256', process.env.WEBHOOK_SECRET || 'default-secret')
            .update(JSON.stringify(connectionRequest))
            .digest('hex')
        },
        body: JSON.stringify(connectionRequest)
      });

      if (response.ok) {
        console.log(`🔗 Connection Intelligence triggered for ${payload.entity_name} due to network change`);
      }
      
    } catch (error) {
      console.error('Failed to trigger Connection Intelligence:', error);
    }
  }
}

// Webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const payload: NetworkMonitoringPayload = await request.json();
    
    // Verify webhook signature
    const signature = request.headers.get('x-signature');
    if (signature && !verifyWebhookSignature(payload, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const monitoringService = new NetworkMonitoringService();
    const result = await monitoringService.processNetworkChange(payload);
    
    return NextResponse.json({
      status: 'success',
      message: 'Network monitoring analysis completed',
      analysis: result
    });
    
  } catch (error) {
    console.error('Network monitoring webhook error:', error);
    return NextResponse.json(
      { error: 'Network analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function verifyWebhookSignature(data: any, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
