import { mcp__brightdata__search_engine } from '@/lib/mcp/brightdata'
import { mcp__brightdata__scrape_as_markdown } from '@/lib/mcp/brightdata'

export interface LinkedInRFPSignal {
  title: string
  description: string
  entity: string
  procurementType: string
  estimatedValue?: string
  deadline?: string
  sourceUrl: string
  confidence: number
  keywords: string[]
  publishedAt: string
}

export interface BrightDataSearchResult {
  title: string
  url: string
  description: string
  publishedAt?: string
  source: string
}

export class RealBrightDataIntegration {
  private apiKey: string
  private zone: string

  constructor() {
    this.apiKey = process.env.BRIGHTDATA_API_TOKEN || ''
    this.zone = process.env.BRIGHTDATA_ZONE || 'linkedin_posts_monitor'
    
    if (!this.apiKey) {
      console.warn('⚠️ BrightData API token not configured - using simulation mode')
    }
  }

  async searchForRFPSignals(entityName: string, entityType: string = 'Company'): Promise<LinkedInRFPSignal[]> {
    console.log(`🔍 Searching LinkedIn RFP signals for ${entityName}...`)
    
    const searchQueries = this.generateSearchQueries(entityName, entityType)
    const signals: LinkedInRFPSignal[] = []

    for (const query of searchQueries) {
      try {
        const results = await this.executeSearch(query)
        const entitySignals = await this.processSearchResults(results, entityName)
        signals.push(...entitySignals)
      } catch (error) {
        console.error(`❌ Error searching for ${query}:`, error)
      }
    }

    console.log(`✅ Found ${signals.length} RFP signals for ${entityName}`)
    return signals
  }

  private generateSearchQueries(entityName: string, entityType: string): string[] {
    const baseQueries = [
      `${entityName} RFP procurement tender`,
      `${entityName} digital transformation request for proposal`,
      `${entityName} technology vendor selection`,
      `${entityName} seeking proposals from vendors`,
      `${entityName} procurement opportunity supplier`
    ]

    const entityTypeQueries = {
      'Club': [
        `${entityName} stadium technology RFP`,
        `${entityName} fan engagement digital transformation`,
        `${entityName} sports technology procurement`,
        `${entityName} ticketing system RFP`,
        `${entityName} merchandise platform tender`
      ],
      'League': [
        `${entityName} league technology platform RFP`,
        `${entityName} broadcast technology procurement`,
        `${entityName} digital media platform tender`,
        `${entityName} data analytics vendor selection`,
        `${entityName} fan experience technology RFP`
      ],
      'Organization': [
        `${entityName} sports technology consulting RFP`,
        `${entityName} event management platform procurement`,
        `${entityName} sponsorship technology tender`,
        `${entityName} sports marketing RFP`,
        `${entityName} athlete management technology RFP`
      ]
    }

    return [...baseQueries, ...(entityTypeQueries[entityType] || [])]
  }

  private async executeSearch(query: string): Promise<BrightDataSearchResult[]> {
    try {
      if (this.apiKey && this.apiKey !== '') {
        // Use real BrightData MCP search
        const searchResults = await mcp__brightdata__search_engine({
          query: query,
          engine: 'linkedin',
          num_results: 10
        })

        return searchResults.results?.map((result: any) => ({
          title: result.title || result.name || '',
          url: result.url || result.link || '',
          description: result.description || result.snippet || '',
          publishedAt: result.date || result.published_date,
          source: 'linkedin'
        })) || []
      } else {
        // Simulation mode for development
        return this.simulateSearchResults(query)
      }
    } catch (error) {
      console.error('BrightData search failed, falling back to simulation:', error)
      return this.simulateSearchResults(query)
    }
  }

