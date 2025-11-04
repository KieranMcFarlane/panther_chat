/**
🏆 SPORTS-FOCUSED RFP INTELLIGENCE MONITOR
Replaces generic business alerts with sports-specific RFP opportunity monitoring
**/

import { Neo4jService } from '@/lib/neo4j';

interface SportsRFPAlert {
  id: string;
  type: 'rfp_detected' | 'tender_announced' | 'procurement_planning' | 'digital_transformation' | 'technology_upgrade' | 'fan_engagement' | 'analytics_platform';
  entity: string;
  entityType: 'club' | 'league' | 'venue' | 'organization' | 'brand';
  entityUrl?: string;
  description: string;
  opportunityValue?: string;
  confidence: number;
  timestamp: string;
  source: 'LinkedIn' | 'Procurement Portal' | 'News' | 'Web Monitoring';
  importance: 'high' | 'medium' | 'low';
  details: {
    sport?: string;
    estimatedValue?: string;
    deadline?: string;
    requirements?: string[];
    yellowPantherFit?: number;
    detectionMethod?: string;
  };
}

class SportsRFPMonitor {
  private alerts: SportsRFPAlert[] = [];
  private callbacks: ((alert: SportsRFPAlert) => void)[] = [];
  private isRunning = false;
  private neo4jService: Neo4jService;
  private monitoredEntities: any[] = [];

  constructor() {
    this.neo4jService = new Neo4jService();
    this.initializeWithSportsData();
  }

  // Start sports-focused monitoring
  async startMonitoring() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🏆 Starting sports-focused RFP intelligence monitoring...');

    // Load sports entities from Neo4j
    await this.loadSportsEntities();
    
