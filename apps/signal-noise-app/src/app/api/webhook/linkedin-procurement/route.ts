import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * LinkedIn Procurement Webhook Handler
 * Integrates BrightData LinkedIn monitoring with Yellow Panther RFP detection
 */

interface BrightDataWebhookPayload {
  webhook_id: string;
  site_name: string;
  page_url: string;
  page_title: string;
  content: string;
  meta: {
    author?: string;
    company?: string;
    role?: string;
    post_id?: string;
    hashtags?: string[];
    mentions?: string[];
    engagement_count?: number;
  };
  extracted_at: string;
  signals: string[];
}

interface LinkedInPost {
  post_id: string;
  author_name: string;
  author_company: string;
  author_role: string;
  content: string;
  published_at: Date;
  engagement_count: number;
  url: string;
  hashtags: string[];
  mentions: string[];
}

interface ProcurementSignal {
  source_post: LinkedInPost;
  signal_type: string;
  sport_type: string;
  estimated_value?: string;
  urgency_level: string;
  confidence_score: number;
  organization_name: string;
  contact_person?: string;
  deadline?: Date;
  requirements: string[];
}

class LinkedInProcurementDetector {
  private readonly PROCUREMENT_KEYWORDS = [
    'request for proposal', 'rfp', 'tender', 'procurement', 'vendor selection',
    'digital transformation', 'technology upgrade', 'software implementation',
    'consultancy services', 'professional services', 'implementation partner',
    'system integrator', 'digital strategy', 'technology adoption'
  ];

  private readonly SPORTS_KEYWORDS = [
    'football', 'soccer', 'rugby', 'cricket', 'tennis', 'basketball', 'golf',
    'stadium', 'arena', 'club', 'team', 'federation', 'league', 'sports',
    'premier league', 'championship', 'world cup', 'season'
  ];

  private readonly VALUE_INDICATORS = [
    'million', 'm': '£', '$', 'investment', 'budget', 'million pounds',
    'large scale', 'enterprise', 'major', 'significant'
  ];

  private readonly URGENCY_KEYWORDS = {
    'CRITICAL': ['urgent', 'deadline', 'immediately', 'asap', 'critical', 'pressing'],
    'HIGH': ['soon', 'quickly', 'priority', 'important', 'fast track'],
    'MEDIUM': ['looking for', 'interested in', 'seeking', 'evaluating'],
    'LOW': ['considering', 'planning', 'future', 'exploring', 'researching']
  };

  detectProcurementSignals(post: LinkedInPost): ProcurementSignal[] {
    const signals: ProcurementSignal[] = [];
    const contentLower = post.content.toLowerCase();
    
    // Check for procurement + sports combination
    const hasProcurement = this.PROCUREMENT_KEYWORDS.some(keyword => 
      contentLower.includes(keyword)
    );
    const hasSports = this.SPORTS_KEYWORDS.some(keyword => 
      contentLower.includes(keyword)
    );
    
    if (!hasProcurement || !hasSports) {
      return signals;
    }
    
    // Analyze content for procurement signals
    const signalType = this.determineSignalType(contentLower, post.author_role);
    const sportType = this.extractSportType(contentLower, post.content);
    const urgency = this.assessUrgency(contentLower);
    const confidence = this.calculateConfidence(post, contentLower);
    
    if (confidence < 0.6) { // Minimum confidence threshold
      return signals;
    }
    
    // Estimate value if possible
    const estimatedValue = this.estimateValue(contentLower, post.author_company);
    
    // Extract organization and contact details
    const organizationName = post.author_company || this.extractOrganization(contentLower);
    const contactPerson = post.author_name;
    const deadline = this.extractDeadline(contentLower);
    const requirements = this.extractRequirements(contentLower);
    
    signals.push({
      source_post: post,
      signal_type: signalType,
      sport_type: sportType,
      estimated_value: estimatedValue,
      urgency_level: urgency,
      confidence_score: confidence,
      organization_name: organizationName,
      contact_person: contactPerson,
      deadline,
      requirements
    });
    
    return signals;
  }

