/**
 * BrightData MCP Dossier Enhancer
 *
 * This module integrates BrightData MCP directly into the dossier generation system
 * to provide real-time web scraping and intelligence enrichment for entities.
 */

import { mcp__brightdata__search_engine, mcp__brightdata__scrape_as_markdown } from './mcp-client-bus';

interface DossierEnhancementOptions {
  entityId: string;
  entityName: string;
  entityUrl?: string;
  includeNews: boolean;
  includeFinancials: boolean;
  includePersonnel: boolean;
  includeCompetitors: boolean;
}

interface BrightDataIntelligence {
  webSearch: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      source: string;
    }>;
    totalResults: number;
    lastSearched: string;
  };
  webScraping: {
    content: string;
    url: string;
    extractedAt: string;
    success: boolean;
  };
  financialIntelligence: {
    funding: Array<{
      amount: string;
      date: string;
      investors: string[];
      round: string;
    }>;
    revenue: string;
    marketCap: string;
    growth: string;
  };
  personnelIntelligence: {
    executives: Array<{
      name: string;
      title: string;
      linkedIn?: string;
      recentNews: string[];
    }>;
    boardMembers: Array<{
      name: string;
      role: string;
      background: string;
    }>;
    keyPersonnel: Array<{
      name: string;
      role: string;
      department: string;
      contactInfo: string;
    }>;
  };
  competitorAnalysis: {
    competitors: Array<{
      name: string;
      marketShare: string;
      strengths: string[];
      weaknesses: string[];
    }>;
    marketPosition: string;
    competitiveAdvantages: string[];
  };
  lastUpdated: string;
  sources: string[];
}

export class BrightDataDossierEnhancer {
  private cache = new Map<string, BrightDataIntelligence>();
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds

  constructor() {
    console.log('🔆 BrightData Dossier Enhancer initialized');
  }

  /**
   * Generate enhanced dossier using BrightData MCP for real-time intelligence
   */
  async enhanceDossier(
    entityId: string,
    entityName: string,
    options: Partial<DossierEnhancementOptions> = {}
  ): Promise<BrightDataIntelligence> {
    const startTime = Date.now();
    console.log(`🔆 Starting BrightData enhancement for: ${entityName}`);

    // Check cache first
    const cacheKey = `${entityId}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      console.log(`✅ Using cached BrightData intelligence for: ${entityName}`);
      return cached;
    }

    const enhancementOptions: DossierEnhancementOptions = {
      entityId,
      entityName,
      includeNews: true,
      includeFinancials: true,
      includePersonnel: true,
      includeCompetitors: true,
      ...options
    };

    console.log(`🔍 BrightData enhancement options:`, enhancementOptions);

    try {
      // Perform parallel BrightData searches
      const [
        webSearch,
        webScraping,
        financialIntelligence,
        personnelIntelligence,
        competitorAnalysis
      ] = await Promise.allSettled([
        this.performWebSearch(entityName, enhancementOptions),
        this.performWebScraping(entityName, enhancementOptions),
        this.performFinancialIntelligence(entityName, enhancementOptions),
        this.performPersonnelIntelligence(entityName, enhancementOptions),
        this.performCompetitorAnalysis(entityName, enhancementOptions)
      ]);

      const intelligence: BrightDataIntelligence = {
        webSearch: webSearch.status === 'fulfilled' ? webSearch.value : this.getDefaultWebSearch(),
        webScraping: webScraping.status === 'fulfilled' ? webScraping.value : this.getDefaultWebScraping(),
        financialIntelligence: financialIntelligence.status === 'fulfilled' ? financialIntelligence.value : this.getDefaultFinancialIntelligence(),
        personnelIntelligence: personnelIntelligence.status === 'fulfilled' ? personnelIntelligence.value : this.getDefaultPersonnelIntelligence(),
        competitorAnalysis: competitorAnalysis.status === 'fulfilled' ? competitorAnalysis.value : this.getDefaultCompetitorAnalysis(),
        lastUpdated: new Date().toISOString(),
        sources: this.extractSources(webSearch, webScraping, financialIntelligence, personnelIntelligence, competitorAnalysis)
      };

      // Cache the result
      this.cacheResult(cacheKey, intelligence);

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ BrightData enhancement completed for: ${entityName} (${processingTime}s)`);