  private async processSearchResults(results: BrightDataSearchResult[], entityName: string): Promise<LinkedInRFPSignal[]> {
    const signals: LinkedInRFPSignal[] = []

    for (const result of results) {
      const isRFPSignal = this.isRFPRelated(result.title + ' ' + result.description)
      
      if (isRFPSignal) {
        let detailedAnalysis = result
        
        // If high confidence, scrape the full page for more details
        if (isRFPSignal.confidence > 0.7 && this.apiKey) {
          try {
            const scrapedContent = await mcp__brightdata__scrape_as_markdown({
              url: result.url
            })
            detailedAnalysis = await this.extractRFPDetails(scrapedContent, result)
          } catch (error) {
            console.warn(`⚠️ Could not scrape ${result.url}:`, error)
          }
        }

        const signal: LinkedInRFPSignal = {
          title: this.extractRFPTitle(detailedAnalysis.title, detailedAnalysis.description, entityName),
          description: detailedAnalysis.description || result.description,
          entity: entityName,
          procurementType: this.identifyProcurementType(detailedAnalysis.title + ' ' + detailedAnalysis.description),
          estimatedValue: this.extractEstimatedValue(detailedAnalysis.description),
          deadline: this.extractDeadline(detailedAnalysis.description),
          sourceUrl: result.url,
          confidence: isRFPSignal.confidence,
          keywords: this.extractKeywords(detailedAnalysis.title + ' ' + detailedAnalysis.description),
          publishedAt: result.publishedAt || new Date().toISOString()
        }

        signals.push(signal)
      }
    }

    return signals
  }

  private isRFPRelated(content: string): { isRFP: boolean; confidence: number } {
    const rfpKeywords = [
      'request for proposal', 'rfp', 'tender', 'procurement', 'bidding',
      'vendor selection', 'supplier', 'solicitation', 'invitation to bid',
      'itb', 'ifb', 'eoI', 'expression of interest', 'quotation',
      'request for quotation', 'rfq', 'request for information', 'rfi',
      'seeking proposals', 'looking for vendors', 'supplier registration',
      'contract opportunity', 'business opportunity', 'service provider'
    ]

    const content_lower = content.toLowerCase()
    let score = 0
    const maxScore = 100

    // Check for RFP keywords
    rfpKeywords.forEach(keyword => {
      if (content_lower.includes(keyword.toLowerCase())) {
        score += 20
      }
    })

    // Check for urgency indicators
    const urgencyKeywords = ['deadline', 'submission', 'closing date', 'due date']
    urgencyKeywords.forEach(keyword => {
      if (content_lower.includes(keyword.toLowerCase())) {
        score += 15
      }
    })

    // Check for technology/sports context
    const contextKeywords = ['technology', 'digital', 'software', 'system', 'platform', 'solution']
    contextKeywords.forEach(keyword => {
      if (content_lower.includes(keyword.toLowerCase())) {
        score += 10
      }
    })

    const confidence = Math.min(score / maxScore, 0.95) // Cap at 95%

    return {
      isRFP: confidence > 0.3,
      confidence: confidence
    }
  }

  private extractRFPTitle(title: string, description: string, entityName: string): string {
    const text = (title + ' ' + description).trim()
    
    // Look for specific RFP title patterns
    const patterns = [
      /request for proposal[:\s]*(.+?)(?:\n|\.|$)/i,
      /rfp[:\s]*(.+?)(?:\n|\.|$)/i,
      /tender[:\s]*(.+?)(?:\n|\.|$)/i,
      /procurement[:\s]*(.+?)(?:\n|\.|$)/i,
      /seeking[:\s]*(.+?)(?:\n|\.|$)/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    // If no specific pattern found, create a descriptive title
    const cleanedTitle = title.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    return `${entityName} - ${cleanedTitle.substring(0, 80)}`
  }

  private identifyProcurementType(content: string): string {
    const content_lower = content.toLowerCase()
    
    const types = {
      'Technology': ['software', 'system', 'platform', 'digital', 'technology', 'it', 'app'],
      'Services': ['consulting', 'services', 'support', 'maintenance', 'training'],
      'Infrastructure': ['hardware', 'equipment', 'infrastructure', 'facilities'],
      'Marketing': ['marketing', 'advertising', 'sponsorship', 'promotion'],
      'Operations': ['operations', 'management', 'logistics', 'supply chain']
    }

    for (const [type, keywords] of Object.entries(types)) {
      if (keywords.some(keyword => content_lower.includes(keyword))) {
        return type
      }
    }

    return 'General'
  }

  private extractEstimatedValue(content: string): string | undefined {
    const patterns = [
      /\$(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(million|billion|k|k|m|b))?/i,
      /€(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(million|billion|k|k|m|b))?/i,
      /£(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(million|billion|k|k|m|b))?/i,
      /value[:\s]*[$€£]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i,
      /budget[:\s]*[$€£]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        const amount = match[1]
        const unit = match[2] || ''
        return `${match[0]}`
      }
    }

    return undefined
  }

