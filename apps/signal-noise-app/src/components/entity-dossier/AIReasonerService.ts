// AI Reasoner Feedback Service
// Generates strategic insights and recommendations based on entity intelligence data

import { Entity } from './types'
import { getOptimizedPrompt, AI_REASONER_PROMPTS } from './optimized-prompts'

export interface AIReasonerResult {
  entity_id: string
  entity_name: string
  entity_type: string
  analysis_type: 'club' | 'person' | 'league' | 'organization'
  feedback: {
    overallAssessment: string
    yellowPantherOpportunity: string
    engagementStrategy: string
    riskFactors: string[]
    competitiveAdvantages: string[]
    recommendedApproach: string
    strategicRecommendations: string[]
    confidenceScore: number
  }
  generated_at: string
  processing_time_ms: number
}

class AIReasonerService {
  private static instance: AIReasonerService
  
  public static getInstance(): AIReasonerService {
    if (!AIReasonerService.instance) {
      AIReasonerService.instance = new AIReasonerService()
    }
    return AIReasonerService.instance
  }

  async generateFeedback(entity: Entity, intelligenceData: any): Promise<AIReasonerResult> {
    const startTime = Date.now()
    
    try {
      const entityType = this.determineAnalysisType(entity)
      const entityName = entity.properties.name || 'Unknown Entity'
      
      console.log(`🧠 Generating AI Reasoner feedback for ${entityName} (${entityType})`)
      
      let feedback: AIReasonerResult['feedback']
      
      switch (entityType) {
        case 'club':
          feedback = await this.generateClubFeedback(entity, intelligenceData)
          break
        case 'person':
          feedback = await this.generatePersonFeedback(entity, intelligenceData)
          break
        case 'league':
          feedback = await this.generateLeagueFeedback(entity, intelligenceData)
          break
        case 'organization':
          feedback = await this.generateOrganizationFeedback(entity, intelligenceData)
          break
        default:
          feedback = this.generateGenericFeedback(entity, intelligenceData)
      }
      
      const result: AIReasonerResult = {
        entity_id: entity.id.toString(),
        entity_name: entityName,
        entity_type: entityType,
        analysis_type: entityType,
        feedback,
        generated_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime
      }
      
      console.log(`✅ AI Reasoner feedback generated for ${entityName} in ${result.processing_time_ms}ms`)
      return result
      
    } catch (error) {
      console.error('❌ AI Reasoner feedback generation failed:', error)
      throw error
    }
  }

  private determineAnalysisType(entity: Entity): 'club' | 'person' | 'league' | 'organization' {
    const type = entity.properties.type || ''
    const labels = entity.labels || []
    
    if (type === 'club' || labels.includes('Club')) return 'club'
    if (type === 'person' || labels.includes('Person')) return 'person'
    if (type === 'league' || labels.includes('League')) return 'league'
    if (type === 'organization' || labels.includes('Organization')) return 'organization'
    
    // Default to club for safety
    return 'club'
  }

  private async generateClubFeedback(entity: Entity, intelligenceData: any): Promise<AIReasonerResult['feedback']> {
    const entityName = entity.properties.name || 'Unknown Club'
    const digitalMaturity = entity.properties.digitalMaturity || 50
    const opportunityScore = entity.properties.opportunityScore || 70
    
    // Generate contextual feedback based on intelligence data
    const feedback: AIReasonerResult['feedback'] = {
      overallAssessment: this.generateOverallAssessment(entityName, digitalMaturity, intelligenceData),
      yellowPantherOpportunity: this.generateYellowPantherOpportunity(entityName, opportunityScore, intelligenceData),
      engagementStrategy: this.generateEngagementStrategy(entityName, intelligenceData),
      riskFactors: this.generateRiskFactors(digitalMaturity, intelligenceData),
      competitiveAdvantages: this.generateCompetitiveAdvantages(entityName, intelligenceData),
      recommendedApproach: this.generateRecommendedApproach(digitalMaturity, intelligenceData),
      strategicRecommendations: this.generateStrategicRecommendations(entityName, opportunityScore, intelligenceData),
      confidenceScore: Math.min(90, 50 + opportunityScore/2)
    }
    
    return feedback
  }

