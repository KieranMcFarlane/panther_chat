import { z } from "zod";

// Sports Intelligence Schema Integration
export interface SportsClub {
  clubName: string;
  website: string;
  linkedinUrl: string;
  totalMembers: number;
  digitalMaturity: number; // 0-100, lower = higher opportunity
  opportunityScore: number; // 0-100, higher = better opportunity
  keyContacts: LinkedInContact[];
  websiteStatus: 'VERIFIED' | 'ACCESSIBLE' | 'INACCESSIBLE';
  linkedinStatus: 'VERIFIED' | 'ACCESSIBLE' | 'INACCESSIBLE';
  insights: ClubInsights;
  division: string;
  league: string;
}

export interface LinkedInContact {
  name: string;
  role: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  profileUrl: string;
  connection: string;
  availability: string;
  relevance: string;
}

export interface ClubInsights {
  opportunityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedApproach: string;
  marketSignals: string[];
  estimatedBudget: string;
  timeline: string;
  digitalTransformationSignals: string[];
}

export const sportsIntelligenceTools = {
  createSportsClubCard: {
    description: "Create a sports club card on the canvas with comprehensive intelligence data",
    parameters: z.object({
      clubName: z.string().describe("Name of the sports club"),
      website: z.string().url().describe("Club website URL"),
      linkedinUrl: z.string().url().describe("LinkedIn company page URL"),
      division: z.string().describe("Division or league (e.g., Premier League, Championship)"),
      league: z.string().describe("League name"),
      totalMembers: z.number().describe("Total LinkedIn members"),
      digitalMaturity: z.number().min(0).max(100).describe("Digital maturity score (0-100)"),
      keyContacts: z.array(z.object({
        name: z.string(),
        role: z.string(),
        priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
        profileUrl: z.string().url(),
        connection: z.string(),
        availability: z.string(),
        relevance: z.string()
      })).describe("Key decision makers and contacts"),
      marketSignals: z.array(z.string()).describe("Market opportunity signals"),
      estimatedBudget: z.string().describe("Estimated budget range"),
      timeline: z.string().describe("Implementation timeline")
    }),
    execute: async (params: {
      clubName: string;
      website: string;
      linkedinUrl: string;
      division: string;
      league: string;
      totalMembers: number;
      digitalMaturity: number;
      keyContacts: LinkedInContact[];
      marketSignals: string[];
      estimatedBudget: string;
      timeline: string;
    }) => {
      try {
        // Calculate opportunity score using the schema algorithm
        const opportunityScore = calculateOpportunityScore({
          digitalMaturity: params.digitalMaturity,
          totalMembers: params.totalMembers,
          criticalContacts: params.keyContacts.filter(c => c.priority === 'CRITICAL').length,
          marketSignals: params.marketSignals.length
        });

        const clubData: SportsClub = {
          clubName: params.clubName,
          website: params.website,
          linkedinUrl: params.linkedinUrl,
          totalMembers: params.totalMembers,
          digitalMaturity: params.digitalMaturity,
          opportunityScore,
          keyContacts: params.keyContacts,
          websiteStatus: 'VERIFIED',
          linkedinStatus: 'VERIFIED',
          insights: {
            opportunityLevel: getOpportunityLevel(opportunityScore),
            recommendedApproach: generateRecommendedApproach(params.digitalMaturity, params.marketSignals),
            marketSignals: params.marketSignals,
            estimatedBudget: params.estimatedBudget,
            timeline: params.timeline,
            digitalTransformationSignals: generateTransformationSignals(params.digitalMaturity)
          },
          division: params.division,
          league: params.league
        };

        return {
          success: true,
          data: {
            type: 'sports_club_card',
            id: `club_${Date.now()}`,
            title: params.clubName,
            subtitle: `${params.division} • ${params.league}`,
            content: clubData,
            priority: getOpportunityLevel(opportunityScore),
            score: opportunityScore,
            message: `Created sports club card for ${params.clubName} with opportunity score ${opportunityScore}`
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create sports club card: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  analyzeDigitalMaturity: {
    description: "Analyze digital maturity and technology gaps for a sports organization",
    parameters: z.object({
      organizationName: z.string().describe("Name of the organization"),
      website: z.string().url().describe("Organization website"),
      linkedinUrl: z.string().url().optional().describe("LinkedIn company page"),
      currentTechStack: z.array(z.string()).optional().describe("Current technology stack"),
      socialMediaPresence: z.object({
        twitter: z.boolean().optional(),
        instagram: z.boolean().optional(),
        facebook: z.boolean().optional(),
        youtube: z.boolean().optional()
      }).optional().describe("Social media presence"),
      mobileApp: z.boolean().optional().describe("Has mobile app"),
      ecommerce: z.boolean().optional().describe("Has e-commerce platform")
    }),
    execute: async (params: {
      organizationName: string;
      website: string;
      linkedinUrl?: string;
      currentTechStack?: string[];
      socialMediaPresence?: any;
      mobileApp?: boolean;
      ecommerce?: boolean;
    }) => {
      try {
        // Calculate digital maturity score
        const digitalMaturity = calculateDigitalMaturityScore({
          website: params.website,
          linkedinUrl: params.linkedinUrl,
          currentTechStack: params.currentTechStack || [],
          socialMediaPresence: params.socialMediaPresence || {},
          mobileApp: params.mobileApp || false,
          ecommerce: params.ecommerce || false
        });

        // Identify technology gaps
        const technologyGaps = identifyTechnologyGaps({
          digitalMaturity,
          mobileApp: params.mobileApp || false,
          ecommerce: params.ecommerce || false,
          socialMediaPresence: params.socialMediaPresence || {}
        });

        return {
          success: true,
          data: {
            organizationName: params.organizationName,
            digitalMaturityScore: digitalMaturity,
            opportunityLevel: getOpportunityLevel(100 - digitalMaturity), // Inverse relationship
            technologyGaps,
            recommendations: generateTechnologyRecommendations(technologyGaps),
            estimatedInvestment: estimateTechnologyInvestment(technologyGaps),
            message: `Digital maturity analysis complete for ${params.organizationName}`
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Digital maturity analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  discoverDecisionMakers: {
    description: "Discover and analyze decision makers for a sports organization",
    parameters: z.object({
      organizationName: z.string().describe("Name of the organization"),
      linkedinUrl: z.string().url().describe("LinkedIn company page URL"),
      sport: z.string().describe("Sport type (Football, Rugby, Cricket, etc.)"),
      organizationSize: z.enum(['Startup', 'Small', 'Medium', 'Large', 'Enterprise']).describe("Organization size"),
      searchKeywords: z.array(z.string()).optional().describe("Additional search keywords")
    }),
    execute: async (params: {
      organizationName: string;
      linkedinUrl: string;
      sport: string;
      organizationSize: string;
      searchKeywords?: string[];
    }) => {
      try {
        // Mock decision maker discovery - would integrate with BrightData MCP
        const decisionMakers = await discoverDecisionMakers({
          organizationName: params.organizationName,
          linkedinUrl: params.linkedinUrl,
          sport: params.sport,
          organizationSize: params.organizationSize,
          searchKeywords: params.searchKeywords || []
        });

        return {
          success: true,
          data: {
            organizationName: params.organizationName,
            sport: params.sport,
            decisionMakers,
            totalContacts: decisionMakers.length,
            criticalContacts: decisionMakers.filter(c => c.priority === 'CRITICAL').length,
            highPriorityContacts: decisionMakers.filter(c => c.priority === 'HIGH').length,
            accessibilityScore: calculateAccessibilityScore(decisionMakers),
            message: `Discovered ${decisionMakers.length} decision makers for ${params.organizationName}`
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Decision maker discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  calculateOpportunityScore: {
    description: "Calculate comprehensive opportunity score for a sports organization",
    parameters: z.object({
      digitalMaturity: z.number().min(0).max(100).describe("Digital maturity score"),
      totalMembers: z.number().describe("Total LinkedIn members"),
      criticalContacts: z.number().describe("Number of critical contacts"),
      marketSignals: z.number().describe("Number of market signals"),
      recentActivity: z.number().optional().describe("Recent activity score"),
      revenueEstimate: z.string().optional().describe("Revenue estimate range")
    }),
    execute: async (params: {
      digitalMaturity: number;
      totalMembers: number;
      criticalContacts: number;
      marketSignals: number;
      recentActivity?: number;
      revenueEstimate?: string;
    }) => {
      try {
        const opportunityScore = calculateOpportunityScore({
          digitalMaturity: params.digitalMaturity,
          totalMembers: params.totalMembers,
          criticalContacts: params.criticalContacts,
          marketSignals: params.marketSignals,
          recentActivity: params.recentActivity || 5
        });

        return {
          success: true,
          data: {
            opportunityScore,
            priorityLevel: getOpportunityLevel(opportunityScore),
            colorCode: getOpportunityColor(getOpportunityLevel(opportunityScore)),
            breakdown: {
              digitalMaturityGap: Math.max(0, 100 - params.digitalMaturity),
              networkSize: Math.min(20, params.totalMembers / 1000),
              contactAccess: Math.min(20, params.criticalContacts * 10),
              marketSignals: Math.min(10, params.marketSignals * 5),
              recentActivity: params.recentActivity || 5
            },
            recommendations: generateOpportunityRecommendations(opportunityScore),
            message: `Opportunity score calculated: ${opportunityScore} (${getOpportunityLevel(opportunityScore)})`
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Opportunity score calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  }
};

// Helper Functions (from your schema)
function calculateOpportunityScore(params: {
  digitalMaturity: number;
  totalMembers: number;
  criticalContacts: number;
  marketSignals: number;
  recentActivity?: number;
}): number {
  const maturityScore = Math.max(0, 100 - params.digitalMaturity) * 0.4;
  const networkScore = Math.min(20, (params.totalMembers / 1000)) * 0.2;
  const contactScore = Math.min(20, params.criticalContacts * 10) * 0.2;
  const marketScore = Math.min(10, params.marketSignals * 5) * 0.1;
  const activityScore = (params.recentActivity || 5) * 0.1;
  
  return Math.round(maturityScore + networkScore + contactScore + marketScore + activityScore);
}

function getOpportunityLevel(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function getOpportunityColor(level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500';
    case 'HIGH': return 'bg-orange-500';
    case 'MEDIUM': return 'bg-yellow-500';
    case 'LOW': return 'bg-green-500';
  }
}

function calculateDigitalMaturityScore(params: any): number {
  // Simplified digital maturity calculation
  let score = 0;
  
  if (params.linkedinUrl) score += 25;
  if (params.currentTechStack && params.currentTechStack.length > 5) score += 20;
  if (params.socialMediaPresence) {
    const platforms = Object.values(params.socialMediaPresence).filter(Boolean).length;
    score += Math.min(20, platforms * 5);
  }
  if (params.mobileApp) score += 15;
  if (params.ecommerce) score += 10;
  
  return Math.min(100, score + 10); // Base score
}

function identifyTechnologyGaps(params: any): string[] {
  const gaps = [];
  
  if (!params.mobileApp) gaps.push('Mobile app missing');
  if (params.digitalMaturity < 50) gaps.push('Website needs modernization');
  if (!params.ecommerce) gaps.push('E-commerce platform missing');
  if (params.digitalMaturity < 30) gaps.push('CRM system needed');
  if (params.digitalMaturity < 40) gaps.push('Analytics platform missing');
  
  return gaps;
}

function generateTechnologyRecommendations(gaps: string[]): string[] {
  return gaps.map(gap => {
    switch (gap) {
      case 'Mobile app missing': return 'Develop native mobile application for fan engagement';
      case 'Website needs modernization': return 'Implement responsive, modern website design';
      case 'E-commerce platform missing': return 'Build integrated e-commerce solution';
      case 'CRM system needed': return 'Implement customer relationship management system';
      case 'Analytics platform missing': return 'Deploy data analytics and reporting platform';
      default: return `Address ${gap.toLowerCase()}`;
    }
  });
}

function estimateTechnologyInvestment(gaps: string[]): string {
  const baseInvestment = gaps.length * 200; // £200K per gap
  const min = baseInvestment;
  const max = baseInvestment * 3;
  return `£${min}K-£${max}K`;
}

function generateRecommendedApproach(digitalMaturity: number, marketSignals: string[]): string {
  if (digitalMaturity < 30) {
    return 'Direct approach - urgent digital transformation needed';
  } else if (digitalMaturity < 60) {
    return 'Consultative approach - gradual modernization opportunity';
  } else {
    return 'Partnership approach - advanced technology collaboration';
  }
}

function generateTransformationSignals(digitalMaturity: number): string[] {
  const signals = [];
  if (digitalMaturity < 40) signals.push('Legacy systems detected');
  if (digitalMaturity < 60) signals.push('Modernization opportunity');
  if (digitalMaturity < 80) signals.push('Technology upgrade potential');
  return signals;
}

async function discoverDecisionMakers(params: any): Promise<LinkedInContact[]> {
  // Mock implementation - would integrate with BrightData MCP
  return [
    {
      name: "John Smith",
      role: "Chief Executive Officer",
      priority: "CRITICAL",
      profileUrl: "https://linkedin.com/in/john-smith",
      connection: "2nd degree",
      availability: "High",
      relevance: "Primary decision maker"
    },
    {
      name: "Sarah Johnson",
      role: "Commercial Director",
      priority: "HIGH",
      profileUrl: "https://linkedin.com/in/sarah-johnson",
      connection: "1st degree",
      availability: "Medium",
      relevance: "Budget authority"
    }
  ];
}

function calculateAccessibilityScore(contacts: LinkedInContact[]): number {
  const scores = contacts.map(c => {
    switch (c.connection) {
      case '1st degree': return 100;
      case '2nd degree': return 75;
      case '3rd degree': return 50;
      default: return 25;
    }
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function generateOpportunityRecommendations(score: number): string[] {
  if (score >= 80) {
    return ['Immediate action required', 'Schedule high-priority meeting', 'Prepare comprehensive proposal'];
  } else if (score >= 60) {
    return ['Strong potential - prioritize', 'Begin relationship building', 'Monitor for RFP opportunities'];
  } else if (score >= 40) {
    return ['Moderate opportunity', 'Maintain contact', 'Look for market signals'];
  } else {
    return ['Limited opportunity', 'Long-term relationship', 'Monitor for changes'];
  }
}
