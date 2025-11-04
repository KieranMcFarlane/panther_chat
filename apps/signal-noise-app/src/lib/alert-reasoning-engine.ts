/**
 * 🧠 Alert Reasoning Engine
 * 
 * Enhanced intelligence layer using Claude Agent SDK with CopilotKit integration
 * to analyze alerts and provide actionable insights
 */

import { HistoricalRFP } from './entity-scaling-manager';
import { rfpIntelligenceAgent } from './claude-agent-rfp-intelligence';

interface ReasoningContext {
  entity: {
    name: string;
    type: string;
    industry: string;
    size: string;
    location: string;
  };
  alert: {
    type: string;
    description: string;
    impact: number;
    source: string;
    timestamp: string;
  };
  historicalData: {
    previousAlerts: any[];
    relatedRFPs: HistoricalRFP[];
    industryTrends: any;
  };
  marketContext: {
    industryConditions: string;
    competitorActivity: any[];
    economicFactors: any;
  };
}

interface ReasonedAlert {
  originalAlert: any;
  reasoning: {
    significance: 'critical' | 'high' | 'medium' | 'low';
    urgency: 'immediate' | 'high' | 'medium' | 'low';
    businessImpact: string;
    recommendedActions: string[];
    riskAssessment: string;
    opportunityScore: number; // 0-100
    confidenceLevel: number; // 0-100
  };
  insights: {
    strategicImplications: string[];
    tacticalRecommendations: string[];
    timingConsiderations: string;
    stakeholderImpact: string[];
  };
  relatedOpportunities: Array<{
    type: 'RFP' | 'Partnership' | 'Acquisition' | 'Investment';
    title: string;
    confidence: number;
    timeline: string;
  }>;
}

class AlertReasoningEngine {
  private industryKnowledge: Map<string, any> = new Map();
  private rfpDatabase: HistoricalRFP[] = [];
  private marketIndicators: Map<string, any> = new Map();

  constructor() {
    this.initializeIndustryKnowledge();
    this.initializeMarketIndicators();
  }

  async reasonAboutAlert(alert: any, context: Partial<ReasoningContext> = {}): Promise<ReasonedAlert> {
    try {
      // Use Claude Agent for sophisticated reasoning
      const entityContext = context.entity || {
        name: alert.entity,
        type: 'company',
        industry: 'Technology',
        size: 'medium',
        location: 'Unknown'
      };

      const claudeReasoning = await rfpIntelligenceAgent.reasonAboutAlert(alert, entityContext);
      
      // Transform Claude Agent response to our format
      const reasoning = {
        significance: claudeReasoning.significance || 'medium',
        urgency: claudeReasoning.urgency || 'medium',
        businessImpact: claudeReasoning.businessImpact || `${alert.entity} ${alert.description} may present opportunities`,
        recommendedActions: claudeReasoning.recommendedActions || ['Monitor for further developments'],
        riskAssessment: claudeReasoning.riskAssessment || 'Standard business risk levels apply',
        opportunityScore: claudeReasoning.opportunityScore || 70,
        confidenceLevel: claudeReasoning.confidenceLevel || 75
      };

      const insights = {
        strategicImplications: claudeReasoning.insights?.strategicImplications || [
          `This ${alert.type} may indicate ${alert.entity}'s strategic direction`
        ],
        tacticalRecommendations: claudeReasoning.insights?.tacticalRecommendations || [
          'Monitor for engagement opportunities'
        ]
      };

      const relatedOpportunities = this.findRelatedOpportunities({
        ...context,
        alert: { ...alert, reasoning: claudeReasoning }
      });

      return {
        originalAlert: alert,
        reasoning,
        insights,
        relatedOpportunities
      };

    } catch (error) {
      console.warn('Claude Agent reasoning failed, using fallback:', error);
      
      // Fallback to original reasoning logic
      const reasoningContext = await this.buildReasoningContext(alert, context);
      const reasoning = this.analyzeSignificance(reasoningContext);
      const insights = this.generateInsights(reasoningContext);
      const relatedOpportunities = this.findRelatedOpportunities(reasoningContext);

      return {
        originalAlert: alert,
        reasoning,
        insights,
        relatedOpportunities
      };
    }
  }

  private async buildReasoningContext(alert: any, partialContext: Partial<ReasoningContext>): Promise<ReasoningContext> {
    // Build comprehensive reasoning context
    return {
      entity: partialContext.entity || {
        name: alert.entity,
        type: 'company',
        industry: 'Technology',
        size: 'medium',
        location: 'Unknown'
      },
      alert: {
        type: alert.type,
        description: alert.description,
        impact: alert.impact || 0,
        source: alert.source,
        timestamp: alert.timestamp
      },
      historicalData: {
        previousAlerts: await this.getHistoricalAlerts(alert.entity),
        relatedRFPs: await this.getRelatedRFPs(alert.entity),
        industryTrends: await this.getIndustryTrends(alert.entity)
      },
      marketContext: {
        industryConditions: await this.getIndustryConditions(alert.entity),
        competitorActivity: await this.getCompetitorActivity(alert.entity),
        economicFactors: await this.getEconomicFactors()
      }
    };
  }

