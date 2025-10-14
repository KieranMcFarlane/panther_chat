// Simple formatValue function to avoid import issues
function formatValue(value: any): string {
  if (value === null || value === undefined) return ""
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'boolean') return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map(item => formatValue(item)).join(", ")
  
  // Handle objects
  if (typeof value === 'object') {
    // If object has low and high properties (Neo4j number type), extract the low value
    if ('low' in value && 'high' in value && value.low !== undefined) {
      return formatValue(value.low)
    }
    
    // If object has a value property, use that
    if ('value' in value && value.value !== undefined) {
      return formatValue(value.value)
    }
    
    // If object has name property, use that
    if ('name' in value && value.name !== undefined) {
      return formatValue(value.name)
    }
    
    // If empty object, return empty string
    if (Object.keys(value).length === 0) {
      return ""
    }
    
    // Last resort: return JSON stringified version
    try {
      const stringValue = JSON.stringify(value)
      return stringValue === '{}' ? '' : stringValue
    } catch {
      return String(value)
    }
  }
  
  return String(value)
}

export type EntityType = 'Club' | 'Person' | 'League' | 'Partner' | 'Organization' | 'Generic'

export interface Entity {
  id: string
  neo4j_id: string | number
  labels: string[]
  properties: Record<string, any>
}

export interface Connection {
  relationship: string
  target: string
  target_type: string
}

export interface PerplexityIntelligence {
  financialPerformance?: {
    revenue: string
    growth: string
    marketCap: string
    partnerships: string[]
  }
  competitiveAnalysis?: {
    position: string
    strategy: string
    focus: string
  }
  technologyInitiatives?: {
    partnerships: string[]
    digitalStrategy: string
    innovations: string[]
  }
  businessOpportunities?: {
    sponsorshipPipeline: string[]
    expansion: string[]
    priorities: string[]
  }
  lastUpdated: string
  sources: string[]
}

// Enhanced dossier interfaces for ASCII-style Football Intelligence System
export interface DigitalTransformationPanel {
  digitalMaturity: number // 0-100
  transformationScore: number // 0-100
  websiteModernness: number // 0-10
  currentPartner: string
  keyWeaknesses: string[]
  strategicOpportunities: string[]
}

export interface AIReasonerFeedback {
  overallAssessment: string
  yellowPantherOpportunity: string
  engagementStrategy: string
  riskFactors: string[]
  competitiveAdvantages: string[]
  recommendedApproach: string
}

export interface StrategicOpportunities {
  immediateLaunch: string[]
  mediumTermPartnerships: string[]
  longTermInitiatives: string[]
  opportunityScores: { [key: string]: number } // opportunity name -> score 0-100
}

export interface RecentNews {
  date: string
  headline: string
  source: string
  category: 'partnership' | 'technology' | 'financial' | 'sports' | 'operations'
  relevanceScore: number // 0-100
}

export interface LeagueContext {
  currentPosition: number
  currentPoints: number
  recentForm: string[] // ['W', 'D', 'L', 'W', 'W']
  keyStatistics: {
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
  }
  miniTable: Array<{
    position: number
    club: string
    points: number
    goalDifference: number
  }>
}

export interface KeyDecisionMaker {
  id?: string | number // Add optional ID for Neo4j entities
  name: string
  role: string
  influenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  decisionScope: string[]
  relationshipMapping: {
    reportsTo?: string
    collaboratesWith: string[]
  }
  communicationProfile: {
    tone: string
    riskProfile: string
    preferredContact: string
  }
  strategicHooks: string[]
}

export interface PersonAIAnalysis {
  careerBackground: {
    previousRoles: string[]
    education: string[]
    recognition: string[]
  }
  decisionMakingPatterns: {
    partnershipPhilosophy: string
    technologyFocus: string[]
    recentInvestments: string[]
  }
  strategicFocus: {
    currentPriorities: string[]
    technologyScouting: string[]
    innovationCriteria: string[]
    budgetAuthority: string
  }
  communicationAnalysis: {
    tone: string
    riskProfile: 'LOW' | 'MEDIUM' | 'HIGH'
    outreachStrategy: string
    negotiationStyle: string
  }
}

// Enhanced dossier data structure
export interface EnhancedClubDossier {
  coreInfo: {
    name: string
    type: 'Club'
    league: string
    founded: number
    hq: string
    stadium: string
    website: string
    employeeRange: string
  }
  digitalTransformation: DigitalTransformationPanel
  aiReasonerFeedback: AIReasonerFeedback
  strategicOpportunities: StrategicOpportunities
  recentNews: RecentNews[]
  keyDecisionMakers: KeyDecisionMaker[]
  leagueContext: LeagueContext
  status: {
    watchlist: boolean
    activeDeal: boolean
    noEntry: boolean
    lastUpdated: string
  }
}

