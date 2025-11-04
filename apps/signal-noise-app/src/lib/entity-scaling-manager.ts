/**
 * 🌐 Entity Scaling Manager
 * 
 * Manages monitoring of thousands of entities with intelligent prioritization
 */

import { MONITORING_TARGETS } from './monitoring-config';
import { HybridMonitoringService } from './hybrid-monitoring-strategy';

interface Entity {
  id: string;
  name: string;
  type: 'company' | 'person' | 'organization' | 'federation' | 'club';
  industry?: string;
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  location?: string;
  website?: string;
  linkedinUrl?: string;
  careersUrl?: string;
  domain?: string;
  tier: 'golden' | 'standard' | 'economy';
  priority: number; // 1-100
  lastScraped?: string;
  scrapeInterval: number; // minutes
  keywords: string[];
  alertTypes: string[];
  status: 'active' | 'inactive' | 'paused';
  metadata: Record<string, any>;
}

interface HistoricalRFP {
  id: string;
  title: string;
  organization: string;
  type: 'RFP' | 'Tender' | 'Contract' | 'RFT';
  source: string;
  published: string;
  deadline?: string;
  value?: string;
  category: string;
  description: string;
  url?: string;
  location?: string;
  scrapedAt: string;
  processingStatus: 'pending' | 'processed' | 'analyzed';
}

interface ScalingConfig {
  maxConcurrentScrapes: number;
  batchSize: number;
  goldenZoneLimit: number;
  standardZoneLimit: number;
  economyZoneLimit: number;
  historicalLookbackDays: number;
  retryAttempts: number;
  rateLimitDelay: number; // milliseconds
}

class EntityScalingManager {
  private entities: Map<string, Entity> = new Map();
  private config: ScalingConfig;
  private activeScrapers: Map<string, NodeJS.Timeout> = new Map();
  private historicalRFPs: HistoricalRFP[] = [];
  private isInitialized = false;

  constructor(config?: Partial<ScalingConfig>) {
    this.config = {
      maxConcurrentScrapes: 50,
      batchSize: 100,
      goldenZoneLimit: 50,
      standardZoneLimit: 500,
      economyZoneLimit: 5000,
      historicalLookbackDays: 365, // 1 year back
      retryAttempts: 3,
      rateLimitDelay: 1000,
      ...config
    };

    this.initialize();
  }

  private async initialize() {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Entity Scaling Manager...');
    
    // Load entities from database/API
    await this.loadEntitiesFromDatabase();
    
    // Load historical RFP data
    await this.loadHistoricalRFPData();
    
    // Start monitoring based on tiers
    await this.startTieredMonitoring();
    
    this.isInitialized = true;
    console.log(`✅ Entity Scaling Manager initialized with ${this.entities.size} entities`);
  }

  private async loadEntitiesFromDatabase() {
    try {
      // In production, this would load from your entity database
      // For now, we'll simulate a large entity database
      
      // Load hardcoded high-value targets
      MONITORING_TARGETS.forEach(target => {
        const entity: Entity = {
          id: target.id,
          name: target.name,
          type: target.type === 'person' ? 'person' : 'company',
          tier: target.tier,
          priority: target.tier === 'golden' ? 90 : target.tier === 'standard' ? 60 : 30,
          scrapeInterval: target.checkInterval,
          keywords: target.keywords,
          alertTypes: target.alertTypes,
          status: 'active',
          website: target.url,
          linkedinUrl: target.linkedinUrl,
          careersUrl: target.careersUrl,
          metadata: { source: 'manual_config' }
        };
        this.entities.set(entity.id, entity);
      });

      // Generate scaled entity database
      await this.generateScaledEntityDatabase();
      
    } catch (error) {
      console.error('Error loading entities:', error);
    }
  }