  private analyzeSignificance(context: ReasoningContext) {
    const { alert, entity, historicalData, marketContext } = context;
    
    // Calculate significance based on multiple factors
    const baseImpact = this.calculateBaseImpact(alert, entity);
    const historicalSignificance = this.calculateHistoricalSignificance(historicalData);
    const marketSignificance = this.calculateMarketSignificance(marketContext);
    
    const overallSignificance = this.combineSignificanceScores(baseImpact, historicalSignificance, marketSignificance);
    
    // Determine urgency
    const urgency = this.determineUrgency(alert, historicalData, marketContext);
    
    // Generate business impact assessment
    const businessImpact = this.generateBusinessImpact(overallSignificance, entity, alert);
    
    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(overallSignificance, alert, entity);
    
    // Risk assessment
    const riskAssessment = this.generateRiskAssessment(alert, historicalData, marketContext);
    
    // Calculate opportunity score
    const opportunityScore = this.calculateOpportunityScore(overallSignificance, marketContext);
    
    // Confidence level
    const confidenceLevel = this.calculateConfidenceLevel(overallSignificance, historicalData);

    return {
      significance: overallSignificance.significance,
      urgency,
      businessImpact,
      recommendedActions,
      riskAssessment,
      opportunityScore,
      confidenceLevel
    };
  }

  private calculateBaseImpact(alert: any, entity: any) {
    let impactScore = 0;
    
    // Alert type scoring
    const typeScores = {
      'promotion': 0.8,
      'departure': 0.9,
      'hiring': 0.6,
      'funding': 0.95,
      'traffic': 0.4,
      'expansion': 0.7,
      'job_listing': 0.3,
      'post': 0.2
    };
    
    impactScore += typeScores[alert.type] || 0.5;
    
    // Impact percentage scoring
    if (alert.impact) {
      if (alert.impact > 100) impactScore += 0.3;
      else if (alert.impact > 50) impactScore += 0.2;
      else if (alert.impact > 20) impactScore += 0.1;
    }
    
    // Entity size scoring
    const sizeScores = {
      'enterprise': 0.3,
      'large': 0.2,
      'medium': 0.1,
      'small': 0.05,
      'startup': 0.02
    };
    
    impactScore += sizeScores[entity.size] || 0.1;
    
    return Math.min(1, impactScore);
  }