export interface EnhancedPersonDossier {
  coreInfo: {
    name: string
    role: string
    organization: string
    since: string
    location: string
    pastRoles: string[]
  }
  responsibilities: string[]
  influenceAnalysis: {
    influenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'
    decisionScope: string[]
    relationshipMapping: {
      reportsTo?: string
      collaboratesWith: string[]
    }
  }
  aiCommunicationAnalysis: {
    tone: string
    riskProfile: string
    outreachStrategy: string
  }
  strategicHooks: string[]
  currentProjects: string[]
  budgetAuthority: string
  status: {
    watchlist: boolean
    activeDeal: boolean
    noEntry: boolean
    lastUpdated: string
  }
}

export interface PersonIntelligence {
  careerBackground?: {
    previousRoles: string[]
    education: string[]
    recognition: string[]
  }
  decisionMakingPatterns?: {
    partnershipPhilosophy: string
    technologyFocus: string[]
    recentInvestments: string[]
  }
  strategicFocus?: {
    currentPriorities: string[]
    technologyScouting: string[]
    innovationCriteria: string[]
    budgetAuthority: string
  }
  lastUpdated: string
  sources: string[]
}

export function detectEntityType(entity: Entity): EntityType {
  const labels = entity.labels || []
  const properties = entity.properties || {}
  
  // Priority checks - most specific first
  if (labels.includes('Club') || properties.type === 'club' || properties.type === 'Club') return 'Club'
  if (labels.includes('Person') || properties.type === 'person' || properties.type === 'Person') return 'Person'
  if (labels.includes('League') || properties.type === 'league' || properties.type === 'League') return 'League'
  
  // Organization types
  if (labels.includes('Partner') || properties.type === 'partner') return 'Partner'
  if (labels.includes('Organization') || properties.type === 'organization') return 'Organization'
  
  // Label-based detection
  if (labels.includes('Company') || labels.includes('Agency')) return 'Partner'
  if (labels.includes('Association') || labels.includes('Governing Body')) return 'League'
  
  // Property-based detection
  const name = (properties.name || '').toLowerCase()
  const description = (properties.description || '').toLowerCase()
  
  // Club indicators
  if (properties.stadium || properties.league || properties.founded || 
      name.includes('fc') || name.includes('united') || name.includes('city') ||
      description.includes('football club') || description.includes('stadium')) {
    return 'Club'
  }
  
  // Person indicators
  if (properties.role || properties.position || properties.email ||
      name.includes('director') || name.includes('manager') || name.includes('ceo') ||
      description.includes('managing director') || description.includes('executive')) {
    return 'Person'
  }
  
  // League indicators
  if (properties.teams || properties.members || properties.commissioner ||
      name.includes('league') || name.includes('association') || name.includes('federation') ||
      description.includes('governing body') || description.includes('member clubs')) {
    return 'League'
  }
  
  return 'Generic'
}

export function getEntityPriority(entity: Entity): number {
  const properties = entity.properties || {}
  
  // Direct priority scores
  if (properties.yellowPantherPriority) {
    return parseInt(formatValue(properties.yellowPantherPriority)) || 0
  }
  
  if (properties.opportunityScore) {
    return parseInt(formatValue(properties.opportunityScore)) || 0
  }
  
  // Calculate priority based on various factors
  let priority = 0
  
  // Type-based priority
  const entityType = detectEntityType(entity)
  switch (entityType) {
    case 'Club': priority += 50; break
    case 'League': priority += 40; break
    case 'Person': priority += 30; break
    case 'Partner': priority += 35; break
    default: priority += 10; break
  }
  
  // Property-based priority
  if (properties.estimatedValue) {
    const value = parseFloat(formatValue(properties.estimatedValue).replace(/[^\d.]/g, ''))
    if (value > 1000000) priority += 30 // £1M+
    else if (value > 100000) priority += 20 // £100K+
  }
  
  if (properties.digitalMaturity) {
    const maturity = parseInt(formatValue(properties.digitalMaturity))
    priority += Math.min(maturity / 10, 10) // Up to 10 points for digital maturity
  }
  
  return Math.min(priority, 100)
}

export function getStatusColor(priority: number): string {
  if (priority >= 90) return 'bg-red-100 text-red-800 border-red-200'
  if (priority >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (priority >= 50) return 'bg-blue-100 text-blue-800 border-blue-200'
  return 'bg-green-100 text-green-800 border-green-200'
}

// Re-export the centralized formatValue utility
export { formatValue } from '@/lib/formatValue'