  private async generatePersonFeedback(entity: Entity, intelligenceData: any): Promise<AIReasonerResult['feedback']> {
    const entityName = entity.properties.name || 'Unknown Person'
    const role = entity.properties.role || 'Executive'
    const organization = entity.properties.organization || 'Unknown Organization'
    
    const feedback: AIReasonerResult['feedback'] = {
      overallAssessment: `${entityName} is a key decision-maker at ${organization} with significant influence over ${role.toLowerCase()} strategies.`,
      yellowPantherOpportunity: `Focus on AI-powered intelligence solutions that can enhance ${entityName}'s decision-making capabilities and provide competitive advantage for ${organization}.`,
      engagementStrategy: `Approach ${entityName} with data-driven insights and ROI projections. Emphasize how Yellow Panther can solve specific pain points in their current role.`,
      riskFactors: ['Limited technology budget', 'Vendor lock-in concerns', 'Change management challenges'],
      competitiveAdvantages: ['Strong decision authority', 'Innovation mindset', 'Results-oriented approach'],
      recommendedApproach: 'Lead with a pilot project that demonstrates immediate value, then expand based on success metrics.',
      strategicRecommendations: [
        'Focus on measurable ROI outcomes',
        'Align with their current strategic priorities',
        'Provide case studies from similar organizations',
        'Offer flexible implementation options'
      ],
      confidenceScore: 75
    }
    
    return feedback
  }

  private async generateLeagueFeedback(entity: Entity, intelligenceData: any): Promise<AIReasonerResult['feedback']> {
    const entityName = entity.properties.name || 'Unknown League'
    
    const feedback: AIReasonerResult['feedback'] = {
      overallAssessment: `${entityName} represents a significant opportunity for league-wide technology adoption and partnership.`,
      yellowPantherOpportunity: `Position Yellow Panther as a strategic technology partner that can benefit all member clubs through standardized intelligence and RFP monitoring.`,
      engagementStrategy: `Focus on league-level decision makers and emphasize solutions that provide value across the entire membership ecosystem.`,
      riskFactors: ['Complex governance structures', 'Multiple stakeholder approval processes', 'Varying member club needs'],
      competitiveAdvantages: ['League-wide adoption potential', 'Standardized solutions', 'Cross-club data aggregation'],
      recommendedApproach: 'Start with pilot programs involving willing member clubs, then scale based on demonstrated success.',
      strategicRecommendations: [
        'Develop modular solutions that can be adopted incrementally',
        'Focus on data privacy and compliance requirements',
        'Build partnerships with league technology committees',
        'Provide member club success stories and case studies'
      ],
      confidenceScore: 80
    }
    
    return feedback
  }

  private async generateOrganizationFeedback(entity: Entity, intelligenceData: any): Promise<AIReasonerResult['feedback']> {
    const entityName = entity.properties.name || 'Unknown Organization'
    
    const feedback: AIReasonerResult['feedback'] = {
      overallAssessment: `${entityName} presents strategic partnership potential for complementary service offerings and market expansion.`,
      yellowPantherOpportunity: `Explore integration opportunities where ${entityName}'s services can enhance Yellow Panther's platform and vice versa.`,
      engagementStrategy: `Focus on mutually beneficial partnerships that create enhanced value propositions for shared customers.`,
      riskFactors: ['Integration complexity', 'Competitive overlap concerns', 'Cultural alignment challenges'],
      competitiveAdvantages: ['Market access', 'Complementary technology', 'Shared customer base'],
      recommendedApproach: 'Identify specific integration points and develop joint solutions that leverage both organizations\' strengths.',
      strategicRecommendations: [
        'Map complementary service offerings',
        'Identify shared customer segments',
        'Develop integration proof-of-concepts',
        'Create joint go-to-market strategies'
      ],
      confidenceScore: 70
    }
    
    return feedback
  }