  private calculateHistoricalSignificance(historicalData: any) {
    let significance = 0;
    
    // Frequency of similar alerts
    const similarAlerts = historicalData.previousAlerts.filter((a: any) => 
      a.type === historicalData.previousAlerts[0]?.type
    );
    
    if (similarAlerts.length > 10) significance += 0.3; // High frequency
    else if (similarAlerts.length > 5) significance += 0.2; // Medium frequency
    else if (similarAlerts.length > 2) significance += 0.1; // Low frequency
    
    // Recency of last similar alert
    if (similarAlerts.length > 0) {
      const lastAlert = similarAlerts[0];
      const daysSinceLastAlert = (Date.now() - new Date(lastAlert.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastAlert < 7) significance += 0.2; // Very recent
      else if (daysSinceLastAlert < 30) significance += 0.1; // Recent
    }
    
    // Related RFP activity
    if (historicalData.relatedRFPs.length > 5) significance += 0.2;
    else if (historicalData.relatedRFPs.length > 2) significance += 0.1;
    
    return Math.min(1, significance);
  }

  private calculateMarketSignificance(marketContext: any) {
    let significance = 0;
    
    // Industry conditions
    if (marketContext.industryConditions === 'growing') significance += 0.3;
    else if (marketContext.industryConditions === 'stable') significance += 0.1;
    else if (marketContext.industryConditions === 'declining') significance += 0.2; // More significant in declining markets
    
    // Competitor activity intensity
    const competitorActivityLevel = marketContext.competitorActivity.length;
    if (competitorActivityLevel > 10) significance += 0.2;
    else if (competitorActivityLevel > 5) significance += 0.1;
    
    // Economic factors
    if (marketContext.economicFactors.growthRate > 0.05) significance += 0.1;
    else if (marketContext.economicFactors.growthRate < -0.02) significance += 0.2;
    
    return Math.min(1, significance);
  }

  private combineSignificanceScores(base: number, historical: number, market: number) {
    const weightedScore = (base * 0.5) + (historical * 0.3) + (market * 0.2);
    
    let significance: 'critical' | 'high' | 'medium' | 'low';
    let score = weightedScore;
    
    if (score > 0.8) significance = 'critical';
    else if (score > 0.6) significance = 'high';
    else if (score > 0.4) significance = 'medium';
    else significance = 'low';
    
    return { significance, score };
  }

  private determineUrgency(alert: any, historicalData: any, marketContext: any) {
    let urgencyScore = 0;
    
    // Alert type urgency
    const urgencyByType = {
      'departure': 0.9,
      'funding': 0.8,
      'promotion': 0.6,
      'expansion': 0.7,
      'hiring': 0.4,
      'traffic': 0.3,
      'job_listing': 0.2,
      'post': 0.1
    };
    
    urgencyScore += urgencyByType[alert.type] || 0.5;
    
    // Market timing
    if (marketContext.industryConditions === 'growing') urgencyScore += 0.2;
    
    // Competitive pressure
    if (marketContext.competitorActivity.length > 5) urgencyScore += 0.3;
    
    let urgency: 'immediate' | 'high' | 'medium' | 'low';
    if (urgencyScore > 0.8) urgency = 'immediate';
    else if (urgencyScore > 0.6) urgency = 'high';
    else if (urgencyScore > 0.4) urgency = 'medium';
    else urgency = 'low';
    
    return urgency;
  }

  private generateBusinessImpact(significance: any, entity: any, alert: any) {
    const impacts = {
      critical: `Critical business impact for ${entity.name}. This ${alert.type} significantly affects market position and competitive advantage.`,
      high: `High business impact expected. ${entity.name} may experience substantial changes in market positioning.`,
      medium: `Moderate business impact anticipated. This development could affect ${entity.name}'s operations.`,
      low: `Limited business impact expected. Monitor for further developments.`
    };
    
    return impacts[significance.significance];
  }

  private generateRecommendedActions(significance: any, alert: any, entity: any) {
    const actions = [];
    
    // Base actions by alert type
    const typeActions: Record<string, string[]> = {
      'promotion': [
        'Reach out to congratulate executive',
        'Update relationship strategy',
        'Explore new opportunities with promoted contact',
        'Review account assignment'
      ],
      'departure': [
        'Immediate outreach to departing executive',
        'Identify replacement decision makers',
        'Review ongoing projects and relationships',
        'Assess competitive implications'
      ],
      'hiring': [
        'Analyze hiring patterns and needs',
        'Identify service opportunities',
        'Connect with HR/talent acquisition',
        'Monitor department growth'
      ],
      'funding': [
        'Assess scaling opportunities',
        'Prepare partnership proposals',
        'Monitor expansion plans',
        'Engage executive leadership'
      ],
      'expansion': [
        'Identify new market entry opportunities',
        'Prepare localized service offerings',
        'Connect with regional leadership',
        'Monitor competitive response'
      ]
    };
    
    // Add type-specific actions
    if (typeActions[alert.type]) {
      actions.push(...typeActions[alert.type]);
    }
    
    // Add significance-based actions
    if (significance.significance === 'critical') {
      actions.unshift('Immediate executive review required');
      actions.push('Consider cross-functional response team');
    } else if (significance.significance === 'high') {
      actions.unshift('Senior management attention required');
      actions.push('Develop response strategy within 48 hours');
    }
    
    return actions;
  }

  private generateRiskAssessment(alert: any, historicalData: any, marketContext: any) {
    const risks = [];
    
    // Type-specific risks
    const typeRisks: Record<string, string[]> = {
      'departure': [
        'Loss of key decision maker',
        'Relationship disruption',
        'Competitive poaching opportunity',
        'Project continuity risk'
      ],
      'promotion': [
        'Strategy changes possible',
        'New decision maker preferences',
        'Budget allocation shifts',
        'Organizational structure changes'
      ],
      'hiring': [
        'Market timing considerations',
        'Competitive talent acquisition',
        'Service expansion opportunities',
        'Budget increases likely'
      ]
    };
    
    if (typeRisks[alert.type]) {
      risks.push(...typeRisks[alert.type]);
    }
    
    // Market-based risks
    if (marketContext.industryConditions === 'declining') {
      risks.push('Reduced budget availability', 'Increased price sensitivity');
    }
    
    if (marketContext.competitorActivity.length > 5) {
      risks.push('Increased competitive pressure', 'Market share erosion risk');
    }
    
    return risks.length > 0 ? risks.join('; ') : 'Standard business risk levels apply';
  }

  private calculateOpportunityScore(significance: any, marketContext: any) {
    let score = significance.score * 100;
    
    // Market opportunity multiplier
    if (marketContext.industryConditions === 'growing') score *= 1.2;
    else if (marketContext.industryConditions === 'declining') score *= 0.8;
    
    // Competitive activity multiplier
    if (marketContext.competitorActivity.length > 5) score *= 1.1;
    else if (marketContext.competitorActivity.length < 2) score *= 0.9;
    
    return Math.min(100, Math.round(score));
  }

  private calculateConfidenceLevel(significance: any, historicalData: any) {
    let confidence = significance.score * 100;
    
    // Historical data confidence boost
    if (historicalData.previousAlerts.length > 5) confidence += 10;
    if (historicalData.relatedRFPs.length > 3) confidence += 5;
    
    return Math.min(100, Math.round(confidence));
  }

  private generateInsights(context: ReasoningContext) {
    const { alert, entity, historicalData, marketContext } = context;
    
    return {
      strategicImplications: [
        `This ${alert.type} may indicate ${entity.name}'s strategic direction`,
        `Market timing suggests ${marketContext.industryConditions} conditions`,
        `Historical patterns show ${historicalData.previousAlerts.length > 3 ? 'consistent' : 'emerging'} behavior`
      ],
      tacticalRecommendations: [
        'Align outreach with alert type and significance',
        'Consider competitive positioning implications',
        'Prepare service proposals based on identified needs'
      ],
      timingConsiderations: this.calculateOptimalTiming(alert, marketContext),
      stakeholderImpact: this.assessStakeholderImpact(alert, entity)
    };
  }

  private findRelatedOpportunities(context: ReasoningContext) {
    const opportunities = [];
    
    // RFP opportunities
    if (context.historicalData.relatedRFPs.length > 0) {
      const recentRFPs = context.historicalData.relatedRFPs.slice(0, 3);
      recentRFPs.forEach(rfp => {
        opportunities.push({
          type: 'RFP' as const,
          title: rfp.title,
          confidence: 0.8,
          timeline: 'Next 30-60 days'
        });
      });
    }
    
    // Partnership opportunities
    if (context.alert.type === 'expansion' || context.alert.type === 'funding') {
      opportunities.push({
        type: 'Partnership' as const,
        title: `Strategic partnership with ${context.entity.name}`,
        confidence: 0.7,
        timeline: 'Next 90 days'
      });
    }
    
    return opportunities;
  }

  private calculateOptimalTiming(alert: any, marketContext: any): string {
    if (marketContext.industryConditions === 'growing') {
      return 'Immediate action recommended to capitalize on market momentum';
    } else if (alert.type === 'departure') {
      return 'Immediate outreach required to maintain relationships';
    } else if (alert.type === 'promotion') {
      return 'Strategic timing: allow 2-4 weeks for new executive to settle in';
    }
    return 'Monitor for 1-2 weeks, then assess response timing';
  }

  private assessStakeholderImpact(alert: any, entity: any): string[] {
    const stakeholders = [];
    
    if (entity.type === 'company') {
      stakeholders.push('Executive leadership affected');
      if (alert.type === 'departure') stakeholders.push('Team stability at risk');
      if (alert.type === 'hiring') stakeholders.push('Department growth expected');
    }
    
    stakeholders.push('Competitive landscape may shift');
    stakeholders.push('Market positioning implications');
    
    return stakeholders;
  }

  // Helper methods (simplified for brevity)
  private async getHistoricalAlerts(entity: string): Promise<any[]> {
    // In production, query database for historical alerts
    return [];
  }

  private async getRelatedRFPs(entity: string): Promise<HistoricalRFP[]> {
    // In production, query RFP database
    return [];
  }

  private async getIndustryTrends(entity: string): Promise<any> {
    // In production, query industry trend data
    return {};
  }

  private async getIndustryConditions(entity: string): Promise<string> {
    // In production, query industry condition data
    return 'stable';
  }

  private async getCompetitorActivity(entity: string): Promise<any[]> {
    // In production, query competitor activity data
    return [];
  }

  private async getEconomicFactors(): Promise<any> {
    // In production, query economic indicators
    return { growthRate: 0.03 };
  }

  private initializeIndustryKnowledge() {
    // Initialize industry-specific knowledge base
    const industries = ['Technology', 'Sports', 'Finance', 'Healthcare'];
    
    industries.forEach(industry => {
      this.industryKnowledge.set(industry, {
        keyMetrics: [],
        trends: [],
        riskFactors: [],
        opportunityIndicators: []
      });
    });
  }

  private initializeMarketIndicators() {
    // Initialize market indicator data
    this.marketIndicators.set('technology', { growthRate: 0.08, volatility: 0.15 });
    this.marketIndicators.set('sports', { growthRate: 0.05, volatility: 0.10 });
  }
}

export const alertReasoningEngine = new AlertReasoningEngine();
export default AlertReasoningEngine;