  private determineSignalType(content: string, authorRole: string): string {
    if (content.includes('rfp') || content.includes('request for proposal')) {
      return 'rfp_announced';
    }
    if (this.containsAnyWord(content, ['hiring', 'recruiting', 'role', 'position'])) {
      return 'procurement_team_hiring';
    }
    return 'vendor_soliciting';
  }

  private extractSportType(content: string, fullContent: string): string {
    const sportMapping = {
      'football': ['football', 'soccer', 'premier league', 'championship'],
      'rugby': ['rugby', 'six nations', 'premiership rugby'],
      'cricket': ['cricket', 'pending', 't20'],
      'tennis': ['tennis', 'wimbledon', 'roland garros'],
      'basketball': ['basketball', 'nba'],
      'golf': ['golf', 'pga', 'european tour']
    };

    for (const [sport, keywords] of Object.entries(sportMapping)) {
      if (this.containsAnyWord(content, keywords)) {
        return sport;
      }
    }

    return 'multi-sport';
  }

  private assessUrgency(content: string): string {
    for (const [urgency, keywords] of Object.entries(this.URGENCY_KEYWORDS)) {
      if (this.containsAnyWord(content, keywords)) {
        return urgency;
      }
    }
    return 'MEDIUM';
  }

  private calculateConfidence(post: LinkedInPost, content: string): number {
    let confidence = 0.0;

    // Author credibility factors (0.3 weight)
    if (post.author_role) {
      const credibleRoles = ['procurement', 'it', 'operations', 'director', 'manager'];
      if (credibleRoles.some(role => post.author_role.toLowerCase().includes(role))) {
        confidence += 0.3;
      }
    }

    // Content indicators (0.3 weight)
    const procurementCount = this.PROCUREMENT_KEYWORDS.filter(keyword => 
      content.includes(keyword)
    ).length;
    confidence += Math.min(0.3, procurementCount * 0.1);

    // Engagement indicators (0.2 weight)
    if (post.engagement_count > 50) {
      confidence += 0.2;
    }

    // Company size indicators (0.2 weight)
    if (this.VALUE_INDICATORS.some(indicator => content.includes(indicator))) {
      confidence += 0.2;
    }

    return Math.min(1.0, confidence);
  }

  private estimateValue(content: string, company: string): string | undefined {
    if (content.includes('million')) {
      if (content.includes('2m') || content.includes('../images/two million')) {
        return '£2M';
      } else if (content.includes('1m') || content.includes('one million')) {
        return '../images/tom';
      } else {
        return '../images/tom-£2M';
      }
    }

    // Default ranges based on company type
    if (company.toLowerCase().includes('large') || 
        company.toLowerCase().includes('enterprise') ||
        company.toLowerCase().includes('corporate')) {
      return '../images/tom-£1M';
    }
    if (company.toLowerCase().includes('group') || 
        company.toLowerCase().includes('holding')) {
      return '../images/tom-£2M';
    }

    return '../images/tok-£500K';
  }

  private extractOrganization(content: string): string {
    const orgIndicators = ['at', 'from', '@'];
    for (const indicator of orgIndicators) {
      if (content.includes(indicator)) {
        const parts = content.split(indicator);
        if (parts.length > 1) {
          const possibleOrg = parts[1].split(' ').slice(0, 3);
          if (possibleOrg.length > 0) {
            return possibleOrg.join(' ');
          }
        }
      }
    }
    return 'Unknown Organization';
  }

  private extractDeadline(content: string): Date | undefined {
    const deadlineKeywords = ['deadline', 'due date', 'submission', 'by'];
    for (const keyword of deadlineKeywords) {
      if (content.includes(keyword)) {
        // This would be enhanced with date parsing
        // For now, return undefined - requires actual implementation
        return undefined;
      }
    }
    return undefined;
  }

  private extractRequirements(content: string): string[] {
    const techKeywords = [
      'cloud', 'saas', 'api', 'integration', 'analytics', 'dashboard',
      'mobile', 'web', 'database', 'security', 'compliance', 'ai', 'ml'
    ];

    return techKeywords.filter(keyword => content.includes(keyword)).slice(0, 5);
  }