  private generateGenericFeedback(entity: Entity, intelligenceData: any): Promise<AIReasonerResult['feedback']> {
    return {
      overallAssessment: 'This entity requires further analysis to determine partnership potential.',
      yellowPantherOpportunity: 'Additional research needed to identify specific Yellow Panther value propositions.',
      engagementStrategy: 'Gather more intelligence about the entity before developing engagement strategy.',
      riskFactors: ['Limited information available', 'Unknown decision-making structure'],
      competitiveAdvantages: ['To be determined based on additional research'],
      recommendedApproach: 'Conduct deeper intelligence gathering before outreach.',
      strategicRecommendations: [
        'Research entity background and structure',
        'Identify key decision makers',
        'Understand current technology stack',
        'Assess partnership potential'
      ],
      confidenceScore: 30
    }
  }

  // Helper methods for generating contextual feedback
  private generateOverallAssessment(name: string, digitalMaturity: number, intelligenceData: any): string {
    if (digitalMaturity >= 70) {
      return `${name} demonstrates strong digital capabilities and technology readiness, making them an ideal partner for advanced AI solutions.`
    } else if (digitalMaturity >= 40) {
      return `${name} shows moderate digital maturity with clear opportunities for technology enhancement and innovation.`
    } else {
      return `${name} requires digital transformation support and could benefit significantly from Yellow Panther's intelligence platform.`
    }
  }

  private generateYellowPantherOpportunity(name: string, opportunityScore: number, intelligenceData: any): string {
    if (opportunityScore >= 80) {
      return `Position Yellow Panther as a strategic technology partner to enhance ${name}'s competitive advantage through AI-powered market intelligence and RFP monitoring.`
    } else if (opportunityScore >= 60) {
      return `Offer Yellow Panther's intelligence platform to help ${name} identify new commercial opportunities and optimize decision-making processes.`
    } else {
      return `Introduce Yellow Panther as a cost-effective solution for ${name}'s market intelligence and opportunity tracking needs.`
    }
  }

  private generateEngagementStrategy(name: string, intelligenceData: any): string {
    return `Focus on demonstrating immediate ROI through pilot projects. Start with specific pain points in commercial operations or fan engagement, then expand based on success metrics.`
  }

  private generateRiskFactors(digitalMaturity: number, intelligenceData: any): string[] {
    const risks = []
    if (digitalMaturity < 50) risks.push('Limited digital infrastructure')
    if (digitalMaturity < 30) risks.push('Technology readiness concerns')
    risks.push('Budget constraints', 'Change management requirements')
    return risks
  }

  private generateCompetitiveAdvantages(name: string, intelligenceData: any): string[] {
    return [
      'Brand strength and market presence',
      'Fan base engagement potential',
      'Commercial growth opportunities',
      'Innovation readiness indicators'
    ]
  }

  private generateRecommendedApproach(digitalMaturity: number, intelligenceData: any): string {
    if (digitalMaturity >= 70) {
      return 'Propose advanced integration opportunities and co-innovation projects.'
    } else if (digitalMaturity >= 40) {
      return 'Start with modular solutions that complement existing systems and demonstrate clear value.'
    } else {
      return 'Focus on foundational intelligence capabilities with quick implementation and measurable results.'
    }
  }

  private generateStrategicRecommendations(name: string, opportunityScore: number, intelligenceData: any): string[] {
    const recommendations = [
      'Develop customized pilot project based on current priorities',
      'Create detailed ROI projections and success metrics',
      'Identify internal champions and decision makers'
    ]
    
    if (opportunityScore >= 80) {
      recommendations.push('Propose multi-year partnership framework')
      recommendations.push('Explore joint innovation initiatives')
    }
    
    return recommendations
  }
}

export const aiReasonerService = AIReasonerService.getInstance()
export default aiReasonerService