  private extractDeadline(content: string): string | undefined {
    const patterns = [
      /deadline[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /closing date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /submission[:\s]*due[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:deadline|closing|due)[:\s]*(\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{4})/i
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return undefined
  }

  private extractKeywords(content: string): string[] {
    const content_lower = content.toLowerCase()
    const keywords: string[] = []

    // Technology keywords
    const techKeywords = ['software', 'hardware', 'cloud', 'ai', 'machine learning', 'data analytics', 'mobile', 'web', 'api', 'integration']
    // Business keywords
    const businessKeywords = ['transformation', 'digitalization', 'automation', 'optimization', 'efficiency', 'innovation']
    // Sports keywords
    const sportsKeywords = ['fan engagement', 'ticketing', 'stadium', 'venue', 'broadcast', 'media', 'sponsorship', 'merchandise']

    const allKeywords = [...techKeywords, ...businessKeywords, ...sportsKeywords]

    allKeywords.forEach(keyword => {
      if (content_lower.includes(keyword.toLowerCase())) {
        keywords.push(keyword)
      }
    })

    return [...new Set(keywords)].slice(0, 8) // Return unique keywords, max 8
  }

  private async extractRFPDetails(scrapedContent: any, originalResult: BrightDataSearchResult): Promise<BrightDataSearchResult> {
    const content = typeof scrapedContent === 'string' ? scrapedContent : JSON.stringify(scrapedContent)
    
    return {
      ...originalResult,
      description: this.extractDescriptionFromContent(content) || originalResult.description,
      title: this.extractTitleFromContent(content) || originalResult.title
    }
  }

  private extractDescriptionFromContent(content: string): string | undefined {
    // Look for description or summary in the scraped content
    const patterns = [
      /(?:description|summary|overview)[:\s]*([^.!?]*[.!?])/i,
      /(?:about|project details)[:\s]*([^.!?]*[.!?])/i,
      /(?:scope|objective)[:\s]*([^.!?]*[.!?])/i
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match && match[1] && match[1].length > 20) {
        return match[1].trim()
      }
    }

    return undefined
  }

  private extractTitleFromContent(content: string): string | undefined {
    // Look for title in the scraped content
    const patterns = [
      /<title[^>]*>([^<]+)<\/title>/i,
      /<h1[^>]*>([^<]+)<\/h1>/i,
      /(?:project|tender|rfp)[:\s]*([^.!?]*[.!?])/i
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    return undefined
  }

  private simulateSearchResults(query: string): BrightDataSearchResult[] {
    // Simulation mode for development/testing
    console.log(`🎭 Simulating search results for: ${query}`)
    
    const mockResults: BrightDataSearchResult[] = [
      {
        title: `${query.split(' ')[0]} Digital Transformation RFP 2024`,
        url: 'https://linkedin.com/company/example-rfp',
        description: `Request for proposal for digital transformation initiatives including fan engagement platforms, ticketing systems, and venue technology solutions.`,
        publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'linkedin'
      },
      {
        title: `Technology Vendor Selection - ${query.split(' ')[0]}`,
        url: 'https://linkedin.com/company/example-vendor',
        description: `Seeking qualified technology vendors for comprehensive sports technology implementation and integration services.`,
        publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'linkedin'
      }
    ]

    return mockResults
  }

  async getRealEntityData(entityName: string): Promise<any> {
    // This would integrate with your actual entity database
    return {
      name: entityName,
      type: 'Club',
      linkedinUrl: `https://linkedin.com/company/${entityName.toLowerCase().replace(/\s+/g, '-')}`,
      industry: 'Sports',
      size: 'Large',
      lastUpdated: new Date().toISOString()
    }
  }
}

// Export singleton instance
export const realBrightDataIntegration = new RealBrightDataIntegration()