  private containsAnyWord(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }
}

class RFPTargetingService {
  private readonly YELLOW_PANTHER_CAPABILITIES = [
    'digital transformation', 'data analytics', 'dashboard development',
    'api integration', 'cloud migration', 'mobile applications',
    'business intelligence', 'automated reporting', 'performance analytics'
  ];

  assessYellowPantherFit(signal: ProcurementSignal): {
    fit_score: number;
    priority: string;
    match_factors: string[];
    recommendation: string;
  } {
    let fitScore = 0;
    const matchFactors: string[] = [];

    // Sport type alignment (20 points)
    if (['football', 'rugby', 'cricket', 'multi-sport'].includes(signal.sport_type)) {
      fitScore += 20;
      matchFactors.push('Strong sports industry alignment');
    }

    // Capability matching (30 points)
    const capabilityMatches = signal.requirements.filter(req =>
      this.YELLOW_PANTHER_CAPABILITIES.some(cap => cap.includes(req))
    ).length;

    if (capabilityMatches > 0) {
      fitScore += Math.min(30, capabilityMatches * 10);
      matchFactors.push(`${capabilityMatches} capability overlaps`);
    }

    // Value range alignment (25 points)
    if (signal.estimated_value && signal.estimated_value.includes('M')) {
      fitscore += 25;
      matchFactors.push('High-value opportunity');
    } else if (signal.estimated_value && signal.estimated_value.includes('K')) {
      fitScore += 15;
      matchFactors.push('Mid-range opportunity');
    }

    // Urgency factor (15 points)
    if (signal.urgency_level === 'CRITICAL') {
      fitScore += 15;
      matchFactors.push('High urgency - immediate attention needed');
    } else if (signal.urgency_level === 'HIGH') {
      fitScore += 10;
      matchFactors.push('Time-sensitive opportunity');
    }

    // Confidence factor (10 points)
    fitScore += signal.confidence_score * 10;

    return {
      fit_score: Math.min(100, fitScore),
      priority: fitScore >= 70 ? 'HIGH' : fitScore >= 50 ? 'MEDIUM' : 'LOW',
      match_factors: matchFactors,
      recommendation: this.getRecommendation(fitScore)
    };
  }

  private getRecommendation(fitScore: number): string {
    if (fitScore >= 80) {
      return 'Systematic & comprehensive proposal';
        } else if (fitScore >= 60) {
          return 'Proactive outreach with capability brief';
        } else if (fitScore >= 40) {
          return 'Monitor & engage when appropriate';
        } else {
          return 'Archive - not aligned with capabilities';
        }
      }
}

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function isLinkedInContent(data: BrightDataWebhookPayload): boolean {
  return (
    data.page_url.includes('linkedin.com') ||
    data.page_title.includes('LinkedIn') ||
    data.site_name === 'linkedin'
      );
}

