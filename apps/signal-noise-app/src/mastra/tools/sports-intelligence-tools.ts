import { z } from "zod";
import { queryNeo4j, createNeo4jNode } from './neo4j-helper';

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
  getEntityCount: {
    description: "Get the total number of entities in the Neo4j knowledge graph with detailed enrichment statistics",
    parameters: z.object({}),
    execute: async () => {
      try {
        const query = `MATCH (n) 
                      RETURN count(n) as totalEntities,
                             count(CASE WHEN n.enrichmentStatus IS NOT NULL THEN 1 END) as enrichedEntities,
                             count(CASE WHEN n.keyPersonnel IS NOT NULL AND size(n.keyPersonnel) > 0 THEN 1 END) as entitiesWithPersonnel,
                             count(CASE WHEN n.digitalMaturityScore IS NOT NULL THEN 1 END) as entitiesWithDigitalScores,
                             count(CASE WHEN n.opportunityScore IS NOT NULL THEN 1 END) as entitiesWithOpportunityScores`;
        
        const data = await queryNeo4j(query, {});
        const stats = data[0];
        const enrichmentRate = stats.totalEntities > 0 ? Math.round((stats.enrichedEntities / stats.totalEntities) * 100) : 0;
        
        return {
          totalEntities: stats.totalEntities || 0,
          enrichedEntities: stats.enrichedEntities || 0,
          entitiesWithPersonnel: stats.entitiesWithPersonnel || 0,
          entitiesWithDigitalScores: stats.entitiesWithDigitalScores || 0,
          entitiesWithOpportunityScores: stats.entitiesWithOpportunityScores || 0,
          enrichmentRate: enrichmentRate,
          source: 'Neo4j MCP (native)',
          message: `Found ${stats.totalEntities} entities in the Neo4j knowledge graph. Enrichment: ${stats.enrichedEntities} entities (${enrichmentRate}%), ${stats.entitiesWithPersonnel} with key personnel, ${stats.entitiesWithDigitalScores} with digital scores.`
        };
      } catch (error) {
        console.error('Error fetching entity count from Neo4j MCP:', error);
        return { 
          error: `Failed to fetch entity count from Neo4j database: ${error instanceof Error ? error.message : 'Unknown error'}`,
          totalEntities: 0,
          source: 'Error'
        };
      }
    }
  },

  searchSportsEntities: {
    description: "Search for sports entities by name, sport, country, or level directly in the Neo4j database with comprehensive filtering",
    parameters: z.object({
      entityName: z.string().optional().describe("Name of the entity to search for"),
      sport: z.string().optional().describe("Sport type (e.g., Football, Basketball)"),
      country: z.string().optional().describe("Country name"),
      level: z.string().optional().describe("Level or league (e.g., Premier League)"),
      limit: z.number().optional().default(50).describe("Maximum number of results to return (default: 50)")
    }),
    execute: async (params: {
      entityName?: string;
      sport?: string;
      country?: string;
      level?: string;
      limit?: number;
    }) => {
      try {
        const limit = params.limit || 50;
        
        // Build dynamic Cypher query based on provided parameters
        let whereConditions = [];
        let queryParams: any = {};
        
        if (params.entityName) {
          whereConditions.push("(n.name CONTAINS $entityName OR n.clubName CONTAINS $entityName)");
          queryParams.entityName = params.entityName;
        }
        
        if (params.sport) {
          whereConditions.push("n.sport CONTAINS $sport");
          queryParams.sport = params.sport;
        }
        
        if (params.country) {
          whereConditions.push("n.country CONTAINS $country");
          queryParams.country = params.country;
        }
        
        if (params.level) {
          whereConditions.push("n.level CONTAINS $level");
          queryParams.level = params.level;
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";
        const cypherQuery = `
          MATCH (n) 
          ${whereClause}
          RETURN n.name as name, n.sport as sport, n.country as country, n.level as level, 
                 n.type as type, n.website as website, n.linkedin as linkedin, 
                 n.estimatedValue as estimatedValue, n.digitalMaturityScore as digitalMaturityScore,
                 n.opportunityScore as opportunityScore, n.keyPersonnel as keyPersonnel
          ORDER BY n.name
          LIMIT ${limit}
        `;
        
        const entities = await queryNeo4j(cypherQuery, queryParams);
        
        if (!entities || entities.length === 0) {
          return {
            matchingEntities: [],
            totalMatches: 0,
            searchCriteria: params,
            message: "No entities found matching the search criteria"
          };
        }
        
        // Transform the results to include enriched data indicators
        const enrichedEntities = entities.map((entity: any) => ({
          name: entity.name,
          sport: entity.sport,
          country: entity.country,
          level: entity.level,
          type: entity.type,
          website: entity.website,
          linkedin: entity.linkedin,
          estimatedValue: entity.estimatedValue,
          digitalMaturityScore: entity.digitalMaturityScore?.low || entity.digitalMaturityScore,
          opportunityScore: entity.opportunityScore?.low || entity.opportunityScore,
          hasKeyPersonnel: !!(entity.keyPersonnel && entity.keyPersonnel.length > 0),
          enrichmentLevel: entity.keyPersonnel ? 'ENRICHED' : 'BASIC'
        }));
        
        return {
          matchingEntities: enrichedEntities,
          totalMatches: enrichedEntities.length,
          searchCriteria: params,
          dataSource: 'Neo4j MCP (native)',
          hasEnrichedData: enrichedEntities.some(e => e.enrichmentLevel === 'ENRICHED')
        };
      } catch (error) {
        console.error('Error searching entities in Neo4j:', error);
        return { 
          error: `Failed to search entities in Neo4j database: ${error instanceof Error ? error.message : 'Unknown error'}`,
          matchingEntities: [],
          totalMatches: 0
        };
      }
    }
  },

  getEntityDetails: {
    description: "Get detailed enriched information about a specific sports entity directly from Neo4j database including key personnel, digital maturity, partnerships, and opportunity scores",
    parameters: z.object({
      entityName: z.string().describe("Name of the entity to get details for (e.g., 'Arsenal', 'Manchester United')")
    }),
    execute: async (params: { entityName: string }) => {
      try {
        const NEO4J_MCP_URL = process.env.NEO4J_MCP_URL || 'http://localhost:3004';
        
        // Query Neo4j directly for comprehensive entity data
        const response = await fetch(`${NEO4J_MCP_URL}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'tools/call',
            params: {
              name: 'execute_query',
              arguments: {
                query: `MATCH (n) 
                       WHERE n.name CONTAINS $entityName OR n.clubName CONTAINS $entityName 
                       RETURN n LIMIT 1`,
                params: { entityName: params.entityName }
              }
            }
          }),
          signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
          throw new Error(`Neo4j MCP error: ${response.status}`);
        }

        const data = await response.json();
        const resultText = data.result?.content?.[0]?.text;
        
        if (!resultText) {
          return {
            found: false,
            error: `No entity found matching "${params.entityName}" in Neo4j database`
          };
        }

        const entities = JSON.parse(resultText);
        if (!entities || entities.length === 0) {
          return {
            found: false,
            error: `No entity found matching "${params.entityName}"`
          };
        }

        const entity = entities[0].n;
        
        return {
          found: true,
          entity: {
            // Basic info
            name: entity.name,
            sport: entity.sport,
            country: entity.country,
            level: entity.level,
            website: entity.website,
            linkedin: entity.linkedin || entity.linkedinUrl,
            estimatedValue: entity.estimatedValue,
            type: entity.type,
            founded: entity.founded?.low,
            headquarters: entity.headquarters,
            companySize: entity.companySize,
            
            // Rich enriched data
            about: entity.about,
            achievements: entity.achievements || [],
            keyPersonnel: entity.keyPersonnel || [],
            partnerships: entity.partnerships || [],
            
            // Digital intelligence
            digitalMaturityScore: entity.digitalMaturityScore?.low || entity.digitalMaturity?.low,
            digitalTransformationScore: entity.digitalTransformationScore?.low,
            opportunityScore: entity.opportunityScore?.low,
            digitalGaps: entity.digitalGaps || [],
            digitalWeakness: entity.digitalWeakness,
            digitalTransformationPartner: entity.digitalTransformationPartner,
            
            // Social media & digital presence
            linkedinEmployees: entity.linkedinEmployees?.low,
            linkedinFollowers: entity.linkedinFollowers?.low,
            mobileApp: entity.mobileApp,
            
            // Business intelligence
            yellowPantherBudgetRange: entity.yellowPantherBudgetRange,
            yellowPantherStrategy: entity.yellowPantherStrategy,
            procurementStatus: entity.procurementStatus,
            priority: entity.priority,
            
            // Metadata
            enrichmentStatus: entity.enrichmentStatus,
            lastEnriched: entity.lastEnriched,
            intelligenceSource: entity.intelligenceSource,
            notes: entity.notes
          },
          enrichmentStatus: entity.enrichmentStatus || 'Not enriched',
          lastUpdated: entity.lastEnriched || entity.lastEnrichmentDate || 'Unknown',
          dataSource: 'Neo4j MCP (live enriched data)',
          hasEnrichedData: !!(entity.keyPersonnel || entity.digitalMaturityScore || entity.partnerships)
        };
      } catch (error) {
        console.error('Error fetching entity details from Neo4j:', error);
        return {
          found: false,
          error: `Failed to fetch entity details from Neo4j: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  getPersonsOfInterest: {
    description: "Get all persons of interest (key personnel) for a specific sports organization from the Neo4j database",
    parameters: z.object({
      organizationName: z.string().describe("Name of the organization (e.g., 'Arsenal', 'Manchester United')")
    }),
    execute: async (params: { organizationName: string }) => {
      try {
        const query = `MATCH (n) 
                      WHERE n.name CONTAINS $organizationName OR n.clubName CONTAINS $organizationName 
                      RETURN n.name as organizationName, n.keyPersonnel as keyPersonnel, 
                             n.notes as accessibilityNotes
                      LIMIT 1`;
        
        const results = await queryNeo4j(query, { organizationName: params.organizationName });
        
        if (!results || results.length === 0) {
          return {
            found: false,
            message: `No organization found matching "${params.organizationName}"`
          };
        }

        const org = results[0];
        const keyPersonnel = org.keyPersonnel || [];
        
        return {
          found: true,
          organizationName: org.organizationName,
          totalPersons: keyPersonnel.length,
          personsOfInterest: keyPersonnel,
          accessibilityNotes: org.accessibilityNotes || 'No specific accessibility information available',
          message: `Found ${keyPersonnel.length} persons of interest for ${org.organizationName}`,
          dataSource: 'Neo4j MCP (native)'
        };
      } catch (error) {
        console.error('Error fetching persons of interest from Neo4j:', error);
        return {
          found: false,
          error: `Failed to fetch persons of interest: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  },

  trackThinkingStep: {
    description: "Track a thinking step in the agent's reasoning process",
    parameters: z.object({
      step: z.number().describe("Step number in the thinking process"),
      action: z.string().describe("What action is being taken"),
      reasoning: z.string().describe("Why this action is being taken"),
      tool: z.string().optional().describe("Which tool is being used"),
      result: z.string().optional().describe("Result of the action"),
      confidence: z.number().min(0).max(100).optional().describe("Confidence level (0-100)")
    }),
    execute: async (params: {
      step: number;
      action: string;
      reasoning: string;
      tool?: string;
      result?: string;
      confidence?: number;
    }) => {
      console.log(`🧠 Thinking Step ${params.step}: ${params.action}`);
      console.log(`   Reasoning: ${params.reasoning}`);
      if (params.tool) console.log(`   Tool: ${params.tool}`);
      if (params.result) console.log(`   Result: ${params.result}`);
      if (params.confidence) console.log(`   Confidence: ${params.confidence}%`);
      
      return {
        success: true,
        thinkingStep: params
      };
    }
  },
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
        const BRIGHTDATA_MCP_URL = process.env.BRIGHTDATA_MCP_URL || 'http://localhost:8014';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        try {
          const company = params.organizationName;
          const baseKeywords = [
            'Chief Executive Officer',
            'CEO',
            'Commercial Director',
            'Chief Commercial Officer',
            'Chief Marketing Officer',
            'Director of Digital',
            'Head of Digital',
          ];
          const queries = Array.from(new Set([...(params.searchKeywords ?? []), ...baseKeywords]));
          const allProfiles: any[] = [];
          for (const q of queries) {
            try {
              const res = await fetch(`${BRIGHTDATA_MCP_URL}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  method: 'tools/call', 
                  params: { 
                    name: 'search_engine', 
                    arguments: { query: `site:linkedin.com/in ${q} ${company}`, engine: 'google' } 
                  } 
                }),
                signal: controller.signal,
              });
              if (res.ok) {
                const data = await res.json();
                if (data?.result?.content?.[0]?.text) {
                  // Extract LinkedIn profiles from search results text
                  const searchText = data.result.content[0].text;
                  const profileUrls = searchText.match(/linkedin\.com\/in\/[^\s"<>]+/gi) || [];
                  const names = searchText.match(/([A-Z][a-z]+ [A-Z][a-z]+)/g) || [];
                  
                  for (let i = 0; i < Math.min(profileUrls.length, 3); i++) {
                    const profileUrl = profileUrls[i].startsWith('http') ? profileUrls[i] : `https://${profileUrls[i]}`;
                    const name = names[i] || 'Unknown';
                    allProfiles.push({
                      name: name,
                      title: q, // Use the search query as title
                      profileUrl: profileUrl,
                      connections: null
                    });
                  }
                }
              }
            } catch {}
          }
          clearTimeout(timeout);

          // Normalize into LinkedInContact[]
          const dedup = new Map<string, any>();
          for (const p of allProfiles) {
            const key = (p.profileUrl || p.id || p.name || '').toLowerCase();
            if (!key) continue;
            if (!dedup.has(key)) dedup.set(key, p);
          }
          const contacts: LinkedInContact[] = Array.from(dedup.values()).map((p: any) => ({
            name: String(p.name || '').trim(),
            role: String(p.title || '').trim(),
            priority: /chief|ceo|director|head/i.test(String(p.title || '')) ? 'CRITICAL' : 'HIGH',
            profileUrl: String(p.profileUrl || ''),
            connection: typeof p.connections === 'number' && p.connections > 500 ? '2nd degree' : '3rd degree',
            availability: 'Medium',
            relevance: 'Potential decision maker',
          })).filter(c => c.name && c.role && c.profileUrl);

          return {
            success: true,
            data: {
              organizationName: params.organizationName,
              sport: params.sport,
              decisionMakers: contacts,
              totalContacts: contacts.length,
              criticalContacts: contacts.filter(c => c.priority === 'CRITICAL').length,
              highPriorityContacts: contacts.filter(c => c.priority === 'HIGH').length,
              accessibilityScore: calculateAccessibilityScore(contacts),
              message: `Discovered ${contacts.length} decision makers for ${params.organizationName}`
            }
          } as const;
        } catch (inner) {
          clearTimeout(timeout);
          throw inner;
        }
      } catch (error) {
        return { success: false, error: `Decision maker discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
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
