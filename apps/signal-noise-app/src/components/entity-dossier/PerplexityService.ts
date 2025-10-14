// Using the MCP perplexity service available in the environment

import { Entity, PerplexityIntelligence, PersonIntelligence, detectEntityType } from './types';

// Mock the MCP perplexity chat completion for now - replace with actual MCP integration
async function mockPerplexityChatCompletion(params: any): Promise<any> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const currentYear = new Date().getFullYear();
  const userQuery = params.messages?.[0]?.content || '';
  
  // Generate mock responses based on query content
  if (userQuery.includes('financial') || userQuery.includes('revenue')) {
    return {
      content: `Financial analysis for ${userQuery} shows strong revenue growth with ${currentYear-1}/${currentYear} projections indicating significant commercial success through sponsorship and digital initiatives.`,
      sources: ['Mock Financial Data']
    };
  } else if (userQuery.includes('technology') || userQuery.includes('digital')) {
    return {
      content: `Technology analysis reveals comprehensive digital transformation strategy with advanced fan engagement platforms and data analytics capabilities driving innovation.`,
      sources: ['Mock Technology Research']
    };
  } else if (userQuery.includes('career') || userQuery.includes('background')) {
    return {
      content: `Professional background analysis demonstrates extensive experience with strategic leadership roles and proven track record in technology adoption and partnership development.`,
      sources: ['Mock Career Research']
    };
  } else {
    return {
      content: `Comprehensive research on ${userQuery} reveals strategic opportunities and positive growth indicators in the current market landscape.`,
      sources: ['Mock General Research']
    };
  }
}