  private async generateScaledEntityDatabase() {
    // Generate realistic entity database with thousands of entries
    const industries = ['Technology', 'Sports', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Energy', 'Education'];
    const companySuffixes = ['Inc', 'LLC', 'Corp', 'Ltd', 'GmbH', 'SA', 'AG', 'Pty Ltd'];
    const locations = ['London', 'New York', 'San Francisco', 'Berlin', 'Paris', 'Tokyo', 'Sydney', 'Toronto'];

    // Generate companies
    for (let i = 0; i < 2000; i++) {
      const companyId = `company-${i + 1000}`;
      const industry = industries[Math.floor(Math.random() * industries.length)];
      const size = this.getRandomSize();
      const tier = this.determineTier(size, Math.random());
      
      const entity: Entity = {
        id: companyId,
        name: `Company ${i + 1000} ${companySuffixes[Math.floor(Math.random() * companySuffixes.length)]}`,
        type: 'company',
        industry,
        size,
        location: locations[Math.floor(Math.random() * locations.length)],
        website: `https://company${i + 1000}.com`,
        domain: `company${i + 1000}.com`,
        tier,
        priority: this.calculatePriority(tier, size, Math.random()),
        scrapeInterval: this.getScrapeInterval(tier),
        keywords: this.generateKeywords(industry),
        alertTypes: this.getRandomAlertTypes(),
        status: Math.random() > 0.1 ? 'active' : 'inactive',
        metadata: {
          generated: true,
          employeeCount: this.getEmployeeCount(size),
          revenue: this.getRevenue(size)
        }
      };
      
      this.entities.set(companyId, entity);
    }

    // Generate sports clubs/organizations
    const sportsEntities = [
      { type: 'club', count: 500, prefix: 'FC' },
      { type: 'club', count: 300, prefix: 'SC' },
      { type: 'organization', count: 200, prefix: 'Association' },
      { type: 'federation', count: 100, prefix: 'Federation' }
    ];

    for (const sportsType of sportsEntities) {
      for (let i = 0; i < sportsType.count; i++) {
        const entityId = `${sportsType.type}-${i + 1}`;
        const tier = Math.random() > 0.8 ? 'golden' : Math.random() > 0.5 ? 'standard' : 'economy';
        
        const entity: Entity = {
          id: entityId,
          name: `${i + 1} ${sportsType.prefix} ${['United', 'City', 'Athletic', 'Sporting', 'Rovers'][Math.floor(Math.random() * 5)]}`,
          type: sportsType.type as any,
          industry: 'Sports',
          location: locations[Math.floor(Math.random() * locations.length)],
          tier,
          priority: this.calculatePriority(tier, 'medium', Math.random()),
          scrapeInterval: this.getScrapeInterval(tier),
          keywords: ['sports', 'football', 'soccer', 'club', 'team'],
          alertTypes: ['hiring', 'expansion', 'funding', 'traffic'],
          status: Math.random() > 0.05 ? 'active' : 'inactive',
          metadata: {
            generated: true,
            sportType: 'football',
            leagueLevel: this.getRandomLeagueLevel()
          }
        };
        
        this.entities.set(entityId, entity);
      }
    }

    console.log(`📊 Generated ${this.entities.size} entities for monitoring`);
  }

  private async loadHistoricalRFPData() {
    try {
      // Load historical RFPs going back 1 year
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - this.config.historicalLookbackDays);

      // Generate realistic historical RFP data
      for (let i = 0; i < 5000; i++) {
        const publishedDate = new Date(lookbackDate.getTime() + Math.random() * (Date.now() - lookbackDate.getTime()));
        
        const rfp: HistoricalRFP = {
          id: `rfp-historical-${i + 1}`,
          title: this.generateRFPTitle(),
          organization: this.getRandomOrganization(),
          type: this.getRandomRFPType(),
          source: this.getRandomRFPSource(),
          published: publishedDate.toISOString(),
          deadline: this.getRandomDeadline(publishedDate),
          value: this.getRandomValue(),
          category: this.getRandomCategory(),
          description: this.generateRFPDescription(),
          url: `https://example.com/rfp/${i + 1}`,
          location: this.getRandomLocation(),
          scrapedAt: new Date().toISOString(),
          processingStatus: 'pending'
        };

        this.historicalRFPs.push(rfp);
      }

      // Sort by publication date (newest first)
      this.historicalRFPs.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
      
      console.log(`📋 Loaded ${this.historicalRFPs.length} historical RFPs (last ${this.config.historicalLookbackDays} days)`);
      
    } catch (error) {
      console.error('Error loading historical RFP data:', error);
    }
  }