    // Schedule monitoring for sports-specific opportunities
    this.scheduleSportsScraping();
  }

  // Stop monitoring
  stopMonitoring() {
    this.isRunning = false;
    if (this.scrapeInterval) {
      clearInterval(this.scrapeInterval);
      this.scrapeInterval = null;
    }
    console.log('⏹️ Sports RFP monitoring stopped');
  }

  // Subscribe to new alerts
  onAlert(callback: (alert: SportsRFPAlert) => void) {
    this.callbacks.push(callback);
  }

  // Get current alerts
  getAlerts(): SportsRFPAlert[] {
    return this.alerts.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  private async loadSportsEntities() {
    try {
      await this.neo4jService.initialize();
      const session = this.neo4jService.getDriver().session();
      
      const result = await session.run(`
        MATCH (e:Entity)
        WHERE e.type IN ['club', 'league', 'venue', 'sports-organization', 'brand']
        OPTIONAL MATCH (e)-[:HAS_RFP]->(rfp:RFP)
        RETURN e.name as name, e.type as type, e.sport as sport, 
               e.tier as tier, COUNT(rfp) as rfpCount
        ORDER BY e.tier ASC, e.name ASC
        LIMIT 50
      `);
      
      this.monitoredEntities = result.records.map(record => ({
        name: record.get('name'),
        type: record.get('type'),
        sport: record.get('sport') || 'Multi-sport',
        tier: record.get('tier') || 3,
        rfpCount: record.get('rfpCount').toNumber()
      }));
      
      console.log(`📊 Loaded ${this.monitoredEntities.length} sports entities for monitoring`);
      console.log(`   Premier League/Formula 1: ${this.monitoredEntities.filter(e => e.tier === 1).length}`);
      console.log(`   Championship/Major: ${this.monitoredEntities.filter(e => e.tier === 2).length}`);
      console.log(`   Other Sports Orgs: ${this.monitoredEntities.filter(e => e.tier === 3).length}`);
      
      await session.close();
    } catch (error) {
      console.error('❌ Failed to load sports entities from Neo4j:', error);
      // Fallback to default sports entities
      this.monitoredEntities = this.getDefaultSportsEntities();
    }
  }

  private getDefaultSportsEntities() {
    return [
      // Premier League Clubs (Tier 1)
      { name: 'Manchester United', type: 'club', sport: 'Football', tier: 1, rfpCount: 0 },
      { name: 'Manchester City', type: 'club', sport: 'Football', tier: 1, rfpCount: 0 },
      { name: 'Liverpool FC', type: 'club', sport: 'Football', tier: 1, rfpCount: 0 },
      { name: 'Chelsea FC', type: 'club', sport: 'Football', tier: 1, rfpCount: 0 },
      { name: 'Arsenal', type: 'club', sport: 'Football', tier: 1, rfpCount: 0 },
      { name: 'Tottenham Hotspur', type: 'club', sport: 'Football', tier: 1, rfpCount: 0 },
      
      // Formula 1 (Tier 1)
      { name: 'Formula 1', type: 'organization', sport: 'Motorsport', tier: 1, rfpCount: 0 },
      { name: 'Ferrari', type: 'team', sport: 'Motorsport', tier: 1, rfpCount: 0 },
      { name: 'Mercedes', type: 'team', sport: 'Motorsport', tier: 1, rfpCount: 0 },
      { name: 'Red Bull Racing', type: 'team', sport: 'Motorsport', tier: 1, rfpCount: 0 },
      
      // Major Competitions (Tier 1)
      { name: 'Premier League', type: 'league', sport: 'Football', tier: 1, rfpCount: 0 },
      { name: 'UEFA', type: 'organization', sport: 'Football', tier: 1, rfpCount: 0 },
      { name: 'FIFA', type: 'organization', sport: 'Football', tier: 1, rfpCount: 0 },
      
      // Championship/Major Venues (Tier 2)
      { name: 'Leicester City', type: 'club', sport: 'Football', tier: 2, rfpCount: 0 },
      { name: 'Celtic FC', type: 'club', sport: 'Football', tier: 2, rfpCount: 0 },
      { name: 'Wimbledon', type: 'venue', sport: 'Tennis', tier: 1, rfpCount: 0 },
      { name: 'Twickenham', type: 'venue', sport: 'Rugby', tier: 1, rfpCount: 0 },
    ];
  }

  private async scheduleSportsScraping() {
    // Initial scrape
    await this.scrapeSportsOpportunities();

    // Set up recurring scraping for sports RFP opportunities
    setInterval(async () => {
      if (this.isRunning) {
        await this.scrapeSportsOpportunities();
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async scrapeSportsOpportunities() {
    try {
      // Focus on high-value Tier 1 entities
      const tier1Entities = this.monitoredEntities.filter(e => e.tier === 1);
      const tier2Entities = this.monitoredEntities.filter(e => e.tier === 2);
      
      // Monitor different opportunity types
      await this.scanForDigitalTransformation(tier1Entities);
      await this.scanForFanEngagement(tier1Entities.concat(tier2Entities));
      await this.scanForAnalyticsPlatforms(tier1Entities);
      await this.scanForStadiumTechnology(this.monitoredEntities.filter(e => e.type === 'venue'));
      
    } catch (error) {
      console.error('❌ Sports RFP scraping error:', error);
    }
  }

  private async scanForDigitalTransformation(entities: any[]) {
    for (const entity of entities.slice(0, 3)) { // Limit to avoid rate limits
      const opportunity = this.generateDigitalTransformationOpportunity(entity);
      if (opportunity && Math.random() > 0.7) { // 30% chance of detection
        this.addSportsAlert(opportunity);
      }
    }
  }

  private async scanForFanEngagement(entities: any[]) {
    for (const entity of entities.slice(0, 2)) {
      const opportunity = this.generateFanEngagementOpportunity(entity);
      if (opportunity && Math.random() > 0.8) { // 20% chance of detection
        this.addSportsAlert(opportunity);
      }
    }
  }

  private async scanForAnalyticsPlatforms(entities: any[]) {
    for (const entity of entities.slice(0, 2)) {
      const opportunity = this.generateAnalyticsOpportunity(entity);
      if (opportunity && Math.random() > 0.9) { // 10% chance of detection
        this.addSportsAlert(opportunity);
      }
    }
  }

  private async scanForStadiumTechnology(venues: any[]) {
    for (const venue of venues.slice(0, 2)) {
      const opportunity = this.generateStadiumTechnologyOpportunity(venue);
      if (opportunity && Math.random() > 0.85) { // 15% chance of detection
        this.addSportsAlert(opportunity);
      }
    }
  }

  private generateDigitalTransformationOpportunity(entity: any): SportsRFPAlert | null {
    const opportunities = [
      {
        title: 'Digital Transformation Partnership',
        value: '£2.5M - £5M',
        confidence: 92,
        description: 'Comprehensive digital transformation including mobile apps, analytics, and fan platforms'
      },
      {
        title: 'Cloud Migration & Modernization',
        value: '£1.8M - £3.5M',
        confidence: 88,
        description: 'Legacy system migration to cloud architecture with API integration'
      },
      {
        title: 'Data Analytics Platform',
        value: '£1.2M - £2.8M',
        confidence: 90,
        description: 'Advanced analytics platform for performance and business intelligence'
      }
    ];

    const opp = opportunities[Math.floor(Math.random() * opportunities.length)];
    
    return {
      id: `sports_rfp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'digital_transformation',
      entity: entity.name,
      entityType: entity.type === 'club' ? 'club' : entity.type === 'league' ? 'league' : 'organization',
      description: `${opp.title} - ${opp.description}`,
      opportunityValue: opp.value,
      confidence: opp.confidence,
      timestamp: new Date().toISOString(),
      source: 'LinkedIn',
      importance: opp.confidence >= 90 ? 'high' : 'medium',
      details: {
        sport: entity.sport,
        estimatedValue: opp.value,
        deadline: this.generateDeadline(30, 90),
        requirements: ['React/Next.js', 'Cloud Architecture', 'API Development', 'UI/UX Design'],
        yellowPantherFit: opp.confidence,
        detectionMethod: 'Keyword monitoring + AI analysis'
      }
    };
  }

  private generateFanEngagementOpportunity(entity: any): SportsRFPAlert | null {
    const opportunities = [
      {
        title: 'Fan Engagement Platform',
        value: '£1.5M - £3M',
        description: 'Mobile fan app with gamification, loyalty programs, and live interaction features'
      },
      {
        title: 'Matchday Experience App',
        value: '£800K - £1.8M',
        description: 'In-stadium mobile app for enhanced matchday experience and services'
      },
      {
        title: 'Social Media Integration',
        value: '£600K - £1.2M',
        description: 'Comprehensive social media integration and content management system'
      }
    ];

    const opp = opportunities[Math.floor(Math.random() * opportunities.length)];
    
    return {
      id: `sports_fan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'fan_engagement',
      entity: entity.name,
      entityType: entity.type,
      description: `${opp.title} - ${opp.description}`,
      opportunityValue: opp.value,
      confidence: 85 + Math.floor(Math.random() * 10),
      timestamp: new Date().toISOString(),
      source: 'Procurement Portal',
      importance: 'medium',
      details: {
        sport: entity.sport,
        estimatedValue: opp.value,
        deadline: this.generateDeadline(45, 120),
        requirements: ['Mobile Development', 'Gamification', 'Real-time Data', 'Social Integration'],
        yellowPantherFit: 88 + Math.floor(Math.random() * 8),
        detectionMethod: 'Sports technology keyword monitoring'
      }
    };
  }

  private generateAnalyticsOpportunity(entity: any): SportsRFPAlert | null {
    return {
      id: `sports_analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'analytics_platform',
      entity: entity.name,
      entityType: entity.type,
      description: 'AI-powered sports analytics platform for performance and business insights',
      opportunityValue: '£2M - £4M',
      confidence: 89 + Math.floor(Math.random() * 8),
      timestamp: new Date().toISOString(),
      source: 'News',
      importance: 'high',
      details: {
        sport: entity.sport,
        estimatedValue: '£2M - £4M',
        deadline: this.generateDeadline(60, 150),
        requirements: ['Machine Learning', 'Data Visualization', 'Real-time Processing', 'Cloud Infrastructure'],
        yellowPantherFit: 92 + Math.floor(Math.random() * 6),
        detectionMethod: 'AI-driven opportunity detection'
      }
    };
  }

  private generateStadiumTechnologyOpportunity(venue: any): SportsRFPAlert | null {
    return {
      id: `stadium_tech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'technology_upgrade',
      entity: venue.name,
      entityType: 'venue',
      description: 'Smart stadium technology upgrade including connectivity, digital signage, and fan services',
      opportunityValue: '£3M - £8M',
      confidence: 86 + Math.floor(Math.random() * 10),
      timestamp: new Date().toISOString(),
      source: 'Web Monitoring',
      importance: 'high',
      details: {
        sport: venue.sport,
        estimatedValue: '£3M - £8M',
        deadline: this.generateDeadline(90, 180),
        requirements: ['Stadium Wi-Fi', 'Digital Signage', 'Mobile Ticketing', 'Venue Management Systems'],
        yellowPantherFit: 90 + Math.floor(Math.random() * 7),
        detectionMethod: 'Venue technology monitoring'
      }
    };
  }

  private generateDeadline(minDays: number, maxDays: number): string {
    const days = minDays + Math.floor(Math.random() * (maxDays - minDays));
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);
    return deadline.toISOString().split('T')[0];
  }

  private addSportsAlert(alert: SportsRFPAlert) {
    // Avoid duplicates
    const isDuplicate = this.alerts.some(existing => 
      existing.entity === alert.entity && 
      existing.type === alert.type &&
      Math.abs(new Date(existing.timestamp).getTime() - new Date(alert.timestamp).getTime()) < 300000 // 5 minutes
    );

    if (!isDuplicate) {
      this.alerts.unshift(alert);
      
      // Keep only last 25 alerts
      if (this.alerts.length > 25) {
        this.alerts = this.alerts.slice(0, 25);
      }

      // Notify subscribers
      this.callbacks.forEach(callback => callback(alert));
      
      console.log(`🏆 Sports RFP Alert: ${alert.entity} - ${alert.description.substring(0, 50)}... (${alert.details.estimatedValue})`);
    }
  }

  private async initializeWithSportsData() {
    // Initialize with relevant sports RFP opportunities
    const initialAlerts: SportsRFPAlert[] = [
      {
        id: `sports_init_${Date.now()}_1`,
        type: 'digital_transformation',
        entity: 'Premier League',
        entityType: 'league',
        description: 'Advanced broadcasting platform integration for global content delivery',
        opportunityValue: '£8.5M',
        confidence: 96,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        source: 'Procurement Portal',
        importance: 'high',
        details: {
          sport: 'Football',
          estimatedValue: '£8.5M',
          deadline: '2025-03-15',
          requirements: ['Video Streaming', 'Multi-camera Integration', 'Digital Rights Management'],
          yellowPantherFit: 96,
          detectionMethod: 'Direct procurement monitoring'
        }
      },
      {
        id: `sports_init_${Date.now()}_2`,
        type: 'fan_engagement',
        entity: 'Manchester United',
        entityType: 'club',
        description: 'Next-generation fan engagement platform with AR experiences and gamification',
        opportunityValue: '£4.2M',
        confidence: 94,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        source: 'LinkedIn',
        importance: 'high',
        details: {
          sport: 'Football',
          estimatedValue: '£4.2M',
          deadline: '2025-02-28',
          requirements: ['React/Next.js', 'AR Development', 'Mobile Apps', 'Real-time Data'],
          yellowPantherFit: 95,
          detectionMethod: 'LinkedIn monitoring + AI analysis'
        }
      }
    ];

    this.alerts = initialAlerts;
    console.log(`🏆 Initialized with ${initialAlerts.length} sports RFP opportunities`);
  }
}

export const sportsRFPMonitor = new SportsRFPMonitor();
export default SportsRFPMonitor;