function convertToLinkedInPost(data: BrightDataWebhookPayload): LinkedInPost {
  // Extract author information from meta data
  const authorName = data.meta.author || 'Unknown';
  const authorCompany = data.meta.company || '';
  const authorRole = data.meta.role || '';
  
  // Extract engagement metrics
  const engagementCount = data.meta.engagement_count || 0;
  
  // Extract hashtags and mentions
  const hashtags = data.meta.hashtags || [];
  const mentions = data.meta.mentions || [];
  
  return {
    post_id: data.meta.post_id || `linkedin_${Date.now()}`,
    author_name: authorName,
    author_company: authorCompany,
    author_role: authorRole,
    content: data.content,
    published_at: new Date(data.extracted_at),
    engagement_count: engagementCount,
    url: data.page_url,
    hashtags,
    mentions
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const payload = await request.text();
    const signature = request.headers.get('X-Brightdata-Signature') || '';
    const secret = process.env.BRIGHTDATA_WEBHOOK_SECRET || '';
    
    if (!verifyWebhookSignature(payload, signature, secret)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const webhookData: BrightDataWebhookPayload = JSON.parse(payload);

    // Validate LinkedIn content
    if (!isLinkedInContent(webhookData)) {
      return NextResponse.json({
        status: 'ignored',
        reason: 'Not LinkedIn content'
      });
    }

    // Convert to LinkedIn post
    const linkedinPost = convertToLinkedInPost(webhookData);

    // Initialize detectors
    const detector = new LinkedInProcurementDetector();
    const targetingService = new RFPTargetingService();

    // Detect procurement signals
    const signals = detector.detectProcurementSignals(linkedinPost);

    if (signals.length === 0) {
      return NextResponse.json({
        status: 'no_signals',
        message: 'No procurement signals detected'
      });
    }

    // Process each signal
    const processedSignals = [];
    
    for (const signal of signals) {
      // Assess Yellow Panther fit
      const targetingAssessment = targetingService.assessYellowPantherFit(signal);

      // Only process high/medium priority signals
      if (['HIGH', 'MEDIUM'].includes(targetingAssessment.priority)) {
        
        // Create RFP record
        const rfpData = {
          id: `webhook_${signal.source_post.post_id}_${new Date().toISOString().split('T')[0]}`,
          title: `${signal.signal_type.replace('_', ' ')} - ${signal.sport_type}`,
          organization: signal.organization_name,
          sport: signal.sport_type,
          procurement_type: 'Digital Services',
          description: signal.source_post.content.substring(0, 500) + '...',
          deadline: signal.deadline?.toISOString(),
          value_estimate: signal.estimated_value || '../images/tok-£500K',
          opportunity_score: targetingAssessment.fit_score,
          priority_level: signal.urgency_level,
          status: 'DISCOVERED',
          requirements: signal.requirements,
          urgency: signal.urgency_level,
          contact_info: {
            name: signal.contact_person,
            email: 'search_required',
            organization: signal.organization_name,
            department: 'Digital Services'
          },
          yellow_panther_fit: targetingAssessment.fit_score,
          source: 'webhook_linkedin',
          discovered_at: new Date().toISOString(),
          confidence_score: signal.confidence_score,
          webhook_source: {
            post_url: signal.source_post.url,
            author: signal.source_post.author_name,
            detection_method: 'brighdata_webhook'
          }
        };

        // Store in Neo4j Knowledge Graph
        try {
          const neo4jResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/mcp/neo4j`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operation: 'createRFPNodes',
              data: [rfpData]
            })
          });

          if (neo4jResponse.ok) {
            console.log(`✅ Stored RFP in Neo4j: ${signal.organization_name}`);
          }
        } catch (neo4jError) {
          console.error('Neo4j storage error:', neo4jError);
        }

        // Send real-time notification
        if (targetingAssessment.priority === 'HIGH') {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/notifications/rfp-detected`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'rfp_detected',
              priority: 'HIGH',
              organization: signal.organization_name,
              fit_score: targetingAssessment.fit_score,
              estimated_value: signal.estimated_value,
              urgency: signal.urgency_level,
              recommendation: targetingAssessment.recommendation,
              post_url: signal.source_post.url,
              detected_at: new Date().toISOString()
            })
          });
        }

        processedSignals.push({
          signal,
          assessment: targetingAssessment,
          rfp_data: rfpData
        });

        console.log(`🔍 HIGH PRIORITY RFP DETECTED: ${signal.organization_name} (Score: ${targetingAssessment.fit_score})`);
      }
    }

    return NextResponse.json({
      status: 'success',
      signals_detected: signals.length,
      signals_processed: processedSignals.length,
      processed_signals: processedSignals.map(ps => ({
        organization: ps.signal.organization_name,
        sport: ps.signal.sport_type,
        priority: ps.assessment.priority,
        fit_score: ps.assessment.fit_score
      }))
    });

  } catch (error) {
    console.error('LinkedIn procurement webhook error:', error);
    return NextResponse.json(
      { error: 'Internal processing error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'LinkedIn Procurement Webhook Handler',
    timestamp: new Date().toISOString()
  });
}