  private async startTieredMonitoring() {
    const entitiesByTier = {
      golden: Array.from(this.entities.values()).filter(e => e.tier === 'golden' && e.status === 'active'),
      standard: Array.from(this.entities.values()).filter(e => e.tier === 'standard' && e.status === 'active'),
      economy: Array.from(this.entities.values()).filter(e => e.tier === 'economy' && e.status === 'active')
    };

    console.log('🎯 Starting tiered monitoring:', {
      golden: entitiesByTier.golden.length,
      standard: entitiesByTier.standard.length,
      economy: entitiesByTier.economy.length
    });

    // Start Golden Zone monitoring (real-time)
    await this.startTierMonitoring('golden', entitiesByTier.golden, 5); // 5 minutes
    
    // Start Standard Tier monitoring (15 minutes)
    await this.startTierMonitoring('standard', entitiesByTier.standard, 15); // 15 minutes
    
    // Start Economy Tier monitoring (1 hour)
    await this.startTierMonitoring('economy', entitiesByTier.economy, 60); // 1 hour
  }

  private async startTierMonitoring(tier: string, entities: Entity[], intervalMinutes: number) {
    const maxConcurrent = Math.min(
      this.config.maxConcurrentScrapes,
      tier === 'golden' ? this.config.goldenZoneLimit :
      tier === 'standard' ? this.config.standardZoneLimit :
      this.config.economyZoneLimit
    );

    // Process entities in batches
    for (let i = 0; i < entities.length; i += this.config.batchSize) {
      const batch = entities.slice(i, Math.min(i + this.config.batchSize, entities.length));
      
      const interval = setInterval(async () => {
        if (!this.isInitialized) return;
        
        await this.processEntityBatch(batch, maxConcurrent);
      }, intervalMinutes * 60 * 1000);

      this.activeScrapers.set(`${tier}-batch-${Math.floor(i / this.config.batchSize)}`, interval);
      
      // Stagger batch start times to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
    }
  }

  private async processEntityBatch(entities: Entity[], maxConcurrent: number) {
    const batches = [];
    for (let i = 0; i < entities.length; i += maxConcurrent) {
      batches.push(entities.slice(i, i + maxConcurrent));
    }

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(entity => this.scrapeEntity(entity))
      );
      