      return intelligence;

    } catch (error) {
      console.error(`❌ BrightData enhancement failed for ${entityName}:`, error);

      // Return default intelligence on failure
      return this.getDefaultIntelligence();
    }
  }

  /**
   * Perform web search using BrightData MCP
   */
  private async performWebSearch(
    entityName: string,
    options: DossierEnhancementOptions
  ): Promise<BrightDataIntelligence['webSearch']> {
    console.log(`🔍 Performing BrightData web search for: ${entityName}`);

    try {
      const searchQueries = this.generateSearchQueries(entityName, options);

      const searchResults = [];
      let totalResults = 0;

      // Perform multiple searches with different queries
      for (const query of searchQueries) {
        const result = await mcp__brightdata__search_engine({
          query,
          engine: 'google'
        });

        if (result && result.length > 0) {
          searchResults.push(...result.map(item => ({
            title: item.title || 'Unknown',
            url: item.url || '',
            description: item.description || '',
            source: 'BrightData Google Search'
          })));
          totalResults += result.length;
        }

        // Brief delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return {
        results: searchResults.slice(0, 10), // Top 10 results
        totalResults,
        lastSearched: new Date().toISOString()
      };

    } catch (error) {
      console.error('Web search failed:', error);
      return this.getDefaultWebSearch();
    }
  }

  /**
   * Perform web scraping using BrightData MCP
   */
  private async performWebScraping(
    entityName: string,
    options: DossierEnhancementOptions
  ): Promise<BrightDataIntelligence['webScraping']> {
    console.log(`📄 Performing BrightData web scraping for: ${entityName}`);

    try {
      if (!options.entityUrl) {
        console.log('⚠️ No entity URL provided for web scraping');
        return this.getDefaultWebScraping();
      }

      const result = await mcp__brightdata__scrape_as_markdown({
        url: options.entityUrl
      });

      return {
        content: result || '',
        url: options.entityUrl,
        extractedAt: new Date().toISOString(),
        success: !!result
      };

    } catch (error) {
      console.error('Web scraping failed:', error);
      return this.getDefaultWebScraping();
    }
  }

  /**
   * Perform financial intelligence search
   */
  private async performFinancialIntelligence(
    entityName: string,
    options: DossierEnhancementOptions
  ): Promise<BrightDataIntelligence['financialIntelligence']> {
    console.log(`💰 Performing financial intelligence for: ${entityName}`);

    try {
      const financialQueries = [
        `${entityName} funding round investment`,
        `${entityName} revenue financial performance`,
        `${entityName} market valuation IPO`,
        `${entityName} quarterly earnings report`
      ];

      const financialResults = [];
      let totalResults = 0;

      for (const query of financialQueries) {
        const results = await mcp__brightdata__search_engine({
          query,
          engine: 'google'
        });

        if (results && results.length > 0) {
          financialResults.push(...results);
          totalResults += results.length;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Extract financial intelligence from search results
      const intelligence = this.extractFinancialData(financialResults, entityName);

      return intelligence;

    } catch (error) {
      console.error('Financial intelligence failed:', error);
      return this.getDefaultFinancialIntelligence();
    }
  }

  /**
   * Perform personnel intelligence search
   */
  private async performPersonnelIntelligence(
    entityName: string,
    options: DossierEnhancementOptions
  ): Promise<BrightDataIntelligence['personnelIntelligence']> {
    console.log(`👥 Performing personnel intelligence for: ${entityName}`);

    try {
      const personnelQueries = [
        `${entityName} CEO executive leadership team`,
        `${entityName} board of directors members`,
        `${entityName} management team structure`,
        `${entityName} key executives LinkedIn`
      ];

      const personnelResults = [];
      for (const query of personnelQueries) {
        const results = await mcp__brightdata__search_engine({
          query,
          engine: 'google'
        });

        if (results) {
          personnelResults.push(...results);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return this.extractPersonnelData(personnelResults, entityName);

    } catch (error) {
      console.error('Personnel intelligence failed:', error);
      return this.getDefaultPersonnelIntelligence();
    }
  }

  /**
   * Perform competitor analysis
   */
  private async performCompetitorAnalysis(
    entityName: string,
    options: DossierEnhancementOptions
  ): Promise<BrightDataIntelligence['competitorAnalysis']> {
    console.log(`🏆 Performing competitor analysis for: ${entityName}`);

    try {
      const competitorQueries = [
        `${entityName} competitors market analysis`,
        `${entityName} vs competitors comparison`,
        `${entityName} industry market share`,
        `${entityName} competitive landscape`
      ];

      const competitorResults = [];
      for (const query of competitorQueries) {
        const results = await mcp__brightdata__search_engine({
          query,
          engine: 'google'
        });

        if (results) {
          competitorResults.push(...results);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return this.extractCompetitorData(competitorResults, entityName);

    } catch (error) {
      console.error('Competitor analysis failed:', error);
      return this.getDefaultCompetitorAnalysis();
    }
  }

  /**
   * Generate targeted search queries based on entity type
   */
  private generateSearchQueries(
    entityName: string,
    options: DossierEnhancementOptions
  ): string[] {
    const baseQueries = [
      entityName,
      `${entityName} official website`,
      `${entityName} company profile`
    ];

    if (options.includeNews) {
      baseQueries.push(
        `${entityName} recent news`,
        `${entityName} press releases`,
        `${entityName} announcements`
      );
    }

    if (options.includeFinancials) {
      baseQueries.push(
        `${entityName} financial performance`,
        `${entityName} revenue`,
        `${entityName} funding`
      );
    }

    if (options.includePersonnel) {
      baseQueries.push(
        `${entityName} leadership`,
        `${entityName} management team`,
        `${entityName} executives`
      );
    }

    return baseQueries.slice(0, 5); // Limit to 5 queries to avoid rate limiting
  }

  /**
   * Extract financial data from search results
   */
  private extractFinancialData(
    searchResults: any[],
    entityName: string
  ): BrightDataIntelligence['financialIntelligence'] {
    // This is a simplified extraction - in production, you'd use more sophisticated NLP
    const funding: any[] = [];
    let revenue = 'Not available';
    let marketCap = 'Not available';
    let growth = 'Not available';

    // Look for funding information in search results
    searchResults.forEach(result => {
      const text = (result.title + ' ' + result.description).toLowerCase();

      if (text.includes('funding') || text.includes('investment') || text.includes('raises')) {
        funding.push({
          amount: 'TBD',
          date: new Date().toISOString(),
          investors: ['Various'],
          round: 'TBD'
        });
      }

      if (text.includes('revenue') || text.includes('earnings')) {
        revenue = 'Revenue data found in search results';
      }

      if (text.includes('market cap') || text.includes('valuation')) {
        marketCap = 'Market cap data found in search results';
      }

      if (text.includes('growth') || text.includes('growth rate')) {
        growth = 'Growth data found in search results';
      }
    });

    return {
      funding: funding.slice(0, 3), // Top 3 funding rounds
      revenue,
      marketCap,
      growth
    };
  }

  /**
   * Extract personnel data from search results
   */
  private extractPersonnelData(
    searchResults: any[],
    entityName: string
  ): BrightDataIntelligence['personnelIntelligence'] {
    const executives: any[] = [];
    const boardMembers: any[] = [];
    const keyPersonnel: any[] = [];

    searchResults.forEach(result => {
      const text = (result.title + ' ' + result.description);

      // Simple extraction - in production, use more sophisticated NLP
      if (text.toLowerCase().includes('ceo') || text.toLowerCase().includes('executive')) {
        executives.push({
          name: 'Executive found in search',
          title: 'Executive',
          linkedIn: '',
          recentNews: [result.title]
        });
      }

      if (text.toLowerCase().includes('board') || text.toLowerCase().includes('director')) {
        boardMembers.push({
          name: 'Board member found in search',
          role: 'Board Member',
          background: result.description
        });
      }

      keyPersonnel.push({
        name: 'Key personnel found in search',
        role: 'Key Personnel',
        department: 'Management',
        contactInfo: ''
      });
    });

    return {
      executives: executives.slice(0, 5),
      boardMembers: boardMembers.slice(0, 5),
      keyPersonnel: keyPersonnel.slice(0, 5)
    };
  }

  /**
   * Extract competitor data from search results
   */
  private extractCompetitorData(
    searchResults: any[],
    entityName: string
  ): BrightDataIntelligence['competitorAnalysis'] {
    const competitors: any[] = [];
    let marketPosition = 'Position analysis from search results';
    const competitiveAdvantages: string[] = [];

    searchResults.forEach(result => {
      const text = (result.title + ' ' + result.description).toLowerCase();

      if (text.includes('competitor') || text.includes('vs')) {
        competitors.push({
          name: 'Competitor found in search',
          marketShare: 'Market share data from search',
          strengths: ['Strengths identified in search'],
          weaknesses: ['Weaknesses identified in search']
        });
      }

      if (text.includes('advantage') || text.includes('strength')) {
        competitiveAdvantages.push('Advantage identified in search results');
      }
    });

    return {
      competitors: competitors.slice(0, 5),
      marketPosition,
      competitiveAdvantages: competitiveAdvantages.slice(0, 3)
    };
  }

  /**
   * Extract all sources used in intelligence gathering
   */
  private extractSources(...results: any[]): string[] {
    const sources = new Set<string>();

    results.forEach(result => {
      if (result && result.status === 'fulfilled') {
        sources.add('BrightData MCP - Web Search');
        sources.add('BrightData MCP - Web Scraping');
        sources.add('BrightData MCP - Intelligence Analysis');
      }
    });

    return Array.from(sources);
  }

  // Default fallback methods
  private getDefaultIntelligence(): BrightDataIntelligence {
    return {
      webSearch: this.getDefaultWebSearch(),
      webScraping: this.getDefaultWebScraping(),
      financialIntelligence: this.getDefaultFinancialIntelligence(),
      personnelIntelligence: this.getDefaultPersonnelIntelligence(),
      competitorAnalysis: this.getDefaultCompetitorAnalysis(),
      lastUpdated: new Date().toISOString(),
      sources: ['BrightData MCP - Fallback Data']
    };
  }

  private getDefaultWebSearch(): BrightDataIntelligence['webSearch'] {
    return {
      results: [],
      totalResults: 0,
      lastSearched: new Date().toISOString()
    };
  }

  private getDefaultWebScraping(): BrightDataIntelligence['webScraping'] {
    return {
      content: '',
      url: '',
      extractedAt: new Date().toISOString(),
      success: false
    };
  }

  private getDefaultFinancialIntelligence(): BrightDataIntelligence['financialIntelligence'] {
    return {
      funding: [],
      revenue: 'Not available',
      marketCap: 'Not available',
      growth: 'Not available'
    };
  }

  private getDefaultPersonnelIntelligence(): BrightDataIntelligence['personnelIntelligence'] {
    return {
      executives: [],
      boardMembers: [],
      keyPersonnel: []
    };
  }

  private getDefaultCompetitorAnalysis(): BrightDataIntelligence['competitorAnalysis'] {
    return {
      competitors: [],
      marketPosition: 'Not available',
      competitiveAdvantages: []
    };
  }

  private getCachedResult(key: string): BrightDataIntelligence | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.lastUpdated) < this.CACHE_TTL) {
      return cached;
    }
    return null;
  }

  private cacheResult(key: string, intelligence: BrightDataIntelligence): void {
    this.cache.set(key, intelligence);
  }

  /**
   * Clear cache manually if needed
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 BrightData intelligence cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.CACHE_TTL
    };
  }
}

// Export singleton instance
export const brightDataEnhancer = new BrightDataDossierEnhancer();