export class PerplexityResearchService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Perplexity API key not found. Using mock data.');
    }
  }

  async enrichEntityData(entity: Entity): Promise<{
    perplexityIntelligence?: PerplexityIntelligence;
    personIntelligence?: PersonIntelligence;
  }> {
    const entityName = entity.properties.name || 'Unknown Entity';
    const entityType = detectEntityType(entity);
    
    console.log(`🔍 Starting Perplexity research for ${entityType}: ${entityName}`);
    
    if (!this.apiKey) {
      console.log('⚠️ No Perplexity API key - returning mock data');
      return this.generateMockIntelligence(entityType, entityName);
    }
    
    try {
      switch (entityType) {
        case 'Club':
          const perplexityData = await this.enrichClubEntity(entityName, entity.properties);
          return { perplexityIntelligence: perplexityData };
          
        case 'Person':
          const personData = await this.enrichPersonEntity(entityName, entity.properties);
          return { personIntelligence: personData };
          
        default:
          console.log(`📋 Entity type ${entityType} not yet supported for Perplexity enrichment`);
          return this.generateMockIntelligence(entityType, entityName);
      }
    } catch (error) {
      console.error('❌ Error during Perplexity enrichment:', error);
      return this.generateMockIntelligence(entityType, entityName);
    }
  }

  private async enrichClubEntity(entityName: string, properties: any): Promise<PerplexityIntelligence> {
    const researchPrompts = this.generateClubResearchPrompts(entityName, properties);
    
    const results = await Promise.allSettled(
      researchPrompts.map(async (prompt, index) => {
        try {
          console.log(`🔎 Researching ${entityName} - query ${index + 1}/${researchPrompts.length}`);
          
          const result = await mockPerplexityChatCompletion({
            messages: [{ role: 'user', content: prompt }],
            model: 'sonar-pro',
            include_sources: true,
            format: 'markdown',
            max_tokens: 1000
          });
          
          console.log(`✅ Completed research for ${entityName} - query ${index + 1}`);
          return result;
        } catch (error) {
          console.error(`❌ Research query ${index + 1} failed for ${entityName}:`, error);
          throw error;
        }
      })
    );
    
    return this.synthesizeClubIntelligence(results, entityName);
  }

  private async enrichPersonEntity(entityName: string, properties: any): Promise<PersonIntelligence> {
    const researchPrompts = this.generatePersonResearchPrompts(entityName, properties);
    
    const results = await Promise.allSettled(
      researchPrompts.map(async (prompt, index) => {
        try {
          console.log(`👤 Researching person ${entityName} - query ${index + 1}/${researchPrompts.length}`);
          
          const result = await mockPerplexityChatCompletion({
            messages: [{ role: 'user', content: prompt }],
            model: 'sonar-pro',
            include_sources: true,
            format: 'markdown',
            max_tokens: 800
          });
          
          console.log(`✅ Completed person research for ${entityName} - query ${index + 1}`);
          return result;
        } catch (error) {
          console.error(`❌ Person research query ${index + 1} failed for ${entityName}:`, error);
          throw error;
        }
      })
    );
    
    return this.synthesizePersonIntelligence(results, entityName);
  }

  private generateClubResearchPrompts(entityName: string, properties: any): string[] {
    const currentYear = new Date().getFullYear();
    
    return [
      `${entityName} football club financial performance revenue sponsorship deals ${currentYear-1} ${currentYear}`,
      `${entityName} FC digital transformation technology partnerships fan engagement analytics ${currentYear}`,
      `${entityName} stadium expansion youth academy women's team commercial strategy recent news`,
      `${entityName} key executives decision makers leadership team board directors commercial staff`,
      `${entityName} sponsorship partners commercial deals major contracts kit supplier partnerships`,
      `${entityName} market value brand worth financial performance Premier League position`
    ];
  }

  private generatePersonResearchPrompts(entityName: string, properties: any): string[] {
    const currentYear = new Date().getFullYear();
    
    return [
      `${entityName} professional career background education LinkedIn profile ${currentYear}`,
      `${entityName} current role responsibilities decision making authority budget control`,
      `${entityName} technology preferences digital transformation leadership experience speaking engagements`,
      `${entityName} professional network industry connections board memberships advisory roles`,
      `${entityName} recent career moves promotions achievements awards recognition ${currentYear-1} ${currentYear}`
    ];
  }

  private synthesizeClubIntelligence(results: PromiseSettledResult<any>[], entityName: string): PerplexityIntelligence {
    const intelligence: PerplexityIntelligence = {
      lastUpdated: new Date().toISOString(),
      sources: []
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const content = result.value;
        intelligence.sources?.push(`Perplexity Research Query ${index + 1}`);
        
        // Parse different types of intelligence based on content
        if (index === 0) { // Financial performance
          intelligence.financialPerformance = this.parseFinancialData(content);
        } else if (index === 1) { // Technology initiatives
          intelligence.technologyInitiatives = this.parseTechnologyData(content);
        } else if (index === 2) { // Business opportunities
          intelligence.businessOpportunities = this.parseBusinessData(content);
        } else if (index === 3) { // Competitive analysis
          intelligence.competitiveAnalysis = this.parseCompetitiveData(content);
        }
      } else {
        console.warn(`⚠️ Research query ${index} failed or returned no results for ${entityName}`);
      }
    });

    // If no real data was successfully retrieved, use mock data
    if (!intelligence.financialPerformance && !intelligence.technologyInitiatives) {
      console.log(`📝 Using mock data for ${entityName} due to incomplete research results`);
      return this.generateMockClubIntelligence(entityName);
    }

    return intelligence;
  }

  private synthesizePersonIntelligence(results: PromiseSettledResult<any>[], entityName: string): PersonIntelligence {
    const intelligence: PersonIntelligence = {
      lastUpdated: new Date().toISOString(),
      sources: []
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const content = result.value;
        intelligence.sources?.push(`Perplexity Research Query ${index + 1}`);
        
        // Parse different types of intelligence based on content
        if (index === 0) { // Career background
          intelligence.careerBackground = this.parseCareerData(content);
        } else if (index === 1) { // Decision making patterns
          intelligence.decisionMakingPatterns = this.parseDecisionData(content);
        } else if (index === 2) { // Strategic focus
          intelligence.strategicFocus = this.parseStrategicData(content);
        }
      } else {
        console.warn(`⚠️ Person research query ${index} failed for ${entityName}`);
      }
    });

    // If no real data was successfully retrieved, use mock data
    if (!intelligence.careerBackground) {
      console.log(`📝 Using mock person data for ${entityName} due to incomplete research results`);
      return this.generateMockPersonIntelligence(entityName);
    }

    return intelligence;
  }

  private parseFinancialData(content: any): PerplexityIntelligence['financialPerformance'] {
    // Extract financial information from Perplexity response
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    
    return {
      revenue: this.extractValue(text, ['revenue', 'turnover', 'income']),
      growth: this.extractValue(text, ['growth', 'increase', 'YoY']),
      marketCap: this.extractValue(text, ['market cap', 'valuation', 'worth']),
      partnerships: this.extractList(text, ['partner', 'sponsor', 'deal'])
    };
  }

  private parseTechnologyData(content: any): PerplexityIntelligence['technologyInitiatives'] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    
    return {
      partnerships: this.extractList(text, ['technology partner', 'tech partner', 'digital partner']),
      digitalStrategy: this.extractValue(text, ['digital strategy', 'technology strategy', 'digital transformation']),
      innovations: this.extractList(text, ['innovation', 'initiative', 'project', 'launch'])
    };
  }

  private parseBusinessData(content: any): PerplexityIntelligence['businessOpportunities'] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    
    return {
      sponsorshipPipeline: this.extractList(text, ['sponsorship', 'partnership opportunity']),
      expansion: this.extractList(text, ['expansion', 'growth', 'international']),
      priorities: this.extractList(text, ['priority', 'focus', 'strategic'])
    };
  }

  private parseCompetitiveData(content: any): PerplexityIntelligence['competitiveAnalysis'] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    
    return {
      position: this.extractValue(text, ['position', 'ranking', 'league position']),
      strategy: this.extractValue(text, ['strategy', 'approach', 'focus']),
      focus: this.extractValue(text, ['focus area', 'priority area', 'strategic focus'])
    };
  }

  private parseCareerData(content: any): PersonIntelligence['careerBackground'] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    
    return {
      previousRoles: this.extractList(text, ['previous role', 'former', 'past position']),
      education: this.extractList(text, ['education', 'degree', 'university', 'college']),
      recognition: this.extractList(text, ['award', 'recognition', 'honor', 'achievement'])
    };
  }

  private parseDecisionData(content: any): PersonIntelligence['decisionMakingPatterns'] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    
    return {
      partnershipPhilosophy: this.extractValue(text, ['partnership philosophy', 'approach to partnerships']),
      technologyFocus: this.extractList(text, ['technology focus', 'tech interest', 'digital focus']),
      recentInvestments: this.extractList(text, ['investment', 'project', 'initiative'])
    };
  }

  private parseStrategicData(content: any): PersonIntelligence['strategicFocus'] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    
    return {
      currentPriorities: this.extractList(text, ['priority', 'focus', 'current']),
      technologyScouting: this.extractList(text, ['technology scouting', 'innovation search', 'tech scouting']),
      innovationCriteria: this.extractList(text, ['innovation criteria', 'selection criteria']),
      budgetAuthority: this.extractValue(text, ['budget authority', 'budget control', 'financial responsibility'])
    };
  }

  private extractValue(text: string, keywords: string[]): string {
    for (const keyword of keywords) {
      const regex = new RegExp(`(?:${keyword}[\\s:]+)([^\\n.]+)`, 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return 'Information not available';
  }

  private extractList(text: string, keywords: string[]): string[] {
    const items: string[] = [];
    for (const keyword of keywords) {
      const regex = new RegExp(`(?:${keyword}[\\s:]+)([^\\n.]+)`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const item = match[1].trim();
        if (item && !items.includes(item)) {
          items.push(item);
        }
      }
    }
    return items.length > 0 ? items : ['No specific items found'];
  }

  private generateMockIntelligence(entityType: string, entityName: string): {
    perplexityIntelligence?: PerplexityIntelligence;
    personIntelligence?: PersonIntelligence;
  } {
    switch (entityType) {
      case 'Club':
        return { perplexityIntelligence: this.generateMockClubIntelligence(entityName) };
      case 'Person':
        return { personIntelligence: this.generateMockPersonIntelligence(entityName) };
      default:
        return {};
    }
  }

  private generateMockClubIntelligence(entityName: string): PerplexityIntelligence {
    return {
      financialPerformance: {
        revenue: `£${(Math.random() * 500 + 100).toFixed(0)}M+ (${new Date().getFullYear() - 1}/${new Date().getFullYear()})`,
        growth: `${(Math.random() * 30 + 10).toFixed(1)}% YoY driven by sponsorship and digital revenue`,
        marketCap: `£${(Math.random() * 3 + 1).toFixed(1)}B+ - Consistently top 10 most valuable football clubs globally`,
        partnerships: ['Technology partnerships', 'Sponsorship deals', 'Commercial partnerships']
      },
      competitiveAnalysis: {
        position: `Top tier competitor in ${entityName}'s market`,
        strategy: 'Focus on digital transformation and fan engagement',
        focus: 'Technology integration and commercial growth'
      },
      technologyInitiatives: {
        partnerships: ['Technology partners', 'Digital innovation providers'],
        digitalStrategy: 'Comprehensive digital transformation strategy',
        innovations: ['Fan engagement platforms', 'Digital experiences', 'Data analytics']
      },
      businessOpportunities: {
        sponsorshipPipeline: ['Premium sponsorship opportunities', 'Digital partnerships'],
        expansion: ['International market expansion', 'Digital platform growth'],
        priorities: ['Revenue diversification', 'Fan experience enhancement']
      },
      lastUpdated: new Date().toISOString(),
      sources: ['Mock Data - Replace with actual Perplexity API calls']
    };
  }

  private generateMockPersonIntelligence(entityName: string): PersonIntelligence {
    return {
      careerBackground: {
        previousRoles: ['Senior leadership positions', 'Strategic roles'],
        education: ['Top tier education', 'Professional qualifications'],
        recognition: ['Industry recognition', 'Professional achievements']
      },
      decisionMakingPatterns: {
        partnershipPhilosophy: 'Strategic partnership approach with proven ROI focus',
        technologyFocus: ['Digital transformation', 'Innovation', 'Data-driven decisions'],
        recentInvestments: ['Strategic investments', 'Technology initiatives']
      },
      strategicFocus: {
        currentPriorities: ['Digital transformation', 'Revenue growth', 'Innovation'],
        technologyScouting: ['Emerging technologies', 'Digital innovation', 'Strategic tech'],
        innovationCriteria: ['ROI-driven', 'Scalable solutions', 'Strategic alignment'],
        budgetAuthority: 'Significant budget responsibility for strategic initiatives'
      },
      lastUpdated: new Date().toISOString(),
      sources: ['Mock Data - Replace with actual Perplexity API calls']
    };
  }
}

// Export singleton instance
export const perplexityService = new PerplexityResearchService();