      // Rate limiting between batches
      await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
    }
  }

  private async scrapeEntity(entity: Entity) {
    try {
      // Update last scraped time
      entity.lastScraped = new Date().toISOString();
      
      // Scrape based on entity type and alert types
      const scrapePromises = [];
      
      if (entity.alertTypes.includes('traffic')) {
        scrapePromises.push(this.scrapeEntityTraffic(entity));
      }
      
      if (entity.alertTypes.includes('hiring') && entity.careersUrl) {
        scrapePromises.push(this.scrapeEntityCareers(entity));
      }
      
      if (entity.alertTypes.includes('post') && entity.linkedinUrl) {
        scrapePromises.push(this.scrapeEntityLinkedIn(entity));
      }

      await Promise.allSettled(scrapePromises);
      
    } catch (error) {
      console.error(`Error scraping entity ${entity.name}:`, error);
    }
  }

  private async scrapeEntityTraffic(entity: Entity) {
    // Simulate traffic scraping
    const trafficChange = (Math.random() - 0.5) * 200; // -100% to +100%
    
    if (Math.abs(trafficChange) > 5) { // Only flag significant changes
      // Emit traffic alert
      console.log(`📈 Traffic alert for ${entity.name}: ${trafficChange.toFixed(1)}%`);
    }
  }

  private async scrapeEntityCareers(entity: Entity) {
    // Simulate job scraping
    const jobCount = Math.floor(Math.random() * 10);
    
    if (jobCount > 0) {
      // Emit hiring alert
      console.log(`💼 Hiring alert for ${entity.name}: ${jobCount} new jobs`);
    }
  }

  private async scrapeEntityLinkedIn(entity: Entity) {
    // Simulate LinkedIn scraping
    const activities = ['promotion', 'departure', 'post'];
    const activity = activities[Math.floor(Math.random() * activities.length)];
    
    // Emit LinkedIn alert
    console.log(`🔗 LinkedIn alert for ${entity.name}: ${activity}`);
  }

  // Public methods
  getEntitiesByTier(tier: string): Entity[] {
    return Array.from(this.entities.values()).filter(e => e.tier === tier && e.status === 'active');
  }

  getHistoricalRFPs(days?: number): HistoricalRFP[] {
    if (!days) return this.historicalRFPs;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.historicalRFPs.filter(rfp => new Date(rfp.published) > cutoffDate);
  }

  getScalingStats() {
    const stats = {
      totalEntities: this.entities.size,
      activeEntities: Array.from(this.entities.values()).filter(e => e.status === 'active').length,
      entitiesByTier: {
        golden: this.getEntitiesByTier('golden').length,
        standard: this.getEntitiesByTier('standard').length,
        economy: this.getEntitiesByTier('economy').length
      },
      historicalRFPs: this.historicalRFPs.length,
      activeScrapers: this.activeScrapers.size,
      config: this.config
    };

    return stats;
  }

  // Helper methods
  private getRandomSize(): Entity['size'] {
    const sizes: Entity['size'][] = ['startup', 'small', 'medium', 'large', 'enterprise'];
    return sizes[Math.floor(Math.random() * sizes.length)];
  }

  private determineTier(size: Entity['size'], randomFactor: number): Entity['tier'] {
    if (size === 'enterprise' || randomFactor > 0.9) return 'golden';
    if (size === 'large' || randomFactor > 0.6) return 'standard';
    return 'economy';
  }

  private calculatePriority(tier: Entity['tier'], size: Entity['size'], randomFactor: number): number {
    let base = tier === 'golden' ? 80 : tier === 'standard' ? 50 : 20;
    
    const sizeBonus = size === 'enterprise' ? 15 : size === 'large' ? 10 : size === 'medium' ? 5 : 0;
    const randomBonus = Math.floor(randomFactor * 10);
    
    return Math.min(100, base + sizeBonus + randomBonus);
  }

  private getScrapeInterval(tier: Entity['tier']): number {
    return tier === 'golden' ? 5 : tier === 'standard' ? 15 : 60;
  }

  private generateKeywords(industry: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'Technology': ['software', 'technology', 'digital', 'innovation'],
      'Sports': ['sports', 'football', 'soccer', 'athletics', 'club'],
      'Finance': ['finance', 'banking', 'financial', 'investment'],
      'Healthcare': ['healthcare', 'medical', 'health', 'pharmaceutical'],
      'Manufacturing': ['manufacturing', 'production', 'industrial'],
      'Retail': ['retail', 'shopping', 'commerce', 'sales'],
      'Energy': ['energy', 'power', 'renewable', 'sustainability'],
      'Education': ['education', 'learning', 'training', 'academic']
    };

    return keywordMap[industry] || ['business', 'company', 'corporate'];
  }

  private getRandomAlertTypes(): string[] {
    const allTypes = ['hiring', 'promotion', 'departure', 'post', 'traffic', 'job_listing', 'funding', 'expansion'];
    const count = Math.floor(Math.random() * 4) + 2; // 2-5 alert types
    return allTypes.sort(() => Math.random() - 0.5).slice(0, count);
  }

  private getEmployeeCount(size: Entity['size']): string {
    const counts = {
      startup: '1-10',
      small: '11-50',
      medium: '51-200',
      large: '201-1000',
      enterprise: '1000+'
    };
    return counts[size];
  }

  private getRevenue(size: Entity['size']): string {
    const revenues = {
      startup: '$<1M',
      small: '$1-10M',
      medium: '$10-100M',
      large: '$100M-1B',
      enterprise: '$1B+'
    };
    return revenues[size];
  }

  private getRandomLeagueLevel(): string {
    const levels = ['Premier League', 'Championship', 'League One', 'League Two', 'Non-League'];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  private generateRFPTitle(): string {
    const templates = [
      'Digital Transformation Partnership',
      'Cloud Migration Services',
      'Data Analytics Platform',
      'Cybersecurity Assessment',
      'Mobile App Development',
      'Website Redesign Project',
      'Marketing Services Contract',
      'Infrastructure Upgrade',
      'Staff Training Program',
      'Consulting Services Agreement'
    ];

    const organizations = ['City Council', 'Health Authority', 'University', 'Government Agency', 'School District', 'Hospital Trust'];
    
    return `${templates[Math.floor(Math.random() * templates.length)]} - ${organizations[Math.floor(Math.random() * organizations.length)]}`;
  }

  private getRandomOrganization(): string {
    const orgs = [
      'London Borough Council', 'NHS Trust', 'Ministry of Defence', 'University of Oxford',
      'Manchester City Council', 'BBC', 'Transport for London', 'British Airways',
      'HSBC Bank', 'BP Oil', 'Tesco plc', 'Vodafone Group', 'National Grid',
      'Network Rail', 'Royal Mail', 'Metropolitan Police', 'Fire Brigade'
    ];
    return orgs[Math.floor(Math.random() * orgs.length)];
  }

  private getRandomRFPType(): HistoricalRFP['type'] {
    const types: HistoricalRFP['type'][] = ['RFP', 'Tender', 'Contract', 'RFT'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private getRandomRFPSource(): string {
    const sources = ['LinkedIn', 'Find a Tender', 'Contracts Finder', 'TED Procurement', 'Official Journal', 'Direct Award'];
    return sources[Math.floor(Math.random() * sources.length)];
  }

  private getRandomDeadline(published: Date): string {
    const daysAhead = Math.floor(Math.random() * 90) + 7; // 7-97 days ahead
    const deadline = new Date(published);
    deadline.setDate(deadline.getDate() + daysAhead);
    return deadline.toISOString();
  }

  private getRandomValue(): string {
    const values = ['£50K-100K', '£100K-250K', '£250K-500K', '£500K-1M', '£1M-5M', '£5M+'];
    return values[Math.floor(Math.random() * values.length)];
  }

  private getRandomCategory(): string {
    const categories = ['Technology', 'Construction', 'Consulting', 'Marketing', 'Legal', 'Financial', 'Healthcare', 'Education'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  private generateRFPDescription(): string {
    const descriptions = [
      'Seeking experienced partner for comprehensive digital transformation initiative including cloud migration and modernization of legacy systems.',
      'Required expertise in data analytics and business intelligence to help drive data-driven decision making across the organization.',
      'Looking for cybersecurity specialist to conduct thorough security assessment and implement advanced threat protection measures.',
      'Need experienced web development team to design and build responsive, accessible website with modern UX/UI principles.',
      'Seeking marketing agency for brand development and multi-channel marketing campaign to increase market visibility.'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private getRandomLocation(): string {
    const locations = ['London, UK', 'Manchester, UK', 'Birmingham, UK', 'Edinburgh, Scotland', 'Cardiff, Wales', 'Belfast, NI'];
    return locations[Math.floor(Math.random() * locations.length)];
  }

  // Cleanup
  destroy() {
    this.activeScrapers.forEach(interval => clearInterval(interval));
    this.activeScrapers.clear();
    this.isInitialized = false;
  }
}

export const entityScalingManager = new EntityScalingManager();
export default EntityScalingManager;